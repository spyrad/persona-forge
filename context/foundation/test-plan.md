# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-06-23

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic check that already catches the
   regression. The deterministic scoring core (`oejts-score`,
   `oejts-aggregate`) is already unit-tested — this rollout attacks the
   untested boundary (API, services, RLS, run-engine), not the covered core.
2. **User concerns are first-class evidence.** Risks anchored in "the
   developer is worried about X, and the failure would surface somewhere in
   <area>" carry the same weight as PRD lines or hot-spot data. The two
   stated top fears — a decrypted API key escaping over a boundary
   (interview Q1+Q4) and cross-tenant RLS leakage (Q3) — drive Phase 1.
3. **Risks are scenarios, not code locations.** This plan documents _what
   could fail_ and _why we believe it's likely_ — drawn from documents,
   interview, and codebase _signal_ (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src/` (app code; excludes
`node_modules`, tests, `context/`, `dtb-project/`).

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the _evidence that surfaced
this risk_ — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| #   | Risk (failure scenario)                                                                                                                                             | Impact | Likelihood | Source (evidence — not anchor)                                                                                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Cross-tenant leak: user A reads/updates/deletes user B's personas, runs, or model-configs via direct id access despite RLS; or a private object is visible globally | High   | High       | FR-003, §Access-Control guardrail "kein Leck über Nutzergrenzen", interview Q3, archive `2026-06-17-persona-catalog` + `2026-06-20-visibility-controls` lessons, hot-spot dir `src/lib/services/` (14 commits/30d)                                        |
| 2   | Decrypted API key escapes over a service/API boundary — appears in a response body or the client bundle                                                             | High   | Medium     | FR-006, NFR Key-/Daten-Dichtheit, interview Q1, interview Q4, hot-spot dir `src/lib/services/` (`model-configs` 4 commits/30d)                                                                                                                            |
| 3   | SSRF: an attacker-controlled base-URL (internal IPs, cloud metadata endpoint, numeric IPv4 forms) is not blocked at the real outbound-request boundary              | High   | Medium     | FR-005, archive `2026-06-15-model-config-management` lesson (dword/octal/hex IPv4 hardening), NFR Key-/Daten-Dichtheit                                                                                                                                    |
| 4   | Run integrity: an aborted run leaves partial data (a partial aggregate surfaces as a result), or a duplicated step call double-inserts a repetition                 | High   | Medium     | US-01 acceptance criteria, FR-012/FR-013/FR-014, archive `2026-06-17-oejts-measurement-run` lesson (unique `(run_id, rep_index)`, idempotent, abort = hard DELETE + cascade), hot-spot dirs `src/lib/services/` + `src/components/runs/` (11 commits/30d) |
| 5   | Auth gap: an unauthenticated request reaches a protected route (middleware regression)                                                                              | High   | Medium     | §Access Control, hot-spot file churn in `src/middleware.ts` (6 commits/30d)                                                                                                                                                                               |

Risk #1 and #2 are the developer's two stated top fears and are scheduled
first. Deterministic scoring/aggregation and the isolated `crypto` /
`url-guard` / `persona-compile` helpers are already unit-tested and are NOT
risk rows — Risks #2 and #3 deliberately target the _boundary enforcement_
those isolated units do not exercise.

### Risk Response Guidance

| Risk | What would prove protection                                                                                                                                                                                       | Must challenge                                                                                  | Context `/10x-research` must ground                                                     | Likely cheapest layer                             | Anti-pattern to avoid                                                                                           |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| #1   | Account A receives 404/403/0-rows on B's id across GET/PATCH/DELETE for personas, runs, and model-configs; a private object stays invisible to others; a global object is visible                                 | "Logged in = authorized"; "a 0-row RLS match = success" (S-02 lesson)                           | RLS policies per table, owner-scoping, the `visibility` value set at insert time        | integration (two authenticated Supabase sessions) | happy-path-only; mirroring the RLS policy SQL instead of driving two real accounts                              |
| #2   | Response body of `GET /api/models` (list + detail) and `test-connection` never contains the key (neither plaintext nor ciphertext); the key flows only server → LLM endpoint                                      | "Encrypted at rest = safe" — the decrypt path may still return it to the client                 | where decryption happens, which DTO the API serializes, which fields cross the boundary | integration (API-route response assertion)        | implementation mirror: asserting `encrypt()` was called instead of asserting the secret's absence in the output |
| #3   | A request to an internal / metadata IP (incl. `169.254.169.254`, `localhost`, dword/octal/hex forms) is rejected at the real boundary (test-connection AND the run step), not only in the isolated guard          | "url-guard is unit-tested, therefore safe" — is the guard actually invoked at the request site? | where the outbound request is built, whether the guard is wired in front of it          | integration (boundary enforcement)                | re-testing url-guard in isolation (already covered) instead of its enforcement                                  |
| #4   | Abort → the run is fully gone (no partial aggregate is rendered); a second step call with the same rep_index creates no duplicate; a partially-failed run reports its failure quota rather than a fake empty view | "Final status 200 = run OK"; "abort already deletes everything"                                 | step-endpoint transaction, the unique constraint, the cascade-delete, resume logic      | integration (endpoint + DB state)                 | mirroring the cascade-DELETE mechanics instead of asserting the observable result                               |
| #5   | An unauthenticated request to every `PROTECTED_ROUTE` redirects to login; an authenticated request passes                                                                                                         | "Middleware exists, therefore it protects"                                                      | the `PROTECTED_ROUTES` list, the middleware user-resolution                             | integration (request → redirect) or light e2e     | asserting middleware internals instead of the redirect behavior                                                 |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| #   | Phase name                    | Goal (one line)                                                                                                  | Risks covered | Test types                                    | Status   | Change folder                                        |
| --- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------- | --------------------------------------------- | -------- | ---------------------------------------------------- |
| 1   | Integration security gate     | Prove key-tightness, cross-tenant tightness, and route protection; bootstrap the two-account integration harness | #1, #2, #5    | integration (API/service, two accounts)       | complete | `context/changes/testing-integration-security-gate/` |
| 2   | Run integrity + SSRF boundary | Prove abort discards fully, step is idempotent, and the SSRF guard fires at the request site                     | #4, #3        | integration (run/step/abort, test-connection) | complete | `context/changes/testing-run-integrity-ssrf/`        |
| 3   | Quality-gates wiring          | Wire `npm run test` as a CI pre-deploy gate; optionally consolidate the two-account Playwright smoke             | cross-cutting | gates (e2e deliberately skipped)              | complete | `context/changes/testing-quality-gates-wiring/`      |

**Status vocabulary** (fixed): `not started` → `change opened` →
`researched` → `planned` → `implementing` → `complete`.

Phase 1 carries the heaviest load by design — it both attacks the two
highest risks and bootstraps the integration harness (two authenticated
Supabase clients hitting real API routes) that Phase 2 reuses. Phase 3 is
only meaningful once tests exist; it closes the known "CI lint-fail skips
deploy silently" gap by making the test run an explicit gate.

## 4. Stack

The classic test base for this project. AI-native tools (if any) carry a
`checked:` date so future readers can see which lines need re-verification.

| Layer                | Tool                                 | Version | Notes                                                                                                  |
| -------------------- | ------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------ |
| unit                 | Vitest                               | ^4.1.9  | configured; `src/**/*.test.ts`, Node env; 6 test files, all pure `src/lib/` logic                      |
| integration          | Vitest (+ Supabase JS clients)       | ^4.1.9  | none yet — see §3 Phase 1; two-account harness against real API routes/services                        |
| API mocking          | network-edge only (no SDK mock)      | —       | mock the outbound LLM HTTP edge only; never mock internal services or Supabase RLS                     |
| e2e                  | Playwright                           | n/a     | none wired yet — optional, see §3 Phase 3; an ad-hoc two-account RLS matrix exists per WORKFLOW_STATUS |
| (optional) AI-native | Playwright MCP — checked: 2026-06-22 | n/a     | only for a visual-only risk; not justified by current risk map (all five are deterministic)            |

**Stack grounding tools (current session):**

- Docs: Context7 — available; use for current Vitest 4 / Astro 6 / Playwright APIs and Supabase-test-client setup; checked: 2026-06-22
- Search: Exa.ai — not available in current session
- Runtime/browser: Playwright MCP — available; possible light e2e layer for Risk #5 / two-account smoke (Phase 3); not used for Phases 1–2 (integration is cheaper); checked: 2026-06-22
- Provider/platform: Supabase (skill + MCP) — available; use to verify RLS policies behind Risk #1; Cloudflare deploy is GitHub-Actions-gated (CI gate relevance for §3 Phase 3); checked: 2026-06-22

Use docs MCPs for current framework/library APIs and setup details. Use
search MCPs for discovery only. Do not use MCP docs/search to infer code
failure anchors; those belong in per-phase `/10x-research`.

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.
"Required for §3 Phase N" means the gate is enforced once that rollout
phase lands; before that, the gate is `planned`.

| Gate                                             | Where                   | Required?                         | Catches                                                           |
| ------------------------------------------------ | ----------------------- | --------------------------------- | ----------------------------------------------------------------- |
| lint + typecheck (`npm run lint`, `astro check`) | local (pre-commit) + CI | required                          | syntactic / type drift; already wired (husky + lint-staged)       |
| unit + integration                               | local + CI              | required (wired §3 Phase 3)       | logic + boundary regressions (key leak, RLS, run integrity, SSRF) |
| e2e on critical flows                            | CI on PR                | deferred (covered by integration) | broken cross-tenant visibility / auth-redirect path               |
| pre-prod smoke                                   | between merge + prod    | optional                          | Cloudflare-edge-specific failures (lucide re-opt, route manifest) |

The `npm run test` gate was the load-bearing addition. As of §3 Phase 3 it
is wired in CI: the `ci` job runs `npm run test` (unit) and a separate
`integration` job runs `npm run test:integration` against `supabase start`;
`deploy` has `needs: [ci, integration]`, so a red test blocks the deploy.
The earlier "lint-fail silently skips deploy" gap (archive S-01) is closed
by making `ci` + `integration` _required status checks_ on `main` — an
in-YAML `needs:` gate blocks the deploy job within a run but does NOT make a
skipped deploy visible; only branch protection does. The e2e row is
deliberately deferred: the two-account RLS matrix is already covered by the
integration test `src/test/integration/rls-cross-tenant.itest.ts`; a browser
smoke would only add the middleware-302 + cookie-roundtrip path (low
regression) at high cost. Revisit on an Astro/@supabase/ssr major upgrade.

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, the sub-section reads
"TBD — see §3 Phase N."

### 6.1 Adding a unit test

- **Location**: next to the unit under test, `src/lib/**/<module>.test.ts`.
- **Naming**: `<module>.test.ts` (matched by `vitest.config.ts` `include`).
- **Reference test**: `src/lib/runs/oejts-score.test.ts` (pure deterministic logic).
- **Run locally**: `npm run test` (or `npm run test:watch`).

### 6.2 Adding an integration test

- **Location**: `src/test/integration/<name>.itest.ts` (eigenes Pattern, getrennt von Unit `*.test.ts`).
- **Config**: `vitest.integration.config.ts` (sequenziell, `setupFiles` lädt `.env.test`, aliast `astro:env/server` auf einen process.env-Stub).
- **Run**: `npm run test:integration` — braucht lokales Supabase (`npx supabase start`, Docker) + `.env.test` (siehe `.env.test.example`). Der Safety-Guard in `setup.ts` verweigert nicht-lokale `SUPABASE_URL`.
- **Two-account harness**: `createTestAccount()` / `cleanupTestAccount()` aus `accounts.ts` (programmatischer `signUp` mit Timestamp-Mail, kein `service_role`); Domänen-Fixtures in `fixtures.ts` (`makePersona`/`makeModelConfig`/`makeCompletedRun`/`rowExists`).
- **Mock-Grenze**: nur die ausgehende LLM-HTTP-Kante mocken — NIE Supabase/RLS. Repetitions direkt per Client einfügen (kein echter `processNextRepetition`-Call).
- **Reference test**: `src/test/integration/rls-cross-tenant.itest.ts` (Risk #1, zwei Sessions, DB-Gegenproben).

### 6.3 Adding an e2e test

- **Deliberately not wired (decision, §3 Phase 3).** No Playwright/e2e layer
  exists. The "two-account RLS matrix" seed pattern is already implemented as the
  integration test `src/test/integration/rls-cross-tenant.itest.ts` (two real
  sessions, DB counter-probes) — a browser smoke would only add the middleware-302
  redirect + cookie-roundtrip path, which is framework-level (Astro + `@supabase/ssr`)
  and low-regression, at high cost/brittleness. Cost×signal (§1) does not justify it.
- **When to revisit**: an Astro or `@supabase/ssr` major upgrade, or a page gaining
  interactive, data-dependent auth behavior. Then add a light Playwright smoke driving
  the middleware redirect + cookie lifecycle (not the RLS logic, which integration owns).
- **Lern-Smoke existiert seit 2026-06-25 (s03e04, NICHT gate-relevant):** Unter
  `tests/e2e/` liegt eine minimale Playwright-Schicht (Seed + `auth-redirect.spec.ts`),
  die genau den Risk-#5-Browser-Pfad (Middleware-302 + Cookie-Roundtrip) demonstriert.
  Sie ist bewusst KEIN Deploy-Gate — die Cost×Signal-Defer-Entscheidung oben bleibt
  gültig. Setup/Run: siehe `tests/e2e/README.md`.

### 6.4 Adding a test for a new API endpoint

- **Auth-Gate**: Handler direkt importieren (`import { GET } from "@/pages/api/.../index"`) und mit `makeApiContext()` (aus `route-context.ts`) ohne Session aufrufen → erwarte **401**. Tabellengetrieben über alle Methoden×Routes; kein Dev-Server, kein Astro-Container nötig (der `astro:env/server`-Stub-Alias löst die einzige Kopplung). Reference: `src/test/integration/auth-gates.itest.ts`.
- **Verhalten/RLS**: bevorzugt über die Service-Schicht mit zwei echten Sessions (siehe §6.2) — Response-Shape UND persistierten Side-Effect/RLS-Scope asserten; 0-Row-Match → 404/null, NIE leeres 200 (S-02-Lesson).
- **Key-Dichtheit (Risk #2)**: assert, dass der Klartext-/Ciphertext-Key in keiner Response/keinem View auftaucht (Sentinel-Key + Feldnamen-Check). Reference: `src/test/integration/key-boundary.itest.ts`.

### 6.5 Adding a test for the run engine

- **Ausgangslage bauen**: `makePendingRun` / `makeRunningRun(writtenReps, totalReps)` /
  `makeFailedRun(okReps, failedReps)` aus `fixtures.ts` — Repetitions werden direkt
  per Client eingefügt (kein LLM-Call). Die Builder geben den `createRun`-Snapshot
  (`status='pending'`) zurück; den wirksamen DB-Status frisch lesen.
- **LLM-Kante mocken**: `mockLlmContent()` / `mockLlmRedirect()` aus `llm-mock.ts`
  stubben `globalThis.fetch`, reichen aber lokale Supabase-Calls (`127.0.0.1`)
  durch — sonst bekämen die DB-Queries die OEJTS-Antwort. IMMER `restoreLlm()` in
  `afterEach`.
- **Beobachtbaren Effekt asserten, nicht die Mechanik** (§2-Anti-Pattern): Abort →
  `deleteRun` → `rowExists(run)`/`rowExists(rep)` false (Cascade-Gegenprobe) +
  `getRunResult` null. Idempotenz → `Promise.all([step, step])` auf einem `running`
  Run mit 0 Reps → genau 1 Repetition (23505-Catch). Failure-Quote → `getRunResult`
  `state`/`usableReps`/`failedCount`.
- **Reference test**: `src/test/integration/run-integrity.itest.ts` (Risk #4).

### 6.6 Per-rollout-phase notes

(Optional. After each phase lands, `/10x-implement` appends a 2-3 line note
here capturing anything surprising the rollout phase taught.)

- **Phase 1 (Integration security gate, 2026-06-23):** Service-Level reicht für
  #1/#2; Route-Level für #5 brauchte KEINE Astro-Container-API — der
  `astro:env/server`-Stub-Alias erlaubt direkten In-Process-Handler-Aufruf mit
  Mock-`APIContext`. Feiner RLS-Fall „Seed owner=NULL" ist mangels `seed.sql`
  nicht testbar (per anon-key nicht erzeugbar) und in den global-Objekt-Fällen
  mit abgedeckt. Repetitions werden direkt per Client eingefügt (kein LLM-Call).
- **Phase 2 (Run integrity + SSRF boundary, 2026-06-23):** (a) `vi.stubGlobal("fetch")`
  trifft AUCH supabase-js (nutzt intern global fetch) — der LLM-Mock muss lokale
  Calls (`127.0.0.1`) durchreichen und nur die Outbound-Kante mocken. (b) Der
  SSRF-Guard ist an ZWEI unabhängigen Sites verdrahtet (kein gemeinsamer Wrapper) —
  jede separat getestet; im Run-Step wirft er VOR dem fetch, daher braucht der
  SSRF-Fall dort keinen Mock. (c) test-connection sitzt hinter `requireUser`;
  `authedCookieHeader` erzeugt mit `@supabase/ssr` selbst einen echten Session-Cookie
  → erster authentifizierter In-Process-Route-Aufruf (schließt §6.4-„manuell").
  (d) Der 23505-Nebenläufigkeitspfad braucht `completedReps=0`, sonst verschiebt
  sich `rep_index` und der Catch wird verfehlt.
- **Phase 3 (Quality-gates wiring, 2026-06-24):** (a) Unit-Gate ist trivial — ein
  `npm run test`-Step im `ci`-Job, Docker-frei. (b) Integration in CI über einen
  eigenen `integration`-Job: `supabase/setup-cli@v2` + `supabase start -x <slim set>`
  (nur Postgres/GoTrue/PostgREST/Kong), Connection-Export via `supabase status -o env`
  nach `$GITHUB_ENV` (`API_URL`→`SUPABASE_URL`, `ANON_KEY`→`SUPABASE_KEY`), Wegwerf-
  `ENCRYPTION_KEY` per `node -e randomBytes(32).base64`. Das Repo war vorverdrahtet
  (`setup.ts` lässt CI-`process.env` gewinnen, Guard akzeptiert `127.0.0.1`,
  `enable_confirmations=false`) → kein `.env.test`-Write nötig. (c) CLI-Pin an die
  Lockfile (`2.98.2`), nicht an den package.json-Range. (d) Der entscheidende Teil ist
  KEIN YAML: ein `needs:`-Gate blockt den Deploy-Job im Run, aber nur ein GitHub
  _Required Status Check_ (Branch-Protection) macht einen geskippten Deploy sichtbar.

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5 — answer was
"unsure"; proposed and accepted at brief review). Respect these unless the
underlying assumption changes.

- **Deterministic scoring/aggregation re-coverage** — `oejts-score`,
  `oejts-aggregate`, `oejts-run` are already unit-tested; don't duplicate.
  Re-evaluate if the scoring formulas or instrument definition change.
  (Source: Phase 2 interview Q5 + existing coverage.)
- **Pure presentational Astro pages / visual snapshots** — brittle, low
  signal; such islands are rendered statically anyway (lucide re-opt
  hydration lesson). Re-evaluate if a page gains interactive,
  data-dependent behavior. (Source: Phase 2 interview Q5.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-06-22
- Stack versions last verified: 2026-06-22
- AI-native tool references last verified: 2026-06-22

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
