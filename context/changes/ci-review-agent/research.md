---
date: 2026-07-08T00:00:00+02:00
researcher: Damian
git_commit: a33a0a3790031f5693784d98164ea7a99217a855
branch: main
repository: persona-forge
topic: "CI-Review-Agent — Codebase-Grounding für Kriterien und Bau"
tags: [research, codebase, ci-review-agent, llm, github-actions, review-criteria]
status: complete
last_updated: 2026-07-08
last_updated_by: Damian
---

# Research: CI-Review-Agent — Codebase-Grounding für Kriterien und Bau

**Date**: 2026-07-08T00:00:00+02:00
**Researcher**: Damian
**Git Commit**: a33a0a3790031f5693784d98164ea7a99217a855
**Branch**: main
**Repository**: persona-forge

## Research Question

Was soll der LLM-basierte CI-PR-Reviewer (Champion-Projekt M5L3) prüfen, und
welche bestehende Infrastruktur/welche Kriterien-Quellen kann der Bau
wiederverwenden? Ziel: die 5–6 eigenen Review-Kriterien erden und den
`review.ts`-Scorer + die GitHub-Action fundiert planen.

## Summary

Drei belastbare Kernbefunde:

1. **Der Mehrwert des LLM-Reviewers liegt fast ausschließlich in
   projektspezifischen semantischen Regeln, die kein Linter kennt.** ESLint
   (`strictTypeChecked` + Prettier + `react-compiler` + `jsx-a11y`) deckt
   Typ-Sicherheit, Formatierung, Hook-Korrektheit und a11y-Basics bereits
   **mechanisch** ab. Der Reviewer soll NICHT prüfen, was diese Gates schon
   fangen — sondern: Farb-Token-Disziplin, RLS-Vollständigkeit auf neuen
   Tabellen, das API-Route-Quartett, `client:load`-Sinnhaftigkeit und
   Code-Platzierung. Diese Regeln sind der eigentliche Kriterien-Kern.

2. **Bestehende LLM-Infrastruktur ist unter plain `tsx` wiederverwendbar** —
   `chatCompletion()` (`src/lib/llm/openai-compatible.ts:142`) ist ein reiner
   fetch-Client mit Retry/Timeout/SSRF-Härtung und **eingebautem
   z.ai-`thinking:disabled`-Toggle**. Das wirft die SDK-Frage neu auf: Hausstil
   (fetch + `jsonMode` + zod-`safeParse`) vs. Vercel AI SDK 6 (`Output.object`).
   → **Offene Entscheidung für `/10x-plan`** (siehe Open Questions).

3. **Fertige, wörtlich übernehmbare Kriterien-Quelle existiert im Repo**:
   `.claude/skills/10x-impl-review-ci/references/impl-review-instructions.md`
   liefert 6–7 Review-Dimensionen + Severity×Impact-Grammatik + Fix-Options-
   Grammatik, direkt als Scorer-Output-Schema mappbar. Die projektspezifische
   Risiko-Liste steht kanonisch in `context/foundation/test-plan.md` (RLS,
   Key-Leak, Auth-Gap, SSRF, Run-Integrität).

## Detailed Findings

### A) Was der Reviewer prüfen soll (Kriterien-Kern, gegroundet)

Abgrenzung „mechanisch gefangen vs. LLM-Urteil" — nur die **nein**-Zeilen sind
Reviewer-Domäne:

| Konvention                                                                                          | Fundstelle                                                                    | Mechanisch?                |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------- |
| Semantische Farb-Tokens statt Literalen (`text-white`/Gradient/`*-blue-*`)                          | `src/styles/global.css:6-117`; Nutzung `src/pages/runs/compare.astro:107,118` | **nein**                   |
| `export const prerender = false` je API-Route                                                       | `src/pages/api/personas/index.ts:7`; `models/index.ts:8`                      | **nein**                   |
| Uppercase HTTP-Exports `GET/POST/PUT/DELETE`                                                        | `personas/index.ts:33,45`; `models/[id].ts:21,48`                             | **nein**                   |
| zod-`safeParse`-Validierung des Inputs                                                              | `personas/index.ts:27-57`; `models/index.ts:10-42`                            | **nein**                   |
| `requireUser` + zentrale Response-Helper (`@/lib/api-responses`)                                    | `personas/index.ts:3-4,34`                                                    | **nein**                   |
| RLS enable + Policy je Operation, `to authenticated`, `(select auth.uid())` + `owner_id`-Index      | `supabase/migrations/20260616051425_model_configs.sql:29-48`                  | **nein**                   |
| `client:load` nur bei echter Interaktivität                                                         | positiv `runs/compare.astro:112-114`; Regel `context/foundation/lessons.md:9` | **nein**                   |
| `cn()` statt manueller Klassen-Konkatenation                                                        | `src/lib/utils.ts:4`                                                          | **nein**                   |
| Business-Logik in `src/lib/services/`, Types in `src/types.ts`                                      | `personas/index.ts:5`; `models/index.ts:6`                                    | **nein**                   |
| Type-Safety/no-any/floating promises, no-console, unused-vars, Prettier, a11y, Hooks, `no-set-html` | `eslint.config.js:15,23,25,36,56,65,76,78`                                    | **ja**                     |
| Unit `*.test.ts` co-located / Integration `*.itest.ts` unter `src/test/integration/`                | `vitest.config.ts:13`; `vitest.integration.config.ts:20`                      | **teilweise** (Glob-Split) |

**Einziger Farb-Literal-Treffer in `src/`**: `src/components/ui/button.tsx:14`
(`bg-destructive text-white`) — generierte shadcn/ui-Komponente, akzeptierter
Sonderfall. Keine `"use client"`-Direktiven im Code.

### B) Bestehende LLM-Pipeline — was `review.ts` erbt

- **Zentraler Client:** `chatCompletion()` — `src/lib/llm/openai-compatible.ts:142`.
  Reiner `fetch`, EIN `POST {baseUrl}/chat/completions`, OpenAI-Payload-Form.
  Signatur `{baseUrl, apiKey, model, messages, jsonMode?, signal?}` →
  `{content, promptTokens, completionTokens}` (`:25-40`). Eingebaut:
  Retry/Backoff bei 429/5xx (`MAX_ATTEMPTS=3`), 60s-Timeout (`:22,89`),
  SSRF-Härtung (`redirect:"manual"` + `isPublicHttpsUrl`, `:144`),
  Error-Kappung auf 200 Zeichen (`:53`), tolerantes `jsonMode`-Fallback (`:192`).
- **z.ai-Toggle bereits eingebaut:** `isZaiEndpoint()` (`:128`, Host endet auf
  `z.ai`) schaltet `thinking:{type:"disabled"}` scharf (`:152,169`). Der
  `/coding/paas/v4`-Pfad ist Teil der gespeicherten `base_url`, nicht im Code
  → z.ai-Coding-Plan funktioniert out-of-the-box bei korrekter voller URL.
- **`ChatMessage`-Typ:** `src/lib/runs/oejts-run.ts:13`.
- **LLM-JSON-Parsing heute:** kein zod, sondern handgeschriebener toleranter
  Parser `parseOejtsResponse()` (`oejts-run.ts:132`) + `tryParseJson()`
  (Codefence-/Freitext-tolerant, `:106`, nicht exportiert — adaptierbar).
- **zod v4 installiert** (`package.json:43`), aber nur für Request-Validierung
  genutzt (`test-connection.ts:84`), nicht für LLM-Output.
- **Vercel AI SDK: NICHT installiert** (kein `ai`/`@ai-sdk/*`) — bestätigt.

### C) Env-/Runtime-Bruchpunkt (kritisch für den Bau)

- App-Code liest Secrets **ausschließlich über `astro:env/server`**
  (`src/lib/encryption-key.ts:1`, `src/lib/supabase.ts`); Env-Schema in
  `astro.config.mjs:44-50` kennt nur `SUPABASE_URL`, `SUPABASE_KEY`,
  `ENCRYPTION_KEY`. **`astro:env/server` ist unter plain `npx tsx` nicht
  auflösbar** (Vite-Virtual-Module).
- `chatCompletion` selbst liest **kein** Env (importiert nur `@/lib/url-guard`
  - einen Typ) → unter tsx nutzbar, sofern `@/*`-Alias aufgelöst wird.
