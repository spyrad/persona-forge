# Sentry-Produktions-Monitoring (Astro 6 + Cloudflare Workers) Implementation Plan

## Overview

Server-only Sentry-Error-Monitoring für den deployten Cloudflare-Worker als reaktives
Sicherheitsnetz (Kurslektion s03e05): ein `Sentry.withSentry`-Wrapper am Worker-Entry
fängt unbehandelte Exceptions, `captureConsoleIntegration` macht stille
`console.warn`/`console.error` als Sentry-Issues sichtbar (OWASP A10:2025 — swallowed
errors). Source-Maps liefern lesbare Prod-Stack-Traces; PII wird gescrubbt. Kein
Tracing, kein Logs-Produkt, kein Client-SDK.

## Current State Analysis

- **Kein Produktions-Monitoring.** `observability.enabled: true` in `wrangler.jsonc`
  liefert nur Cloudflare-eigene Logs (3 Tage Retention, kein Issue-Tracking, keine
  Stack-Trace-Aggregation). Laufzeit-Fehler sind faktisch unsichtbar.
- **Worker-Setup passt zum Sentry-Astro-Cloudflare-Pfad:** `astro ^6.3.1`,
  `@astrojs/cloudflare ^13.5.0`, `nodejs_compat` aktiv, Worker (nicht Pages) →
  custom `main` erlaubt (`wrangler.jsonc:4` = `@astrojs/cloudflare/entrypoints/server`).
- **Secret-Mechanik etabliert:** `astro.config.mjs` `env.schema` (`envField`,
  `astro:env/server`) für `SUPABASE_URL`/`SUPABASE_KEY`/`ENCRYPTION_KEY`; der
  Deploy-Job (`ci.yml:68-77`) synct GitHub-Secrets via `wrangler-action`
  `secrets:`-Block als Worker-Secrets. Single Source of Truth = GitHub-Secrets.
- **E2E-gated Adapter** (`astro.config.mjs:21`): `process.env.E2E ? node() : cloudflare()`.
  Der Sentry-Wrapper hängt an `wrangler.jsonc` `main` → greift NUR im deployten Worker;
  `astro dev` + E2E (Node-Adapter) umgehen ihn.
- **Audit-Befund (s03e05):** Service-Schicht propagiert jeden Supabase-`error` (`fail()` →
  throw → `serviceErrorResponse`); KEIN produktiver swallowed error. Es gibt also keinen
  „echten" Bug zum Reproduzieren — die Lücke ist die fehlende Sichtbarkeit, nicht der Code.

## Desired End State

Ein im Worker laufender unbehandelter Fehler ODER ein `console.warn`/`.error` im
Server-Code erscheint als Issue im Sentry-EU-Projekt (`o4511626474291200` /
`4511626489692240`) mit einem **source-gemappten** Stack-Trace (echte Datei/Zeile),
ohne PII (keine Cookies/Header/User-IDs/Keys). Lokaler Dev, Unit-, Integration- und
E2E-Lauf bleiben unverändert; ohne gesetztes DSN läuft die App im no-op-Modus.

### Key Discoveries:

- Custom-Entry-Pattern (offizielle Astro+Cloudflare-Doku, Stand verifiziert):
  `Sentry.withSentry((env) => ({ dsn: env.SENTRY_DSN, … }), handler)` mit
  `handler` aus `@astrojs/cloudflare/entrypoints/server`.
- `env.SENTRY_DSN` kommt aus dem **Cloudflare-Worker-Env** (Worker-Secret), NICHT aus
  `astro:env` → kein Schema-Eintrag in `astro.config` nötig (`astro.config.mjs:22-28`).
- Source-Maps via `@sentry/astro`-Integration (`org`/`project`/`authToken`) — Build-Zeit,
  getrennt vom Laufzeit-DSN. EU-Region kann beim Upload den `de.sentry.io`-Host verlangen.
- PII-Scrub: `sendDefaultPii: false` (Default) + explizit `dataCollection: { userInfo:
false, httpBodies: [] }` — wichtig wegen entschlüsselter API-Keys im Request-Pfad.
- `captureConsoleIntegration({ levels: ["warn","error"] })` (Lektions-Deep-Dive) — der
  Mechanismus, der stille warns sichtbar macht.

## What We're NOT Doing

- **Kein Client-/Browser-SDK** (keine `sentry.client.config.ts`, keine Island-Instrumentierung).
- **Kein Tracing/Performance** (`tracesSampleRate: 0`) und **kein Logs-Produkt** (`enableLogs`
  aus) — nur Error-Monitoring, passend zur Sentry-Projekt-Auswahl (5.000 Errors/mo).
