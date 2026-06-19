<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: distribution-results (S-05)

- **Plan**: context/changes/distribution-results/plan.md
- **Scope**: Phase 1 + 2 (alle)
- **Date**: 2026-06-19
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Zwei unabhängige Sub-Agenten (Plan-Drift + Safety/Quality/Pattern). 13 geänderte
Dateien, alle im Plan — keine Missing/EXTRA/Scope-Creep. Automated-Kriterien
verifiziert: Lint clean, 48 Tests grün, `astro check` 0 errors, Build grün.
Manual-Gate 11/11 abgenommen (1.5–1.8 + 2.4–2.11).

## Findings

### F1 — RunResultView.state: 3 statt 4 Enum-Werte

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/types.ts:330-334 (bzw. Plan §3-Contract)
- **Detail**: Plan-Contract listete `state = ready|insufficient|empty|unfinished` (4),
  Code hat 3 (`ready|empty|unfinished`). Bewusste Divergenz: Plan §4 delegiert die
  „<2 nicht belastbar"-Schwelle an die UI (aus `usableCount`/`usableReps`,
  RELIABLE_MIN=2). Der Plan-Text widersprach sich; der Code folgte der Prosa und ist
  über Types/Service/UI konsistent.
- **Fix**: Plan-Contract §3 auf die 3-State-Form korrigiert + klarstellende Notiz
  (reine Doku, kein Code-Change).
- **Decision**: FIXED

### F2 — toRepForScoring ist faktisch ein No-Op-Mapper

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/services/runs.ts:176
- **Detail**: `(data as Pick<RunRepetition,"item_values">[]).map(toRepForScoring)` —
  das „Läutern" des untypisierten Clients passiert durch den Cast; der Mapper gibt
  `{item_values}` 1:1 zurück. Projektkonsistent mit `toView` (Z.84).
- **Fix**: Mapper streichen + Cast direkt an `aggregateRun` reichen.
- **Decision**: SKIPPED — projektkonsistent mit dem toView-Muster, kein echter Mangel.

### F3 — maxStack ohne Layout-Wirkung (Histogramm-Säulen können überlaufen)

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (UI)
- **Location**: src/components/runs/RunResult.tsx:36-39, 88-89
- **Detail**: `maxStack` wurde nur in einem sr-only-Span ausgegeben; die Punktsäulen
  stapelten per `flex-col-reverse` unbegrenzt aus dem `h-20`-Container. Bei vielen
  identischen Scores (bis 25 Reps) ragten sie optisch über die Box.
- **Fix**: Punktgröße + Gap gegen `maxStack` normiert (`slotPx = min(10, 60/maxStack)`),
  sodass die dichteste Säule ins Feld passt; bei N=5 deckungsgleich mit vorher.
- **Decision**: FIXED

### F4 — cn() mit ausschließlich statischen Strings

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/runs/RunResult.tsx:229 (Achsen-Grid)
- **Detail**: `cn("grid gap-4", "sm:grid-cols-2")` mergte zwei Konstanten ohne
  Konditionale — `cn()` hier überflüssig.
- **Fix**: Zu `className="grid gap-4 sm:grid-cols-2"` zusammengefasst; ungenutzten
  `cn`-Import entfernt.
- **Decision**: FIXED
