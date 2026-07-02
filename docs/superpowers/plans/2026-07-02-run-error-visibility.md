# Fehler-Sichtbarkeit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der Lauf-Owner sieht bei Fehlern den konkreten Grund — live während des Laufs (letzte fehlgeschlagene Wiederholung) und auf der Ergebnis-Seite (aggregiert nach Fehlertext) — inkl. des echten Upstream-Provider-Fehlers statt nur des HTTP-Status.

**Architecture:** Zwei neue reine Helfer (`extractUpstreamError`, `summarizeFailures`), rein additive DTO-Felder (`RunResultView.failures`, `RunProgress.lastRepError`). Der Fehler wird bereits pro Rep persistiert (`run_repetitions.error`) — dieser Plan reicht ihn nur nach vorne durch. Keine Migration, keine Verhaltensänderung an bestehenden Pfaden.

**Tech Stack:** Astro 6 SSR, React 19, TypeScript, Supabase (Postgres), zod, Vitest (Node-Env Unit + `.itest.ts` Integration).

## Global Constraints

- Reine Helfer ohne I/O → Node-Vitest-testbar; Business-Logik in `src/lib/`.
- DTO-Schemas in `src/lib/runs/run-schemas.ts` bleiben **non-strict** (`z.object`, nie `.strict()`). Ein additives Feld, das der Client konsumiert, MUSS trotzdem ins Schema, sonst strippt `safeParse` es weg.
- `RunView`/`RunProgress` sind `z.infer` aus den Schemas (Single Source); `@/types` re-exportiert sie. Enum-Werte `status`/`visibility` NICHT anfassen (Compile-Guard in `types.ts`).
- Leak-Invariante (`openai-compatible.ts:9`): Fehler tragen nie Key-Material/Header — nur der `error.message`-String des Providers, gekappt auf **200 Zeichen**.
- UI-Farben nur über semantische Tokens (`text-destructive`, `text-foreground`, `text-muted-foreground`, `border-destructive/30`, `bg-destructive/10`) — keine Farb-Literale.
- Commits: Conventional Commits; Pre-Commit-Hooks (husky/lint-staged) laufen automatisch (eslint --fix, prettier). CRLF-`Delete ␍`-Lint-Hinweise ignorieren — husky fixt sie beim Commit.
- Unit-Tests: `npm run test` (Vitest, Node-Env, `src/**/*.test.ts`). Integration: `npm run test:integration` (`src/**/*.itest.ts`, braucht lokales Supabase via Docker).
- **Kein Push in diesem Plan** — Push auf `main` deployt Prod. Nur lokale Commits; Deploy separat mit User-Go.

---

### Task 1: Teil B — `extractUpstreamError` + Wiring in `chatCompletion`

**Files:**

- Modify: `src/lib/llm/openai-compatible.ts` (Helfer exportieren + an den beiden Fehler-Stellen anhängen)
- Test: `src/lib/llm/openai-compatible.test.ts` (bestehende Datei erweitern)

**Interfaces:**

- Consumes: bestehendes `asRecord` (`openai-compatible.ts:42`) und `chatCompletion`.
- Produces: `extractUpstreamError(bodyText: string): string | null` (exportiert); `chatCompletion` hängt bei nicht-ok-Antworten den Upstream-`error.message` an den geworfenen Fehler an.

- [ ] **Step 1: Failing tests schreiben**

In `src/lib/llm/openai-compatible.test.ts` den Import erweitern und am Dateiende zwei `describe`-Blöcke anhängen. Import-Zeile (heute `import { chatCompletion, isZaiEndpoint } from "./openai-compatible";`) ersetzen durch:

```ts
import { chatCompletion, extractUpstreamError, isZaiEndpoint } from "./openai-compatible";
```

Am Dateiende anhängen:

