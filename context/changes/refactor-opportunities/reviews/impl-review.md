<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: C-B — zod-Validator an der RunRunner-Naht

- **Plan**: context/changes/refactor-opportunities/plan.md
- **Scope**: Phase 1+2 von 2 (komplett)
- **Date**: 2026-06-30
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 1 observation

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

## Evidence

- **Drift (Agent 1):** voller MATCH über Phase 1 §1–§3 + Phase 2 §1–§3; kein DRIFT/MISSING/EXTRA.
  Compile-Guard sogar stärker als geplant (deckt zusätzlich `RunView.visibility`↔`Visibility`
  und `RunProgress.status`↔`RunStatus`). NOT-Doing-Grenzen eingehalten (C-C lokal, `{error}`/
  `messageFromPayload` unangetastet, keine Server-Form-Änderung, RunResult/RunComparison unberührt).
- **Safety (Agent 2):** keine CRITICAL; kein doppeltes `res.json()`, kein Step-Loop-Race
  (`stopLoop` setzt cancelledRef/clearTimer/activeRunId=null; setTimeout nur auf Happy-Non-Terminal),
  Non-Strict-zod wie behauptet, Compile-Guard korrekt (bricht bei Drift, lässt Gleichheit durch).
- **Success Criteria:** `npm run test` grün, `astro check` 0 errors, `git grep "as RunView|as RunProgress"`
  in RunRunner.tsx = 0.

## Findings

### F1 — Ungeschütztes await res.json() vor safeParse (200-mit-Nicht-JSON friert UI ein)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Reliability)
- **Location**: RunRunner.tsx:217 (runStep), :181 (refetch)
- **Detail**: `safeParse` greift erst nach `await res.json()`. Ein 200 mit leerem/Nicht-JSON-Body
  (Cloudflare-Edge-Proxy/Interstitial) wirft SyntaxError; da `runStep` als `void runStep(...)` gefeuert
  wird, bleibt die Rejection ungefangen → kein setServerError, kein stopLoop → UI friert ein. Asymmetrie
  zum `!res.ok`-Zweig (:212), der defensiv `.catch(() => null)` liest. Pre-existing, aber genau die Naht,
  die diese Change härtet.
- **Fix**: `await res.json()` → `await res.json().catch(() => null)` an :217 + :181; `safeParse(null)`
  schlägt fehl → bestehender Banner-Pfad (setServerError + stopLoop + refetch).
- **Decision**: FIXED (Fix now — beide Stellen auf `.catch(() => null)`)

### F2 — Gemischte Banner-Sprache auf strukturgleichen Drift-Pfaden

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: RunRunner.tsx:220/:274 (DE) vs :129/:183/:191 (EN)
- **Detail**: Neue Schema-Drift-Banner deutsch ("Unerwartete Server-Antwort."), die "load runs failed"-
  Banner-Klasse englisch ("Couldn't load runs. Please reload.") an drei Stellen (initialer `loadError`-State
  :129, refetch-Drift :183, refetch-`!res.ok` :191). Kein Bug.
- **Fix**: Die drei "load runs failed"-Banner auf DE angeglichen ("Laufliste konnte nicht geladen werden.
  Bitte neu laden.") — eine Sprache je Banner-Klasse.
- **Decision**: FIXED (Fix — alle 3 Vorkommen inkl. :129 auf DE)