- **Kein Sentry-MCP-Server** (späterer, optionaler Schritt — Deep Dive der Lektion).
- **Kein Deploy-Gate** durch Sentry; Required Checks bleiben `ci`+`integration`.
- **Keine** Härtung von `signout.ts` (separater, im Audit gefundener Grenzfall — eigener Change).
- **Keine** Änderung an Datenmodell, Migrationen oder Business-Logik.

## Implementation Approach

Dem dokumentierten Astro-6-Cloudflare-Pfad folgen: Laufzeit-Instrumentierung über den
Worker-Entry-Wrapper (`@sentry/cloudflare`), Build-Zeit-Source-Maps über die
`@sentry/astro`-Integration. Erst Code + lokale Gates (Phase 1), dann Secret-Sync, sodass
der erste Deploy mit DSN grün durchläuft (Phase 2), dann ein einmaliger Live-Beweis über
einen gegateten Wegwerf-Trigger, der danach revertiert wird (Phase 3).

## Critical Implementation Details

- **Entry-Point/Build-Interaktion (Hauptrisiko):** `wrangler.jsonc` `main` zeigt künftig
  auf `./sentry.server.config.ts`, die `@astrojs/cloudflare/entrypoints/server` importiert
  und mit `withSentry` umschließt. wrangler bundelt diese Datei als Worker-Entry; der
  Astro-Build muss vorher gelaufen sein (liefert die Server-Manifest-Artefakte, die der
  Adapter-Entrypoint erwartet). Reihenfolge im Deploy unverändert: `npm run build` →
  `wrangler deploy`.
- **E2E darf nicht brechen:** Unter `E2E=1` greift der Node-Adapter und `wrangler.jsonc`
  `main` ist irrelevant. Die `@sentry/astro`-Integration läuft aber bei JEDEM `astro build`
  (auch E2E/lokal) — sie darf ohne `SENTRY_AUTH_TOKEN` den Build NICHT brechen (Upload wird
  ohne Token still übersprungen) und darf kein Client-Bundle in die Islands injizieren
  (keine `sentry.client.config.ts` anlegen → kein Client-Runtime).
- **EU-Region:** DSN ist `…ingest.de.sentry.io…`. Falls der Source-Map-Upload den
  US-Default ansteuert, beim Implement den Region-Host setzen (Integration-Option `url`
  bzw. `SENTRY_URL=https://de.sentry.io/`). Org-Auth-Token erst in der EU-Org erzeugen.

## Phase 1: Server-Instrumentierung (Code)

### Overview

Sentry-Deps installieren, den Worker-Entry-Wrapper anlegen, `wrangler.jsonc` umstellen und
die Source-Map-Integration verdrahten — so, dass alle lokalen Gates grün bleiben und der
E2E-Pfad unberührt ist. (Noch ohne Secrets → lokal no-op.)

### Changes Required:

#### 1. Sentry-Dependencies

**File**: `package.json`

**Intent**: `@sentry/astro` und `@sentry/cloudflare` als Dependencies aufnehmen — die
Versionen, die den Astro-6-Cloudflare-Custom-Entry unterstützen (`@sentry/astro` ≥ 10.44).

**Contract**: Beide unter `dependencies`; `package-lock.json` aktualisiert. Installation
ggf. mit `NODE_OPTIONS=--use-system-ca` (TLS-Interception-Gotcha).

#### 2. Worker-Entry-Wrapper

**File**: `sentry.server.config.ts` (neu, Repo-Root)

**Intent**: Den Cloudflare-Astro-Handler mit `Sentry.withSentry` umschließen; DSN aus dem
Worker-Env, stille Konsolen-Logs einfangen, PII scrubben, Tracing/Logs aus.

**Contract**: Default-Export = Rückgabe von `Sentry.withSentry(configFn, handler)`.
`handler` aus `@astrojs/cloudflare/entrypoints/server`. Config: `dsn: env.SENTRY_DSN`,
`sendDefaultPii: false`, `dataCollection: { userInfo: false, httpBodies: [] }`,
`tracesSampleRate: 0`, `integrations: [Sentry.captureConsoleIntegration({ levels:
["warn","error"] })]`, optional `environment: "production"`. Ohne DSN → SDK no-op.