```ts
describe("extractUpstreamError", () => {
  it("zieht error.message aus dem Upstream-Body", () => {
    expect(extractUpstreamError('{"error":{"message":"insufficient balance"}}')).toBe("insufficient balance");
  });

  it("akzeptiert error als flachen String", () => {
    expect(extractUpstreamError('{"error":"rate limited"}')).toBe("rate limited");
  });

  it("gibt null bei fehlendem Feld oder Nicht-JSON", () => {
    expect(extractUpstreamError("{}")).toBeNull();
    expect(extractUpstreamError("not json")).toBeNull();
    expect(extractUpstreamError('{"error":{}}')).toBeNull();
  });

  it("kappt auf 200 Zeichen (plus Ellipsis)", () => {
    const long = "x".repeat(300);
    const out = extractUpstreamError(JSON.stringify({ error: { message: long } }));
    expect(out).toHaveLength(201);
    expect(out?.endsWith("…")).toBe(true);
  });
});

describe("chatCompletion — Upstream-Fehlertext", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Stubt fetch mit einem festen Status + JSON-Body (als text() lesbar). */
  function stubFetchStatus(status: number, body: unknown): void {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: status >= 200 && status < 300,
          status,
          type: "basic",
          text: () => Promise.resolve(JSON.stringify(body)),
          json: () => Promise.resolve(body),
        } as unknown as Response),
      ),
    );
  }

  // baseUrl OpenAI + jsonMode weglassen → 400 fällt direkt auf den !res.ok-Wurf
  // (kein 429-Retry-Backoff, kein jsonMode-off-Retry) → schneller, deterministischer Test.
  const baseArgs = {
    apiKey: "k",
    model: "gpt-4o-mini",
    messages: [{ role: "user" as const, content: "hi" }],
    baseUrl: "https://api.openai.com/v1",
  };

  it("hängt den Upstream-error.message an den geworfenen Fehler an", async () => {
    stubFetchStatus(400, { error: { message: "insufficient balance" } });
    await expect(chatCompletion(baseArgs)).rejects.toThrow("insufficient balance");
  });

  it("bleibt beim generischen Text, wenn kein message im Body steht", async () => {
    stubFetchStatus(400, {});
    await expect(chatCompletion(baseArgs)).rejects.toThrow("endpoint returned status 400");
  });
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag verifizieren**

Run: `npm run test -- src/lib/llm/openai-compatible.test.ts`
Expected: FAIL — `extractUpstreamError` ist nicht exportiert (Import bricht) bzw. der geworfene Fehler enthält „insufficient balance" noch nicht.

- [ ] **Step 3: Helfer implementieren**

In `src/lib/llm/openai-compatible.ts` direkt nach dem `asRecord`-Helfer (heute `:42-44`) einfügen:

```ts
/**
 * Zieht die menschenlesbare Fehlermeldung aus einem Upstream-Error-Body
 * (OpenAI/z.ai-Format `{ error: { message } }`), defensiv geparst und auf 200
 * Zeichen gekappt. Gibt null, wenn nichts Brauchbares drinsteht. Übernimmt NUR
 * den message-String (kein Header, kein Key, kein Body-Rest) — Leak-Invariante bleibt.
 */