- **Es gibt keine globale LLM-Key-Env-Var** — LLM-Keys leben verschlüsselt in
  `model_configs` und werden per authentifiziertem RLS-Supabase-Client +
  `getDecryptedTarget()` (`src/lib/services/model-configs.ts:122`) geholt.
  Ein CI-Script hat **keine User-Session** → dieser DB/Krypto-Pfad ist für
  `review.ts` nicht nutzbar.
- **Konsequenz:** `review.ts` liest `baseUrl`/`apiKey`/`model` direkt aus
  `process.env` (neue Vars, z.B. `ZAI_BASE_URL`/`ZAI_API_KEY`/`REVIEW_MODEL`);
  fasst DB/Krypto NICHT an.

### D) Kriterien-Quellen & CI-Mechanik-Prior-Art (im Repo)

- **`.claude/skills/10x-impl-review-ci/references/impl-review-instructions.md`**
  — 7 Dimensionen (Plan Adherence, Scope Discipline, Safety & Quality,
  Architecture, Pattern Consistency, Test Coverage, Success Criteria; je
  PASS/WARNING/FAIL). Safety-Subkategorien wörtlich: Security (Injection,
  hardcoded secrets, fehlende authn/authz an Boundaries, permissive CORS),
  Performance (N+1, unbounded iteration, fehlende Pagination), Reliability
  (Error-Handling an externen Boundaries, Races, Leaks), Data safety
  (destruktive DB-Ops ohne Rollback, Schema ohne Migrationspfad). Verdict:
  APPROVED / NEEDS ATTENTION / REJECTED. **Finding-Grammatik:** Severity
  (CRITICAL/WARNING/OBSERVATION) × Impact (LOW/MEDIUM/HIGH), orthogonal;
  Fix-Optionen (Strength/Tradeoff/Confidence/Blind spot). → direkt als
  JSON-Output-Schema wiederverwendbar.
- **`.claude/skills/10x-impl-review-ci/references/workflow-template.yml`** —
  Action-Blaupause: Label-Gate, Fork-PR-Block, `fetch-depth: 0`,
  Output-Contract-Validierung, **Verdict-Gate als separater
  `POST /statuses`-Commit-Status** (nicht in-Claude), Dedup-Marker +
  Post-new-then-delete-old-Cleanup. Direkt relevant für die
  `ai-cr:passed`/`ai-cr:failed`-Mechanik.
- **`10x-plan-review` / `10x-rule-review`** — Letzteres zeigt das
  Scorecard-Muster „Zähl-Metrik → Verdict-Schwelle → Top-3-Actions", nützlich,
  um 5–6 Kriterien in einen deterministischen 1–10-Score zu gießen.
- **`code-review`/`security-review` sind KEINE Repo-Skills** (Harness-Skills) —
  keine verwertbare Kriterien-Quelle im Projekt.

### E) Bestehende CI-Pipeline (`.github/workflows/ci.yml`)

Drei Jobs: `ci` (test → lint → build), `integration` (lokales Supabase, slim
Service-Set), `deploy` (`needs: [ci, integration]`, nur `push` auf `main` →
Cloudflare + Secrets-Sync). **Kein `.github/actions/`-Verzeichnis** → Composite
Action ist Greenfield. Trigger heute nur `push`/`pull_request` auf `main`.

## Code References

- `src/lib/llm/openai-compatible.ts:142` — `chatCompletion()` (reiner fetch-Client, tsx-tauglich)
- `src/lib/llm/openai-compatible.ts:128` — `isZaiEndpoint()` (z.ai `thinking:disabled`-Toggle)
- `src/lib/runs/oejts-run.ts:106,132` — `tryParseJson()` / `parseOejtsResponse()` (LLM-JSON-Extraktion)
- `src/lib/services/model-configs.ts:122` — `getDecryptedTarget()` (DB/RLS-gebunden, NICHT für CI)
- `src/lib/encryption-key.ts:1` — `astro:env/server`-Zugriff (bricht unter tsx)
- `astro.config.mjs:44-50` — Env-Schema (nur SUPABASE\_\*/ENCRYPTION_KEY)
- `eslint.config.js:15,23,56,65,78` — mechanische Gates (Abgrenzung zum Reviewer)
- `src/styles/global.css:6-117` — semantische Farb-Tokens
- `supabase/migrations/20260616051425_model_configs.sql:29-48` — RLS-Referenzmuster
- `.github/workflows/ci.yml` — bestehende Pipeline
- `context/foundation/test-plan.md` — kanonische Risiko-Liste (RLS/Key-Leak/Auth-Gap/SSRF/Run-Integrität)

