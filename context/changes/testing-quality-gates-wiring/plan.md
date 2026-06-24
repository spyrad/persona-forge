# Quality-gates wiring (CI test-gate before deploy) Implementation Plan

## Overview

Make the test suite an enforced pre-deploy gate. Today `.github/workflows/ci.yml`
runs only `lint` + `build`, so no test ever blocks a Cloudflare deploy. This plan adds
a `npm run test` (unit) step to the `ci` job, a new Supabase-backed `integration` job,
makes `deploy` depend on both, and closes the S-01 "silent skip" gap with a manual
required-status-check on `main`. The optional Playwright two-account smoke is
deliberately dropped — its behavior is already covered by `rls-cross-tenant.itest.ts`.

## Current State Analysis

- `.github/workflows/ci.yml` has two jobs: `ci` (checkout → setup-node 22 → `npm ci`
  → `npx astro sync` → `npm run lint` → `npm run build`) and `deploy` (`needs: ci`,
  `if: push && refs/heads/main`, build + `cloudflare/wrangler-action@v3` with Worker
  secrets-sync). **No `npm run test` anywhere** (`ci.yml:10-50`).
- `npm run test` = Vitest unit (`src/**/*.test.ts`, Node env, Docker-free, 6 files of
  pure `src/lib/` logic). `npm run test:integration` = Vitest integration
  (`src/**/*.itest.ts`, sequential, needs local Supabase + `.env.test`).
- Integration harness is CI-ready by construction: `setup.ts:30` lets existing
  `process.env` win over `.env.test`; `setup.ts:47-51` guard accepts `127.0.0.1`/
  `localhost`; `supabase/config.toml:209` has `enable_confirmations = false` so
  programmatic `signUp` yields a session; 8 migrations auto-apply on `supabase start`;
  no `seed.sql` required.
