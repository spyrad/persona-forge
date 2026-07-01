# Lauf- & Wiederholungs-Timing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Erfasse und zeige Ausführungs-Datum, Lauf-Dauer (Modell-Zeit + Wall-Clock) und Pro-Wiederholungs-Dauer eines Test-Laufs.

**Architecture:** Explizite Messung der LLM-Call-Dauer je Wiederholung (`duration_ms`) plus `finished_at` auf `runs`; ein reiner Helfer aggregiert das zu `RunTiming`; additive, non-strict DTOs reichen es an UI (Ergebnis-Seite, Live-Runner, Liste) durch.

**Tech Stack:** Astro 6 SSR, React 19, TypeScript, Supabase (Postgres), zod, Vitest (Node-Env Unit + `.itest.ts` Integration).

## Global Constraints

- Migrationen: `supabase/migrations/YYYYMMDDHHmmss_kurzbeschreibung.sql`; additive Spalten **nullable**, keine RLS-Änderung.
- DTO-Schemas in `src/lib/runs/run-schemas.ts` bleiben **non-strict** (`z.object`, nie `.strict()`) — additive Server-Felder rückwärtskompatibel.
- `RunView`/`RunProgress` sind `z.infer` aus den Schemas (Single Source); `@/types` re-exportiert sie. Enum-Werte `status`/`visibility` NICHT anfassen (Compile-Guard in `types.ts`).
- Services/Business-Logik → `src/lib/`; reine Helfer testbar ohne I/O (Node-Vitest).
- UI-Farben nur über semantische Tokens (`text-muted-foreground`, `text-foreground`, `border-border` …) — keine Farb-Literale.
- Commits: Conventional Commits; Pre-Commit-Hooks (husky/lint-staged) laufen automatisch (eslint --fix, prettier).
- Unit-Tests: `npm run test` (Vitest, Node-Env, `src/**/*.test.ts`). Integration: `npm run test:integration` (`src/**/*.itest.ts`, braucht lokales Supabase via Docker).
- **Kein Push in diesem Plan** — Push auf `main` deployt Prod. Nur lokale Commits; Deploy separat mit User-Go.

---

### Task 1: Migration — `duration_ms` + `finished_at`

**Files:**

- Create: `supabase/migrations/20260701230000_run_timing.sql`

**Interfaces:**

- Produces: Spalten `public.run_repetitions.duration_ms int` (nullable) und `public.runs.finished_at timestamptz` (nullable) für alle folgenden Tasks.

- [ ] **Step 1: Migration schreiben**

Erstelle `supabase/migrations/20260701230000_run_timing.sql`:

```sql
-- Timing (Run-Timing-Feature): Pro-Wiederholungs-Dauer + Lauf-Endzeit.
-- Additiv + nullable → kompatibel mit dem aktuell laufenden Worker, keine
-- RLS-Aenderung (Spalten erben die bestehenden Policies).

-- Wall-Zeit des LLM-Calls dieser Wiederholung (inkl. interner Retries/Backoff);
-- auch bei status='failed' gesetzt. Alt-Zeilen bleiben null.
alter table public.run_repetitions add column duration_ms int;

-- Einmalig gesetzt beim Uebergang des Laufs nach completed/failed. Alt-Zeilen null.
alter table public.runs add column finished_at timestamptz;
```

- [ ] **Step 2: SQL-Syntax lokal prüfen (falls Docker verfügbar)**

Run: `npx supabase db reset` (wendet alle Migrationen auf die lokale DB an)
Expected: läuft ohne Fehler durch; die neue Migration erscheint am Ende der Liste. **Falls kein Docker:** überspringen — die Anwendung auf die gehostete DB erfolgt separat (siehe Deployment-Sektion der Spec).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260701230000_run_timing.sql
git commit -m "feat(runs): Migration fuer duration_ms + finished_at (Timing)"
```

---

### Task 2: Reiner Timing-Helfer (`run-timing.ts`)

**Files:**

- Create: `src/lib/runs/run-timing.ts`
- Test: `src/lib/runs/run-timing.test.ts`

**Interfaces:**

- Produces:
  - `interface RunTiming { executedAt: string; finishedAt: string | null; wallClockMs: number | null; modelMs: number; repCount: number; avgMs: number | null; minMs: number | null; maxMs: number | null }`
  - `summarizeTiming(createdAt: string, finishedAt: string | null, repDurations: (number | null)[]): RunTiming`
  - `formatDuration(ms: number): string`
  - `formatDateTime(iso: string): string`

- [ ] **Step 1: Failing test schreiben**

Erstelle `src/lib/runs/run-timing.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatDateTime, formatDuration, summarizeTiming } from "./run-timing";