```typescript
import * as Sentry from "@sentry/cloudflare";
import handler from "@astrojs/cloudflare/entrypoints/server";

export default Sentry.withSentry(
  (env) => ({
    dsn: env.SENTRY_DSN,
    sendDefaultPii: false,
    dataCollection: { userInfo: false, httpBodies: [] },
    tracesSampleRate: 0,
    integrations: [Sentry.captureConsoleIntegration({ levels: ["warn", "error"] })],
  }),
  handler,
);
```

#### 3. Worker-Entry umstellen

**File**: `wrangler.jsonc`

**Intent**: `main` vom Adapter-Default auf den Sentry-Wrapper zeigen lassen.

**Contract**: `"main": "./sentry.server.config.ts"` statt
`"@astrojs/cloudflare/entrypoints/server"`. Rest (`assets`, `observability`,
`compatibility_*`) unverändert.

#### 4. Source-Map-Integration

**File**: `astro.config.mjs`

**Intent**: Die `@sentry/astro`-Integration nur für Build-Zeit-Source-Map-Upload ergänzen
(Org/Projekt/Token), ohne Client-Runtime. SENTRY_DSN NICHT ins `env.schema` (wird nur am
Worker-Rand konsumiert).

**Contract**: `sentry({ org: "…", project: "…", sourceMapsUploadOptions: { authToken:
process.env.SENTRY_AUTH_TOKEN } })` in `integrations`. Upload no-op ohne Token. Falls die
Integration sonst Client-Instrumentierung aktiviert: per Option deaktivieren (keine
`sentry.client.config.ts` anlegen). EU-Host-Option offen halten (siehe Critical Details).

#### 5. Env-Typing für `SENTRY_DSN`

**File**: `src/env.d.ts` (oder generiertes `worker-configuration.d.ts` via `wrangler types`)

**Intent**: Den Worker-`Env`-Typ um `SENTRY_DSN` erweitern, damit `env.SENTRY_DSN` im
Wrapper typsicher ist.

**Contract**: `interface Env { SENTRY_DSN?: string }` (bzw. via `wrangler types` generiert).
Kein `any`-Cast im Wrapper.

#### 6. Lokale Env-Vorlage

**File**: `.dev.vars` / `.env` / deren `.example`-Geschwister

**Intent**: `SENTRY_DSN` als dokumentierte (leere/optionale) Variable aufnehmen — lokal
bewusst leer (no-op), Vorlage zeigt das EU-DSN-Format.

**Contract**: `SENTRY_DSN=` in `.example`; reale lokale Dateien optional gefüllt.

### Success Criteria:

#### Automated Verification:

- Typecheck/Astro-Check passt: `npx astro sync && npm run build`
- Linting passt: `npm run lint`
- Unit-Tests grün: `npm run test`
- E2E-Build/-Lauf unberührt: `npm run test:e2e` grün (Node-Adapter, kein Sentry-Bruch)

#### Manual Verification:

- `astro dev` startet ohne Sentry-bezogene Fehler; App funktioniert ohne gesetztes DSN (no-op)
- Kein zusätzliches Client-JS in den Islands (Network-Tab: keine Sentry-Browser-Bundles)
- `dist`-Worker-Bundle baut mit `main = ./sentry.server.config.ts` ohne Bundling-Fehler

**Implementation Note**: Nach Phase 1 + grünen Automated-Checks hier für manuelle
Bestätigung pausieren, bevor Phase 2 (Secrets) startet.

---

## Phase 2: Secret-Sync (CI/Prod)

### Overview

Beide Secrets verdrahten — `SENTRY_DSN` als Laufzeit-Worker-Secret, `SENTRY_AUTH_TOKEN`
als Build-Zeit-Secret für den Source-Map-Upload — sodass der nächste Deploy grün
durchläuft und das DSN im Worker ankommt.

### Changes Required:

#### 1. Worker-Secret-Sync (Laufzeit-DSN)

**File**: `.github/workflows/ci.yml` (Job `deploy`)

**Intent**: `SENTRY_DSN` über den `wrangler-action`-`secrets:`-Block als Worker-Secret
synchronisieren (analog `SUPABASE_*`).

**Contract**: `SENTRY_DSN` in den `secrets: |`-Block UND in die `env:` der
`cloudflare/wrangler-action`-Stufe aufnehmen.

```yaml
secrets: |
  SUPABASE_URL
  SUPABASE_KEY
  SENTRY_DSN
env:
  SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
  SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
  SENTRY_DSN: ${{ secrets.SENTRY_DSN }}
```

#### 2. Build-Zeit-Token (Source-Maps)