export function extractUpstreamError(bodyText: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return null;
  }
  const errorField = asRecord(parsed)?.error;
  const errRec = asRecord(errorField);
  let message: string | null = null;
  if (errRec && typeof errRec.message === "string") {
    message = errRec.message;
  } else if (typeof errorField === "string") {
    message = errorField;
  }
  const trimmed = message?.trim() ?? "";
  if (trimmed.length === 0) return null;
  return trimmed.length > 200 ? `${trimmed.slice(0, 200)}…` : trimmed;
}
```

- [ ] **Step 4: Wiring an den beiden Fehler-Stellen**

In `chatCompletion` den retrybaren Block (heute `:171-180`) so ergänzen, dass der Body gelesen und angehängt wird:

```ts
// Retrybare Upstream-Fehler.
if (res.status === 429 || res.status >= 500) {
  cancel();
  lastError = `endpoint returned status ${res.status}`;
  const upstream = extractUpstreamError(await res.text().catch(() => ""));
  if (upstream) lastError = `${lastError}: ${upstream}`;
  if (attempt < MAX_ATTEMPTS) {
    await backoff(attempt, args.signal);
    continue;
  }
  throw new Error(lastError);
}
```

Und den nicht-retrybaren `!res.ok`-Block (heute `:182-185`) ersetzen durch:

```ts
if (!res.ok) {
  cancel();
  let message = `endpoint returned status ${res.status}`;
  const upstream = extractUpstreamError(await res.text().catch(() => ""));
  if (upstream) message = `${message}: ${upstream}`;
  throw new Error(message);
}
```

Der jsonMode-400/422-Toleranz-Block (`:165`) bleibt unangetastet (er `continue`t vor diesen Stellen), ebenso der Netzwerk-catch (`:147`, hat keine Response → kein Body).

- [ ] **Step 5: Test ausführen, Erfolg verifizieren**

Run: `npm run test -- src/lib/llm/openai-compatible.test.ts`
Expected: PASS (alle bisherigen + 6 neue Fälle).

- [ ] **Step 6: Commit**

```bash
git add src/lib/llm/openai-compatible.ts src/lib/llm/openai-compatible.test.ts
git commit -m "feat(llm): Upstream-error.message in Fehlertext durchreichen"
```

---

### Task 2: Reiner Aggregations-Helfer (`run-failures.ts`)

**Files:**

- Create: `src/lib/runs/run-failures.ts`
- Test: `src/lib/runs/run-failures.test.ts`

**Interfaces:**

- Consumes: `RepetitionStatus` aus `@/types` (`types.ts:203`).
- Produces:
  - `interface RunFailureSummary { message: string; count: number }`
  - `summarizeFailures(reps: { status: RepetitionStatus; error: string | null }[]): RunFailureSummary[]`

- [ ] **Step 1: Failing test schreiben**

Erstelle `src/lib/runs/run-failures.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { summarizeFailures } from "./run-failures";

