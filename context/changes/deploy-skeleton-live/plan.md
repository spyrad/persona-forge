# Deploy-Skeleton Live (F-02) Implementation Plan

## Overview

Merge auf `main` deployt das App-Skeleton automatisch als **Cloudflare Worker**;
eine öffentliche `*.workers.dev`-Live-URL existiert. Das schafft den
Verifikationspfad „jeder Slice ist auf Produktion prüfbar" für S-01–S-08 und
schließt die Kurs-Anforderung s01e05 (Modul 1) ab.

## Current State Analysis

- **CI lief noch nie:** `.github/workflows/ci.yml:5,7` triggert auf `master`,
  der Branch heißt `main`. Der Workflow selbst (checkout → npm ci →
  `astro sync` → lint → build mit Supabase-Secrets) ist korrekt aufgebaut.
- **Kein Deploy-Pfad:** CI endet nach `npm run build`; es gibt keinen
  Deploy-Step, kein Cloudflare-Projekt, keine Cloudflare-Credentials.
- **Scaffold ist Workers-ready:** `wrangler.jsonc` definiert einen Worker mit
  `@astrojs/cloudflare`-Entrypoint und Static-Assets-Binding auf `./dist`
  (`wrangler.jsonc:4-11`); `wrangler` ist devDependency (`package.json:55`).
- **Falscher Worker-Name:** `wrangler.jsonc:3` heißt noch
  `"10x-astro-starter"` — der Name bestimmt die `workers.dev`-Subdomain.
- **Dokumentations-Drift:** `context/foundation/tech-stack.md:8` sagt
  `deployment_target: cloudflare-pages`; entschieden ist jetzt **Workers**
  (Scaffold-Realität + Cloudflare-Empfehlung; Pages ist eingefroren).
- **Supabase fehlt absichtlich:** F-01 (connect-supabase) ist parallel und
  offen. `SUPABASE_URL`/`SUPABASE_KEY` sind im env-Schema `optional: true`
  (`astro.config.mjs:19-20`) — Build und Runtime starten auch ohne.

## Desired End State

Ein Push/Merge auf `main` durchläuft CI (lint + build) und deployt bei Erfolg
automatisch; `https://persona-forge.<account>.workers.dev` liefert die
Landing-Page. Verifizierbar: GitHub-Actions-Lauf grün (beide Jobs), Live-URL
antwortet mit HTTP 200.

### Key Discoveries:

- `.github/workflows/ci.yml:5,7` — einzige Stellen mit `master`
- `wrangler.jsonc:3` — Worker-Name = workers.dev-Subdomain
- `astro.config.mjs:19-20` — Supabase-Env optional → Skeleton läuft ohne F-01
- `context/foundation/tech-stack.md:8` + `context/foundation/roadmap.md:40,90,92`
  — sagen noch „cloudflare-pages"; im Zuge dieses Changes korrigieren
- Etabliertes Pattern: `cloudflare/wrangler-action@v3` deployt mit
  `apiToken` + `accountId`; Standard-Command ist `wrangler deploy`

## What We're NOT Doing

- **Keine PR-Preview-Deployments** — nur `main` deployt (entschieden; bei
  Bedarf später eigener kleiner Change)
- **Keine Custom Domain** — die `workers.dev`-URL ist die Live-URL
- **Keine Supabase-Secrets / funktionierende Auth** — das ist F-01;
  Auth-Routen dürfen bis dahin Laufzeitfehler zeigen
- **Kein Observability-Ausbau** — `observability.enabled` in wrangler.jsonc
  bleibt wie gescaffoldet, mehr nicht (Roadmap: Parked)
- **Keine Pages-Migration** — wir folgen dem Workers-Scaffold

## Implementation Approach

Dem Scaffold folgen statt umbauen: Der bestehende CI-Workflow bekommt den
Branch-Fix und einen zweiten Job `deploy`, der nur bei Push auf `main` und nur
nach grünem `ci`-Job läuft, selbst baut und per `wrangler-action` deployt.
Cloudflare-Credentials (API-Token, Account-ID) kommen als GitHub-Secrets —
einmalige manuelle Schritte. Dokumente, die noch „Pages" sagen, werden im
selben Change korrigiert.

## Critical Implementation Details

