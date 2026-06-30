<!-- PLAN-REVIEW-REPORT -->

# Plan Review: C-B — zod-Validator an der RunRunner-Naht

- **Plan**: context/changes/refactor-opportunities/plan.md
- **Mode**: Deep
- **Date**: 2026-06-30
- **Verdict**: SOUND
- **Findings**: 0 critical, 1 warning, 1 observation

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | PASS    |
| Blind Spots           | WARNING |
| Plan Completeness     | PASS    |

## Grounding

5/5 Pfade ✓, Symbole verifiziert (3 Casts `RunRunner.tsx:180/:211/:258`, RunView=14 Felder
`types.ts:251-267`, RunProgress=6 Felder `:278-286`, `RunStatus`=4 Literale/`Visibility`=2,
`fixtures.ts` vorhanden, `src/lib/runs/` existiert bereits → gute Platzierung), brief↔plan ✓.
Progress-Headings vs. Body cosmetisch verschieden (Klammer-Suffix) — `/10x-implement`-Parser
keyt auf `Phase N` (Nummer), kein Impact. Beide vom Resume markierten Risiken VERIFIZIERT SOUND:
`z.enum`-Kopie strukturell === `RunStatus` (Typecheck fängt Drift); Step-Loop-Abbruch via
`stopLoop()`+`return` stoppt die `setTimeout`-Verkettung sauber.

## Findings

### F1 — Schema-Strictness unspezifiziert: additive Server-Felder

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 §1 (Schemas) + §3 (Tests)
- **Detail**: Der Plan legte nicht fest, ob die zod-Objekt-Schemas strict/non-strict sind.
  Default-`z.object` strippt unbekannte Keys → additive Server-Felder bleiben rückwärtskompatibel.
  Mit `.strict()` würde jedes künftige additive Server-Feld den `serverError`-Banner auslösen. Die
  Reject-Fixture testete nur Rename/Remove, nie ein additives Feld.
- **Fix**: Schema-Kontrakt explizit non-strict (kein `.strict()`) festschreiben + Accept-Test mit
  unbekanntem Extra-Feld (`success === true`) ergänzen.
  - Strength: Pinnt das gewünschte Drift-Verhalten; verhindert plausiblen Implementer-Fehler mit Prod-Folgen.
  - Tradeoff: Eine Test-Zeile + ein Satz Schema-Kontrakt.
  - Confidence: HIGH — zod-Default ist dokumentiert non-strict.
  - Blind spot: Keine signifikante.
- **Decision**: FIXED (Fix in Plan — Phase 1 §1 Strictness-Absatz + §3 Accept-additiv-Testfall)

### F2 — runStep-Drift-Pfad ruft kein refetch (UI-Konsistenz)

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Phase 2 §3 (runStep `:211`)
- **Detail**: Der bestehende `!res.ok`-Pfad (`:206-208`) macht `setServerError + stopLoop + refetch()`.
  Der geplante safeParse-Mismatch-Pfad machte `setServerError + stopLoop + return` ohne refetch —
  Liste spiegelt den DB-Stand nach Drift-Abbruch nicht.
- **Fix**: Im Drift-Pfad analog `await refetch()` nach `stopLoop()` ergänzen.
- **Decision**: FIXED (Fix in Plan — Phase 2 §3 Contract auf `setServerError + stopLoop + await refetch() + return` angeglichen)
