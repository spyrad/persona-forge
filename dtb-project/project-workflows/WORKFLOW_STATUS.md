# Workflow-Status: persona-forge

**Letztes Update:** 2026-06-15
**Letzter Session-Log:** `dtb-project/project-changelog/2026-06/2026-06-15.md`

---

## Aktueller Stand

| Kennzahl | Wert |
|----------|------|
| **Laufende Arbeit** | S-01 `email-auth-live` — **Phase 3 fertig** (`a210f0c`), **live deployt** (`27521878004` grün); Phase 4 lokal grün (4.1–4.3); **Confirm-Mail-Callback gefixt** (`4b5e916`, lokal) |
| **Naechster Schritt** | **Damian:** Supabase URL-Config (Site-URL + Redirect-Allowlist für `/auth/callback`) → lokal Mail-Link verifizieren → `4b5e916` pushen → Prod-Runde 4.4/4.5 |
| **Blocker** | Confirm-Mail-Link braucht Supabase-Dashboard-Config (Allowlist), sonst greift `emailRedirectTo` nicht; OEJTS-Quelle blockt S-04 (unverändert) |

---

## Offene Aufgaben

- [ ] Supabase URL-Config: Site-URL → Prod; Redirect-Allowlist → `localhost:4321/auth/callback` + Prod-`/auth/callback` (Owner: Damian)
- [ ] Lokal Mail-Link verifizieren (Signup → Link → `/auth/callback` → `/dashboard`) → dann `4b5e916` pushen → Prod 4.4 + 4.5
- [ ] S-01 abschließen + `email-auth-live` archivieren (`/dtb:archive`)
- [ ] Cleanup Test-User remote-DB: `7ad40ffa…514794`, `98cbe7ba…2d4fd` + `+pf…`-Aliases; `.playwright-mcp/` in `.gitignore`
- [ ] OEJTS-Quelle fixieren — Itemtexte, Achsen, Scoring (Owner: Damian)
- [ ] Test-Runner (Vitest), dann `test_command` in `workflow.config.yaml` — Voraussetzung Modul 3
- [ ] GitHub Repo-Description + Topics setzen (manuell); stale Root-`WORKFLOW_STATUS.md`-Duplikat klären

---

## Abgeschlossene Meilensteine (kompakt)

| Datum | Meilenstein | Ergebnis | Details |
|-------|-------------|----------|---------|
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

- **miniflare-Dev-Quirk:** transienter „Network connection lost" (`entry.worker.js`) bei in-flight-Request während Vite-`program reload`; per F5 grün, in Prod unmöglich. Kein Code-Bug.
- **Astro-Watcher-Race (Windows):** `astro dev` crasht gelegentlich beim Anlegen neuer Routen (`stat` auf `*.ts.tmp.*`) — Dev-Server neu starten.
- **PKCE-Confirm:** `emailRedirectTo` wird nur akzeptiert, wenn es in der Supabase-Redirect-Allowlist steht — sonst Fallback auf Site-URL.

---

## Session-Resume

Fuer neue Session: `/dtb:workflow-resume`
