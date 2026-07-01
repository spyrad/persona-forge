# Design: Lauf- & Wiederholungs-Timing

**Datum:** 2026-07-01
**Status:** Entwurf zur Review
**Autor:** Damian (via Brainstorming mit Claude)

## Problem

Ein Lauf zeigt heute Fehlquote und Token-Verbrauch, aber **keine Zeitinformation**:
weder wann er ausgeführt wurde noch wie lange er (bzw. die einzelnen Wiederholungen)
gedauert hat. Bei Reasoning-Modellen (z. B. z.ai `glm-5.2`) variiert die Dauer je
Wiederholung stark — diese Sichtbarkeit fehlt komplett.

## Ziel

Erfassen und anzeigen:

1. **Ausführungs-Datum/-Zeit** des Laufs.
2. **Lauf-Dauer** in zwei Lesarten (Entscheidung: beide zeigen):
   - **Modell-Zeit** = Summe der Wiederholungs-Dauern (echte Rechenzeit, robust
     gegen Pausen/Polling-Lücken).
   - **Wall-Clock** = `finished_at − created_at` (Kalenderzeit; enthält bewusst
     auch Leerlauf, wenn der Lauf pausiert/das Tab geschlossen wird).
3. **Pro-Wiederholung-Dauer**: als Zusammenfassung (⌀/Min/Max) im Ergebnis **und**
   live während des Laufs (jede Wiederholung zeigt ihre Dauer, sobald sie fertig ist).

## Nicht-Ziele (YAGNI)

- Time-to-first-token, Retry-/Backoff-Aufschlüsselung, eigenes Telemetrie-Schema.
- Der `thinking:{type:"disabled"}`-Fix (Reasoning-Tempo) und die Fehler-Durchreichung
  aus `openai-compatible.ts` — **separater** Vorgang, nicht Teil dieser Change.
- Volle ausklappbare Pro-Rep-Tabelle (bewusst zugunsten der kompakten Zusammenfassung
  verworfen).

## Gewählter Ansatz

**Explizite Messung** (statt Ableitung aus vorhandenen `created_at`-Deltas): pro
Wiederholung die LLM-Call-Dauer messen und persistieren; `runs` bekommt ein
`finished_at`. Grund: `run_repetitions.created_at` ist nur der Insert-Zeitpunkt —
Deltas daraus enthielten Client-Polling-Lücken und ließen sich nicht von der
Modell-Latenz trennen (Rauschen). Die explizite Messung isoliert die echte
Rechenzeit; Kosten: je eine additive, nullable Spalte auf zwei Tabellen.

## Architektur

### 1. Datenmodell — Migration `supabase/migrations/<ts>_run_timing.sql`

```sql
alter table public.run_repetitions add column duration_ms int;
alter table public.runs add column finished_at timestamptz;
```

- `run_repetitions.duration_ms` (nullable): gemessene Wall-Zeit **des einen
  LLM-Calls** dieser Wiederholung, inkl. interner Retries/Backoff (`chatCompletion`).
  Wird auch bei `status = 'failed'` gesetzt (Zeit bis zum Fehler ist aussagekräftig).
  Alt-Zeilen bleiben `null`.
- `runs.finished_at` (nullable): **einmalig** gesetzt beim Übergang des Laufs nach
  `completed`/`failed`. Alt-Zeilen bleiben `null`.
- **Ausführungsdatum** braucht keine neue Spalte — vorhandenes `runs.created_at`.
- **Keine RLS-Änderung**: additive Spalten erben die bestehenden Policies. Sicher,
  kein Downtime, kompatibel mit dem aktuell laufenden Worker (nullable, kein Default
  nötig).

### 2. Service — `src/lib/services/runs.ts`

**Messung in `processNextRepetition`:**

```ts
const startedAt = performance.now();
try {
  const completion = await chatCompletion({ … });
  …
} catch (err) {
  repError = …;
}
const durationMs = Math.round(performance.now() - startedAt);
// … beim Insert in run_repetitions: duration_ms: durationMs
```

Die Messung umschließt den gesamten `try/catch`, damit Erfolg **und** Fehler
(inkl. Timeout nach 60 s) eine Dauer bekommen. `performance.now()` ist in der
Worker-Runtime verfügbar (die Date-/Random-Beschränkung gilt nur für
Workflow-Skripte, nicht für App-Code).

**Terminal-Übergang zentralisieren:** kleiner Helfer

```ts
async function finalize(sb, runId, status: "completed" | "failed") {
  await patchRun(sb, runId, { status, finished_at: new Date().toISOString() });
}
```

Ersetzt die drei bestehenden `patchRun(..., { status: "…failed/completed" })`-Stellen
(Finalisierung bei allen Reps geschrieben; kein `modelConfigId`; kein entschlüsseltes
Target). Setzt `finished_at` genau einmal, beim ersten Terminal-Wechsel.

### 3. DTO/Schemas — additiv, non-strict (rückwärtskompatibel, kein Drift-Banner)

**Neuer reiner Helfer `src/lib/runs/run-timing.ts`:**

