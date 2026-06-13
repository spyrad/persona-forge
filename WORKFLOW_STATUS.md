# Workflow-Status: persona-forge

**Letztes Update:** 2026-06-13
**Letzter Session-Log:** `dtb-project/project-changelog/2026-06/2026-06-13.md`

---

## Aktueller Stand

| Kennzahl | Wert |
|----------|------|
| **Laufende Arbeit** | S-01 (email-auth-live) — Phase 1 code-fertig + auto-verifiziert (WIP `fa1f632`); manuelle Browser-Checks 1.4–1.6 ausstehend |
| **Naechster Schritt** | Manuelle Verifikation 1.4–1.6 (Browser gegen `npm run dev`), dann 1.3–1.6 in `plan.md` abhaken + Phase-End-Ritual (SHA-Write-back), dann `/10x-implement email-auth-live phase 2` |
| **Blocker** | S-04 (Messlauf) wartet auf gemeinfreie OEJTS-Quelle (Owner: Damian) — blockt nicht S-01 |

---

## Offene Aufgaben

- [ ] **S-01 Phase 1 abschliessen:** manuelle Browser-Checks 1.4 (Signup echte Mail → confirm-email), 1.5 (Signin → /dashboard), 1.6 (7-Zeichen-PW client-seitig geblockt); danach 1.3–1.6 in `plan.md` abhaken + Phase-End-Ritual (SHA-Write-back auf 1.0–1.6). Achtung: Code ist als WIP `fa1f632` schon committet — Phase-End-Commit wird leer/dokumentarisch sein
- [ ] `/10x-implement email-auth-live phase 2` — profiles-Trigger-Migration (danach Phase 3, 4)
- [ ] OEJTS-Items als gemeinfreie Quelle fixieren — blockt S-04 → S-05/S-06/S-08; Owner: Damian
- [ ] Review-Follow-ups CLAUDE.md (atomar): RLS-Doppelung mergen, Environment-Sektion kürzen
- [ ] Repo-Description + Topics auf GitHub setzen — manueller Schritt
- [ ] Test-Runner einrichten (Vitest), `test_command` in `workflow.config.yaml` setzen — Modul-3-Voraussetzung
- [ ] Stale Duplikat klären: `dtb-project/project-workflows/WORKFLOW_STATUS.md` (Session-8-Stand) vs. diese Root-Datei
- [ ] Freiwillig: Live-Signup-Nachprobe (frische Mail / +suffix) — Kontext: Impl-Review-Finding F3

---

## Abgeschlossene Meilensteine (kompakt)

| Datum | Meilenstein | Ergebnis | Details |
|-------|-------------|----------|---------|
| 2026-06-09 | DTB-Projekt-Initialisierung | Config + Struktur + Basis-Dateien | `dtb-project/project-changelog/2026-06/2026-06-09.md` |
| 2026-06-10 | Greenfield-Shaping + PRD | shape-notes.md accepted, PRD 10/10 Sektionen | `context/foundation/prd.md` |
| 2026-06-10 | Tech-Stack + Git/GitHub | 10x-astro-starter, Repo `spyrad/persona-forge` | `context/foundation/tech-stack.md` |
| 2026-06-11 | Bootstrap + Roadmap | Scaffold grün, 2 Foundations + 8 Slices | `context/foundation/roadmap.md` |
| 2026-06-11 | s01e04 (Agent-Onboarding) | CLAUDE.md + Rule-Review abgeschlossen | `dtb-project/project-changelog/2026-06/2026-06-11.md` |
| 2026-06-12 | F-02 live + archiviert (Modul 1 ✅) | CI deployt auf Workers, Live-URL HTTP 200 | `context/archive/2026-06-11-deploy-skeleton-live/` |
| 2026-06-12 | F-01 Plan + Plan-Review SOUND | 4 Phasen, 4 Findings gefixt, externe Claims verifiziert | `context/archive/2026-06-12-connect-supabase/reviews/plan-review.md` |
| 2026-06-12 | F-01 Phase 1+2 + Impl-Review APPROVED | Supabase live, RLS bewiesen, Secrets-Sync, 6×PASS | `dtb-project/project-changelog/2026-06/2026-06-12.md` |
| 2026-06-13 | F-01 archiviert — beide Foundations done | roadmap.md F-01 done, `0e2217d` | `dtb-project/project-changelog/2026-06/2026-06-13.md` |
| 2026-06-13 | S-01 geplant (email-auth-live) | 4 Phasen, Trigger-Entscheidung, Plan + Brief | `context/changes/email-auth-live/plan-brief.md` |

---

## Kurs-Standort (10xDevs)

Modul 1: 5/5 ✅ — Modul 2: 4/5 ✅ (s02e04 abgeschlossen).
Position: ⏭️ s02e05 (Multi-Agenten-Feature) — S-01-Planung ist der erste Schritt dazu.
Zertifizierung: 1. Termin 05.07.2026 (mit Wyróżnienie-Chance), dann 10.08. / 14.09.2026.

---

## Entscheidungs-Eckpunkte (v1)

- Stack: Astro 6 + React 19 + TS + Tailwind + shadcn/ui + Supabase + **Cloudflare Workers**; npm; GitHub Actions
- Deploy: wrangler-action im CI, nur `main` deployt; Supabase-Secrets synct der Deploy-Job je Deploy als Worker-Secrets (GitHub = Single Source, seit `e298d17`)
- RLS-Contract (F-01, bewiesen): „Eigenes + Globales"; visibility weitet nur select, Writes owner-only, `(select auth.uid())`, Index auf owner-Spalte; `profiles` bewusst ohne delete-Policy (auth.users-Cascade)
- S-01-Entscheidungen (geplant): profiles-Anlage via DB-Trigger; Middleware-Auth-Check nur auf PROTECTED_ROUTES; Passwort min 8 Zeichen; Signin→/dashboard; Zod-Fehler→HTTP 400+JSON
- Einrolliges Web-Tool, E-Mail+Passwort, Sichtbarkeit privat/global (Default global)
- Instrument: **OEJTS** (gemeinfrei, MBTI-artig) — Mini-IPIP/Big Five später
- Umgebung: `NODE_OPTIONS=--use-system-ca` dauerhaft (TLS-Interception); API-Calls per System-`curl.exe --ssl-no-revoke`; Supabase-Mail-Limit Free Tier ~2–4/h einplanen

---

## Session-Resume

Fuer neue Session: `/pf:workflow-resume`
