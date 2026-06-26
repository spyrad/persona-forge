---
change_id: sentry-monitoring
title: Sentry-Produktions-Monitoring (Astro 6 + Cloudflare Workers)
status: impl_reviewed
created: 2026-06-25
updated: 2026-06-25
archived_at: null
---

## Notes

Reaktives Sicherheitsnetz aus Kurslektion s03e05 (Debugging vom Stack-Trace): Sentry
als Produktions-Monitoring, damit stille Fehler (swallowed errors, OWASP A10:2025)
sichtbar werden, die der proaktive Test-Pipeline (Modul 3) per Definition nicht fängt.

Auslöser: Das s03e05-Audit ergab **keinen** produktiven swallowed error im Code
(Service-Schicht durchgängig diszipliniert), aber die echte Lücke ist **fehlendes
Produktions-Monitoring** — aktuell null Sichtbarkeit auf Laufzeit-Fehler.

Kern-Constraints (für /10x-plan):

- Stack = Astro 6 + `@astrojs/cloudflare` (Workers) → Deep-Dive-Fall: braucht
  `@sentry/astro` **und** `@sentry/cloudflare`, **custom entry point** statt Default
  (`sentry.server.config.ts` mit `Sentry.withSentry(...)`, `main`-Override in
  `wrangler`-Config). `@sentry/astro` ≥ 10.44.0 (issue #19762).
- `captureConsoleIntegration({ levels: ["warn","error"] })` — macht stille
  `console.warn` als Issues sichtbar (Kosten-Trade-off: teilt sich das 5.000/mo-Limit).
- DSN = `SENTRY_DSN`, **EU-Region** (`ingest.de.sentry.io`). Als Env-Var/Secret führen
  (lokal `.dev.vars`/`.env`, prod GitHub-Secret → Deploy-Job synct als Worker-Secret,
  CLAUDE.md-Gotcha). Kein DSN → SDK no-op (gleicher Code mit/ohne Sentry).
- Sentry-Projekt: SDK **Astro**, nur **Error monitoring** (Logging/Replay/Tracing/
  Metrics bewusst aus). Org `o4511626474291200`, Projekt `4511626489692240`.
- Optional (Deep Dive, nicht MVP): Sentry MCP-Server für agentengetriebene Diagnose.

E2E-Adapter-Gotcha beachten: astro.config schaltet bei `process.env.E2E` auf
`@astrojs/node` — der Sentry-Workers-Entry-Point darf den E2E-Lauf nicht brechen.

## Adaptation (Phase 1, 2026-06-25)

Plan sah `@sentry/astro`-Integration für Source-Maps vor. Recherche im installierten
Paket (`@sentry/astro@10.61`) ergab: deren Cloudflare-Vite-Plugin wrappt den Worker-
Handler automatisch mit `withSentry(() => undefined, handler)` und re-initialisiert pro
Request mit NUR `{ dsn }` aus dem Env — `captureConsoleIntegration` greift dabei nicht.
Source-Maps sind zudem an `sdkEnabled` gekoppelt (kein „nur Source-Maps ohne Auto-Wrap").
Da persona-forge Fehler abfängt + als 500 via `console.error` loggt (`api-responses.ts:27`),
wären ohne captureConsole die echten 500er in Sentry unsichtbar. **Entscheidung (User
bestätigt):** manueller `withSentry`-Entry (volle Options-Kontrolle) + `@sentry/vite-plugin`
für Source-Maps. `@sentry/astro` entfernt, `@sentry/vite-plugin` (dev) ergänzt. `dataCollection`
(neuere Docs) existiert in 10.61 nicht → `sendDefaultPii: false` als PII-Kontrolle.