## Architecture Insights

- **Hausstil = null-SDK, reines `fetch`.** Das ganze Projekt macht LLM-Calls
  ohne SDK. Ein Vercel-AI-SDK-Bau wäre ein bewusster Bruch mit dem Hausstil
  (Lernwert + Kurstreue vs. neue Dependency + Runtime-Overhead unter tsx).
- **Runtime-Trennung ist bewusst designt:** `crypto.ts` (rein, Key als Param)
  ist von `encryption-key.ts` (Astro-Env) getrennt — genau das Muster, das
  `review.ts` erlaubt, `chatCompletion` ohne Astro-Runtime zu nutzen.
- **Der Reviewer ist ein „semantischer Linter" für das, was ESLint nicht sieht.**
  Die Kriterien sollten präzise auf die **nein**-Zeilen aus Abschnitt A zielen,
  nicht auf generische Code-Qualität (die fangen die mechanischen Gates).
- **Verdict muss Required Status Check werden** (`lessons.md:12-17`): ein
  in-YAML-Gate allein lässt einen `ai-cr:failed`-Merge still durch.

## Historical Context (from prior changes)

- `context/archive/2026-06-23-testing-integration-security-gate/` — projekt-
  spezifische Safety-Dimensionen (Cross-Tenant-RLS-Leak, Key-Dichtheit,
  Auth-Gap/401) — Input für die Safety-Kriterien des Reviewers.
- `context/archive/2026-06-23-testing-run-integrity-ssrf/` — SSRF +
  Run-Integrität (weitere Safety-Dimensionen).
- `context/archive/2026-06-24-testing-quality-gates-wiring/` +
  `context/foundation/lessons.md:12-17` — CI-Gate-Verdrahtung (`needs:` +
  Required Status Checks).
- `context/archive/*/reviews/impl-review.md` (13×) + `plan-review.md` (7×) —
  reale, ausgefüllte Anwendungen der Finding-Grammatik (Ton/Granularität).

## Related Research

- `context/changes/run-flow-analysis/` — OEJTS-Datenfluss (Nachbar-Change, nur
  am Rande relevant).

## Open Questions

1. **SDK-Entscheidung (Kern-Fork für `/10x-plan`):** Vercel AI SDK 6
   (`Output.object`/`generateObject`, kurstreu, Lernwert) vs. Hausstil
   (`chatCompletion({jsonMode:true})` + zod-`safeParse` auf `content`, keine
   neue Dependency, weniger Reibung unter tsx). WORKFLOW_STATUS hat Vercel
   bereits „bestätigt" — Befund B stellt das legitim in Frage; im Plan bewusst
   entscheiden. Möglich auch: Vercel-SDK NUR mit z.ai-Custom-Provider/`baseURL`.
2. **Die 5–6 konkreten Kriterien** (je „1"- und „10"-Zustand) — noch offen.
   Kandidaten aus A + D: (i) Projekt-Konventions-Konformität (Farb-Tokens,
   API-Quartett, `client:load`, Platzierung), (ii) Sicherheit (RLS-
   Vollständigkeit, Key-Dichtheit, Auth-Gates, SSRF), (iii) Test-Abdeckung
   (Unit/Integration-Zuordnung), (iv) Scope/Plan-Treue, (v) Architektur/Pattern-
   Konsistenz, (vi) Klarheit von PR-Titel/Body. → Aufgabe 1 vor `/10x-plan`.
3. **Diff-Größe/Token-Budget:** wie wird ein großer `git diff` gekappt/segmentiert
   (Kosten-Bramka `stepCountIs(N)` deckt Loop-Schritte, nicht Input-Größe)?
4. **Trigger-Modell:** nur `ai-cr:review`-Label (on-demand) oder auch
   automatisch auf `pull_request`? Fork-PR-Sicherheit (Secrets) beachten.