**File**: `.github/workflows/ci.yml` (Jobs `ci` und `deploy`, jeweils der `npm run build`-Step)

**Intent**: `SENTRY_AUTH_TOKEN` der Build-Umgebung verfügbar machen, damit der Upload läuft.
Build bleibt grün, falls Token fehlt (Upload wird übersprungen).

**Contract**: `SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}` in der `env:` des
`npm run build`-Steps in beiden Jobs.

#### 3. GitHub-Secrets

**File**: (GitHub-Repo-Settings, manuell durch User)

**Intent**: `SENTRY_DSN` (EU-DSN) und `SENTRY_AUTH_TOKEN` (EU-Org-Auth-Token mit
`project:releases`/source-map-Scope) als Repo-Secrets hinterlegen.

**Contract**: Beide Secrets gesetzt; Single Source of Truth bleibt GitHub-Secrets.

### Success Criteria:

#### Automated Verification:

- CI-Lauf nach Push grün: `ci` + `integration` + `deploy` (REST-API-Check der Run-Steps,
  da `gh` nicht installiert — `curl.exe --ssl-no-revoke`)
- `build`-Step bricht NICHT, wenn `SENTRY_AUTH_TOKEN` (noch) fehlt

#### Manual Verification:

- Worker-Secret `SENTRY_DSN` ist nach Deploy am Worker gesetzt (Cloudflare-Dashboard/`wrangler secret list`)
- Deploy-Job-Log zeigt erfolgreichen (oder bewusst übersprungenen) Source-Map-Upload
- Prod-`/` lädt unverändert (kein Regress durch den Entry-Point-Wechsel)

**Implementation Note**: Nach Phase 2 für manuelle Bestätigung (Deploy grün, DSN am
Worker) pausieren, bevor der Live-Trigger (Phase 3) gebaut wird.

---

## Phase 3: End-to-end-Verifikation (temporärer Test-Trigger)

### Overview

Einmalig live beweisen, dass die Kette DSN → EU-Region → Worker-Entry → Sentry-Issue mit
source-gemapptem Stack-Trace funktioniert — über einen gegateten Wegwerf-Trigger, der nach
der Bestätigung sofort revertiert wird (Deliberate-Break-Muster aus s03e04).

### Changes Required:

#### 1. Temporärer Test-Trigger

**File**: `src/pages/api/_debug-sentry.ts` (neu, temporär)

**Intent**: Ein gegateter Endpoint, der bei Aufruf mit einem geheimen Token-Query bewusst
wirft (für unhandled-exception-Pfad) bzw. `console.error` ausführt (für captureConsole-Pfad)
— nur um EIN Event zu erzeugen. Wird im selben Phasen-Abschluss entfernt.

**Contract**: `GET` mit `prerender = false`; nur aktiv, wenn ein Query-Token einem
erwarteten Wert entspricht (sonst 404), damit der Endpoint nie versehentlich generisch
auslösbar ist. Kein Persistenz-/Auth-Effekt.

#### 2. Revert

**File**: `src/pages/api/_debug-sentry.ts`

**Intent**: Endpoint nach erfolgreicher Sentry-Bestätigung wieder entfernen.

**Contract**: Datei gelöscht; Revert-Commit referenziert das Verifikations-Ergebnis.

### Success Criteria:

#### Automated Verification:

- Vor Revert: Deploy mit Trigger grün (`ci`+`integration`+`deploy`)
- Nach Revert: `npm run build` + `npm run lint` grün; Endpoint-Datei existiert nicht mehr

#### Manual Verification:

- Trigger-Aufruf erzeugt im Sentry-EU-Dashboard ein Issue (unhandled exception)
- Der Stack-Trace ist **source-gemappt** (echte Datei/Zeile, nicht minifiziert) → Source-Map-Upload bestätigt
- Ein `console.error`-Aufruf erscheint ebenfalls als Issue → `captureConsoleIntegration` bestätigt
- Issue enthält **keine** PII (keine Cookies/Authorization-Header/User-IDs/Keys)
- Nach Revert: kein `_debug-sentry`-Endpoint in Prod mehr erreichbar (404)

**Implementation Note**: Phase 3 ist erst „done", wenn der Trigger revertiert UND das
Verifikations-Ergebnis im Changelog (`dtb-project/project-changelog/`) festgehalten ist.

---

## Testing Strategy

### Unit Tests:

