# Deploy-Skeleton Live (F-02) — Plan Brief

> Full plan: `context/changes/deploy-skeleton-live/plan.md`

## What & Why

Merge auf `main` soll das App-Skeleton automatisch auf Cloudflare deployen und
eine öffentliche Live-URL liefern. Das schafft den Verifikationspfad „jeder
Slice ist auf Produktion prüfbar" für alle kommenden Slices (S-01–S-08) und
schließt die offene Kurs-Anforderung s01e05 (Live-Deployment, Modul 1) ab.

## Starting Point

Das Scaffold ist deploy-ready gebaut (wrangler.jsonc, Cloudflare-Adapter), aber
nichts ist verbunden: Die CI triggert auf `master` statt `main` (lief daher noch
nie), es gibt keinen Deploy-Step, kein Cloudflare-Projekt und keine Credentials.
tech-stack.md nennt zudem noch „cloudflare-pages", obwohl das Scaffold auf
Workers gebaut ist.

## Desired End State

Ein Push auf `main` durchläuft lint + build und deployt bei Erfolg automatisch;
`https://persona-forge.<account>.workers.dev` liefert die Landing-Page. Auth
bleibt bis F-01 (Supabase) erwartbar nicht funktional — das Skeleton ist live,
mehr nicht.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Deploy-Ziel | Cloudflare **Workers** (nicht Pages) | Scaffold ist Workers-gebaut; Pages ist eingefroren, Workers ist Cloudflares empfohlener Weg — tech-stack.md wird korrigiert |
| Deploy-Mechanik | GitHub Actions + `wrangler-action@v3` | Eine Pipeline, versioniert im Repo, Deploy nur wenn CI grün — passt zu `ci_default_flow: auto-deploy-on-merge` |
| Supabase-Secrets | Ohne sie live gehen | Env-Schema ist `optional: true`; F-02 bleibt von F-01 unabhängig (Roadmap: parallel) |
| PR-Previews | Nein, nur `main` deployt | Minimaler F-02-Scope („nicht mehr"); bei Bedarf später eigener Change |

## Scope

**In scope:**
- CI-Branch-Fix (`master`→`main`) + Deploy-Job (nur Push auf `main`, nach grünem CI)
- Worker-Name `persona-forge` (bestimmt die workers.dev-URL)
- Cloudflare API-Token + Account-ID als GitHub-Secrets (manuell, einmalig)
- Doku-Korrektur Pages→Workers (tech-stack.md, roadmap.md, CLAUDE.md-Gotcha)

**Out of scope:**
- PR-Preview-Deployments, Custom Domain
- Supabase-Secrets / funktionierende Auth (= F-01)
- Observability-Ausbau, Pages-Migration

## Architecture / Approach

Dem Scaffold folgen statt umbauen: bestehender CI-Workflow bekommt einen
zweiten Job `deploy` (`needs: ci`, `if: push auf main`), der selbst baut und
per wrangler-action deployt. Der erste Deploy erzeugt den Worker — kein
Vorab-Setup im Cloudflare-Dashboard nötig außer Token + Account-ID.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Deploy-Konfiguration im Repo | ci.yml-Fix + Deploy-Job, Worker-Name, Doku-Sync — lokal via `wrangler deploy --dry-run` verifiziert | `needs`/`if`-Bedingung falsch → PRs könnten deployen |
| 2. Cloudflare-Setup + Live-Gang | Token/Secrets gesetzt, erster Auto-Deploy, Live-URL verifiziert | Token-Scope zu eng/breit; erster Deploy-Lauf deckt Konfig-Fehler erst remote auf |

**Prerequisites:** Cloudflare-Account (kostenlos reicht); GitHub-Repo-Adminrechte für Secrets
**Estimated effort:** ~1 Session (Phase 1 ist Datei-Arbeit, Phase 2 sind Klicks + ein Push)

## Open Risks & Assumptions

- Annahme: Der kostenlose Workers-Plan reicht fürs Skeleton (sicher) und
  vorerst auch für spätere Slices (zu prüfen bei S-04, Edge-Runtime-Limits)
- Annahme: `wrangler deploy --dry-run` validiert lokal äquivalent zum echten
  Deploy — Rest-Risiko bleibt beim ersten Remote-Lauf
- Worker-Secrets ≠ GitHub-Secrets: F-01 muss Supabase-Werte doppelt setzen
  (Build + Runtime) — als Migration Note an F-01 übergeben

## Success Criteria (Summary)

- Push auf `main` → beide CI-Jobs grün, PRs deployen nicht
- Live-URL antwortet mit HTTP 200, Landing rendert im Browser
- Doku konsistent auf „Workers" (kein Pages-Rest, CLAUDE.md-Gotcha aufgelöst)
