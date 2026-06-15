# Workflow-Status: persona-forge

**Letztes Update:** 2026-06-15 (Session 2)
**Letzter Session-Log:** `dtb-project/project-changelog/2026-06/2026-06-15.md`

---

## Aktueller Stand

| Kennzahl | Wert |
|----------|------|
| **Laufende Arbeit** | **Keine.** S-01 `email-auth-live` **abgeschlossen + archiviert** (`8b84ace` → `context/archive/2026-06-13-email-auth-live/`); Roadmap S-01 → `done`. Impl-Review gefahren (F1–F5 gefixt + Härtung live `72fa7ce`, Run `27561116880` grün), F6 als Follow-up |
| **Naechster Schritt** | Nächsten Slice starten — **S-02** `model-config-management` oder **S-03** `persona-catalog` (beide entsperrt durch S-01, parallel möglich). Mit `/dtb:feature-start` bzw. `/10x-new` + `/10x-plan` |
| **Blocker** | Keiner. Supabase-SMTP-Rate-Limit nur zeitlich für Mail-Tests; OEJTS-Quelle blockt S-04 (unverändert) |

---

## Offene Aufgaben

- [x] Supabase URL-Config (Site-URL + Redirect-Allowlist `/auth/callback`) — Damian erledigt 2026-06-15
- [x] Mail-Link verifiziert (lokal, echter Link → Verify → `/auth/callback` → E-Mail confirmed → Login → `/dashboard`); Prod-Callback-Wiring per curl belegt; Prod-Re-Deploy `5025edf` grün → 4.4 + 4.5 ✅
- [x] **S-01 abschließen + `email-auth-live` archivieren** — erledigt 2026-06-15 (`8b84ace`), inkl. Impl-Review
- [ ] **F6 (Follow-up):** Trigger-Migration idempotent machen (`on conflict do nothing`) — Detail: `context/archive/2026-06-13-email-auth-live/follow-ups/review-fixes.md`
- [ ] Husky/lint-staged-Hook prüfen: griff bei `4b5e916` nicht (2 prettier-Fehler in callback.ts rutschten durch → CI-Lint-Fail → deploy skipped). Hook-Setup verifizieren, damit Format-Fehler nicht erneut die CI brechen
- [ ] Cleanup Test-User remote-DB: `7ad40ffa…514794`, `98cbe7ba…2d4fd`, `pf…1742`, `pf174558b` + `+pf…`-Aliases; `.playwright-mcp/` in `.gitignore`
- [ ] (Optional) Frischer Prod-Mail-Confirm-Happy-Path wenn SMTP-Limit zurückgesetzt (Auto-Login direkt nach Mail-Klick, einmal live beobachten)
- [ ] OEJTS-Quelle fixieren — Itemtexte, Achsen, Scoring (Owner: Damian)
- [ ] Test-Runner (Vitest), dann `test_command` in `workflow.config.yaml` — Voraussetzung Modul 3
- [ ] GitHub Repo-Description + Topics setzen (manuell); stale Root-`WORKFLOW_STATUS.md`-Duplikat klären

---

## Abgeschlossene Meilensteine (kompakt)

| Datum | Meilenstein | Ergebnis | Details |
|-------|-------------|----------|---------|
| 2026-06-15 | **S-01 abgeschlossen + archiviert** | Impl-Review (F1–F5 gefixt, Härtung live), Change archiviert, Roadmap S-01 → done | `72fa7ce` (Härtung), `8b84ace` (Archiv) |
| 2026-06-15 | S-01 Phase 4 komplett (4.1–4.5) | Auth end-to-end lokal+Prod verifiziert; Callback live | `5025edf`, Run `27559204315` |
| 2026-06-15 | CI-Deploy-Blocker behoben | prettier-Fehler in callback.ts → CI-Lint-Fail (`27522902004`) → deploy skipped; gefixt | `5025edf` |
| 2026-06-15 | S-01 Phase 3 (Middleware) | Manual-Gate grün, live deployt | `a210f0c`, CI-Run `27521878004` |
| 2026-06-15 | Confirm-Mail-Callback (Bug-Fix) | `/auth/callback` + `emailRedirectTo`, build grün | `4b5e916` |
| 2026-06-14 | S-01 Phase 2 (profiles-Trigger) | Migration remote applied, Trigger feuert | `96adb0b` |
| 2026-06-14 | S-01 Phase 1 (API-Validierung) | Zod-Auth, 1.0–1.6 grün | `80357ca` |
| 2026-06-13 | F-01: connect-supabase | Supabase + RLS-Grundgerüst | `context/archive/2026-06-12-connect-supabase/` |
| 2026-06-12 | F-02: deploy-skeleton-live | Live-URL, CI grün | `context/archive/2026-06-11-deploy-skeleton-live/` |

---

## Pausierte Themen

### S-04: OEJTS-Messlauf
**Status:** Blocked — OEJTS-Quelldatensatz (Itemtexte, Achsen, Scoring) muss von Damian beschafft werden
**Details:** `context/foundation/roadmap.md` (Open Roadmap Questions)

---

## Befunde / Gotchas (Session 2026-06-15)

- **CI-Lint blockt Deploy (silent):** `deploy`-Job hängt an `needs: ci`; ein roter `npm run lint` (hier 2 prettier-Fehler in callback.ts, Commit `4b5e916`) lässt `deploy` **skippen** — kein Fehler-Alarm, Prod läuft still auf altem Stand. Symptom war `/auth/callback` = 404 auf Prod trotz gepushtem Fix. Lehre: nach Push auf `main` immer den **deploy-Job** (nicht nur „push erfolgreich") prüfen.
- **PKCE = selber Browser:** Mail-Confirm-Link muss im selben Browser geöffnet werden, der den Signup machte (`code_verifier`-Cookie). Anderer Browser/Device → `?error=PKCE code verifier not found`; E-Mail wird trotzdem bestätigt (Verify-Token läuft), User loggt sich dann normal ein. Beim Testen mit Playwright: Signup **und** Link-Öffnen im selben MCP-Browser-Kontext.
- **miniflare-Dev-Quirk:** transienter „Network connection lost" (`entry.worker.js`) bei in-flight-Request während Vite-`program reload`; per F5 grün, in Prod unmöglich. Kein Code-Bug.
- **Astro-Watcher-Race (Windows):** `astro dev` crasht gelegentlich beim Anlegen neuer Routen (`stat` auf `*.ts.tmp.*`) — Dev-Server neu starten.
- **PKCE-Confirm:** `emailRedirectTo` wird nur akzeptiert, wenn es in der Supabase-Redirect-Allowlist steht — sonst Fallback auf Site-URL.

---

## Session-Resume

Fuer neue Session: `/dtb:workflow-resume`