```ts
export interface RunTiming {
  executedAt: string; // = run.createdAt
  finishedAt: string | null; // = run.finishedAt
  wallClockMs: number | null; // finishedAt − createdAt, sonst null
  modelMs: number; // Summe der duration_ms (nicht-null)
  repCount: number; // Reps mit gemessener Dauer
  avgMs: number | null; // modelMs / repCount, sonst null
  minMs: number | null;
  maxMs: number | null;
}

export function summarizeTiming(
  createdAt: string,
  finishedAt: string | null,
  repDurations: (number | null)[],
): RunTiming;
```

Rein (kein I/O), Node-unit-testbar. `getRunResult` ruft ihn mit den ohnehin
geladenen Reps auf und hängt `timing` an die `RunResultView`:

```ts
export interface RunResultView {
  run: RunView;
  aggregate: RunAggregate | null;
  state: "ready" | "empty" | "unfinished";
  timing: RunTiming; // neu
}
```

**`runViewSchema`** (`src/lib/runs/run-schemas.ts`): `finishedAt: z.string().nullable()`
ergänzen; die `toView`-Projektion in `runs.ts` mappt `finished_at`.

**`runProgressSchema`**: `lastRepDurationMs: z.number().nullable()` ergänzen. In
`processNextRepetition` mit der gerade gemessenen `durationMs` befüllt; in den
Branches ohne verarbeitete Wiederholung (idempotent-terminal, Finalisierung,
Fehler-vor-Call) `null`. Die **laufende Modell-Zeit-Summe** akkumuliert der Runner
clientseitig aus diesen Werten — kein zusätzlicher Server-Query.

### 4. UI

**Ergebnis — `src/components/runs/RunResult.tsx`:** In der Kopf-Sektion
(neben Fehlquote/Tokens) eine Zeile mit `Clock`-Icon:

```
Ausgeführt: 01.07.2026 22:15 · Dauer 3 m 05 s (Modell-Zeit 2 m 48 s) · ⌀ 33 s/Rep (18–61 s)
```

- Fehlt `finishedAt` (unfinished): nur „Ausgeführt: …" zeigen.
- `repCount === 0`: Pro-Rep-Teil weglassen.
- Neue reine Helfer `formatDuration(ms)` (→ „1,2 s" / „3 m 05 s") und
  `formatDateTime(iso)` in `src/lib/runs/run-timing.ts` (Timing-Helfer beisammen),
  unit-getestet.

**Live — `src/components/runs/RunRunner.tsx`:** Im Fortschritts-Panel eine Zeile:

```
Letzte Wiederholung 33 s · Modell-Zeit gesamt 1 m 39 s
```

`modelMs`-Summe als lokaler State, der bei jedem Step um `lastRepDurationMs`
(wenn nicht `null`) erhöht wird; Reset in `start()`.

**Liste — `RunRunner.tsx`:** je Lauf-Zeile die Meta-Zeile um „Ausgeführt: <Datum>"
(aus `run.createdAt`) ergänzen. Wall-Clock in der Liste ist optional/Non-Goal für v1.

### 5. Tests

- **Unit (Node, Docker-frei):**
  - `run-timing.test.ts`: `summarizeTiming` — Summe/⌀/min/max, leere Liste, alle
    `null`, gemischte `null`, fehlendes `finishedAt` (→ `wallClockMs: null`).
  - `formatDuration`/`formatDateTime` — Sekunden/Minuten-Grenzen, Rundung, 0.
  - `run-schemas.test.ts`: `runProgress` mit `lastRepDurationMs`, `runView` mit
    `finishedAt` (gültig + `null`); Drift-Fälle unverändert grün.
- **Integration (itest, hinter dem CI-`integration`-Gate, lokal Docker/Supabase):**
  Nach Abschluss eines gemockten Laufs: `runs.finished_at` gesetzt und
  `run_repetitions.duration_ms` je Rep befüllt.

## Deployment

Die Migration muss auf die **gehostete** Supabase-DB, die sich Prod + lokaler Dev
teilen (siehe CLAUDE.md-Gotcha). Der GitHub-Actions-Deploy-Job pusht **nur den
Worker**, nicht die Migration. Reihenfolge:

1. Migration lokal committen.
2. Migration auf die gehostete DB einspielen (`supabase db push` mit DB-Credentials
   oder via Supabase-Dashboard) — **vor** dem Worker-Deploy, da additive nullable
   Spalten mit dem alten Worker kompatibel sind.
3. Code pushen → Worker-Deploy zieht nach.

## Offene Risiken

| Risiko                                                                                                  | Mitigation                                                                       |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Migration nicht auf gehostete DB gespielt → neuer Worker schreibt `duration_ms`/`finished_at` ins Leere | Deploy-Reihenfolge (Migration zuerst); Spalten nullable → alter Worker unberührt |
| Wall-Clock wirkt „falsch" groß (Lauf pausiert)                                                          | Bewusst akzeptiert; Modell-Zeit steht daneben als robuste Zahl                   |
| `performance.now()` in Worker-Runtime                                                                   | Verfügbar (Standard-Web-API); nur Workflow-Skripte sind eingeschränkt            |
