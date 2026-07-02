# Design: Fehler-Sichtbarkeit (pro-Rep-Fehler im UI + Upstream-Fehlertext)

**Datum:** 2026-07-02
**Status:** Entwurf zur Review
**Autor:** Damian (via Brainstorming mit Claude)

## Problem

Wenn ein Lauf scheitert, sieht der Nutzer nur „Tests scheitern" bzw. eine Fehlquote-Zahl
(`3/5 (60 %)`) — nie das **Warum**. Der eigentliche Fehler wird zwar **pro Wiederholung
persistiert** (`run_repetitions.error`, gesetzt in `runs.ts:443`), aber nirgends nach vorne
gereicht. Zwei Lücken:

1. **Read-Pfad + UI:** `getRunResult` (`runs.ts:208`) liest nur `item_values, duration_ms`;
   `RunResultView` hat kein Fehlerfeld; `RunResult.tsx` zeigt nur die Fehlquote-Zahl; der
   Live-Runner (`RunRunner.tsx`) zeigt nur „· N fehlgeschlagen". Der Fehlertext ist unsichtbar.
2. **Upstream-Text verworfen:** `chatCompletion` (`openai-compatible.ts`) wirft nur generische
   Texte (`endpoint returned status 429`) und verwirft den Provider-Body. Der eigentlich
   diagnostische Satz (z. B. z.ai „insufficient balance") geht verloren — genau der, der beim
   z.ai-Debug in Session 4 gefehlt hat.

## Ziel

Der Lauf-Owner sieht bei Fehlern den konkreten Grund — **live** während des Laufs (letzte
fehlgeschlagene Wiederholung) und **auf der Ergebnis-Seite** (aggregiert nach Fehlertext).
Der durchgereichte Text trägt den echten Provider-Fehler, nicht nur den HTTP-Status.

## Nicht-Ziele (YAGNI)

- **Keine** Fehleranzeige in der Laufliste (`/runs`) — pro Lauf nur eine Zeile, kein Platz.
- **Keine** pro-Rep-Einzelzeilen auf der Ergebnis-Seite (bewusst aggregiert, skaliert auf 25 Reps).
- **Keine** Anzeige der Roh-Response (`raw_response`) oder Reasoning-Tokens im UI.
- **Keine** Migration — die Spalte `run_repetitions.error` existiert bereits.
- **Kein** Retry-/Alerting-Verhalten — reine Sichtbarkeit, keine Verhaltensänderung an der
  Orchestrierung.

## Gewählter Ansatz

Zwei neue **reine Helfer** (isoliert, unit-testbar) plus **rein additive DTO-Felder**. Keine
Verhaltensänderung an bestehenden Pfaden, kein Bruch der zod-Verträge (Felder werden dem
Schema hinzugefügt, damit sie nicht gestrippt werden).

## Architektur

### Teil B — Upstream-Fehlertext durchreichen (`src/lib/llm/openai-compatible.ts`)

Neuer reiner, exportierter Helfer:

```ts
/**
 * Zieht die menschenlesbare Fehlermeldung aus einem Upstream-Error-Body
 * (OpenAI/z.ai-Format `{ error: { message } }`), defensiv geparst und gekappt.
 * Gibt null, wenn nichts Brauchbares drinsteht. Übernimmt NUR den message-String
 * (kein Header, kein Key, kein Body-Rest) — Leak-Invariante bleibt.
 */
export function extractUpstreamError(bodyText: string): string | null;
```

- Parst `bodyText` als JSON (try/catch → `null`). Reihenfolge: `error.message` (String) →
  `error` (falls String) → sonst `null`.
- **Kappt auf 200 Zeichen** (Suffix `…` bei Überlänge).
- Kein JSON / kein Feld → `null` (Aufrufer bleibt beim generischen Text).

Wiring in `chatCompletion` an den drei nicht-ok-Stellen (heute `openai-compatible.ts:172`,
`:182`, plus finaler Retry-Erschöpfung). Der Body wird **einmal** gelesen (`await res.text()`,
tolerant gegen Lesefehler → leerer String) und die Message angehängt:

```ts
lastError = `endpoint returned status ${res.status}`;
const upstream = extractUpstreamError(await res.text().catch(() => ""));
if (upstream) lastError = `${lastError}: ${upstream}`;
```

- Greift für retrybare (`429`/`5xx`) wie nicht-retrybare (`!res.ok`) Antworten. Bei Retry
  wird `lastError` fortgeschrieben und nur beim finalen Wurf verwendet — Verhalten (Anzahl
  Versuche, Backoff) unverändert.
- Der SSRF-/Redirect-/Timeout-Pfad und die Leak-Invariante (`:9`) bleiben unberührt: der Key
  steckt im Request-Header, nicht in der Provider-Antwort; wir übernehmen ohnehin nur den
  `error.message`-String.

### Teil A — Read-Pfad + Aggregation (`src/lib/runs/run-failures.ts`, neu)

Neuer reiner Helfer (+ `run-failures.test.ts`), analog zu `run-timing.ts`:

```ts
export interface RunFailureSummary {
  message: string;
  count: number;
}

/**
 * Gruppiert fehlgeschlagene Wiederholungen nach Fehlertext → {message, count}[],
 * sortiert nach count absteigend (bei Gleichstand alphabetisch, deterministisch).
 * Reps mit status 'ok' zählen nicht. Fehlt der Text (null/leer) bei einem
 * Fehlschlag → Fallback "Unbekannter Fehler".
 */
export function summarizeFailures(reps: { status: RepetitionStatus; error: string | null }[]): RunFailureSummary[];
```

`getRunResult` (`runs.ts`) liest zusätzlich `status, error` aus `run_repetitions`, ruft
`summarizeFailures` auf und legt das Ergebnis ins DTO. Der `unfinished`-Branch (kein
Rep-Read) liefert `failures: []` — während des Laufs ist der Live-Runner die Fehlerquelle.

`RunResultView` (`types.ts:338`) bekommt additiv `failures: RunFailureSummary[]`. Die
Ergebnis-Seite rendert server-seitig (Astro-Page → Prop an die React-Insel), kein zod-Parse
dazwischen → additives Feld kommt durch. `RunFailureSummary` wird in `types.ts` definiert.

### Teil A — Live-Fortschritt (`run-schemas.ts` + `runs.ts` + `RunRunner.tsx`)

- `runProgressSchema` (`run-schemas.ts:50`) bekommt additiv `lastRepError: z.string().nullable()`.
  **Muss** ins Schema, sonst strippt `safeParse` (`RunRunner.tsx:222`) das Feld weg.
- `processNextRepetition` reicht `repError` als `lastRepError` durch: im rep-verarbeitenden
  Return gesetzt, in den terminalen/idempotenten/F3/F4-Returns `null`.
- `RunRunner.tsx`: neuer State `lastRepError` (aus `progress.lastRepError` bei jedem Step
  aktualisiert). Im Live-Panel unter „N fehlgeschlagen" die Meldung in `text-destructive`
  anzeigen, wenn gesetzt.

### UI — Ergebnis-Seite (`RunResult.tsx`)

- **Empty-State** (`RunResult.tsx:86-104`, „Keine verwertbaren Antworten"): unter dem
  generischen Satz die aggregierte Fehlerliste rendern (der Hauptfall — der User will hier
  das Warum sehen).
- **Ready-State**: wenn `result.failures.length > 0`, eine kompakte Fehlerliste unter dem
  Typ-Panel (auch ein Lauf mit Ergebnis kann Teil-Fehler haben).
- Darstellung je Eintrag: `{count}× {message}` (z. B. „3× endpoint returned status 429:
  insufficient balance"). Semantische Tokens (`text-destructive`/`border-destructive/30`),
  keine Farb-Literale.

## Tests (Unit, Node-Vitest, Docker-frei)

1. **`run-failures.test.ts`** — `summarizeFailures`:
   - Gruppierung gleicher Texte + Count.
   - Sortierung nach count desc (Gleichstand alphabetisch → deterministisch).
   - `status:'ok'`-Reps werden ignoriert.
   - Fehlschlag mit `error:null`/leer → „Unbekannter Fehler".
   - Keine Fehler → `[]`.
2. **`openai-compatible.test.ts`** (erweitert) — `extractUpstreamError` + Wiring:
   - `{ error: { message: "insufficient balance" } }` → Message extrahiert.
   - `{ error: "flat string" }` → String übernommen.
   - Kein JSON / kein Feld → `null`.
   - Überlänge → auf 200 Zeichen gekappt.
   - fetch-Stub 429 mit Body `{error:{message:"insufficient balance"}}` → geworfener Fehler
     enthält „insufficient balance"; Body ohne message → generischer Text.
3. **Optional:** bestehenden Timing-`itest` (`run-integrity.itest.ts`) um `error`-Persistenz
   - `getRunResult().failures` erweitern.

## Deployment

Reiner Code-Change (keine Migration). Nach Merge: `main` pushen → Worker-Deploy + CI.
Live-Abnahme: Lauf mit absichtlich falscher Config (z. B. falscher z.ai-Endpunkt → 429)
starten → Live-Runner zeigt die letzte Fehlermeldung, Ergebnis-Seite zeigt die aggregierte
Liste mit dem Upstream-Text.

## Offene Risiken

| Risiko                                                                       | Mitigation                                                                                                                                                        |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Upstream-Body enthält sensibles Material                                     | Wir übernehmen nur `error.message`, gekappt auf 200 Zeichen; der Key ist nie Teil der Provider-Antwort. Fehlertext ist RLS-owner-gescoped (kein Cross-User-Leak). |
| Fehlertext driftet je Provider (Format `{error:{message}}` nicht garantiert) | Fallbacks (`error` als String → `null`); ohne Treffer bleibt der bestehende generische Status-Text.                                                               |
| Additives DTO-Feld wird von altem Client-Schema gestrippt                    | `runProgressSchema` wird explizit erweitert; `RunResultView` läuft server-gerendert ohne zod-Parse.                                                               |
