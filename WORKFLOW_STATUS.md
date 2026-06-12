# Workflow-Status: persona-forge

**Letztes Update:** 2026-06-12
**Letzter Session-Log:** `dtb-project/project-changelog/2026-06/2026-06-12.md`

---

## Aktueller Stand

| Kennzahl | Wert |
|----------|------|
| **Laufende Arbeit** | F-01 fertig: implementiert (`e298d17`) + Impl-Review APPROVED (`7542c8a`) — nur Archivierung offen |
| **Naechster Schritt** | `/10x-archive connect-supabase`, danach S-01 (email-auth-live) planen |
| **Blocker** | S-04 (Messlauf) wartet auf gemeinfreie OEJTS-Quelle (Owner: Damian) — blockt nicht S-01 |

---

## Offene Aufgaben

- [ ] `/10x-archive connect-supabase` — Change-Bundle nach `context/archive/`, F-01 in roadmap.md auf done
- [ ] Freiwillig: Live-Signup-Nachprobe (Mail-Rate-Limit-Fenster abwarten, frische Mail) — Kontext: Review-Finding F3
- [ ] OEJTS-Items als gemeinfreie Quelle fixieren — Kontext: Open Question der Roadmap; blockt S-04 → S-05/S-06/S-08
- [ ] Review-Follow-ups CLAUDE.md (atomar): RLS-Doppelung mergen, Environment-Sektion auf `@README.md` kürzen
- [ ] Repo-Description + Topics auf GitHub setzen — Kontext: manueller Schritt
- [ ] Test-Runner einrichten (z. B. Vitest), dann `test_command` in `workflow.config.yaml` setzen — erster Kandidat: RLS-Probe-SQL als Policy-Test
- [ ] Stale Duplikat klären: `dtb-project/project-workflows/WORKFLOW_STATUS.md` (Session-8-Stand) vs. diese Root-Datei

---

## Abgeschlossene Meilensteine (kompakt)

| Datum | Meilenstein | Ergebnis | Details |
|-------|-------------|----------|---------|
| 2026-06-09 | DTB-Projekt-Initialisierung | Config + Struktur + Basis-Dateien | `dtb-project/project-changelog/2026-06/2026-06-09.md` |
| 2026-06-10 | 10xWorkflow-Init + Greenfield-Shaping | shape-notes.md accepted (16 FRs, Socrates-geprüft) | `context/foundation/shape-notes.md` |
| 2026-06-10 | Git/GitHub-Verknüpfung | Repo `spyrad/persona-forge`, Initial-Commit gepusht | `git log` / `origin` |
| 2026-06-10 | PRD generiert | 10/10 Sektionen, draft, 2 Open Questions | `context/foundation/prd.md` |
| 2026-06-10 | Tech-Stack gewählt | 10x-astro-starter (standard path, first-class) | `context/foundation/tech-stack.md` |
| 2026-06-11 | Bootstrap abgeschlossen (nach TLS-Fix) | Scaffold + Audit-Log, Build grün, committet `a931173` | `context/changes/bootstrap-verification/verification.md` |
| 2026-06-11 | Roadmap generiert | 2 Foundations + 8 Slices, North Star S-05, 13/13 must-haves | `context/foundation/roadmap.md` |
| 2026-06-11 | s01e04 abgeschlossen (Agent-Onboarding) | Scaffold-Merge in CLAUDE.md + Rule-Review, committet `4d29277` | Session-Log 2026-06-11, Session 6 |
| 2026-06-12 | F-02 live + archiviert (Modul 1 komplett) | CI deployt auf Workers, Live-URL HTTP 200, Review APPROVED | `context/archive/2026-06-11-deploy-skeleton-live/` |
| 2026-06-12 | F-01 researcht + geplant + Plan-Review SOUND | research.md + Plan/Brief, 4 Findings gefixt, externe Claims verifiziert | `context/changes/connect-supabase/reviews/plan-review.md` |
| 2026-06-12 | F-01 Phase 1: Projekt verbunden + RLS-Contract bewiesen | Migration remote, Auth-Flow e2e, RLS-Probe inkl. Spoofing, `f96303a` | Session-Log 2026-06-12, Session 11 |
| 2026-06-12 | F-01 Phase 2 + Live-Gang + Impl-Review APPROVED | Secrets-Sync je Deploy (GitHub = SSOT), Live-Signin bewiesen, Review 6×PASS, `e298d17`/`7542c8a` | Session-Log 2026-06-12, Session 12 |

---

## Kurs-Standort (10xDevs)

Modul 1: 5/5 ✅ — Modul 2: s02e04 abgeschlossen (erster voller Zyklus
Research → Plan → Plan-Review → Implement → Impl-Review an F-01).
Zertifizierung: 1. Termin 05.07.2026 (mit Wyróżnienie-Chance), dann 10.08. / 14.09.2026.

---

## Entscheidungs-Eckpunkte (v1)

- Stack: Astro 6 + React 19 + TS + Tailwind + shadcn/ui + Supabase + **Cloudflare Workers**; npm; GitHub Actions
- Deploy: wrangler-action im CI, nur `main` deployt; Supabase-Secrets synct der Deploy-Job je Deploy als Worker-Secrets (GitHub = Single Source, seit `e298d17`)
- RLS-Contract (F-01, bewiesen): „Eigenes + Globales"; visibility weitet nur select, Writes owner-only, `(select auth.uid())`, Index auf owner-Spalte; `profiles` bewusst ohne delete-Policy (auth.users-Cascade)
- Einrolliges Web-Tool, E-Mail+Passwort, Sichtbarkeit privat/global (Default global)
- Instrument: **OEJTS** (gemeinfrei, MBTI-artig) — Mini-IPIP/Big Five später
- Methodenkern unverhandelbar: N Wiederholungen, isoliert, permutierbar → Verteilung je Achse + Typ-Stabilität
- Umgebung: `NODE_OPTIONS=--use-system-ca` dauerhaft (TLS-Interception); API-Calls per System-`curl.exe --ssl-no-revoke`; Supabase-Mail-Limit Free Tier ~2–4/h einplanen

---

## Session-Resume

Fuer neue Session: `/pf:workflow-resume`