**Worker-Secrets sind nicht GitHub-Secrets.** Die GitHub-Secrets
`SUPABASE_URL`/`SUPABASE_KEY` (Build-Zeit) werden beim Workers-Deploy NICHT
automatisch zu Laufzeit-Secrets des Workers. F-01 muss sie später zusätzlich
als Worker-Secrets setzen (`npx wrangler secret put` oder Dashboard) — im
F-01-Plan als Anschluss-Schritt einplanen, hier nur dokumentieren.

**Deploy-Job baut selbst.** `wrangler deploy` braucht `./dist` aus
`astro build`; statt Artefakt-Transfer zwischen Jobs baut der Deploy-Job neu
(npm ci + build, ~1–2 min) — einfacher und beim Skeleton billig.

## Phase 1: Deploy-Konfiguration im Repo

### Overview

Alle Datei-Änderungen: CI-Fix, Deploy-Job, Worker-Name, Doku-Korrektur.
Lokal verifizierbar ohne Cloudflare-Account.

### Changes Required:

#### 1. CI-Workflow: Branch-Fix + Deploy-Job

**File**: `.github/workflows/ci.yml`

**Intent**: CI auf den real existierenden Branch zeigen lassen und den
Auto-Deploy ergänzen — Deploy nur bei Push auf `main`, nur wenn lint + build
grün sind.

**Contract**: `branches: [master]` → `branches: [main]` (push + pull_request).
Neuer Job `deploy` mit diesem Gerüst (non-obvious: `needs` + `if`-Bedingung,
damit PRs und rote CI nie deployen):

```yaml
deploy:
  needs: ci
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: 22, cache: npm }
    - run: npm ci
    - run: npm run build
      env:
        SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
        SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
    - uses: cloudflare/wrangler-action@v3
      with:
        apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

#### 2. Worker-Name

**File**: `wrangler.jsonc`

**Intent**: Worker heißt wie das Projekt; bestimmt die Live-URL
`persona-forge.<account>.workers.dev`.

**Contract**: `"name": "10x-astro-starter"` → `"name": "persona-forge"`
(`wrangler.jsonc:3`). Sonst nichts anfassen.

#### 3. Dokumentations-Korrektur Pages → Workers

**File**: `context/foundation/tech-stack.md`

**Intent**: Die Vorab-Annahme `cloudflare-pages` an die getroffene Entscheidung
angleichen, damit nachgelagerte Skills (`/10x-plan`, `/10x-implement`) nicht
gegen das falsche Ziel planen.

**Contract**: `deployment_target: cloudflare-pages` →
`deployment_target: cloudflare-workers` (Zeile 8); im Fließtext „Why this
stack" keine Änderung nötig (sagt nur „Cloudflare").

**File**: `context/foundation/roadmap.md`

**Intent**: F-02-Wording konsistent halten.

**Contract**: In Zeile 40 und 90–92 „Cloudflare Pages"/„Pages-Verknüpfung" →
„Cloudflare Workers"/„Workers-Verknüpfung"; PRD-ref-Spalte
`cloudflare-pages` → `cloudflare-workers`.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`
- Wrangler-Config + Worker-Bundle valide: `npx wrangler deploy --dry-run`
- Workflow-YAML syntaktisch valide (Parse via `npx js-yaml .github/workflows/ci.yml` oder Push-Probe in Phase 2)

#### Manual Verification:

- Review: Deploy-Job kann auf PRs und bei rotem `ci`-Job nachweislich nicht
  laufen (`needs` + `if` korrekt)

**Implementation Note**: After completing this phase and all automated
verification passes, pause here for manual confirmation from the human that
the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Cloudflare-Setup + Live-Gang

### Overview

Einmalige manuelle Cloudflare-/GitHub-Schritte, dann Push auf `main` und
End-to-End-Verifikation der Live-URL.

### Changes Required:

#### 1. Cloudflare-Credentials beschaffen (manuell, Owner: Damian)

**Intent**: CI braucht ein API-Token mit Workers-Deploy-Rechten und die
Account-ID.

**Contract**: Cloudflare Dashboard → My Profile → API Tokens → Template
**„Edit Cloudflare Workers"** (scoped, kein Global-Key); Account-ID steht im
Dashboard rechts auf der Account-Übersicht (bzw. Workers & Pages → Overview).
Kein Cloudflare-Projekt vorab anlegen — der erste `wrangler deploy` erzeugt
den Worker.

#### 2. GitHub-Secrets setzen (manuell, Owner: Damian)