describe("summarizeTiming", () => {
  it("summiert Modell-Zeit und rechnet ⌀/min/max über gültige Dauern", () => {
    const t = summarizeTiming("2026-07-01T20:00:00.000Z", "2026-07-01T20:03:05.000Z", [18000, 61000, 33000]);
    expect(t.modelMs).toBe(112000);
    expect(t.repCount).toBe(3);
    expect(t.avgMs).toBe(37333);
    expect(t.minMs).toBe(18000);
    expect(t.maxMs).toBe(61000);
    expect(t.wallClockMs).toBe(185000);
    expect(t.executedAt).toBe("2026-07-01T20:00:00.000Z");
    expect(t.finishedAt).toBe("2026-07-01T20:03:05.000Z");
  });

  it("ignoriert null-Dauern und behandelt fehlendes finishedAt", () => {
    const t = summarizeTiming("2026-07-01T20:00:00.000Z", null, [null, 5000, null]);
    expect(t.modelMs).toBe(5000);
    expect(t.repCount).toBe(1);
    expect(t.avgMs).toBe(5000);
    expect(t.wallClockMs).toBeNull();
  });

  it("liefert null-Kennzahlen bei leerer/durchweg-null Liste", () => {
    const t = summarizeTiming("2026-07-01T20:00:00.000Z", "2026-07-01T20:00:01.000Z", []);
    expect(t.modelMs).toBe(0);
    expect(t.repCount).toBe(0);
    expect(t.avgMs).toBeNull();
    expect(t.minMs).toBeNull();
    expect(t.maxMs).toBeNull();
    expect(t.wallClockMs).toBe(1000);
  });
});

describe("formatDuration", () => {
  it("formatiert ms/Sekunden/Minuten deutsch", () => {
    expect(formatDuration(300)).toBe("300 ms");
    expect(formatDuration(3200)).toBe("3,2 s");
    expect(formatDuration(9900)).toBe("9,9 s");
    expect(formatDuration(33000)).toBe("33 s");
    expect(formatDuration(185000)).toBe("3 m 05 s");
  });

  it("fällt bei ungültiger Eingabe auf Gedankenstrich zurück", () => {
    expect(formatDuration(Number.NaN)).toBe("—");
    expect(formatDuration(-5)).toBe("—");
  });
});

