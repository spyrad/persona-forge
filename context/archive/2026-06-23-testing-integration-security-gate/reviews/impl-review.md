<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Integration Security Gate (Test-Rollout Phase 1)

- **Plan**: context/changes/testing-integration-security-gate/plan.md
- **Scope**: Alle 4 Phasen
- **Date**: 2026-06-23
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 4 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

Hinweis Success Criteria: Integration-Suite (`npm run test:integration`) wurde im
Review nicht neu gefahren (lokales Docker-Supabase aus). Docker-freie Checks grün:
`npm run test` (48 Units), `npm run lint` (nur Parser-Warnungen), `npx astro check`
(0 errors). Alle Progress-Checkboxen `[x]` mit Commit-Evidenz; Suites waren bei
Implementierung grün (54 itests + 48 units).

## Findings

### F1 — Safety-Guard nutzt Substring-Match statt Host-Parse

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/test/integration/setup.ts:41
- **Detail**: Der Guard gegen versehentliches Prod-Targeting prüfte `/127\.0\.0\.1|localhost/` per Substring. URLs wie `https://localhost.evil.com` oder `https://prod.db/?h=127.0.0.1` hätten ihn passiert. Er ist die einzige Schranke gegen Tests-gegen-Prod.
- **Fix**: Auf echten Host-Vergleich via `new URL(url).hostname` umgestellt (exakt `127.0.0.1`/`localhost`), inkl. try/catch für ungültige URLs.
- **Decision**: FIXED

### F2 — Plan-Text "13 Routes" ≠ tatsächliche 10 Pfade / 17 Handler

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Plan Adherence
- **Location**: plan.md:381, context/foundation/test-plan.md
- **Detail**: Implementierung testet 17 Methode×Route-Handler = Obermenge aller geschützten Routen; keine Route fehlt. Die "13" ist eine Zählunschärfe im Plan-/Doku-Text, kein Code-Mangel.
- **Decision**: SKIPPED

### F3 — signup fehlt in den public-Positiv-Tests

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Success Criteria
- **Location**: src/test/integration/auth-gates.itest.ts:57
- **Detail**: Nur signin/signout als public getestet; signup hat dieselbe gateless Struktur, Positiv-Signal ausreichend belegt.
- **Decision**: SKIPPED

### F4 — signin-Positiv-Kontrolle deckt nur den Validierungs-Pfad ab

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🔎 MEDIUM
- **Dimension**: Success Criteria
- **Location**: src/test/integration/auth-gates.itest.ts:57
- **Detail**: Leeres FormData → zod-Fail → 400 (`not.toBe(401)` grün). Beweist "kein 401-Gate", nicht den echten Auth-Erfolgspfad. Im Code ehrlich als manuell-deferred (Plan 4.4) deklariert.
- **Decision**: SKIPPED

### F5 — cleanupTestAccount statt geplantem Namen cleanupTestData

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: src/test/integration/accounts.ts:50
- **Detail**: Reiner Namens-Drift; Verhalten identisch + zusätzliches `signOut`. Trivial.
- **Decision**: SKIPPED