**Intent**: Credentials für den Deploy-Job hinterlegen.

**Contract**: Repo `spyrad/persona-forge` → Settings → Secrets and variables →
Actions: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`. Die
Supabase-Secrets werden NICHT angelegt (F-01); der Build toleriert das
(env-Schema optional).

#### 3. Push + Live-Verifikation

**Intent**: Phase-1-Commit auf `main` pushen und den ersten echten
CI+Deploy-Lauf beobachten.

**Contract**: GitHub Actions → Workflow „CI": Job `ci` grün, Job `deploy` grün;
Deploy-Log nennt die Live-URL. Danach in `CLAUDE.md` das CI-Gotcha
(„triggert auf master … lief daher noch nie") durch den neuen Ist-Zustand
ersetzen (eine Zeile: Push auf `main` deployt automatisch auf Cloudflare
Workers).

### Success Criteria:

#### Automated Verification:

- CI-Lauf grün auf `main`: `gh run list --branch main --limit 1` zeigt `completed/success`
- Live-URL antwortet: `curl -s -o NUL -w "%{http_code}" https://persona-forge.<account>.workers.dev` → `200`

#### Manual Verification:

- Landing-Page lädt im Browser (Styles/Assets intakt, keine 500er)
- `/auth/signin` zeigt den erwarteten Bis-F-01-Zustand (Fehler erlaubt,
  Landing bleibt davon unberührt)
- GitHub-Actions-Lauf eines PRs deployt nachweislich nicht (nur `ci`-Job läuft)

**Implementation Note**: After completing this phase and all automated
verification passes, pause here for manual confirmation — danach ist F-02
fertig und `/10x-archive deploy-skeleton-live` möglich.

---

## Testing Strategy

### Unit Tests:

- Entfällt — kein Test-Runner im Projekt (kommt mit Modul 3); keine
  App-Logik geändert.

### Integration Tests:

- Der CI+Deploy-Lauf selbst ist der Integrationstest (lint → build →
  dry-run-validiertes Deploy → Live-URL-Check).

### Manual Testing Steps:

1. PR gegen `main` öffnen → nur `ci`-Job läuft, kein Deploy
2. Merge/Push auf `main` → beide Jobs grün
3. Live-URL im Browser öffnen → Landing rendert
4. `/auth/signin` aufrufen → erwarteter Zustand ohne Supabase dokumentiert

## Performance Considerations

Keine — statisches Skeleton auf Edge; Deploy-Job-Doppelbuild kostet ~1–2 min
CI-Zeit und ist beim aktuellen Projektumfang irrelevant.

## Migration Notes

- F-01 (connect-supabase) muss `SUPABASE_URL`/`SUPABASE_KEY` doppelt setzen:
  als GitHub-Secrets (Build) und als Worker-Secrets (`npx wrangler secret put`,
  Runtime) — im F-01-Plan berücksichtigen.
- Rollback: Worker im Cloudflare-Dashboard löschen + Deploy-Job revert; kein
  Datenverlust möglich (keine persistenten Ressourcen).

## References

- Roadmap-Eintrag: `context/foundation/roadmap.md` (F-02, Zeilen 88–99)
- Tech-Stack-Entscheid: `context/foundation/tech-stack.md`
- CI-Workflow: `.github/workflows/ci.yml`
- Worker-Config: `wrangler.jsonc`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a
> step lands. Do not rename step titles.

### Phase 1: Deploy-Konfiguration im Repo

#### Automated

- [ ] 1.1 Lint passes: `npm run lint`
- [ ] 1.2 Build passes: `npm run build`
- [ ] 1.3 Wrangler-Config + Worker-Bundle valide: `npx wrangler deploy --dry-run`
- [ ] 1.4 Workflow-YAML syntaktisch valide

#### Manual

- [ ] 1.5 Review: Deploy-Job läuft nachweislich nicht auf PRs / bei rotem ci-Job

### Phase 2: Cloudflare-Setup + Live-Gang

#### Automated

- [ ] 2.1 CI-Lauf grün auf `main` (`gh run list`)
- [ ] 2.2 Live-URL antwortet mit HTTP 200

#### Manual

- [ ] 2.3 Landing-Page lädt im Browser (Styles intakt)
- [ ] 2.4 `/auth/signin` zeigt erwarteten Bis-F-01-Zustand
- [ ] 2.5 PR-Lauf deployt nicht (nur ci-Job)
