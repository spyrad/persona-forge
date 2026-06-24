# Quality-gates wiring (CI test-gate before deploy) — Plan Brief

> Full plan: `context/changes/testing-quality-gates-wiring/plan.md`
> Research: `context/changes/testing-quality-gates-wiring/research.md`

## What & Why

Make the test suite an enforced pre-deploy gate. Today CI runs only `lint` + `build`, so
a logic/RLS/auth/run/SSRF regression deploys green — no test ever blocks it. This is
Phase 3 of the test rollout: wire `npm run test` (unit) and a Supabase-backed integration
job as gates before the Cloudflare deploy, and close the archived S-01 "lint-fail
silently skips deploy" gap.

## Starting Point

`.github/workflows/ci.yml` has a `ci` job (lint + build) and a `deploy` job (`needs: ci`,
push-to-main only). No `npm run test` anywhere. The integration harness (6 `*.itest.ts`)
already exists from Phases 1–2 and is CI-ready by construction (env-precedence in
`setup.ts`, `127.0.0.1` guard, `enable_confirmations=false`, auto-applied migrations).
`main` is direct-push with no branch protection.

## Desired End State

A failing unit OR integration test blocks the deploy. A new `integration` job boots local
Supabase via `supabase/setup-cli@v2` + `supabase start` and runs green on PR and main-push.
`main` requires the `ci` + `integration` checks, so a red/skipped run is visible rather
than silent. The test-plan records Phase 3 complete and the deliberate e2e-skip.

## Key Decisions Made

| Decision               | Choice                                                                    | Why                                                                                                                   | Source   |
| ---------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------- |
| Gate scope             | Unit step in `ci` + separate `integration` job; `deploy` needs both       | Closes the gap fully; repo is pre-wired for Supabase-in-CI                                                            | Plan     |
| Integration in CI      | Option A: `supabase start` full stack via CLI                             | Only option that exercises real Auth/RLS; ~zero code change; cheap on public repo                                     | Research |
| Silent-skip fix        | Manual branch-protection: `ci`+`integration` as required checks on `main` | YAML `needs:` blocks deploy but can't make a skip visible — the true S-01 fix                                         | Plan     |
| `ENCRYPTION_KEY` in CI | Generated throwaway in the job step                                       | Only encrypts ephemeral test fixtures; no secret to manage                                                            | Plan     |
| Integration cadence    | Every PR + main-push                                                      | Earliest signal — catches regressions before merge                                                                    | Plan     |
| Playwright smoke       | Dropped this phase                                                        | Two-account RLS matrix already covered by `rls-cross-tenant.itest.ts`; browser delta is low-regression framework code | Research |

## Scope

**In scope:** unit-test step in `ci`; new Supabase `integration` job; `deploy` →
`needs: [ci, integration]`; branch protection on `main`; test-plan/lessons closeout.

**Out of scope:** Playwright/e2e smoke; `astro check` typecheck gate; remote/preview
Supabase for tests; Docker-image caching; any change to deploy/secrets-sync mechanics.

## Architecture / Approach

The existing `needs:` chain is the lever: any job `deploy` depends on becomes a gate.
Phase 1 adds the Docker-free unit step to `ci`. Phase 2 adds an `integration` job
(`setup-cli@v2` → `supabase start -x …` → export `API_URL`/`ANON_KEY` to `$GITHUB_ENV` +
throwaway `ENCRYPTION_KEY` → `npm run test:integration` → `supabase stop`) and re-points
`deploy` to `needs: [ci, integration]`. Phase 3 sets the GitHub required-status-check
(out-of-repo) and updates docs.

## Phases at a Glance

| Phase                       | What it delivers                                      | Key risk                                     |
| --------------------------- | ----------------------------------------------------- | -------------------------------------------- |
| 1. Unit-Test-Gate           | `npm run test` in `ci`, gating deploy                 | Minimal — unit suite already green           |
| 2. Integration job          | Supabase-in-CI integration gate + `deploy needs both` | Cold-start time / occasional GHCR pull flake |
| 3. Branch-protection + docs | Required checks on `main` (manual) + closeout         | Shifts main to a PR flow; manual GitHub step |

**Prerequisites:** GitHub repo admin access for branch protection; Phases 1–2 verified by
a real Actions run (push branch / open PR).
**Estimated effort:** ~1–2 sessions across 3 phases (mostly YAML + one Actions round-trip).

## Open Risks & Assumptions

- `supabase start` cold-start adds ~3–6 min/PR; occasional GHCR pull timeouts (mitigated
  by version pin + `-x` slim set).
- Required checks fully close the silent-skip gap only if `main` moves to a PR flow —
  this is the intended habit change, recorded in Migration Notes.
- Assumes `npm run test` (unit) needs no Supabase/env — confirmed Docker-free in Phases 1–2.

## Success Criteria (Summary)

- A red unit or integration test blocks the deploy (verified by a deliberate-failure PR).
- The `integration` job runs the real suite against local Supabase, green, on PR + main.
- A skipped/red pipeline is visible on `main` via required checks — S-01 closed.
