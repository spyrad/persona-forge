# CLAUDE.md

<!--
CLAUDE.md Pflege-Richtlinien:
- Diese Datei wird in JEDE Conversation geladen — schlank halten (<150 Zeilen)
- Bei architekturrelevanten Aenderungen (neue Routes, Schemas, Patterns, Configs)
  die betroffene CLAUDE.md im gleichen Commit mitaktualisieren
- Details gehoeren in Sub-CLAUDE.md (pro Repo), nicht hier
- Keine Redundanz: Root verweist auf Sub-CLAUDE.md, dupliziert keine Inhalte
- Sub-CLAUDE.md werden nur geladen wenn im jeweiligen Verzeichnis gearbeitet wird
-->

## Project Context

persona-forge — psychometrisches Profiling fuer LLMs: Web-Tool, das gemeinfreie
Tests (v1: OEJTS) mit N Wiederholungen gegen LLMs faehrt und Verteilungen je
Achse liefert. PRD: `context/foundation/prd.md`.

## Important Gotchas

- Cloudflare-Edge-Runtime begrenzt lang laufende Tasks — Testlaeufe mit N
  Wiederholungen (FR-012/FR-014) brauchen Lauf-Aufteilung oder Queues/Workers.
- Push auf `main` deployt automatisch auf Cloudflare Workers
  (`https://persona-forge.damian-spyra-ai.workers.dev`); CI braucht Secrets
  `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` (gesetzt). Supabase-Secrets
  (`SUPABASE_URL`, `SUPABASE_KEY`) folgen mit F-01 — als Worker-Secrets doppelt
  setzen (Build + `wrangler secret put` fuer Runtime).
- Lokale TLS-Interception: npm-Downloads in postinstall-Scripts brauchen
  `NODE_OPTIONS=--use-system-ca` (sonst `UNABLE_TO_VERIFY_LEAF_SIGNATURE`).
- Supabase RLS frueh konfigurieren, sonst entstehen Auth-Luecken.

## Tech Stack

Astro 6 + React 19 + TypeScript + Tailwind 4 + shadcn/ui + Supabase
(Postgres/Auth) + Cloudflare (Scaffold: 10x-astro-starter). Node 22.14 (`.nvmrc`).

## Repository Structure

```
persona-forge/
├── src/                  Astro-App (Pages, Components, Layouts)
├── public/               Statische Assets
├── supabase/             Supabase-Konfiguration & Migrationen
├── context/              10xWorkflow-Artefakte (foundation/, changes/, archive/)
├── dtb-project/          DTB-Workflow-Artefakte
│   ├── project-changelog/   Session-Logs
│   ├── project-rules/       Projekt-Regeln
│   ├── project-workflows/   Workflow-Definitionen & Features
│   ├── project-strategy/    Strategie-Dokumente (PRD, Roadmap)
│   └── project-testing/     Test-Artefakte
├── workflow.config.yaml  Single Source of Truth (Config)
├── WORKFLOW_STATUS.md    Aktueller Workflow-Stand
└── BACKLOG.md            Feature-Backlog
```

## Development Commands

- `npm run dev` — Dev-Server (Cloudflare workerd Runtime)
- `npm run build` / `npm run preview` — Production-Build (SSR) / Preview
- `npm run lint` / `npm run lint:fix` — ESLint
- `npm run format` — Prettier
- Pre-Commit-Hooks (husky + lint-staged): `eslint --fix` auf `*.{ts,tsx,astro}`,
  `prettier --write` auf `*.{json,css,md}`
- Kein Test-Runner eingerichtet — `test_command` in `workflow.config.yaml`
  nachziehen sobald vorhanden (z. B. Vitest)

## Architecture Overview

Astro 6 SSR (`output: "server"`) mit React-19-Islands; alle Pages
server-rendered, API-Routes exportieren `const prerender = false`. Supabase
liefert Postgres + E-Mail/Passwort-Auth. Deploy auf Cloudflare via GitHub
Actions (Ziel-Verbindung offen, siehe Gotchas/F-02).

### Auth-Flow

- `src/lib/supabase.ts` — SSR-Client (`@supabase/ssr`, Cookie-Sessions);
  Secrets via `astro:env/server` (`SUPABASE_URL`, `SUPABASE_KEY`)
- `src/middleware.ts` — loest je Request den User auf → `context.locals.user`;
  redirectet Unauthentifizierte weg von `PROTECTED_ROUTES`
- API: `src/pages/api/auth/{signin,signup,signout}.ts`; Pages:
  `src/pages/auth/*.astro`; geschuetztes Beispiel: `src/pages/dashboard.astro`

### Conventions

- Path-Alias `@/*` → `./src/*`
- Astro-Components fuer Statisches, React nur bei Interaktivitaet; keine
  Next.js-Direktiven (`"use client"`); Hooks nach `src/components/hooks/`
- Tailwind-Klassen via `cn()` aus `@/lib/utils` mergen — nie manuell
  konkatenieren
- shadcn/ui in `src/components/ui/` (Variante "new-york"); neue Komponenten via
  `npx shadcn@latest add [name]`
- API-Routes: uppercase `GET`/`POST`-Exports, Input mit zod validieren
- Migrationen: `supabase/migrations/YYYYMMDDHHmmss_kurzbeschreibung.sql`; auf
  jeder neuen Tabelle RLS aktivieren mit granularen Policies je Operation+Rolle
- Services/Helpers → `src/lib/` (Business-Logik: `src/lib/services/`);
  shared Types (Entities, DTOs) → `src/types.ts`

### Environment

- Env-Vars: `SUPABASE_URL`, `SUPABASE_KEY` — `.env` fuer Node (Vorlage
  `.env.example`), `.dev.vars` fuer Cloudflare-Local-Dev (gitignored)
- Lokale Supabase: `npx supabase start` (braucht Docker)

## Quick Reference

- Config: `workflow.config.yaml`
- Workflow starten: `/pf:workflow-resume`
- Feature planen: `/pf:feature-plan`

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Module 3, Lesson 4 (E2E Tests)

**For E2E tests, use the `/10x-e2e` skill.** It is the single source of truth
for the workflow — risk → seed test + rules → generate → review against the five
anti-patterns → re-prompt → verify. The skill's `references/` carry the full
rules, anti-patterns, seed pattern, and prompt-template.

A few hard rules that hold even before you invoke the skill:

- **Locators:** `getByRole` / `getByLabel` / `getByText` first; `getByTestId`
  only when accessibility attributes are ambiguous. Never CSS selectors, XPath,
  or DOM structure.
- **Never `page.waitForTimeout()`.** Wait for state: `toBeVisible()`,
  `waitForURL()`, `waitForResponse()`.
- **Test independence + cleanup.** Each test runs standalone — its own setup,
  action, assertion, and cleanup; unique ids (timestamp suffix) so parallel runs
  and re-runs don't collide.

Two boundaries to keep straight:

- **DOM (snapshot) is the default.** Vision (`--caps=vision`) is a supplement for
  visual-only risks (layout, z-index, animation); for pixel regression prefer
  deterministic tools (`toMatchSnapshot`, Argos, Lost Pixel). VLM model
  selection/cost is a debugging topic (Lesson 5), not testing.
- **Healer helps on selectors, harms on logic.** A changed selector → healer
  re-finds it (route through PR review). A changed business behavior → healer
  masks the bug; that failing-test-to-fix case is Lesson 5.

<!-- END @przeprogramowani/10x-cli -->