describe("summarizeFailures", () => {
  it("gruppiert gleiche Fehlertexte und zählt sie", () => {
    const out = summarizeFailures([
      { status: "failed", error: "endpoint returned status 429: insufficient balance" },
      { status: "failed", error: "endpoint returned status 429: insufficient balance" },
      { status: "failed", error: "no parseable item values in response" },
    ]);
    expect(out).toEqual([
      { message: "endpoint returned status 429: insufficient balance", count: 2 },
      { message: "no parseable item values in response", count: 1 },
    ]);
  });

  it("sortiert nach count absteigend, bei Gleichstand alphabetisch", () => {
    const out = summarizeFailures([
      { status: "failed", error: "b-fehler" },
      { status: "failed", error: "a-fehler" },
    ]);
    expect(out.map((f) => f.message)).toEqual(["a-fehler", "b-fehler"]);
  });

  it("ignoriert erfolgreiche Wiederholungen", () => {
    const out = summarizeFailures([
      { status: "ok", error: null },
      { status: "failed", error: "x" },
    ]);
    expect(out).toEqual([{ message: "x", count: 1 }]);
  });

  it("nutzt Fallback-Text bei fehlendem/leerem Fehler", () => {
    const out = summarizeFailures([
      { status: "failed", error: null },
      { status: "failed", error: "   " },
    ]);
    expect(out).toEqual([{ message: "Unbekannter Fehler", count: 2 }]);
  });

  it("liefert leeres Array ohne Fehler", () => {
    expect(summarizeFailures([{ status: "ok", error: null }])).toEqual([]);
  });
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag verifizieren**

Run: `npm run test -- src/lib/runs/run-failures.test.ts`
Expected: FAIL — `Failed to resolve import "./run-failures"`.

- [ ] **Step 3: Helfer implementieren**

Erstelle `src/lib/runs/run-failures.ts`:

```ts
/**
 * Reiner Aggregations-Helfer für Lauf-Fehler (kein I/O, Node-unit-testbar):
 * gruppiert die fehlgeschlagenen Wiederholungen eines Laufs nach ihrem
 * Fehlertext, damit die UI statt einer bloßen Fehlquote-Zahl die konkreten
 * Gründe (mit Häufigkeit) zeigen kann.
 */
import type { RepetitionStatus } from "@/types";

/** Ein aggregierter Fehler: eindeutiger Text + Häufigkeit über die Wiederholungen. */
export interface RunFailureSummary {
  message: string;
  count: number;
}

/** Fallback, wenn ein Fehlschlag keinen (brauchbaren) Fehlertext trägt. */
const UNKNOWN = "Unbekannter Fehler";

/**
 * Gruppiert fehlgeschlagene Wiederholungen nach Fehlertext → {message, count}[],
 * sortiert nach count absteigend (bei Gleichstand alphabetisch → deterministisch).
 * Nur `status: 'failed'` zählt; fehlender/leerer Text → `UNKNOWN`.
 */
export function summarizeFailures(reps: { status: RepetitionStatus; error: string | null }[]): RunFailureSummary[] {
  const counts = new Map<string, number>();
  for (const rep of reps) {
    if (rep.status !== "failed") continue;
    const trimmed = rep.error?.trim() ?? "";
    const message = trimmed.length > 0 ? trimmed : UNKNOWN;
    counts.set(message, (counts.get(message) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([message, count]) => ({ message, count }))
    .sort((a, b) => b.count - a.count || a.message.localeCompare(b.message));
}
```

- [ ] **Step 4: Test ausführen, Erfolg verifizieren**

Run: `npm run test -- src/lib/runs/run-failures.test.ts`
Expected: PASS (5 Fälle grün).

- [ ] **Step 5: Commit**

```bash
git add src/lib/runs/run-failures.ts src/lib/runs/run-failures.test.ts
git commit -m "feat(runs): reiner Helfer summarizeFailures (Fehler aggregieren)"
```

---

### Task 3: `RunResultView.failures` + `getRunResult` (Read-Pfad)

**Files:**

- Modify: `src/types.ts:13` (Import), `:264-265` (Re-Export), `:338-343` (RunResultView)
- Modify: `src/lib/services/runs.ts:15-20` (Import), `:195-220` (getRunResult)
- Test: `src/test/integration/run-integrity.itest.ts:164-172` (bestehenden Fall erweitern)

**Interfaces:**

- Consumes: `summarizeFailures`, `RunFailureSummary` (Task 2).
- Produces: `RunResultView.failures: RunFailureSummary[]` (befüllt aus `run_repetitions.status`+`error`); `getRunResult` liefert das Feld in allen drei States (`unfinished` → `[]`).

- [ ] **Step 1: Typ verdrahten (`types.ts`)**

In `src/lib/services/runs.ts` und `types.ts` nutzt der bestehende Code `RunTiming` als Muster (lokal in `run-timing.ts`, re-exportiert in `types.ts`). `RunFailureSummary` genauso anschließen.

In `src/types.ts` den Import (nach `import type { RunTiming } from "@/lib/runs/run-timing";`, Zeile 13) ergänzen:

```ts
import type { RunTiming } from "@/lib/runs/run-timing";
import type { RunFailureSummary } from "@/lib/runs/run-failures";
```

Den Re-Export (bei `export type { RunTiming };`, Zeile 265) ergänzen:

```ts
export type { RunView, RunProgress };
export type { RunTiming };
export type { RunFailureSummary };
```

Und `RunResultView` (Zeile 338–343) um `failures` erweitern:

```ts
export interface RunResultView {
  run: RunView;
  aggregate: RunAggregate | null;
  state: "ready" | "empty" | "unfinished";
  timing: RunTiming;
  failures: RunFailureSummary[];
}
```

- [ ] **Step 2: `getRunResult` verdrahten (`runs.ts`)**

In `src/lib/services/runs.ts` den Import (nach `import { summarizeTiming } from "@/lib/runs/run-timing";`, Zeile 19) ergänzen:

```ts
import { summarizeTiming } from "@/lib/runs/run-timing";
import { summarizeFailures } from "@/lib/runs/run-failures";
```

`getRunResult` (Zeile 195–220) so anpassen — der `unfinished`-Zweig liefert `failures: []`, der terminale Zweig liest `status, error` mit und aggregiert:

```ts
export async function getRunResult(sb: SupabaseClient, userId: string, id: string): Promise<RunResultView | null> {
  const run = await getRun(sb, userId, id);
  if (!run) return null;

  if (run.status === "pending" || run.status === "running") {
    return {
      run,
      aggregate: null,
      state: "unfinished",
      timing: summarizeTiming(run.createdAt, run.finishedAt, []),
      failures: [],
    };
  }

  const { data, error } = await sb
    .from("run_repetitions")
    .select("item_values, duration_ms, status, error")
    .eq("run_id", id);
  if (error) fail("result:reps", error.message);
  const rows = data as Pick<RunRepetition, "item_values" | "duration_ms" | "status" | "error">[];
  const reps = rows.map(toRepForScoring);
  const timing = summarizeTiming(
    run.createdAt,
    run.finishedAt,
    rows.map((r) => r.duration_ms),
  );
  const failures = summarizeFailures(rows.map((r) => ({ status: r.status, error: r.error })));

  const aggregate = aggregateRun(reps, OEJTS);
  return { run, aggregate, state: aggregate.usableReps === 0 ? "empty" : "ready", timing, failures };
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run build`
Expected: Typecheck grün — `RunResultView.failures` überall vorhanden, kein „Property 'failures' is missing"-Fehler.

- [ ] **Step 4: Integrationstest erweitern**

In `src/test/integration/run-integrity.itest.ts` den bestehenden Fall „teilweiser Fehlschlag" (Zeile 164–172) um eine `failures`-Assertion ergänzen. `makeFailedRun(..., 8, 2)` legt 2 fehlgeschlagene Reps mit `error: "itest: simulierter Fehlschlag"` an (`fixtures.ts:107`). Direkt vor der schließenden `});` des `it`-Blocks einfügen:

```ts
      expect(result?.run.status).toBe("completed");
      expect(result?.failures).toEqual([{ message: "itest: simulierter Fehlschlag", count: 2 }]);
    });
```

- [ ] **Step 5: Integrationstest ausführen (falls Docker verfügbar)**

Run: `npm run test:integration -- src/test/integration/run-integrity.itest.ts`
Expected: PASS. **Falls kein lokales Supabase/Docker:** überspringen — der CI-`integration`-Job führt ihn aus.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/lib/services/runs.ts src/test/integration/run-integrity.itest.ts
git commit -m "feat(runs): failures im RunResultView (getRunResult aggregiert Fehler)"
```

---

### Task 4: `RunProgress.lastRepError` + `processNextRepetition` (Live-Datenpfad)

**Files:**

- Modify: `src/lib/runs/run-schemas.ts:50-58` (runProgressSchema)
- Modify: `src/lib/services/runs.ts` — `processNextRepetition` (alle 6 RunProgress-Returns)
- Test: `src/lib/runs/run-schemas.test.ts:26-36` (Fixture), `:96-115` (Fall)

**Interfaces:**

- Consumes: nichts aus Vortasks.
- Produces: `RunProgress.lastRepError: string | null` — im rep-verarbeitenden Step gleich `repError`, in allen anderen Returns `null`.

- [ ] **Step 1: Failing test — runProgress mit lastRepError**

In `src/lib/runs/run-schemas.test.ts` die `goodRunProgress()`-Fixture (Zeile 26–36) um `lastRepError` erweitern:

```ts
function goodRunProgress() {
  return {
    status: "running",
    completedReps: 3,
    totalReps: 10,
    failedCount: 1,
    promptTokens: 1234,
    completionTokens: 567,
    lastRepDurationMs: 33000,
    lastRepError: null,
  };
}
```

Und im `describe("runProgressSchema", …)`-Block (nach dem `lastRepDurationMs`-Fall, Zeile 111–114) ergänzen:

```ts
it("akzeptiert lastRepError als string und null", () => {
  expect(runProgressSchema.safeParse({ ...goodRunProgress(), lastRepError: "boom" }).success).toBe(true);
  expect(runProgressSchema.safeParse({ ...goodRunProgress(), lastRepError: null }).success).toBe(true);
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag verifizieren**

Run: `npm run test -- src/lib/runs/run-schemas.test.ts`
Expected: FAIL — der `lastRepError: "boom"`-Fall (bzw. die bekannt-gute Fixture) scheitert, weil das Schema das Feld noch nicht kennt.

- [ ] **Step 3: Schema erweitern**

In `src/lib/runs/run-schemas.ts` in `runProgressSchema` (nach `lastRepDurationMs: z.number().nullable(),`, Zeile 57) ergänzen:

```ts
  lastRepDurationMs: z.number().nullable(),
  lastRepError: z.string().nullable(),
});
```

- [ ] **Step 4: `lastRepError` in alle RunProgress-Returns**

In `src/lib/services/runs.ts` in `processNextRepetition` tragen **sechs** Returns ein `RunProgress`-Objekt. Fünf davon verarbeiten keine Rep → `lastRepError: null`; einer verarbeitet die Rep → `lastRepError: repError`.

Die **fünf** Nicht-Rep-Returns bekommen `lastRepError: null` als letztes Feld (jeweils nach `lastRepDurationMs: null,`):

- Terminal-idempotent (heute `:335-343`)
- Finalisierung-alle-Reps (heute `:357-365`)
- kein `modelConfigId` (heute `:371-379`)
- kein Target (heute `:384-392`)
- F4 unique-Verletzung (heute `:454-462`)

Beispiel (Terminal-idempotent) — die anderen vier analog:

```ts
return {
  status: run.status,
  completedReps: await countReps(sb, runId),
  totalReps: run.repetitionCount,
  failedCount: run.failedCount,
  promptTokens: run.promptTokens,
  completionTokens: run.completionTokens,
  lastRepDurationMs: null,
  lastRepError: null,
};
```

Der **normale rep-verarbeitende Return** am Ende (heute `:480-488`) bekommt `repError`:

```ts
return {
  status: "running",
  completedReps: repIndex,
  totalReps: run.repetitionCount,
  failedCount: newFailedCount,
  promptTokens: newPromptTokens,
  completionTokens: newCompletionTokens,
  lastRepDurationMs: repDurationMs,
  lastRepError: repError,
};
```

- [ ] **Step 5: Unit-Test + Typecheck**

Run: `npm run test -- src/lib/runs/run-schemas.test.ts`
Expected: PASS.

Run: `npm run build`
Expected: Typecheck grün — kein „Property 'lastRepError' is missing" in einem der 6 Returns.

- [ ] **Step 6: Commit**

```bash
git add src/lib/runs/run-schemas.ts src/lib/services/runs.ts src/lib/runs/run-schemas.test.ts
git commit -m "feat(runs): lastRepError im RunProgress (Live-Fehlertext)"
```

---

### Task 5: Ergebnis-Anzeige — Fehlerliste (`RunResult.tsx`)

**Files:**

- Modify: `src/components/runs/RunResult.tsx:1-2` (Import), `:66` (Destrukturierung), Empty-State (`:86-104`), Ready-Panel (`:156-165`)

**Interfaces:**

- Consumes: `result.failures: RunFailureSummary[]` (Task 3).
- Produces: sichtbare aggregierte Fehlerliste im Empty- und im Ready-State.

- [ ] **Step 1: Typ importieren + Destrukturierung**

In `src/components/runs/RunResult.tsx` den Typ-Import (Zeile 2) erweitern:

```ts
import type { AxisDistribution, RunFailureSummary, RunResultView } from "@/types";
```

Und in der `RunResult`-Komponente die Destrukturierung (Zeile 66) erweitern:

```ts
const { run, aggregate, state, timing, failures } = result;
```

- [ ] **Step 2: Reine `FailureList`-Teilkomponente**

In `src/components/runs/RunResult.tsx` vor `export default function RunResult` (Zeile 65) einfügen:

```tsx
/** Aggregierte Fehlerliste eines Laufs (nichts rendern, wenn leer). */
function FailureList({ failures }: { failures: RunFailureSummary[] }) {
  if (failures.length === 0) return null;
  return (
    <div className="border-destructive/30 bg-destructive/10 space-y-1.5 rounded-lg border px-3 py-2">
      <p className="text-destructive flex items-center gap-1.5 text-xs font-medium">
        <AlertTriangle className="size-3.5 shrink-0" />
        Fehler bei einzelnen Wiederholungen
      </p>
      <ul className="text-muted-foreground space-y-0.5 text-xs">
        {failures.map((f) => (
          <li key={f.message}>
            <span className="text-foreground font-medium">{f.count}×</span> {f.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

`AlertTriangle` ist bereits importiert (Zeile 1).

- [ ] **Step 3: Fehlerliste im Empty-State**

Im `state === "empty"`-Zweig, direkt nach dem „Ausgeführt"-`<p>` (Zeile 97) und vor dem schließenden `</div>` (Zeile 98) einfügen:

```tsx
          <p className="text-muted-foreground mt-2 text-xs">Ausgeführt: {formatDateTime(timing.executedAt)}</p>
          <div className="mt-3">
            <FailureList failures={failures} />
          </div>
        </div>
```

- [ ] **Step 4: Fehlerliste im Ready-State**

Im ready-Panel, nach dem `lowReliability`-Block (der abschließt bei Zeile 164 mit `) : null}`) und vor dem schließenden `</section>` (Zeile 165) einfügen:

```tsx
        {lowReliability ? (
          // … bestehender lowReliability-Block …
        ) : null}

        {failures.length > 0 ? (
          <div className="mt-3">
            <FailureList failures={failures} />
          </div>
        ) : null}
      </section>
```

- [ ] **Step 5: Typecheck + Lint**

Run: `npm run build`
Expected: Typecheck grün (`failures` auf `RunResultView`, `RunFailureSummary` importiert).

Run: `npx eslint src/components/runs/RunResult.tsx`
Expected: keine Fehler (CRLF-Hinweise ignorieren).

- [ ] **Step 6: Commit**

```bash
git add src/components/runs/RunResult.tsx
git commit -m "feat(runs): aggregierte Fehlerliste auf der Ergebnis-Seite"
```

---

### Task 6: Live-Fehleranzeige im Runner (`RunRunner.tsx`)

**Files:**

- Modify: `src/components/runs/RunRunner.tsx:151` (State), `runStep` (`:230-236`), `start` (`:288-300`), Fortschritts-Panel (`:511-522`)

**Interfaces:**

- Consumes: `RunProgress.lastRepError` (Task 4).
- Produces: „Letzter Fehler: …" im Live-Fortschritts-Panel; die zuletzt gemeldete Fehlermeldung bleibt sichtbar (sticky), auch wenn danach eine erfolgreiche Wiederholung folgt.

- [ ] **Step 1: State ergänzen**

In `src/components/runs/RunRunner.tsx` bei den Live-States (nach `const [lastRepMs, setLastRepMs] = useState<number | null>(null);`, Zeile 155) einfügen:

```ts
// Letzter nicht-null Rep-Fehler (sticky bis zum nächsten Lauf-Start).
const [lastRepError, setLastRepError] = useState<string | null>(null);
```

- [ ] **Step 2: In `runStep` fortschreiben**

In `runStep`, im Block nach `setProgress(next);` (Zeile 231–236, wo bereits `lastRepDurationMs` verarbeitet wird), die sticky-Fehlerübernahme ergänzen — direkt nach dem bestehenden `if (d != null) {…}`:

```ts
const d = next.lastRepDurationMs;
if (d != null) {
  setLastRepMs(d);
  setModelMsSoFar((prev) => prev + d);
}
if (next.lastRepError != null) {
  setLastRepError(next.lastRepError);
}
```

- [ ] **Step 3: In `start` zurücksetzen + initialen Progress ergänzen**

In `start()`, beim Initialisieren des neuen Laufs (nach `setLastRepMs(null);`, Zeile 291) ergänzen:

```ts
setModelMsSoFar(0);
setLastRepMs(null);
setLastRepError(null);
```

Und den initialen `setProgress({...})` (Zeile 292–300) um das neue Feld ergänzen:

```ts
setProgress({
  status: view.status,
  completedReps: 0,
  totalReps: view.repetitionCount,
  failedCount: 0,
  promptTokens: 0,
  completionTokens: 0,
  lastRepDurationMs: null,
  lastRepError: null,
});
```

- [ ] **Step 4: Anzeige im Fortschritts-Panel**

Im Fortschritts-Panel, nach dem `lastRepMs`-Block (der `<p>` mit „Letzte Wiederholung …", Zeile 518–522) einfügen:

```tsx
{
  lastRepError != null ? <p className="text-destructive text-xs">Letzter Fehler: {lastRepError}</p> : null;
}
```

- [ ] **Step 5: Typecheck + Lint**

Run: `npm run build`
Expected: Typecheck grün (`lastRepError` auf `RunProgress`).

Run: `npx eslint src/components/runs/RunRunner.tsx`
Expected: keine Fehler (CRLF-Hinweise ignorieren).

- [ ] **Step 6: Commit**

```bash
git add src/components/runs/RunRunner.tsx
git commit -m "feat(runs): letzte Fehlermeldung live im Runner anzeigen"
```

---

### Task 7: Voller Grün-Durchlauf + Smoke

**Files:** keine (Verifikation; Doku via `/dtb:workflow-checkpoint` separat)

- [ ] **Step 1: Kompletter Unit-Lauf**

Run: `npm run test`
Expected: alle Tests grün (bisher 77 + neue `run-failures`- (5), `extractUpstreamError`/Wiring- (6), `runProgress`-lastRepError-Fälle).

- [ ] **Step 2: Build gesamt**

Run: `npm run build`
Expected: Typecheck (`astro check`) + Build grün.

- [ ] **Step 3: Manuelle Smoke-Prüfung (lokal)**

Run: `npm run dev`, dann im Browser einen Lauf mit **absichtlich falscher Config** starten (z. B. z.ai-Key auf dem Standard-`paas/v4`-Endpunkt → 429 „insufficient balance", oder ungültiger Key).
Expected:

- Live-Runner zeigt „Letzter Fehler: endpoint returned status 429: insufficient balance" (bzw. den echten Upstream-Text).
- Die Ergebnis-Seite des (voll-)gescheiterten Laufs zeigt unter „Keine verwertbaren Antworten" die aggregierte Fehlerliste (`N× …`).
- Ein Lauf mit Teil-Fehlern zeigt die Liste zusätzlich unter dem Typ-Panel.

- [ ] **Step 4: Kein separater Commit** (Doku/Checkpoint via `/dtb:workflow-checkpoint`, außerhalb dieses Plans).

---

## Deployment (nach Abnahme, mit User-Go)

Reiner Code-Change (keine Migration — Spalte `run_repetitions.error` existiert). `main` pushen → Worker-Deploy + CI. Live-Abnahme wie Task 7 Step 3, aber gegen Prod.
