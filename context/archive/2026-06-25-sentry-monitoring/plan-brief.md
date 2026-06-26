# Sentry-Produktions-Monitoring — Plan Brief

> Full plan: `context/changes/sentry-monitoring/plan.md`

## What & Why

Server-only Sentry-Error-Monitoring für den Cloudflare-Worker als reaktives Sicherheitsnetz
(Kurslektion s03e05): ein `withSentry`-Wrapper fängt unbehandelte Exceptions,
`captureConsoleIntegration` macht stille `console.warn`/`.error` als Issues sichtbar
(swallowed errors, OWASP A10:2025). Das s03e05-Audit fand keinen produktiven swallowed
error im Code — die echte Lücke ist die **fehlende Sichtbarkeit** auf Laufzeit-Fehler.

## Starting Point

persona-forge (Astro 6 + `@astrojs/cloudflare` 13, Worker, `nodejs_compat`) hat **kein**
Produktions-Monitoring — nur Cloudflare-Logs (3 Tage, kein Issue-Tracking). Secret-Sync ist
etabliert (GitHub-Secrets → `wrangler-action` → Worker-Secrets); der Adapter ist E2E-gated.

## Desired End State

Ein Worker-Fehler oder ein server-seitiges `console.warn/.error` erscheint als Issue im
Sentry-EU-Projekt mit **source-gemapptem** Stack-Trace, **ohne PII**. Lokaler Dev, Unit-,
Integration- und E2E-Lauf bleiben unverändert; ohne DSN läuft die App im no-op-Modus.

## Key Decisions Made

| Decision         | Choice                                                | Why (1 sentence)                                                       | Source |
| ---------------- | ----------------------------------------------------- | ---------------------------------------------------------------------- | ------ |
| Erfassungs-Scope | Nur Server (Worker)                                   | Trifft das Lektions-Ziel (serverseitige stille Fehler), minimal        | Plan   |
| Stack-Traces     | Source-Maps hochladen                                 | „vom Stack-Trace" braucht echte Quellzeilen in Prod                    | Plan   |
| PII              | Gescrubbt (`sendDefaultPii:false` + `dataCollection`) | Auth-App mit Mails + entschlüsselten Keys; DSGVO/EU                    | Plan   |
| Verifikation     | Temporärer Test-Trigger + Revert                      | Beweist die ganze Kette DSN→Region→Entry→Event                         | Plan   |
| Sentry-MCP       | Out of scope                                          | Hält den Change auf produktiven Code fokussiert                        | Plan   |
| DSN-Einbindung   | Worker-Env (nicht `astro:env`)                        | `withSentry((env)=>…)` konsumiert am Worker-Rand → kein Schema-Eintrag | Plan   |
| Tracing/Logs     | Aus (`tracesSampleRate:0`, keine Logs)                | Nur Error-Monitoring (5.000/mo-Topf)                                   | Plan   |

## Scope

**In scope:** `@sentry/astro`+`@sentry/cloudflare`-Deps, `sentry.server.config.ts`-Wrapper,
`wrangler.jsonc`-`main`-Wechsel, Source-Map-Integration, `Env`-Typing, CI-Secret-Sync (DSN

- Auth-Token), Live-Verifikation.

**Out of scope:** Client-/Browser-SDK, Tracing/Logs-Produkt, Sentry-MCP, `signout.ts`-Härtung,
Deploy-Gate durch Sentry, Datenmodell-/Logik-Änderungen.

## Architecture / Approach

Laufzeit-Instrumentierung am Worker-Entry (`wrangler.jsonc` `main` → `sentry.server.config.ts`,
das den `@astrojs/cloudflare`-Handler mit `withSentry` umschließt; DSN aus dem Worker-Env).
Build-Zeit-Source-Maps über die `@sentry/astro`-Integration (`org`/`project`/`authToken`).
Der Wrapper greift nur im deployten Worker — `astro dev` + E2E (Node-Adapter) umgehen ihn.

## Phases at a Glance

| Phase                      | What it delivers                              | Key risk                                       |
| -------------------------- | --------------------------------------------- | ---------------------------------------------- |
| 1. Server-Instrumentierung | Code + lokale Gates grün, E2E unberührt       | `main`-Wechsel/Build-Bundling; E2E-Bruch       |
| 2. Secret-Sync (CI/Prod)   | DSN + Auth-Token verdrahtet, Deploy grün      | EU-Region beim Source-Map-Upload; Secret fehlt |
| 3. Live-Verifikation       | Issue mit source-gemapptem Trace, dann Revert | Trigger versehentlich dauerhaft/öffentlich     |

**Prerequisites:** Sentry-EU-Projekt (vorhanden, Astro/Error-Monitoring); GitHub-Secrets
`SENTRY_DSN` + `SENTRY_AUTH_TOKEN` setzbar; Push-auf-`main`-Deploy (braucht User-`!`).
**Estimated effort:** ~1–2 Sessions über 3 Phasen.

## Open Risks & Assumptions

- Custom `main` + `astro build`-Bundling ist der Astro-6-Cloudflare-Pfad (Doku verifiziert),
  aber der Deploy ist der echte Lackmustest — Phase 1 baut lokal, Phase 2 deployt.
- EU-Region kann beim Source-Map-Upload den `de.sentry.io`-Host verlangen (Implement-Verify).
- `@sentry/astro`-Integration darf kein Client-Bundle injizieren (keine `client.config.ts`)
  und den Build ohne Token nicht brechen.

## Success Criteria (Summary)

- Ein Worker-Fehler/`console.error` landet als Issue mit lesbarem (source-gemapptem) Trace im EU-Dashboard.
- Keine PII in den Events; lokaler Dev/Unit/Integration/E2E unverändert grün.
- Test-Trigger nach Verifikation revertiert; Ergebnis im Changelog dokumentiert.
