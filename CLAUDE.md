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

## Tech Stack

Astro 6 + React 19 + TypeScript + Tailwind 4 + Supabase (Postgres/Auth) +
Cloudflare Pages (Scaffold: 10x-astro-starter). Starter-spezifische Konventionen:
`CLAUDE.md.scaffold` (vom Starter mitgeliefert, noch nicht gemergt).

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

- `npm run dev` — Dev-Server
- `npm run build` — Production-Build
- `npm run lint` / `npm run lint:fix` — ESLint
- `npm run format` — Prettier
- Kein Test-Runner eingerichtet — `test_command` in `workflow.config.yaml`
  nachziehen sobald vorhanden (z. B. Vitest)

## Architecture Overview

Astro-Pages mit React-Islands; Supabase liefert Postgres + E-Mail/Passwort-Auth;
Deploy auf Cloudflare Pages (GitHub Actions, Auto-Deploy auf main).

## Important Gotchas

- Cloudflare-Edge-Runtime begrenzt lang laufende Tasks — Testlaeufe mit N
  Wiederholungen (FR-012/FR-014) brauchen Lauf-Aufteilung oder Queues/Workers.
- Lokale TLS-Interception: npm-Downloads in postinstall-Scripts brauchen
  `NODE_OPTIONS=--use-system-ca` (sonst `UNABLE_TO_VERIFY_LEAF_SIGNATURE`).
- Supabase RLS frueh konfigurieren, sonst entstehen Auth-Luecken.

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
