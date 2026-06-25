---
date: 2026-06-24T05:27:52+0200
researcher: Damian
git_commit: 9aa3bbea13832fbdcd66efd483b423ee6dfd19e8
branch: main
repository: spyrad/persona-forge
topic: "Test-Rollout Phase 3 — Quality-gates wiring (CI test-gate before deploy)"
tags: [research, codebase, ci-cd, github-actions, supabase, vitest, quality-gates, playwright]
status: complete
last_updated: 2026-06-24
last_updated_by: Damian
---

# Research: Quality-gates wiring (CI test-gate before deploy)

**Date**: 2026-06-24T05:27:52+0200
**Researcher**: Damian
**Git Commit**: 9aa3bbea13832fbdcd66efd483b423ee6dfd19e8
**Branch**: main
**Repository**: spyrad/persona-forge

## Research Question

Rollout Phase 3 of `context/foundation/test-plan.md` ("Quality-gates wiring"): make
`npm run test` a required CI gate **before** the Cloudflare deploy job so a red test
blocks the deploy — closing the archived S-01 "CI lint-fail silently skips deploy" gap.
Optionally consolidate the ad-hoc two-account RLS matrix into a wired Playwright smoke,
only if it adds signal beyond the integration layer.

**Scope locked at research kickoff (user decision):**

- Gate scope: wire **unit** `npm run test` as the gate now; **research** integration-in-CI
  feasibility as an option for the plan to decide.
- E2E smoke: **research only** (current state + signal question); decision deferred to `/10x-plan`.

## Summary

1. **The gate is genuinely missing.** `.github/workflows/ci.yml` runs `lint` + `build`
   only — **no `npm run test` step exists in any job**. A logic/behavior regression
   (the five risks Phases 1–2 just covered) deploys green today because no test ever
   gates it. This is the load-bearing gap Phase 3 closes.

