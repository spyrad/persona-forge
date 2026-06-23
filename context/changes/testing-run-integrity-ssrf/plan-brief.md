# Test-Rollout Phase 2 — Lauf-Integrität (R4) & SSRF (R3) — Plan Brief

> Full plan: `context/changes/testing-run-integrity-ssrf/plan.md`
> Research: `context/changes/testing-run-integrity-ssrf/research.md`

## What & Why

Phase 2 des Test-Rollouts (`test-plan.md` §3) sichert zwei Risiken regressionsfest
ab: **R4 (Lauf-Integrität)** — ein abgebrochener Run darf keine Teildaten
hinterlassen, ein doppelter Step keine Duplikat-Repetition — und **R3 (SSRF)** —
eine attacker-kontrollierte Base-URL muss am echten Outbound-Request-Boundary
geblockt werden. Beide Verhaltensweisen sind bereits korrekt implementiert; die
Tests friEren sie ein.

## Starting Point

Das Phase-1-Harness (`src/test/integration/`) fährt zwei echte authentifizierte
Supabase-Sessions gegen ein lokales Docker-Supabase und ist ~100 %
wiederverwendbar. Es fehlen drei Bausteine: Builder für nicht-fertige Runs (nur
`makeCompletedRun` existiert), ein LLM-HTTP-Mock und test-connection-Tests.

## Desired End State

`npm run test:integration` führt zwei neue Suites grün aus, die beweisen: Abort =
vollständiges Verwerfen (Cascade), Step idempotent (Terminal + Nebenläufig), kein
partielles Aggregat, Fehlerquote korrekt — und SSRF-Abweisung an **beiden**
Call-Sites plus Redirect-Block. Kein Produktcode geändert.

## Key Decisions Made

| Decision                | Choice                            | Why (1 sentence)                                                              | Source   |
| ----------------------- | --------------------------------- | ----------------------------------------------------------------------------- | -------- |
| LLM-Mock-Schicht        | Global `fetch`-Kante stubben      | Treu zu §6.2; der echte SSRF-Guard in `chatCompletion` läuft mit              | Plan     |
| Idempotenz-Test         | Terminal **+** Nebenläufig        | Deckt den leichten Pfad UND den echten 23505-Concurrency-Catch ab             | Plan     |
| SSRF-Payload-Tiefe      | Repräsentative Auswahl je Site    | Beweist Verdrahtung ohne `url-guard.test.ts` zu duplizieren (§2-Anti-Pattern) | Plan     |
| Run-Builder             | In shared `fixtures.ts`           | Konsistent mit Phase 1, von Phase 3 wiederverwendbar                          | Plan     |
| Request-Härtung         | SSRF-URL **+** 3xx-Redirect-Block | Redirect-Following ist ein realer SSRF-Bypass; Timeout ausgelassen (Flake)    | Plan     |
| Datei-Organisation      | Zwei Dateien (R4 / R3 getrennt)   | Eine Sorge pro Datei, wie Phase 1 (`rls-cross-tenant` etc.)                   | Plan     |
| Guard ist 2× verdrahtet | Beide Sites separat testen        | Kein gemeinsamer Outbound-Wrapper — jede Site braucht Abdeckung               | Research |

## Scope

**In scope:** Run-Builder (pending/running/failed) + fetch-Mock-Helper;
`run-integrity.itest.ts` (Abort/Cascade, Idempotenz, Failure-Quote);
`ssrf-boundary.itest.ts` (beide Call-Sites + Redirect); test-plan/Cookbook-Doku.

**Out of scope:** url-guard-/Scoring-Re-Coverage; Timeout-Pfad; CI-Gate (Phase 3);
Resume-/Auto-Cleanup; jeglicher Produktcode/Migration; `service_role`/Service-Mocks.

## Architecture / Approach

Harness-Erweiterung zuerst (geteilte Builder + fetch-Kanten-Mock). Dann zwei
Suites, die Handler/Services direkt In-Process aufrufen (`makeApiContext`,
`processNextRepetition`, `deleteRun`, `getRunResult`) und den **beobachtbaren**
Effekt asserten — nicht die Cascade-/Catch-Mechanik. Der fetch-Mock erlaubt
R4-Happy-Path, während der echte SSRF-Guard für R3 mitläuft (er wirft vor dem
fetch, daher braucht der R3-Run-Step keinen Mock).

## Phases at a Glance

| Phase                  | What it delivers                  | Key risk                                    |
| ---------------------- | --------------------------------- | ------------------------------------------- |
| 1. Harness-Erweiterung | 3 Run-Builder + fetch-Mock-Helper | Mock-Leck zwischen sequenziellen Tests      |
| 2. R4 Lauf-Integrität  | `run-integrity.itest.ts`          | Nebenläufigkeits-Test-Flake (23505-Pfad)    |
| 3. R3 SSRF-Boundary    | `ssrf-boundary.itest.ts`          | SSRF-URL-Fixture muss Service-Guard umgehen |
| 4. Closeout            | test-plan §3/§6.5/§6.6, Cookbook  | —                                           |

**Prerequisites:** lokales Docker-Supabase (`npx supabase start` + `.env.test`,
ggf. `db reset`); Phase-1-Harness (vorhanden).
**Estimated effort:** ~1-2 Sessions über 4 Phasen.

## Open Risks & Assumptions

- Der 23505-Nebenläufigkeitspfad ist auf `completedReps=0` angewiesen — verschiebt
  ein vorab eingefügter Rep den `rep_index`, verfehlt der Test den Catch.
- fetch-Stub muss in `afterEach` via `vi.unstubAllGlobals()` zurückgesetzt werden,
  sonst leckt er in andere itests (sequenzieller Runner).
- Die SSRF-URL-Fixture muss `base_url` per direktem Client-`update` setzen (der
  Service-Guard würde sie beim Anlegen ablehnen) — spiegelt den realen
  Call-Zeit-Defense-in-depth-Fall.

## Success Criteria (Summary)

- Abort → run + alle Repetitions weg; `getRunResult` === null; kein partielles
  Aggregat je `ready`.
- Doppel-Step (Terminal + nebenläufig) → genau 1 Repetition.
- SSRF-Adressen an test-connection **und** Run-Step abgewiesen; 3xx je Site geblockt.