describe("formatDateTime", () => {
  it("formatiert ISO als de-DE Datum+Zeit (Europe/Berlin)", () => {
    expect(formatDateTime("2026-07-01T20:15:00.000Z")).toBe("01.07.2026 22:15");
  });
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag verifizieren**

Run: `npm run test -- src/lib/runs/run-timing.test.ts`
Expected: FAIL — `Failed to resolve import "./run-timing"` bzw. „is not a function".

- [ ] **Step 3: Helfer implementieren**

Erstelle `src/lib/runs/run-timing.ts`:

```ts
/**
 * Reine Timing-Helfer für den Run-Flow (kein I/O, Node-unit-testbar):
 *   - summarizeTiming: Rep-Dauern + Timestamps → aggregierte RunTiming-Kennzahlen.
 *   - formatDuration/formatDateTime: deutsche Anzeige (ms/s/min bzw. Datum+Zeit).
 */

/** Aggregierte Zeit-Kennzahlen eines Laufs (client-sicher). */
export interface RunTiming {
  /** Ausführungs-Start = runs.created_at (ISO). */
  executedAt: string;
  /** runs.finished_at (ISO) oder null, solange nicht terminal. */
  finishedAt: string | null;
  /** Wall-Clock finishedAt − executedAt in ms; null ohne finishedAt. */
  wallClockMs: number | null;
  /** Summe der gemessenen Wiederholungs-Dauern (echte Modell-Zeit). */
  modelMs: number;
  /** Anzahl Wiederholungen mit gemessener Dauer. */
  repCount: number;
  /** modelMs / repCount (gerundet) oder null. */
  avgMs: number | null;
  minMs: number | null;
  maxMs: number | null;
}

/** Aggregiert Rep-Dauern + Timestamps zu RunTiming (null-Dauern werden ignoriert). */
export function summarizeTiming(
  createdAt: string,
  finishedAt: string | null,
  repDurations: (number | null)[],
): RunTiming {
  const valid = repDurations.filter((d): d is number => typeof d === "number" && Number.isFinite(d));
  const modelMs = valid.reduce((sum, d) => sum + d, 0);
  const repCount = valid.length;
  const wallClockMs = finishedAt ? Math.max(0, Date.parse(finishedAt) - Date.parse(createdAt)) : null;
  return {
    executedAt: createdAt,
    finishedAt,
    wallClockMs,
    modelMs,
    repCount,
    avgMs: repCount > 0 ? Math.round(modelMs / repCount) : null,
    minMs: repCount > 0 ? Math.min(...valid) : null,
    maxMs: repCount > 0 ? Math.max(...valid) : null,
  };
}

/** Millisekunden → deutsche Kurzform: „300 ms" / „3,2 s" / „33 s" / „3 m 05 s". */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return `${String(Math.round(ms))} ms`;
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) {
    // Unter 10 s eine Nachkommastelle (feiner), darüber ganze Sekunden.
    if (ms < 10000) {
      const oneDecimal = (Math.round(ms / 100) / 10).toString().replace(".", ",");
      return `${oneDecimal} s`;
    }
    return `${String(totalSec)} s`;
  }
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m)} m ${String(s).padStart(2, "0")} s`;
}

/** ISO-Timestamp → „01.07.2026 22:15" (de-DE, Europe/Berlin). */
export function formatDateTime(iso: string): string {
  const formatted = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
  // de-DE liefert „01.07.2026, 22:15" — das Komma für die Kurzform entfernen.
  return formatted.replace(", ", " ");
}
```

- [ ] **Step 4: Test ausführen, Erfolg verifizieren**

Run: `npm run test -- src/lib/runs/run-timing.test.ts`
Expected: PASS (alle 6 Fälle grün).

- [ ] **Step 5: Commit**

```bash
git add src/lib/runs/run-timing.ts src/lib/runs/run-timing.test.ts
git commit -m "feat(runs): reiner Timing-Helfer (summarizeTiming + Formatierung)"
```

---

### Task 3: `finishedAt` durch die RunView-Kette

**Files:**

- Modify: `src/types.ts:218-233` (Run-Entity), `:239-253` (RunRepetition-Entity)
- Modify: `src/lib/runs/run-schemas.ts:28-43` (runViewSchema)
- Modify: `src/lib/services/runs.ts:39-40` (VIEW_COLUMNS), `:42-57` (RunViewRow), `:59-76` (toView)
- Test: `src/lib/runs/run-schemas.test.ts:5-22` (goodRunView-Fixture + Fall)

**Interfaces:**

- Consumes: nichts aus Vortasks.
- Produces: `RunView.finishedAt: string | null` (befüllt aus `runs.finished_at`); Entity-Felder `Run.finished_at`, `RunRepetition.duration_ms`.

- [ ] **Step 1: Failing test — RunView mit finishedAt**

In `src/lib/runs/run-schemas.test.ts` die `goodRunView()`-Fixture (Zeilen 5–22) um `finishedAt` erweitern und einen Nullable-Fall ergänzen. Ersetze die Fixture-Funktion durch:

```ts
function goodRunView() {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    personaId: "22222222-2222-2222-2222-222222222222",
    modelConfigId: "33333333-3333-3333-3333-333333333333",
    instrumentId: "oejts-1.2",
    repetitionCount: 5,
    status: "completed",
    promptTokens: 100,
    completionTokens: 200,
    failedCount: 0,
    completedReps: 5,
    visibility: "private",
    isOwn: true,
    createdAt: "2026-07-01T20:00:00.000Z",
    updatedAt: "2026-07-01T20:03:00.000Z",
    finishedAt: "2026-07-01T20:03:00.000Z",
  };
}
```

Und im `describe("runViewSchema", …)`-Block diesen Fall hinzufügen:

```ts
it("akzeptiert finishedAt = null", () => {
  const v = { ...goodRunView(), finishedAt: null };
  expect(runViewSchema.safeParse(v).success).toBe(true);
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag verifizieren**

Run: `npm run test -- src/lib/runs/run-schemas.test.ts`
Expected: FAIL — der neue `finishedAt: null`-Fall (und ggf. der Bekannt-gut-Fall) scheitert, weil `runViewSchema` das Feld noch nicht kennt/erzwingt.

- [ ] **Step 3: Schema erweitern**

In `src/lib/runs/run-schemas.ts` in `runViewSchema` (nach `updatedAt: z.string(),`, Zeile 42) ergänzen:

```ts
  updatedAt: z.string(),
  finishedAt: z.string().nullable(),
});
```

- [ ] **Step 4: Entity-Typen erweitern**

In `src/types.ts` das `Run`-Interface (nach `updated_at: string;`, Zeile 232) ergänzen:

```ts
  updated_at: string;
  finished_at: string | null;
}
```

Und das `RunRepetition`-Interface (nach `updated_at: string;`, Zeile 252) ergänzen:

```ts
  updated_at: string;
  duration_ms: number | null;
}
```

- [ ] **Step 5: View-Query + Mapping erweitern**

In `src/lib/services/runs.ts`:

`VIEW_COLUMNS` (Zeile 39–40) — `finished_at` ergänzen:

```ts
const VIEW_COLUMNS =
  "id, owner_id, persona_id, model_config_id, instrument_id, repetition_count, status, prompt_tokens, completion_tokens, failed_count, visibility, created_at, updated_at, finished_at, run_repetitions(count)";
```

`RunViewRow` (Zeile 42–57) — `"finished_at"` in die `Pick`-Union aufnehmen (z. B. nach `"updated_at"`):

```ts
  | "updated_at"
  | "finished_at"
> & { run_repetitions?: { count: number }[] };
```

`toView` (Zeile 59–76) — Feld mappen (nach `updatedAt: row.updated_at,`):

```ts
    updatedAt: row.updated_at,
    finishedAt: row.finished_at,
  };
}
```

- [ ] **Step 6: Tests + Typecheck ausführen**

Run: `npm run test -- src/lib/runs/run-schemas.test.ts`
Expected: PASS.

Run: `npm run build`
Expected: Typecheck grün (`astro check` ohne Fehler), Build erfolgreich.

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/lib/runs/run-schemas.ts src/lib/services/runs.ts src/lib/runs/run-schemas.test.ts
git commit -m "feat(runs): finishedAt in RunView-Kette (Schema, Entity, toView)"
```

---

### Task 4: Service-Orchestrierung — Messen, `finished_at`, `lastRepDurationMs`, Ergebnis-Timing

**Files:**

- Modify: `src/lib/runs/run-schemas.ts:49-56` (runProgressSchema)
- Modify: `src/types.ts:334-338` (RunResultView)
- Modify: `src/lib/services/runs.ts` — `finalize`-Helfer, `processNextRepetition` (Messung + alle RunProgress-Returns + Insert), `getRunResult`
- Test: `src/lib/runs/run-schemas.test.ts` (runProgress-Fall), `src/test/integration/run-integrity.itest.ts` (Persistenz)

**Interfaces:**

- Consumes: `summarizeTiming`, `RunTiming` (Task 2); Entity-Felder (Task 3).
- Produces: `RunProgress.lastRepDurationMs: number | null`; `RunResultView.timing: RunTiming`; `run_repetitions.duration_ms` + `runs.finished_at` werden befüllt.

- [ ] **Step 1: Failing test — runProgress mit lastRepDurationMs**

In `src/lib/runs/run-schemas.test.ts` die `goodRunProgress()`-Fixture (Zeilen ~25–34) um `lastRepDurationMs` erweitern und einen Fall ergänzen. Ersetze die Fixture:

```ts
function goodRunProgress() {
  return {
    status: "running",
    completedReps: 2,
    totalReps: 5,
    failedCount: 0,
    promptTokens: 40,
    completionTokens: 80,
    lastRepDurationMs: 33000,
  };
}
```

Und im `describe("runProgressSchema", …)`-Block:

```ts
it("akzeptiert lastRepDurationMs = null", () => {
  const p = { ...goodRunProgress(), lastRepDurationMs: null };
  expect(runProgressSchema.safeParse(p).success).toBe(true);
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag verifizieren**

Run: `npm run test -- src/lib/runs/run-schemas.test.ts`
Expected: FAIL — `lastRepDurationMs: null` scheitert (Feld unbekannt/nicht erzwungen).

- [ ] **Step 3: runProgressSchema + RunResultView erweitern**

In `src/lib/runs/run-schemas.ts` in `runProgressSchema` (nach `completionTokens: z.number(),`, Zeile 55) ergänzen:

```ts
  completionTokens: z.number(),
  lastRepDurationMs: z.number().nullable(),
});
```

In `src/types.ts` zuerst den Import des Timing-Typs oben bei den Imports ergänzen (nach der bestehenden `import type { RunView, RunProgress } …`-Zeile, Zeile 12):

```ts
import type { RunTiming } from "@/lib/runs/run-timing";
```

Dann `RunTiming` re-exportieren (bei den anderen Re-Exports, Zeile 261):

```ts
export type { RunView, RunProgress };
export type { RunTiming };
```

Und `RunResultView` (Zeile 334–338) um `timing` erweitern:

```ts
export interface RunResultView {
  run: RunView;
  aggregate: RunAggregate | null;
  state: "ready" | "empty" | "unfinished";
  timing: RunTiming;
}
```

- [ ] **Step 4: `finalize`-Helfer + Messung + Returns in `runs.ts`**

In `src/lib/services/runs.ts`:

**(a)** Import des Helfers oben ergänzen (bei den `@/lib/runs`-Imports, nach Zeile 18):

```ts
import { summarizeTiming } from "@/lib/runs/run-timing";
```

**(b)** Nach `patchRun` (nach Zeile 284) den `finalize`-Helfer einfügen:

```ts
/** Terminal-Übergang eines Laufs: setzt Status UND finished_at (genau einmal). */
async function finalize(sb: SupabaseClient, runId: string, status: "completed" | "failed"): Promise<void> {
  await patchRun(sb, runId, { status, finished_at: new Date().toISOString() });
}
```

**(c)** In `processNextRepetition` die drei Terminal-Patches auf `finalize` umstellen:

- Zeile ~336 `await patchRun(sb, runId, { status: finalStatus });` → `await finalize(sb, runId, finalStatus);`
- Zeile ~349 `await patchRun(sb, runId, { status: "failed" });` → `await finalize(sb, runId, "failed");`
- Zeile ~361 `await patchRun(sb, runId, { status: "failed" });` → `await finalize(sb, runId, "failed");`

**(d)** Messung um den Call. Direkt vor `let repStatus: RepetitionStatus = "failed";` (Zeile ~381) eine Variable anlegen und die Messung um den `try/catch` (Zeilen ~388–408) legen:

```ts
let repStatus: RepetitionStatus = "failed";
let rawResponse: string | null = null;
let itemValues: ItemValue[] | null = null;
let repPrompt: number | null = null;
let repCompletion: number | null = null;
let repError: string | null = null;
const repStartedAt = performance.now();

try {
  // … unveränderter chatCompletion/parse-Block …
} catch (err) {
  repError = err instanceof Error ? err.message : "completion failed";
}
const repDurationMs = Math.round(performance.now() - repStartedAt);
```

**(e)** `duration_ms` beim Insert (Zeile ~411–421) mitschreiben:

```ts
const { error: insErr } = await sb.from("run_repetitions").insert({
  run_id: runId,
  rep_index: repIndex,
  item_order: order,
  raw_response: rawResponse,
  item_values: itemValues,
  status: repStatus,
  error: repError,
  prompt_tokens: repPrompt,
  completion_tokens: repCompletion,
  duration_ms: repDurationMs,
});
```

**(f)** `lastRepDurationMs` in ALLE `RunProgress`-Returns aufnehmen. Der normale Return am Ende (Zeile ~453–460):

```ts
return {
  status: "running",
  completedReps: repIndex,
  totalReps: run.repetitionCount,
  failedCount: newFailedCount,
  promptTokens: newPromptTokens,
  completionTokens: newCompletionTokens,
  lastRepDurationMs: repDurationMs,
};
```

Die fünf übrigen Returns bekommen `lastRepDurationMs: null` (kein Rep verarbeitet):

- Terminal-idempotent (Zeile ~316–323)
- Finalisierung-alle-Reps (Zeile ~337–344)
- kein `modelConfigId` (Zeile ~350–357)
- kein Target (Zeile ~362–369)
- F4 unique-Verletzung (Zeile ~428–435)

Beispiel für den ersten (die anderen analog — jeweils `lastRepDurationMs: null,` als letztes Feld ergänzen):

```ts
return {
  status: run.status,
  completedReps: await countReps(sb, runId),
  totalReps: run.repetitionCount,
  failedCount: run.failedCount,
  promptTokens: run.promptTokens,
  completionTokens: run.completionTokens,
  lastRepDurationMs: null,
};
```

- [ ] **Step 5: `getRunResult` — Timing anhängen**

In `src/lib/services/runs.ts` `getRunResult` (Zeile 192–206) anpassen: für den unfinished-Zweig Timing ohne Reps, sonst `duration_ms` mitlesen und aggregieren:

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
    };
  }

  const { data, error } = await sb.from("run_repetitions").select("item_values, duration_ms").eq("run_id", id);
  if (error) fail("result:reps", error.message);
  const rows = data as Pick<RunRepetition, "item_values" | "duration_ms">[];
  const reps = rows.map(toRepForScoring);
  const timing = summarizeTiming(
    run.createdAt,
    run.finishedAt,
    rows.map((r) => r.duration_ms),
  );

  const aggregate = aggregateRun(reps, OEJTS);
  return { run, aggregate, state: aggregate.usableReps === 0 ? "empty" : "ready", timing };
}
```

- [ ] **Step 6: Unit-Tests + Typecheck**

Run: `npm run test -- src/lib/runs/run-schemas.test.ts`
Expected: PASS.

Run: `npm run build`
Expected: Typecheck grün — insbesondere kein „Property 'lastRepDurationMs' is missing"-Fehler (alle 6 Returns befüllt) und `RunResultView.timing` überall vorhanden.

- [ ] **Step 7: Integrationstest — Persistenz von `duration_ms` + `finished_at`**

In `src/test/integration/run-integrity.itest.ts` einen Fall ergänzen. Er nutzt ausschließlich die **bereits in der Datei importierten** Helfer (`makeRunningRun`, `mockLlmContent`, `processNextRepetition`, `account.client`) — keine neuen Imports. Füge ihn im Block `describe("Step-Idempotenz", …)` (oder einem neuen `describe("Timing", …)`) ein:

```ts
it("misst duration_ms je Wiederholung und setzt finished_at beim Abschluss", async () => {
  mockLlmContent();
  // 0 vorab eingefügte Reps, repetitionCount = 1.
  const run = await makeRunningRun(account, personaId, modelConfigId, 0, 1);

  // Schritt 1: schreibt Wiederholung 1 inkl. gemessener Dauer, Lauf bleibt "running".
  const step1 = await processNextRepetition(account.client, account.userId, run.id);
  expect(typeof step1?.lastRepDurationMs).toBe("number");

  // Schritt 2: alle Reps geschrieben → Lauf wird finalisiert (finished_at gesetzt).
  const step2 = await processNextRepetition(account.client, account.userId, run.id);
  expect(step2?.status).toBe("completed");
  expect(step2?.lastRepDurationMs).toBeNull();

  const { data: reps, error: repErr } = await account.client
    .from("run_repetitions")
    .select("duration_ms")
    .eq("run_id", run.id);
  if (repErr) throw new Error(repErr.message);
  expect(reps).toHaveLength(1);
  expect(typeof reps?.[0]?.duration_ms).toBe("number");

  const { data: runRow, error: runErr } = await account.client
    .from("runs")
    .select("finished_at, status")
    .eq("id", run.id)
    .single();
  if (runErr) throw new Error(runErr.message);
  expect(runRow?.status).toBe("completed");
  expect(runRow?.finished_at).not.toBeNull();
});
```

- [ ] **Step 8: Integrationstest ausführen (falls Docker verfügbar)**

Run: `npm run test:integration -- src/test/integration/run-integrity.itest.ts`
Expected: PASS. **Falls kein lokales Supabase/Docker:** überspringen — der CI-`integration`-Job führt ihn aus.

- [ ] **Step 9: Commit**

```bash
git add src/lib/runs/run-schemas.ts src/types.ts src/lib/services/runs.ts src/lib/runs/run-schemas.test.ts src/test/integration/run-integrity.itest.ts
git commit -m "feat(runs): Timing messen + persistieren (duration_ms, finished_at, Ergebnis-Timing, Live)"
```

---

### Task 5: Ergebnis-Anzeige (`RunResult.tsx`)

**Files:**

- Modify: `src/components/runs/RunResult.tsx`

**Interfaces:**

- Consumes: `result.timing: RunTiming` (Task 4), `formatDuration`/`formatDateTime` (Task 2).
- Produces: sichtbare Timing-Zeile im Ergebnis-Panel.

- [ ] **Step 1: Helfer importieren**

In `src/components/runs/RunResult.tsx` die Imports (oben) ergänzen:

```ts
import { formatDateTime, formatDuration } from "@/lib/runs/run-timing";
```

- [ ] **Step 2: `timing` aus dem Result ziehen**

In der `RunResult`-Komponente die Destrukturierung (Zeile ~65 `const { run, aggregate, state } = result;`) erweitern:

```ts
const { run, aggregate, state, timing } = result;
```

- [ ] **Step 3: Timing-Zeile im ready-Panel rendern**

Im ready-Zweig unter der bestehenden Fehlquote/Tokens-Zeile (die `<p>` mit „Fehlquote: … · Tokens: …", ~Zeile 139–142) direkt danach eine zweite Zeile einfügen:

```tsx
<p className="text-muted-foreground mt-1 text-xs">
  Ausgeführt: {formatDateTime(timing.executedAt)}
  {timing.wallClockMs != null
    ? ` · Dauer ${formatDuration(timing.wallClockMs)} (Modell-Zeit ${formatDuration(timing.modelMs)})`
    : ""}
  {timing.repCount > 0 && timing.avgMs != null && timing.minMs != null && timing.maxMs != null
    ? ` · ⌀ ${formatDuration(timing.avgMs)}/Rep (${formatDuration(timing.minMs)}–${formatDuration(timing.maxMs)})`
    : ""}
</p>
```

- [ ] **Step 4: Typecheck + Lint**

Run: `npm run build`
Expected: Typecheck grün (`timing` existiert auf `RunResultView`).

Run: `npx eslint src/components/runs/RunResult.tsx`
Expected: keine Fehler (CRLF-`Delete ␍`-Hinweise ignorieren — husky fixt sie beim Commit).

- [ ] **Step 5: Commit**

```bash
git add src/components/runs/RunResult.tsx
git commit -m "feat(runs): Ausfuehrungsdatum + Dauer im Ergebnis anzeigen"
```

---

### Task 6: Live-Anzeige im Runner + Datum in der Liste (`RunRunner.tsx`)

**Files:**

- Modify: `src/components/runs/RunRunner.tsx`

**Interfaces:**

- Consumes: `RunProgress.lastRepDurationMs` (Task 4), `RunView.finishedAt`/`createdAt` (Task 3), `formatDateTime`/`formatDuration` (Task 2).
- Produces: Live-Dauer-Zeile im Fortschritts-Panel + „Ausgeführt: <Datum>" je Lauf-Zeile.

- [ ] **Step 1: Helfer importieren**

In `src/components/runs/RunRunner.tsx` die Imports ergänzen:

```ts
import { formatDateTime, formatDuration } from "@/lib/runs/run-timing";
```

- [ ] **Step 2: State für laufende Modell-Zeit-Summe**

Bei den `useState`-Deklarationen (nach `const [progress, setProgress] = useState<RunProgress | null>(null);`, ~Zeile 150) ergänzen:

```ts
// Live-Modell-Zeit: Summe der lastRepDurationMs über die Steps dieses Laufs.
const [modelMsSoFar, setModelMsSoFar] = useState<number>(0);
const [lastRepMs, setLastRepMs] = useState<number | null>(null);
```

- [ ] **Step 3: Summe je Step fortschreiben**

In `runStep`, direkt nach `setProgress(next);` (~Zeile 226) einfügen:

```ts
setProgress(next);
if (next.lastRepDurationMs != null) {
  setLastRepMs(next.lastRepDurationMs);
  setModelMsSoFar((prev) => prev + next.lastRepDurationMs!);
}
```

- [ ] **Step 4: Zähler beim Start zurücksetzen**

In `start()`, wo der neue Lauf initialisiert wird (nach `setActiveRunId(view.id);`, vor `setProgress({…})`, ~Zeile 279) ergänzen:

```ts
setActiveRunId(view.id);
setModelMsSoFar(0);
setLastRepMs(null);
```

Und den initialen `setProgress({...})` (~Zeile 280–287) um das neue Feld ergänzen:

```ts
setProgress({
  status: view.status,
  completedReps: 0,
  totalReps: view.repetitionCount,
  failedCount: 0,
  promptTokens: 0,
  completionTokens: 0,
  lastRepDurationMs: null,
});
```

- [ ] **Step 5: Live-Zeile im Fortschritts-Panel**

Im Fortschritts-Panel unter der Tokens-Zeile (die `<p>` mit „Tokens: … ein / … aus", ~Zeile 502–504) eine Zeile einfügen:

```tsx
{
  lastRepMs != null ? (
    <p className="text-muted-foreground text-xs">
      Letzte Wiederholung {formatDuration(lastRepMs)} · Modell-Zeit gesamt {formatDuration(modelMsSoFar)}
    </p>
  ) : null;
}
```

- [ ] **Step 6: Datum in der Lauf-Liste**

In der Lauf-Liste, in der Meta-Zeile je Lauf (die `<p>` mit „Fehlquote: … · Tokens: …", ~Zeile 548–551), das Ausführungsdatum voranstellen. Ersetze den `<p>`-Inhalt durch:

```tsx
<p className="text-muted-foreground mt-1 text-xs">
  Ausgeführt: {formatDateTime(run.createdAt)} · Fehlquote: {failureRate(run.failedCount, run.repetitionCount)} · Tokens:{" "}
  {run.promptTokens} ein / {run.completionTokens} aus
</p>
```

- [ ] **Step 7: Typecheck + Lint**

Run: `npm run build`
Expected: Typecheck grün (`lastRepDurationMs` auf `RunProgress`, `createdAt` auf `RunView`).

Run: `npx eslint src/components/runs/RunRunner.tsx`
Expected: keine Fehler (CRLF-Hinweise ignorieren). Falls `no-non-null-assertion` beim `next.lastRepDurationMs!` in Step 3 anschlägt: in eine lokale Konstante ziehen (`const d = next.lastRepDurationMs; if (d != null) { setLastRepMs(d); setModelMsSoFar((prev) => prev + d); }`).

- [ ] **Step 8: Commit**

```bash
git add src/components/runs/RunRunner.tsx
git commit -m "feat(runs): Live-Dauer im Runner + Ausfuehrungsdatum in der Liste"
```

---

### Task 7: Voller Grün-Durchlauf + Doku

**Files:**

- Modify: `WORKFLOW_STATUS.md` bzw. Session-Log (via `/dtb:workflow-checkpoint`, separat)

- [ ] **Step 1: Kompletter Unit-Lauf**

Run: `npm run test`
Expected: alle Tests grün (bisher 65/65 + neue run-timing- und schema-Fälle).

- [ ] **Step 2: Build + Lint gesamt**

Run: `npm run build`
Expected: Typecheck + Build grün.

- [ ] **Step 3: Manuelle Smoke-Prüfung (lokal)**

Run: `npm run dev`, dann im Browser einen kurzen Lauf (z. B. glm-5.2, 2 Wiederholungen) starten.
Expected: Fortschritts-Panel zeigt „Letzte Wiederholung … · Modell-Zeit gesamt …"; nach Abschluss zeigt die Ergebnis-Seite „Ausgeführt: … · Dauer … (Modell-Zeit …) · ⌀ …/Rep (…–…)"; die Lauf-Liste zeigt je Lauf „Ausgeführt: <Datum>".

> Voraussetzung: die Migration aus Task 1 muss auf die gehostete DB gespielt sein (siehe Deployment-Sektion der Spec), sonst schreiben die neuen Spalten ins Leere.

- [ ] **Step 4: Kein separater Commit nötig** (Doku/Checkpoint via `/dtb:workflow-checkpoint`, außerhalb dieses Plans).

---

## Deployment (nach Abnahme, mit User-Go)

1. Migration `20260701230000_run_timing.sql` auf die **gehostete** Supabase-DB spielen (`supabase db push` mit DB-Credentials oder via Dashboard) — **vor** dem Worker-Deploy (additive nullable Spalten sind mit dem alten Worker kompatibel).
2. Commits pushen → GitHub-Actions-Deploy zieht den Worker nach.
3. Live-Abnahme: Lauf starten, Timing im Ergebnis + live prüfen.
