<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Test-Rollout Phase 2 — R4 & R3

- **Plan**: context/changes/testing-run-integrity-ssrf/plan.md
- **Scope**: Phasen 1–4 (alle)
- **Date**: 2026-06-23
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 3 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

Success-Criteria verifiziert: `npm run lint` 0 Fehler, `npx astro check` 0 Fehler,
`npm run test` 48 passed, `npm run test:integration` 74 passed.

Risiko-Schwerpunkte unabhängig verifiziert: Nebenläufigkeits-Test deterministisch
(23505-Verlierer liest unter Read-Committed zwingend die committete Gewinner-Zeile);
SSRF-Guard wirft VOR dem fetch (Mock-Pass-through für Call-Site 2 irrelevant).

## Findings

### F1 — Mock-Pass-through nutzt Substring statt Hostname

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/test/integration/llm-mock.ts:40
- **Detail**: Lokal-Erkennung `url.includes("127.0.0.1") || url.includes("localhost")` prüft die volle URL als Substring, nicht den Hostname. Eine LLM-URL mit "localhost" im Pfad/Query würde fälschlich ans echte fetch durchgereicht. Aktuell nicht ausgenutzt (LLM-URL ist api.example.com; SSRF-localhost fängt der Guard vor dem fetch). Reine Härtung.
- **Fix**: `new URL(url).hostname`-Vergleich statt `includes`, oder Kommentar, dass die Heuristik bewusst nur die Supabase-Local-URL (127.0.0.1:54321) meint.
- **Decision**: FIXED (hostname-Vergleich via `isLocalHost`)

### F2 — Env-Fallback baut still einen Leerstring-Client

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/test/integration/route-context.ts:83
- **Detail**: `process.env.SUPABASE_URL ?? ""` würde bei fehlendem Env still einen Leerstring-Client bauen, statt früh zu werfen — `accounts.ts:requireEnv` wirft hingegen. Inkonsistenz ohne Praxisfolge (setup.ts garantiert das Env).
- **Fix**: `requireEnv`-Muster aus accounts.ts wiederverwenden statt `?? ""`.
- **Decision**: FIXED (lokales `requireEnv` in `authedCookieHeader`)

### F3 — Plan benennt Mock-Helper inkonsistent (Doku, kein Code)

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/testing-run-integrity-ssrf/plan.md:155
- **Detail**: Der Plan nennt die Helper an einer Stelle `mockLlmOnce`/`mockLlmJson`, während Intent (§141) und alle Phase-3-Contracts `mockLlmContent`/`mockLlmRedirect`/`restoreLlm` verwenden. Implementierung folgt korrekt der dominanten Benennung. Reine Plan-Doku-Inkonsistenz, kein Verhaltens-Drift.
- **Fix**: plan.md:155 an die implementierten Namen angleichen (kosmetisch).
- **Decision**: FIXED (plan.md:152 auf `mockLlmContent` angeglichen)
