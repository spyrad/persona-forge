<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Sentry-Produktions-Monitoring (Astro 6 + Cloudflare Workers)

- **Plan**: context/changes/sentry-monitoring/plan.md
- **Scope**: Phasen 1–3 (vollständig)
- **Date**: 2026-06-25
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 3 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

## Findings

### F1 — Rohe Error-Objekte via console.error → potenzieller Inhalts-Leak

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🔎 MEDIUM — echter Trade-off; kurz nachdenken
- **Dimension**: Safety & Quality
- **Location**: sentry.server.config.ts:26 + src/lib/api-responses.ts:27
- **Detail**: captureConsoleIntegration leitet console.error-Argumente an Sentry. serviceErrorResponse loggt den rohen `err`. `sendDefaultPii:false` scrubbt nur IP/Cookies/Header/Body, NICHT Message-Inhalte. Falls ein Supabase-/Treiber-Fehler je einen Connection-String/JWT/Row-Daten in der Message trägt, landet das als Event-Extra in Sentry.
- **Fix**: beforeSend/beforeBreadcrumb-Scrubber im withSentry-Config ergänzen, der Message-Inhalte auf Secret-Muster filtert. Follow-up, nicht blockierend.
- **Decision**: FIXED (fix now) — Scrubber in `sentry.server.config.ts` ergänzt (JWT/`sb_*`/Bearer/`postgres://`-Muster → `[Filtered]` in message/exception/breadcrumb). Build + 48/48 Units grün.

### F2 — Undokumentierter interner Adapter-Entrypoint-Pfad

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — schnelle Entscheidung, Fix offensichtlich
- **Dimension**: Architecture
- **Location**: sentry.server.config.ts:18
- **Detail**: Import von `@astrojs/cloudflare/entrypoints/server` (interner Pfad). Heute korrekt (gegen @astrojs/cloudflare@13.5.0 + @sentry/cloudflare@10.61 verifiziert), bricht aber potenziell bei einem Adapter-Major-Bump — analog zur bestehenden E2E-Node-Adapter-Kopplung. wrangler.jsonc:5-6 hat schon einen Rollback-Kommentar.
- **Fix**: Einzeiligen CLAUDE.md-Gotcha ergänzen (lockstep-Pin bei Astro-Major, wie beim @astrojs/node-Pin).
- **Decision**: FIXED (fix now) — Gotcha-Zeile in `CLAUDE.md` (Important Gotchas) nach dem `@astrojs/node`-E2E-Eintrag ergänzt.

### F3 — ENCRYPTION_KEY nicht im Deploy-Secret-Sync (vorbestehend, out-of-scope)

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🔎 MEDIUM — verifizieren lohnt sich
- **Dimension**: Safety & Quality
- **Location**: .github/workflows/ci.yml:80-83 (secrets:-Block)
- **Detail**: Der wrangler-action `secrets:`-Block synct SUPABASE_URL/KEY + jetzt SENTRY_DSN, aber NICHT ENCRYPTION_KEY (für API-Key-Verschlüsselung). Nicht von diesem Change eingeführt (vorbestehend), beim Review aufgefallen. Prod läuft, also ist der Key gesetzt — fraglich ob via CI-Sync oder manuell.
- **Fix**: Verifizieren, ob ENCRYPTION_KEY als Worker-Secret gesetzt ist und ob er in den Sync-Block gehört (separater Change — nicht Teil von sentry-monitoring).
- **Decision**: DEFERRED — als separater Change zurückgestellt (out-of-scope, blindes Syncen riskant). Notiert in `context/changes/sentry-monitoring/follow-ups/review-fixes.md`.
