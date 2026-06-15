# Workflow-Status: persona-forge

**Letztes Update:** 2026-06-15 (Session 3)
**Letzter Session-Log:** `dtb-project/project-changelog/2026-06/2026-06-15.md`

---

## Aktueller Stand

| Kennzahl | Wert |
|----------|------|
| **Laufende Arbeit** | Keine. S-01 `email-auth-live` abgeschlossen, impl-reviewt (Härtung F1–F5 live) und archiviert (`8b84ace`); Roadmap S-01 → done |
| **Naechster Schritt** | Nächsten Slice starten: **S-02** `model-config-management` oder **S-03** `persona-catalog` (beide entsperrt, parallel) — `/dtb:feature-start` bzw. `/10x-new` + `/10x-plan` |
| **Blocker** | Keiner. Supabase-SMTP-Rate-Limit nur zeitlich für Mail-Tests; OEJTS-Quelle blockt S-04 |

---

## Offene Aufgaben

- [ ] Nächsten Slice starten (S-02 oder S-03) — Hauptarbeit
- [ ] F6: Trigger-Migration idempotent (`on conflict do nothing`) — neue Migration; Detail: `context/archive/2026-06-13-email-auth-live/follow-ups/review-fixes.md`
- [ ] Husky/lint-staged-Hook reparieren — griff bei `4b5e916` nicht (prettier-Fehler → CI-Lint-Fail → deploy skipped)
- [ ] Cleanup Test-User remote-DB (`pf…1742`, `pf174558b`, ältere `+pf…`); `.playwright-mcp/` in `.gitignore`
- [ ] OEJTS-Quelle fixieren (Itemtexte, Achsen, Scoring) — Owner: Damian; blockt S-04
- [ ] Test-Runner (Vitest) + `test_command` in `workflow.config.yaml` — Voraussetzung Modul 3
- [ ] (Optional) Frischer Prod-Mail-Confirm-Happy-Path wenn SMTP-Limit zurückgesetzt

---

## Abgeschlossene Meilensteine (kompakt)

| Datum | Meilenstein | Ergebnis | Details |
|-------|-------------|----------|---------|
| 2026-06-15 | S-01 impl-reviewt + archiviert | F1–F5 gefixt & live, Change archiviert, Roadmap done | `72fa7ce`, `8b84ace` |
| 2026-06-15 | S-01 Phase 4 + Deploy-Blocker | Auth end-to-end verifiziert; CI-Lint-Fail (skippte deploy) gefixt | `5025edf`, Run `27559204315` |
| 2026-06-14 | S-01 Phase 1–3 | Zod-Auth, profiles-Trigger, Middleware-Opt | `80357ca`, `96adb0b`, `a210f0c` |
| 2026-06-13 | F-01 connect-supabase | Supabase + RLS-Grundgerüst | `context/archive/2026-06-12-connect-supabase/` |
| 2026-06-12 | F-02 deploy-skeleton-live | Live-URL, CI grün | `context/archive/2026-06-11-deploy-skeleton-live/` |

---

## Gotchas (Referenz)

- **CI-Lint blockt deploy lautlos:** roter `npm run lint` → `deploy` (needs: ci) skippt, Prod bleibt alt. Nach Push auf `main` immer deploy-Job prüfen.
- **PKCE = selber Browser:** Mail-Confirm-Link muss im Signup-Browser geöffnet werden (`code_verifier`-Cookie); sonst `?error=PKCE…`. E-Mail wird trotzdem confirmed.
- **`git mv` Windows-Lock:** beim Archiv-Move ggf. „Permission denied" → `Move-Item` (PS) + `git add -A`.

---

## Pausierte Themen

### S-04: oejts-measurement-run
**Status:** Blocked — OEJTS-Quelldatensatz (Itemtexte, Achsen, Scoring) muss von Damian beschafft werden.
**Details:** `context/foundation/roadmap.md` (S-04, Open Roadmap Questions)

---

## Session-Resume

Fuer neue Session: `/dtb:workflow-resume`