- Keine neuen Unit-Tests nötig (Konfig/Infra-Change ohne Business-Logik). Bestehende
  Suite muss grün bleiben (Regressionsschutz für den Entry-Point-Wechsel).

### Integration Tests:

- Keine neuen itests. Der bestehende `integration`-Job muss grün bleiben.

### Manual Testing Steps:

1. `astro dev` ohne DSN starten → App läuft, keine Sentry-Fehler (no-op).
2. `npm run test:e2e` → E2E grün (Node-Adapter, Wrapper umgangen).
3. Nach Deploy: Test-Trigger auslösen → Issue mit source-gemapptem Trace im EU-Dashboard.
4. PII-Check am Issue (keine Header/Cookies/User/Keys).
5. Revert → Endpoint weg.

## Performance Considerations

`tracesSampleRate: 0` und kein Logs-Produkt → minimaler Overhead (nur Error-Capture).
`captureConsoleIntegration` auf `warn`+`error` begrenzt teilt sich das 5.000/mo-Limit —
bei steigendem Traffic ggf. auf `error` verengen (Kosten-Hinweis, nicht jetzt).

## Migration Notes

Keine Daten-Migration. Der einzige laufzeitrelevante Schnitt ist der `wrangler.jsonc`-`main`-
Wechsel; Rollback = `main` auf `@astrojs/cloudflare/entrypoints/server` zurücksetzen und
neu deployen.

## References

- Change-Identität & Constraints: `context/changes/sentry-monitoring/change.md`
- Kurslektion: `.ressources/lekcje/s03-e05-debugowanie-z-ai-od-stack-trace.md` (Deep Dive)
- Bestehende Secret-Mechanik: `.github/workflows/ci.yml:68-77`, `astro.config.mjs:22-28`
- E2E-Adapter-Gating: `astro.config.mjs:21`, `playwright.config.ts:48-66`
- Lessons: `context/foundation/lessons.md` (#2 CI-Gate/Required-Checks)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Server-Instrumentierung (Code)

#### Automated

- [x] 1.1 Typecheck/Build passt: `npx astro sync && npm run build` — c068c87
- [x] 1.2 Linting passt: `npm run lint` — c068c87
- [x] 1.3 Unit-Tests grün: `npm run test` — c068c87
- [x] 1.4 E2E-Build/-Lauf unberührt: `npm run test:e2e` — c068c87

#### Manual

- [x] 1.5 `astro dev` startet ohne Sentry-Fehler; App ohne DSN funktional (no-op) — c068c87
- [x] 1.6 Kein zusätzliches Client-JS in den Islands (Network-Tab) — c068c87
- [x] 1.7 Worker-Bundle baut mit `main = ./sentry.server.config.ts` ohne Bundling-Fehler — c068c87

### Phase 2: Secret-Sync (CI/Prod)

#### Automated

- [x] 2.1 CI-Lauf grün: `ci` + `integration` + `deploy` (REST-API-Check) — 89a835a
- [x] 2.2 `build`-Step bricht nicht, wenn `SENTRY_AUTH_TOKEN` fehlt — 89a835a

#### Manual

- [x] 2.3 Worker-Secret `SENTRY_DSN` nach Deploy gesetzt (`wrangler secret list`) — 89a835a
- [x] 2.4 Deploy-Log zeigt erfolgreichen/übersprungenen Source-Map-Upload — 89a835a
- [x] 2.5 Prod-`/` lädt unverändert (kein Entry-Point-Regress) — 89a835a

### Phase 3: End-to-end-Verifikation (temporärer Test-Trigger)

#### Automated

- [x] 3.1 Vor Revert: Deploy mit Trigger grün (`ci`+`integration`+`deploy`) — 9bb4b66
- [x] 3.2 Nach Revert: `npm run build` + `npm run lint` grün; Endpoint-Datei entfernt

#### Manual

- [x] 3.3 Trigger erzeugt Issue (unhandled exception) im Sentry-EU-Dashboard — 9bb4b66
- [x] 3.4 Stack-Trace ist source-gemappt (echte Datei/Zeile) — 9bb4b66
- [x] 3.5 `console.error` erscheint als Issue (captureConsoleIntegration bestätigt) — 9bb4b66
- [x] 3.6 Issue enthält keine PII (Cookies/Header/User/Keys) — 9bb4b66 (SDK-seitig; IP via Sentry-Server-Inferenz, optional via Projekt-Toggle scrubben)
- [ ] 3.7 Nach Revert: `_debug-sentry`-Endpoint in Prod 404; Ergebnis im Changelog dokumentiert
