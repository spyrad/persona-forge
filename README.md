# persona-forge

**Psychometric profiling for LLMs.** Run openly licensed personality instruments against
any OpenAI-compatible model over N repetitions, and get a per-axis _distribution_ instead
of a single score.

Live: https://persona-forge.damian-spyra-ai.workers.dev

## Why

Language models are not neutral. How agreeable, cautious, creative, or blunt a model
answers varies by model, system prompt, and configuration — and today that disposition is
a black box. Anyone picking a model for a use case, or shaping one via system prompt, has
no instrument to make that disposition visible, comparable, and defensible.

persona-forge takes three positions on that problem:

- **Established instruments over invented prompts.** Openly licensed psychometric
  instruments provide a known, structured scale.
- **Distribution over point value.** LLM answers fluctuate, so a single run is never
  presented as a reliable value. Every result is a distribution with spread across N
  repetitions.
- **The system prompt is a first-class object.** Personas are stored, reusable, immutable,
  and comparable — not throwaway text.

## How a run works

1. You attach a model (base URL, API key, model name) and pick or create a persona.
2. You choose an instrument and a repetition count N.
3. Each repetition runs in an **isolated session**, with item order permuted when the
   instrument enables it. Every raw item answer is persisted.
4. Answers are parsed structurally; a free-text fallback parser catches models that
   ignore the JSON format. Only what neither resolves is marked unparseable.
5. Scoring is **deterministic** — the same stored raw answers always aggregate to the same
   per-axis values.
6. The result shows position, spread, and the raw distribution per axis — plus, for
   type-based instruments, the derived type and how stable it was across the N runs.

Aborting a run discards it completely. There is no partial aggregate, by design.

## Instruments

