<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: OEJTS-Messlauf (S-04)

- **Plan**: context/changes/oejts-measurement-run/plan.md
- **Scope**: Phasen 1–3 von 3 (Full Plan)
- **Date**: 2026-06-18
- **Verdict**: APPROVED (mit kleineren Hinweisen)
- **Findings**: 0 critical, 3 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Überladene remove(): aktiver Abbruch ohne Rückfrage

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency / Data-Safety
- **Location**: src/components/runs/RunRunner.tsx:231-252
- **Detail**: remove() vermischt Abbruch (aktiver Lauf, OHNE confirm) und Löschen (andere, MIT confirm). DELETE löscht hart inkl. aller run_repetitions; bei Abbruch eines fortgeschrittenen Laufs gehen Messdaten ohne Rückfrage verloren. Hartes Löschen ist plan-konform (FR-014), die fehlende Bestätigung + der überladene Name sind UX-/Lesbarkeitsrisiko.
- **Fix**: Aktiven Abbruch (Panel-Button) mit kurzer Bestätigung versehen und ggf. cancelActive() von remove() trennen.
- **Decision**: FIXED — cancelActive() (mit confirm) von remove() getrennt, gemeinsamer deleteRunRequest()-Helfer.

### F2 — Leeres N-Feld → value={NaN} am kontrollierten Input

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/runs/RunRunner.tsx:198,350
- **Detail**: Geleertes Zahlenfeld → valueAsNumber = NaN landet in reps. Submit-Guard !Number.isInteger(reps) blockt korrekt, aber <input value={reps}> rendert value={NaN} → React-kontrollierter-Input-Glitch.
- **Fix**: Im onChange NaN auffangen: const v = e.target.valueAsNumber; setReps(Number.isNaN(v) ? MIN_REPS : v).
- **Decision**: FIXED — NaN wird im onChange auf MIN_REPS geklemmt.

### F3 — Kein client-AbortController für in-flight /step-fetch

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (Reliability)
- **Location**: src/components/runs/RunRunner.tsx (Loop gesamt)
- **Detail**: stopLoop() bricht die Verkettung ab, aber ein laufender fetch(.../step) wird nie abgebrochen — der LLM-Call läuft bis zum 60s-Server-Timeout. Post-await isCancelled()-Checks verhindern korrekt State-Mutation; Restrisiko gering. openai-compatible.ts hat bereits einen ungenutzten signal-Param.
- **Fix**: Optionaler AbortController je Step, in stopLoop() .abort(). Nicht blockierend für v1 (Server-Timeout deckt Worst-Case).
- **Decision**: SKIPPED — Server-seitiger 60s-Timeout deckt den Worst-Case; post-await-Guards verhindern State-Mutation.

### F4 — Token-Aggregat zählt nur `ok`-Wiederholungen

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Korrektheit)
- **Location**: src/lib/services/runs.ts:344-346
- **Detail**: Tokens werden nur bei repStatus === "ok" summiert. Eine failed-Rep mit real verbrauchten Tokens persistiert sie in run_repetitions, trägt aber nicht zum Lauf-Total bei → Kosten untertrieben. Für FR-015 (Token-Zählung) wäre „alle real verbrauchten Tokens" intuitiver.
- **Fix**: Prüfen, ob gewollt; falls nicht, Tokens unabhängig vom rep-Status summieren, sobald usage vorhanden.
- **Decision**: FIXED — Token-Summen zählen jetzt alle real verbrauchten Tokens (auch failed-Reps mit usage); Fehlquote bleibt statusbasiert.

### F5 — Tab-Schließen → Lauf bleibt dauerhaft `running` (Resume ungenutzt)

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/components/runs/RunRunner.tsx (Mount-Verhalten)
- **Detail**: Tab schließen bei status='running' → Lauf hängt in der DB; RunRunner startet den Loop nie für aus initialRuns geladene running-Läufe. Plan dokumentiert das als gewollt (kein Resume in v1) → KEINE Drift. Backend ist via completedReps-Zählung bereits resume-fähig; nur die UI nutzt es nicht.
- **Fix**: Kein Handlungsbedarf (plan-konform). Optional Backlog-Idee „Resume/Fortsetzen-Button".
- **Decision**: SKIPPED — plan-konform (kein Resume in v1).

### F6 — Kein CHECK auf run_repetitions.rep_index-Range

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Data-Safety)
- **Location**: supabase/migrations/20260617190000_runs.sql:60-62
- **Detail**: rep_index ist freies int ohne Range-Check. Nur Serverlogik schreibt (count+1), praktisch unkritisch; ein check (rep_index >= 1) wäre defense-in-depth konsistent mit dem Migrations-Stil.
- **Fix**: Optional in Folge-Migration check (rep_index >= 1) ergänzen.
- **Decision**: SKIPPED — unkritisch (nur Serverlogik schreibt); Migration ist bereits live.