2. **"Silent skip" has two distinct readings, both real.** (a) `deploy` has `needs: ci`
   - an `if:` push-to-main guard, so a red `ci` _skips_ `deploy` — and a skipped deploy
     looks operationally identical to a healthy one absent a required status check, so prod
     silently stays on the old version (the original S-01 June-15 lesson). (b) There is no
     test step at all, so `ci` goes green on lint+build alone (the test-plan's framing).
     Phase 3 targets (b); a branch-protection note addresses (a).

3. **Terminology reconciliation needed.** The change intent says "`npm run test`
   (unit + integration)", but in this repo `npm run test` = **unit only** (Docker-free);
   integration is a _separate_ command `npm run test:integration` that needs a live local
   Supabase (Docker) + `.env.test`. The plan must treat these as two distinct gates.

4. **Unit gate is trivial and zero-risk.** Add one `- run: npm run test` step to the `ci`
   job. Docker-free, ~seconds, gates `deploy` automatically via the existing `needs: ci`.

5. **Integration-in-CI is feasible and cheap (Option A).** Official `supabase/setup-cli@v2`
   - `supabase start` on `ubuntu-latest` (Docker preinstalled) works out of the box; the
     repo is ~90% pre-wired: `enable_confirmations = false` already set, `setup.ts` already
     lets CI `process.env` win over `.env.test`, and the safety-guard already accepts
     `127.0.0.1`. Cost ≈ +3–6 min/run cold-start; free on a public repo. Recommended as a
     **separate `integration` job** that also gates `deploy`.

6. **Playwright smoke adds marginal signal.** Playwright is not installed. The "ad-hoc
   two-account RLS matrix" is a _markdown test-pattern description_, not runnable code —
   and its behavior is **already implemented** as `rls-cross-tenant.itest.ts`. A browser
   smoke would only add the middleware 302-redirect + cookie-roundtrip path (Risk #5's
   transport layer), which is framework-level and low-regression. Lean **skip**; the plan
   decides.

## Detailed Findings

### CI/CD ground truth (`.github/workflows/ci.yml`)

The single workflow file (51 lines); **the only file under `.github/`** — no CODEOWNERS,
no rulesets, no other workflows.

**Triggers** (`ci.yml:3-7`): `push` → `main` and `pull_request` → `main`.

**Job `ci`** (`ci.yml:10-24`) — runs on every push AND PR:

1. `actions/checkout@v4`
2. `actions/setup-node@v4` (node 22, `cache: npm`)
3. `npm ci`
4. `npx astro sync`
5. `npm run lint`
6. `npm run build` (env `SUPABASE_URL`/`SUPABASE_KEY` from secrets)

→ **No `npm run test`. No `astro check` typecheck step (lint only).**

**Job `deploy`** (`ci.yml:26-50`) — gated by `needs: ci` (`:27`) +
`if: github.event_name == 'push' && github.ref == 'refs/heads/main'` (`:28`).
Steps: checkout → setup-node → `npm ci` → `npm run build` → `cloudflare/wrangler-action@v3`
with the `secrets: |` block syncing `SUPABASE_URL`/`SUPABASE_KEY` into the Worker (`:45-50`).

**Workflow git history** (only 3 commits ever touched it):

- `a931173` (Jun 11) scaffold — created the `ci` job (lint+build, no deploy, no test).
- `2f04fee` (Jun 12) — introduced the `deploy` job + `needs: ci`/`if:` gating.
- `e298d17` (Jun 12) — appended the secrets-sync block. **No commit has ever added a test gate.**

**Branch protection:** none as code. `gh` CLI unavailable in research session, so live
server-side protection could not be API-verified — but CLAUDE.md ("Push auf `main`
deployt automatisch") plus the standing "always check the deploy job after pushing"
remediation across changelogs strongly indicate **no required status check on main**.
→ The plan should treat "make `ci` a required check on `main`" as an open, GitHub-UI/API
side task that complements the in-YAML gate (the YAML alone cannot force a required check).

### The S-01 lesson — exact wording + mechanism

- **Origin** (`context/foundation/roadmap.md:237`):
  > "Lesson: CI-Lint-Fehler skippt den deploy-Job lautlos (Prod blieb auf altem Stand) —
  > nach Push auf `main` immer den deploy-Job prüfen."
- **Changelog** (`dtb-project/project-changelog/2026-06/2026-06-15.md:114-115`):
  > "**CI-Lint blockt Deploy lautlos:** Roter `npm run lint` → `deploy` skippt (kein Alarm)."
- **Test-plan framing** (`context/foundation/test-plan.md:127-129`):
  > "today CI can go green on a lint pass while no test ever runs, and a lint failure
  > silently skips the deploy (archive S-01 lesson). §3 Phase 3 wires the test run explicitly."

Mechanism: `needs: ci` makes a red `ci` _skip_ `deploy` (not fail loudly). Without a
required status check, a skip is indistinguishable from success → prod silently stale.
Separately, the absence of a test step means logic regressions pass the gate entirely.

### Integration test infrastructure — what CI must provide

**Two Vitest configs:**

- `vitest.config.ts` (unit): `include: ["src/**/*.test.ts"]`, Node env, no setup, alias `@`→`./src`. Docker-free.
- `vitest.integration.config.ts` (integration): `include: ["src/**/*.itest.ts"]`,
  `fileParallelism: false` (sequential — shared local DB), `setupFiles: ["./src/test/integration/setup.ts"]`,
  alias `astro:env/server` → `./src/test/integration/astro-env-server.stub.ts`.

**Unit test files** (`src/**/*.test.ts`, all pure `src/lib/` logic, Docker-free):
`crypto.test.ts`, `url-guard.test.ts`, `persona-compile.test.ts`,
`runs/oejts-run.test.ts`, `runs/oejts-score.test.ts`, `runs/oejts-aggregate.test.ts`.

**Integration test files** (`src/test/integration/*.itest.ts`):
`rls-cross-tenant` (Risk #1), `auth-gates` (Risk #5, 401 on protected routes),
`key-boundary` (Risk #2), `run-integrity` (Risk #4), `ssrf-boundary` (Risk #3),
`smoke` (harness bootstrap).

**The safety guard** (`src/test/integration/setup.ts:47-51`): hard-throws unless
`SUPABASE_URL` hostname is `127.0.0.1` or `localhost`. Loads `.env.test` manually via
`node:fs`, but **only fills keys not already in `process.env`** (`setup.ts:30`) — so CI
can export env directly and skip writing a file. Requires three vars: `SUPABASE_URL`
(http local), `SUPABASE_KEY` (anon/publishable, never service_role), `ENCRYPTION_KEY`
(base64 32-byte AES-256-GCM).

**`astro:env/server` stub** (`src/test/integration/astro-env-server.stub.ts`): re-exports
`process.env.{SUPABASE_URL,SUPABASE_KEY,ENCRYPTION_KEY}` so plain Vitest resolves the
virtual module used by `src/lib/supabase.ts` and `src/lib/encryption-key.ts`.

**Two-account harness** (`accounts.ts`): `createTestAccount()` programmatic `signUp`+`signIn`,
timestamp email `pf-itest-${Date.now()}-…@example.com`, fixed password, `persistSession:false`,
anon key (no service_role). `cleanupTestAccount()` deletes owned `runs`/`personas`/`model_configs`
(cascade handles children). `fixtures.ts` builds real rows (`makePersona`/`makeModelConfig`/
`makeCompletedRun`/`makePendingRun`/`makeRunningRun`/`makeFailedRun`/`rowExists`).

**Runtime dependency list for `npm run test:integration`:**

- Docker + local Supabase stack (Postgres 17 @ `54322`, API/GoTrue @ `54321`).
- All 8 migrations in `supabase/migrations/` applied (auto by `supabase start`).
- **No `seed.sql`** (config references it but file absent → empty start is fine).
- `enable_confirmations = false` already in `supabase/config.toml:209` → programmatic
  `signUp` yields an immediate usable session (no SMTP).
- `.env.test` (gitignored) OR CI-exported env. Sequential run, ~2–5 min.

### Supabase-in-CI feasibility (external research, current 2026 docs)

**Verdict: feasible, low-risk — Option A.** Docker is preinstalled and running on
`ubuntu-latest`; official `supabase/setup-cli@v2` installs the CLI; `supabase start`
auto-applies migrations + seed. Cold start ≈ 2–5 min (image pull every run on hosted
runners). The old "supabase start broken in GA" issue ([cli#1737]) was a 1.120.x
regression, irrelevant to this repo's CLI `^2.23.4`.

**Options matrix:**

| Option                                               | What                                                         | Auth/GoTrue | Verdict                                                                                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **(A) `supabase start` full stack via CLI**          | `setup-cli@v2` → `supabase start` → `supabase status -o env` | ✅ real     | **Recommended.** Highest fidelity, ~zero code change (guard + confirmations already correct). +3–6 min/run, free on public repo |
| (B) `postgres:` service container + `psql`/`db push` | SQL only, no GoTrue                                          | ❌ none     | **Breaks every auth test** (`signUp`, `auth.uid()` RLS). Rejected                                                               |
| (C) Remote CI/preview Supabase project               | hosted, via access token                                     | ✅ real     | **Requires gutting the safety-guard** + cross-tenant data risk + flaky shared state. Rejected for this scale                    |
| (D) Status quo — unit-only gate                      | keep integration local-only                                  | n/a         | Zero cost; integration regressions only caught locally. The fallback                                                            |

**Option A specifics:**

- Connection export: `supabase status -o env` (CLI v2 supports `env`/`json`/`pretty`/`toml`/`yaml`).
  Emits `API_URL`, `ANON_KEY`, … → remap to `SUPABASE_URL`/`SUPABASE_KEY` via shell into
  `$GITHUB_ENV` (or `--override-name api.url=SUPABASE_URL --override-name auth.anon_key=SUPABASE_KEY`).
  Because `setup.ts:30` prefers existing `process.env`, **no `.env.test` write needed**.
- `ENCRYPTION_KEY`: inject as repo secret or generate a throwaway base64 32-byte key
  (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`) — it only
  encrypts test fixtures.
- Slim the cold start with `supabase start -x imgproxy,storage-api,realtime,studio,edge-runtime,logflare,vector,supavisor,postgres-meta,mailpit`
  (suite touches only Postgres + GoTrue + PostgREST + Kong; confirmed no storage/realtime/edge usage).
- **Image caching via `actions/cache` is NOT worth it** (Supabase maintainers: cache payload ≈ download). Skip it.
- Pin `version: 2.23.4` to match `package-lock.json`.

**Reference job snippet** (sibling to `ci`, also gating `deploy`):

```yaml
integration:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: 22, cache: npm }
    - run: npm ci
    - uses: supabase/setup-cli@v2
      with: { version: 2.23.4, github-token: "${{ github.token }}" }
    - run: supabase start -x imgproxy,storage-api,realtime,studio,edge-runtime,logflare,vector,supavisor,postgres-meta,mailpit
    - name: Export Supabase env
      run: |
        supabase status -o env >> /tmp/sb.env
        echo "SUPABASE_URL=$(grep '^API_URL=' /tmp/sb.env | cut -d= -f2- | tr -d '\"')" >> "$GITHUB_ENV"
        echo "SUPABASE_KEY=$(grep '^ANON_KEY=' /tmp/sb.env | cut -d= -f2- | tr -d '\"')" >> "$GITHUB_ENV"
    - run: npm run test:integration
      env: { ENCRYPTION_KEY: "${{ secrets.ENCRYPTION_KEY }}" }
    - if: always()
      run: supabase stop --no-backup
```

### Playwright / two-account RLS matrix — current state + signal

- **Playwright not installed** (no `@playwright/test`, no `playwright.config.*`, no `*.spec.ts`,
  no `e2e/`). test-plan §4 marks it `n/a`.
- **The "ad-hoc two-account RLS matrix" is a markdown description, not code.** Origin:
  `context/archive/2026-06-20-visibility-controls/plan.md:289-301` ("manuell, kein Code —
  Playwright-MCP gegen Dev-Server, zwei Accounts"). Restated as the harness seed in
  `context/archive/2026-06-23-testing-integration-security-gate/research.md:212-214`.
- **Its behavior is already implemented** as `src/test/integration/rls-cross-tenant.itest.ts`
  (A→global visible to B, A→private disappears, B's PATCH/DELETE on A's id → 404/0-row,
  A's private never listed) — i.e. the matrix is covered at the service/DB layer.
- **What a browser smoke would uniquely add:** the middleware **302 redirect → login** path
  and the **cookie round-trip / SSR hydration** (`src/middleware.ts`: `PROTECTED_ROUTES =
["/dashboard","/models","/personas","/runs"]`, `context.redirect("/auth/signin")`).
  Integration `auth-gates.itest.ts` asserts the route handler **401** in-process but not the
  middleware 302 transport. This is Risk #5's transport layer — framework-level (Astro +
  @supabase/ssr), low regression probability.
- **Signal verdict: marginal.** All five risks are already tested where they live (DB/crypto/fetch).
  The browser-only delta is cookie/middleware flow, unlikely to regress absent an Astro/ssr
  major upgrade. Lean **skip** the smoke this phase; revisit if @supabase/ssr or middleware changes.

## Code References

- `.github/workflows/ci.yml:10-24` — `ci` job (lint+build, **no test step**)
- `.github/workflows/ci.yml:26-28` — `deploy` gating (`needs: ci` + push-to-main `if:`)
- `.github/workflows/ci.yml:41-50` — wrangler-action + Worker secrets-sync
- `package.json:13-16` — `test` (unit, `vitest run`) vs `test:integration` (`--config vitest.integration.config.ts`)
- `vitest.integration.config.ts` — `*.itest.ts` include, `fileParallelism:false`, `astro:env/server` alias
- `src/test/integration/setup.ts:30` — CI env wins over `.env.test`; `:47-51` — non-local URL guard; `:54-59` — required keys
- `src/test/integration/astro-env-server.stub.ts` — re-exports `process.env`
- `src/test/integration/accounts.ts` — two-account `signUp` harness (anon key)
- `src/test/integration/rls-cross-tenant.itest.ts` — the two-account RLS matrix, already implemented
- `src/middleware.ts` — `PROTECTED_ROUTES`, 302 redirect to `/auth/signin`
- `supabase/config.toml:209` — `enable_confirmations = false` (programmatic signUp yields session)
- `supabase/migrations/*.sql` — 8 migrations, auto-applied by `supabase start`; no `seed.sql`
- `.env.test.example` — `SUPABASE_URL` / `SUPABASE_KEY` / `ENCRYPTION_KEY` template

## Architecture Insights

- **The existing `needs: ci` chain is the lever.** Any test step added to the `ci` job (or
  any new job that `deploy` also `needs:`) automatically becomes a pre-deploy gate — no
  restructuring required. Unit → into `ci`; integration → ideally a separate `integration`
  job for clear signal + parallelism, with `deploy` updated to `needs: [ci, integration]`.
- **Two layers of "gate" must not be conflated:** the _in-YAML_ job dependency (blocks the
  deploy job within a run) vs. a GitHub _required status check_ (blocks merge / makes a skip
  visible). The S-01 "silent skip" is fundamentally the _missing required check_; the YAML
  gate alone doesn't surface a skipped deploy.
- **The repo was deliberately pre-wired for CI integration** (confirmations off, guard accepts
  127.0.0.1, env precedence) — Phases 1–2 left the door open for exactly this.
- **Cost × signal (test-plan §1):** unit gate = pure upside (cheap, blocks logic regressions).
  Integration gate = high signal (the five risks) at modest cost. Playwright smoke = high
  cost/brittleness for a delta already de-risked at the framework level.

## Historical Context (from prior changes)

- `context/foundation/test-plan.md:75-88` — Phase 3 row + rationale ("only meaningful once
  tests exist; closes the CI lint-fail skip-deploy gap").
- `context/foundation/test-plan.md:114-129` — §5 Quality Gates: unit+integration "required
  after §3 Phase 1"; e2e "optional after §3 Phase 3".
- `context/archive/2026-06-23-testing-integration-security-gate/` — Phase 1 (Risks #1/#2/#5,
  built the two-account harness). `plan.md:76` confirms test-run wiring was deferred to Phase 3.
- `context/archive/2026-06-23-testing-run-integrity-ssrf/` — Phase 2 (Risks #4/#3); cookbook
  §6.5 notes (`vi.stubGlobal("fetch")` must pass-through 127.0.0.1; SSRF guard at two sites).
- `context/archive/2026-06-20-visibility-controls/plan.md:289-301` — origin of the manual
  two-account RLS matrix (now superseded by `rls-cross-tenant.itest.ts`).

## Related Research

- `context/archive/2026-06-23-testing-integration-security-gate/research.md` — Phase 1 research
  (harness design, RLS policy grounding).
- `context/archive/2026-06-23-testing-run-integrity-ssrf/research.md` — Phase 2 research
  (run engine, SSRF call-sites).

## Open Questions

1. **Integration gate now or deferred?** User scope picked "unit now, integration researched."
   Plan must decide: add the `integration` job this phase (Option A, +3–6 min/run) or land
   unit-only first and follow up. Research says Option A is cheap and feasible — recommend
   including it, but it's a plan call.
2. **Required status check on `main`.** The in-YAML gate cannot make `ci`/`integration` a
   _required_ check (the thing that makes a skipped deploy visible). Needs a GitHub repo
   setting (branch protection / ruleset) — out-of-band manual/`gh api` step. Include as a
   plan task with explicit "manual" tag.
3. **`ENCRYPTION_KEY` provisioning in CI** — repo secret vs. generated throwaway. Either works
   (test fixtures only); pick one in the plan.
4. **PR vs. main cadence for the integration job** — every PR (fast feedback, +cold-start tax)
   vs. main-only/labeled (cheaper). Minor; plan decides.
5. **Typecheck gate?** `astro check` is not in CI today (lint only). Out of Phase 3 scope but
   worth a one-line note — adding `npm run build` already catches most type drift via the
   Astro build.