| Instrument                          | Axes                                                     | Source                                                                           | License         |
| ----------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------- |
| **OEJTS 1.2**                       | 4 Jungian axes (E/I, S/N, T/F, J/P) plus a 4-letter type | Eric Jorgenson, [Open Psychometrics](https://openpsychometrics.org/tests/OJTS/)  | CC BY-NC-SA 4.0 |
| **HEXACO** (60-item IPIP selection) | 6 factors (H, E, X, A, C, O)                             | Ashton, Lee & Goldberg (2007), [IPIP](https://ipip.ori.org/newHEXACO_PI_key.htm) | Public domain   |
| **Steadfastness**                   | Manipulation resistance across LLM-generated scenarios   | Own design — no external instrument                                              | —               |

OEJTS is not affiliated with the official MBTI. The HEXACO items are an own deterministic
selection from the public-domain IPIP-HEXACO scales — not the copyrighted HEXACO-60
(Ashton & Lee, 2009). See [License & attribution](#license--attribution).

## Features

- **Model configurations** — attach any OpenAI-compatible endpoint. API keys are
  encrypted at rest (AES-256-GCM) and never leave the server toward the client.
- **Persona catalog** — free-form or structured system prompts, with visibility
  private/global. Personas are immutable: editing creates a copy.
- **Runs with live progress** — per-repetition progress stage, token accounting, and a
  hard abort.
- **Model profiles & comparison** — put two runs (two models or two personas) side by
  side and read the delta per axis.
- **Dashboard** — overview of profiled models, personas, and recent runs.

## Tech stack

Astro 6 (SSR, `output: "server"`) · React 19 islands · TypeScript · Tailwind 4 ·
shadcn/ui · Supabase (Postgres + email/password auth, RLS on every table) ·
Cloudflare Workers. Node 22.14 (see `.nvmrc`).

## Getting started

Requires Node 22.14 and Docker (for the local Supabase stack, ~7 GB RAM).

```bash
git clone https://github.com/spyrad/persona-forge.git
cd persona-forge
npm install
```

Start the local Supabase stack — this also applies all migrations in
`supabase/migrations/`:

```bash
npx supabase start
```

Create `.env` (Node tooling) and `.dev.vars` (the workerd dev server, which is the
authoritative one for `npm run dev`) from the template:

```bash
cp .env.example .env
cp .env.example .dev.vars
```

Fill in both identically:

| Variable         | Value                                                                                                     |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`   | `http://127.0.0.1:54321` (from `npx supabase status`)                                                     |
| `SUPABASE_KEY`   | The publishable/anon key from `npx supabase status` — **never** `service_role`, which bypasses RLS        |
| `ENCRYPTION_KEY` | base64-encoded 32-byte key: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `SENTRY_DSN`     | Optional — leave empty locally (Sentry becomes a no-op)                                                   |

Then:

```bash
npm run dev
```

Supabase Studio runs at http://localhost:54323. Email confirmation is enabled, so
confirm the signup link before signing in (or toggle it off under
**Authentication → Email → Confirm email** for local work).

## Scripts

| Command                             | Purpose                                    |
| ----------------------------------- | ------------------------------------------ |
| `npm run dev`                       | Dev server (Cloudflare workerd runtime)    |
| `npm run build` / `npm run preview` | Production SSR build / preview             |
| `npm run lint` / `npm run lint:fix` | ESLint (type-checked rules)                |
| `npm run format`                    | Prettier                                   |
| `npm run test`                      | Unit tests (Vitest, Node env, no Docker)   |
| `npm run test:integration`          | Integration tests against local Supabase   |
| `npm run test:e2e`                  | End-to-end tests (Playwright)              |
| `npm run ai-review`                 | LLM PR reviewer (also runs in CI)          |
| `npm run eval:review`               | promptfoo regression gate for the reviewer |

## Testing

Three layers, each mapped to the risk map in
[`context/foundation/test-plan.md`](context/foundation/test-plan.md):

- **Unit** (`src/**/*.test.ts`) — scoring, aggregation, parsing, and other pure logic.
  Runs without Docker.
- **Integration** (`src/**/*.itest.ts`) — against a local Supabase instance. Requires
  `npx supabase start` plus a `.env.test` filled from `npx supabase status` (see
  `.env.test.example`). A safety guard refuses to run against a non-local `SUPABASE_URL`.
- **E2E** (`tests/e2e/*.spec.ts`) — Playwright against a Node-adapter build that is gated
  behind `E2E=1`, so end-to-end runs never touch the production `.dev.vars`/`.env`.

The four high-severity risks map one-to-one onto integration suites: cross-tenant leakage
(`rls-cross-tenant.itest.ts`), decrypted key escape (`key-boundary.itest.ts`), SSRF at the
outbound boundary (`ssrf-boundary.itest.ts`), and run integrity (`run-integrity.itest.ts`).

## Project structure

```
src/
├── pages/            Astro pages; API routes under pages/api/ (prerender = false)
├── components/       Astro for static, React islands for interactivity; ui/ = shadcn
├── lib/
│   ├── services/     Business logic against Supabase (runs, personas, model configs)
│   ├── instruments/  Instrument definitions + registry (OEJTS, HEXACO)
│   ├── runs/         Scoring, aggregation, run orchestration
│   └── ai-review/    The CI code-review agent's scoring logic
├── middleware.ts     Resolves the user per request, guards protected routes
└── types.ts          Shared entities and DTOs
supabase/migrations/  Schema; RLS enabled on every table with per-operation policies
context/              Project foundation (PRD, roadmap, test plan) and change records
```

## Deployment & CI

Pushing to `main` deploys to Cloudflare Workers via GitHub Actions. The `deploy` job
requires both the `ci` job (lint, unit tests, build) and the `integration` job to pass.
Supabase and encryption secrets live as GitHub secrets and are synced to the Worker on
every deploy — there is no manual `wrangler secret put` step.

Every pull request is additionally reviewed by an **LLM code-review agent**
(`.github/workflows/ai-review.yml`). It scores six criteria, posts a single deduplicated
PR comment, sets `ai-cr:*` labels, and publishes a required `ai-review/verdict` status
check that blocks merging when a critical rule fires. Seven of its eighteen rules are
decided statically by regex rather than by the model — a false negative on a security
check was the most expensive failure mode observed while building it.

## Documentation

The project was written from its documentation, not the other way around:

- [`context/foundation/prd.md`](context/foundation/prd.md) — problem, users, functional
  and non-functional requirements, and the explicit non-goals
- [`context/foundation/roadmap.md`](context/foundation/roadmap.md) — the MVP as ordered,
  end-to-end slices
- [`context/foundation/test-plan.md`](context/foundation/test-plan.md) — risk map, quality
  gates, and the phased test rollout
- [`context/foundation/tech-stack.md`](context/foundation/tech-stack.md) — stack decision
- [`CLAUDE.md`](CLAUDE.md) — conventions and gotchas for AI agents working in this repo

## License & attribution

**The instrument content is licensed separately from the code, and the stricter terms
govern it.**

The OEJTS 1.2 items are © Eric Jorgenson / Open Psychometrics and licensed under
[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). That license binds
this project with three obligations: **attribution**, **NonCommercial use**, and
**ShareAlike** for derivatives of the item content. Full details and the discharged
obligations are documented in
[`docs/instruments/oejts-attribution.md`](docs/instruments/oejts-attribution.md).

The HEXACO items come from the public-domain International Personality Item Pool and carry
no such restriction.

A repository-wide `LICENSE` file for the application code has not been settled yet — the
interaction between the CC BY-NC-SA item content and a code license needs a deliberate
decision rather than a default. Until then, no blanket license is claimed for this
repository.