- `deploy` is gated only in-YAML (`needs: ci`). No branch protection exists as code,
  and the project direct-pushes to `main` (CLAUDE.md "Push auf `main` deployt
  automatisch"), so a _skipped_ deploy is operationally invisible — the core S-01 gap.
- Playwright is not installed; the "ad-hoc two-account RLS matrix" is a markdown
  description (`context/archive/2026-06-20-visibility-controls/plan.md:289-301`) whose
  behavior is already implemented in `src/test/integration/rls-cross-tenant.itest.ts`.

## Desired End State

- A failing unit OR integration test blocks `deploy` (gate enforced within the Actions run).
- The `integration` job stands up local Supabase via `supabase/setup-cli@v2` +
  `supabase start`, runs `npm run test:integration` green on PR and on main-push.
- `main` has a branch-protection rule requiring the `ci` and `integration` status
  checks, so a red/skipped run is visible (closes S-01).
- `context/foundation/test-plan.md` Phase 3 reads `complete`; §5 gates updated; the
  e2e-skip decision is recorded; cookbook §6.6 carries a Phase-3 note; a lessons entry
  captures the YAML-gate-vs-required-check distinction.

**Verify:** open a throwaway PR with a deliberately failing test → `ci`/`integration`
job goes red → `deploy` does not run and the PR shows a failing required check. Revert →
all green → deploy proceeds on merge/push.

### Key Discoveries:

- The existing `needs:` chain is the lever — any job `deploy` `needs:` becomes a gate
  (`ci.yml:27`).
- `setup.ts:30` env-precedence means CI can export `SUPABASE_URL`/`SUPABASE_KEY` to
  `$GITHUB_ENV` and skip writing `.env.test` entirely.
- `supabase status -o env` (CLI v2) emits `API_URL`/`ANON_KEY`; remap via shell to the
  repo's `SUPABASE_URL`/`SUPABASE_KEY` names.
- `enable_confirmations = false` (`config.toml:209`) is already the modern nested
  `[auth.email]` key — no change needed for CI signups.
- A required status check is a GitHub repo setting; YAML alone cannot make a skipped
  deploy visible (the true S-01 fix).

## What We're NOT Doing

- **No Playwright / e2e smoke.** The two-account RLS matrix is already covered at the
  service/DB layer (`rls-cross-tenant.itest.ts`); a browser smoke would only add the
  middleware-302 + cookie-roundtrip path (framework-level, low regression) at high
  cost/brittleness. Recorded as a deliberate skip; revisit on an Astro/@supabase/ssr
  major upgrade.
- **No `astro check` typecheck gate.** Out of scope; `npm run build` already catches
  most type drift. Noted as a future option only.
- **No remote/preview Supabase for tests** (would require gutting the local-only safety
  guard) and **no Docker-image caching** (proven not worth it on hosted runners).
- **No change to the Worker secrets-sync or deploy mechanics.**

## Implementation Approach

Three incremental phases, each independently landable. Phase 1 is a one-line, Docker-free
win. Phase 2 adds the integration job and re-points `deploy`'s `needs`. Phase 3 is the
out-of-repo branch-protection step plus documentation closeout. Phases 1–2 are verified
by a real Actions run (push a branch / open a PR); Phase 3's gate is verified by the
failing-check experiment in Desired End State.

## Phase 1: Unit-Test-Gate in the `ci` job

### Overview

Add `npm run test` to the existing `ci` job so unit failures block the build and, via
`needs: ci`, the deploy.

### Changes Required:

#### 1. CI workflow — unit test step

**File**: `.github/workflows/ci.yml`

**Intent**: Run the Docker-free unit suite in CI as a gate. Place it after `npx astro
sync` (so generated `astro:env` types exist) and before `npm run build`, so a logic
regression fails fast before the build artifact is produced.

**Contract**: New `- run: npm run test` step in the `ci` job's `steps:` list, between
the `astro sync` step (`ci.yml:19`) and the `lint`/`build` steps. No new env required
(unit suite is self-contained). The `deploy` gate is unchanged — it already `needs: ci`.

### Success Criteria:

#### Automated Verification:

- Unit suite passes: `npm run test`
- Lint passes: `npm run lint`
- The step is present: `ci.yml` contains a `npm run test` run line in the `ci` job

#### Manual Verification:

- A pushed branch / PR shows the `ci` job running `npm run test` and going green

**Implementation Note**: After automated verification passes, pause for human
confirmation before Phase 2.

---

## Phase 2: Supabase-backed `integration` job + deploy gate

### Overview

Add a new `integration` job that boots local Supabase and runs the integration suite,
then make `deploy` depend on both `ci` and `integration`. Runs on PR and main-push.

### Changes Required:

#### 1. CI workflow — new `integration` job

**File**: `.github/workflows/ci.yml`

**Intent**: Stand up a real local Supabase stack on the runner and run
`npm run test:integration` against it, exercising the five risk areas (RLS, key
boundary, auth gates, run integrity, SSRF) as a gate. No `if:` guard → runs on every
trigger (PR + push), giving pre-merge signal.

**Contract**: New top-level job `integration` (sibling of `ci`), `runs-on: ubuntu-latest`,
steps in order:

1. `actions/checkout@v4`
2. `actions/setup-node@v4` (node 22, `cache: npm`) → `npm ci`
3. `supabase/setup-cli@v2` with `version: 2.23.4` (match `package-lock.json`) and
   `github-token: ${{ github.token }}`
4. `supabase start` with the slim exclude set (only Postgres + GoTrue + PostgREST +
   Kong are needed)
5. Export connection info into `$GITHUB_ENV` (remap `API_URL`→`SUPABASE_URL`,
   `ANON_KEY`→`SUPABASE_KEY`); generate a throwaway `ENCRYPTION_KEY`
6. `npm run test:integration`
7. `supabase stop --no-backup` with `if: always()`

The exclude flag and env-export are the non-obvious parts:

```yaml
- run: supabase start -x imgproxy,storage-api,realtime,studio,edge-runtime,logflare,vector,supavisor,postgres-meta,mailpit
- name: Export Supabase env + throwaway encryption key
  run: |
    supabase status -o env >> /tmp/sb.env
    echo "SUPABASE_URL=$(grep '^API_URL=' /tmp/sb.env | cut -d= -f2- | tr -d '\"')" >> "$GITHUB_ENV"
    echo "SUPABASE_KEY=$(grep '^ANON_KEY=' /tmp/sb.env | cut -d= -f2- | tr -d '\"')" >> "$GITHUB_ENV"
    echo "ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")" >> "$GITHUB_ENV"
```

#### 2. CI workflow — gate deploy on both jobs

**File**: `.github/workflows/ci.yml`

**Intent**: Make a red integration run block the deploy, not just a red `ci`.

**Contract**: Change the `deploy` job's `needs: ci` (`ci.yml:27`) to `needs: [ci, integration]`.
The `if: push && refs/heads/main` guard is unchanged (PRs still never deploy).

### Success Criteria:

#### Automated Verification:

- Integration suite passes locally against a running local Supabase:
  `npx supabase start` then `npm run test:integration`
- Workflow is valid YAML and `deploy` lists both deps: `ci.yml` `needs: [ci, integration]`
- CLI version pin matches lockfile: `supabase` `2.23.4` in `package-lock.json`

#### Manual Verification:

- A pushed branch / PR shows the `integration` job: `supabase start` succeeds, migrations
  apply, `npm run test:integration` goes green (cold start ~3–6 min)
- On a main-push, `deploy` runs only after both `ci` and `integration` succeed
- A deliberately failing integration test keeps `deploy` from running

**Implementation Note**: After automated verification passes, pause for human
confirmation (this phase is only fully verifiable via a real Actions run) before Phase 3.

---

## Phase 3: Branch-protection (required checks) + documentation closeout

### Overview

Make `ci` and `integration` required status checks on `main` so a red/skipped run is
visible (the true S-01 fix), then update the test-plan and lessons to reflect Phase 3
landing and the e2e-skip decision.

### Changes Required:

#### 1. Branch protection on `main` (MANUAL — GitHub repo setting)

**File**: GitHub repo setting (not in-repo) — `spyrad/persona-forge` → Branch protection / ruleset for `main`

**Intent**: Require the `ci` and `integration` checks to pass and require a PR before
merging, so a failing/skipped pipeline blocks the change and is no longer silent. This
is the part YAML cannot express.

**Contract**: Enable on `main`: "Require status checks to pass" → select `ci` and
`integration`; "Require a pull request before merging" (recommended so the gate is
enforced pre-merge and the direct-push-to-main blind spot closes). Can be set via UI or
`gh api -X PUT repos/spyrad/persona-forge/branches/main/protection ...`. Document the
chosen toggles in the closeout note. Trade-off to record: this shifts the workflow from
direct-push-to-main toward a PR flow.

#### 2. Test-plan status + gates + e2e decision

**File**: `context/foundation/test-plan.md`

**Intent**: Reflect that Phase 3 landed and record the deliberate e2e-skip.

**Contract**: §3 table — Phase 3 Status `change opened` → `complete`. §5 — note the
`npm run test` (unit + integration) gate is now wired/required and that the lint-skip-
deploy gap is closed via branch protection; mark the e2e gate row as "deliberately
deferred (covered by integration `rls-cross-tenant.itest.ts`)". §6.3 — replace the TBD
with the decision + rationale (no Playwright this phase). Keep wording consistent with §1
cost×signal.

#### 3. Cookbook note + lessons entry

**File**: `context/foundation/test-plan.md` (§6.6) and `context/foundation/lessons.md`

**Intent**: Capture the one genuinely non-obvious learning for future readers.

**Contract**: §6.6 — 2–3 line Phase-3 note (CI integration via `supabase/setup-cli` +
`supabase start -x …`, env-export to `$GITHUB_ENV`, throwaway `ENCRYPTION_KEY`).
`lessons.md` — append a rule: "An in-YAML `needs:` gate blocks the deploy job within a
run, but does NOT make a skipped deploy visible — only a GitHub _required status check_
(branch protection) closes the silent-skip gap. Wire both."

### Success Criteria:

#### Automated Verification:

- Branch protection is active: `gh api repos/spyrad/persona-forge/branches/main/protection`
  returns the `ci` + `integration` required checks (if `gh` is authenticated)
- Docs updated: `test-plan.md` Phase 3 row reads `complete`; `lessons.md` has the new entry

#### Manual Verification:

- The failing-check experiment (Desired End State) blocks the PR and `deploy`
- Reverting to green lets the deploy proceed
- Test-plan §3/§5/§6.3 read coherently and match the shipped pipeline

**Implementation Note**: The branch-protection step is manual; confirm the GitHub setting
took effect before marking the phase complete.

---

## Testing Strategy

### Unit Tests:

- No new unit tests authored. The existing 6 `src/lib/**/*.test.ts` files become the
  unit gate; they must stay green.

### Integration Tests:

- No new integration tests authored. The existing 6 `src/test/integration/*.itest.ts`
  files become the integration gate, run in CI against `supabase start`.

### Manual Testing Steps:

1. Push a branch with a trivially failing unit test → confirm `ci` red, `deploy` absent.
2. Open a PR → confirm `integration` job boots Supabase and runs green (~3–6 min cold).
3. Add a failing integration assertion → confirm `integration` red blocks the PR/deploy.
4. After branch protection: confirm the PR shows `ci`/`integration` as _required_ checks
   and cannot merge while red.
5. Revert failures → confirm green → deploy proceeds on push to `main`.

## Performance Considerations

The `integration` job adds ~3–6 min/run (cold Docker image pull, unavoidable on hosted
runners). Mitigated by the `-x` exclude set (skips storage/realtime/studio/edge/etc.) and
pinning the CLI version. Image caching via `actions/cache` is intentionally skipped
(maintainer-confirmed: cache payload ≈ download, ~0 net gain).

## Migration Notes

Adopting a required PR flow on `main` (Phase 3) changes the team habit of direct-push-to-
main. This is the intended outcome (it closes the silent-skip blind spot). No data
migration. The throwaway `ENCRYPTION_KEY` only encrypts ephemeral test fixtures in a
per-run DB — no key management needed.

## References

- Research: `context/changes/testing-quality-gates-wiring/research.md`
- Test plan: `context/foundation/test-plan.md` (§3 Phase 3, §5 gates, §6.3 e2e)
- Current workflow: `.github/workflows/ci.yml`
- Integration harness: `src/test/integration/setup.ts:30,47-51`, `supabase/config.toml:209`
- S-01 origin: `context/foundation/roadmap.md:237`,
  `dtb-project/project-changelog/2026-06/2026-06-15.md:114-115`
- RLS matrix already covered: `src/test/integration/rls-cross-tenant.itest.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Unit-Test-Gate in the `ci` job

#### Automated

- [x] 1.1 Unit suite passes: `npm run test` — 99f6e52
- [x] 1.2 Lint passes: `npm run lint` — 99f6e52
- [x] 1.3 The step is present: `ci.yml` contains a `npm run test` run line in the `ci` job — 99f6e52

#### Manual

- [ ] 1.4 A pushed branch / PR shows the `ci` job running `npm run test` and going green

### Phase 2: Supabase-backed `integration` job + deploy gate

#### Automated

- [ ] 2.1 Integration suite passes locally: `npx supabase start` then `npm run test:integration`
- [x] 2.2 Workflow valid YAML and `deploy` lists `needs: [ci, integration]`
- [x] 2.3 CLI version pin matches lockfile: `supabase` `2.23.4` in `package-lock.json`

#### Manual

- [ ] 2.4 PR shows `integration` job: `supabase start` + migrations + `npm run test:integration` green
- [ ] 2.5 On main-push, `deploy` runs only after both `ci` and `integration` succeed
- [ ] 2.6 A deliberately failing integration test keeps `deploy` from running

### Phase 3: Branch-protection (required checks) + documentation closeout

#### Automated

- [ ] 3.1 Branch protection active: `gh api .../branches/main/protection` shows `ci` + `integration` required checks
- [ ] 3.2 Docs updated: `test-plan.md` Phase 3 row `complete`; `lessons.md` has the new entry

#### Manual

- [ ] 3.3 Failing-check experiment blocks the PR and `deploy`; revert → green → deploy proceeds
- [ ] 3.4 Test-plan §3/§5/§6.3 read coherently and match the shipped pipeline
