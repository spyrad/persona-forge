# Workflow-Status: persona-forge

**Letztes Update:** 2026-06-18 (Session 3)
**Letzter Session-Log:** `dtb-project/project-changelog/2026-06/2026-06-18.md`

---

## Aktueller Stand

| Kennzahl | Wert |
|----------|------|
| **Laufende Arbeit** | **S-04 `oejts-measurement-run` abgeschlossen + live** — Phase 3 (`/runs`-UI) implementiert, impl-reviewt (APPROVED), gehärtet, **archiviert** (`d06afbe`), gepusht und **live verifiziert** (`/runs` → 302 `/auth/signin`). |
| **Naechster Schritt** | **S-05 `distribution-results`** (Leitstern-Fortsetzung) — `/10x-plan distribution-results`. |
| **Blocker** | Keine. |

---

## Offene Aufgaben

- [ ] S-05 `distribution-results` starten (Achsen-Aggregation/Verteilung/Typ; Prerequisite S-04 ✅)
- [ ] Cleanup Test-User remote-DB; F6 Trigger-Idempotenz; Husky/lint-staged-Hook reparieren

---

## Abgeschlossene Meilensteine (kompakt)

| Datum | Meilenstein | Ergebnis | Details |
|-------|-------------|----------|---------|
| 2026-06-18 | **S-04 abgeschlossen + gepusht** | Phase 3 (`/runs`-UI), impl-review APPROVED + Hardening (F1/F2/F4), archiviert, Roadmap `done` | `2f3ba29`, `c07761b`, `d06afbe` |
| 2026-06-18 | S-04 Phase 2 abgeschlossen + live | LLM-Call + `/step`-Orchestrierung, Manual-Gate (echte OpenAI-API) | `cc2fff2`, `0348733` |
| 2026-06-18 | S-04 Phase 1 deployed + committet | runs-Datenmodell + RLS + reiner OEJTS-Kern | `8c2fd52`, `6e396ec` |
| 2026-06-17 | S-03 abgeschlossen + deployed | Persona-Katalog, F1-Privacy-Fix, archiviert, live | `3d8bb4e` |
| 2026-06-16 | S-02 abgeschlossen + deployed | Model-Config + E2E-Gate, archiviert, live | `92192ce` |
| 2026-06-15 | S-01 impl-reviewt + archiviert | E-Mail-Auth, F1–F5 gefixt & live | `72fa7ce`, `8b84ace` |

---

## Gotchas (Referenz)

- **OEJTS-Lizenz:** CC BY-NC-SA 4.0 (nicht gemeinfrei) — privat/MVP OK, vor kommerziell/Verteilung neu prüfen.
- **Prod-Worker-URL:** `persona-forge.damian-spyra-ai.workers.dev` (mit `-ai`). Deploy-Check indirekt über neue Route (404→Redirect/401), da `gh`/`GITHUB_TOKEN` fehlen.
- **Push auf `main` + Prod-`db push`** blockt der Auto-Mode-Classifier (Prod-Deploy) → **User-`!`-Kommando**.
- **`git mv` scheitert am Windows-Lock** → `Move-Item` + `git add <alt> <neu>` (Rename bleibt erkannt). **`$host` reserviert in PowerShell** → `$h`.
- **CI-Lint blockt deploy lautlos** → nach Push deploy-Job prüfen. **Worker-Deploy appliziert KEINE DB-Migration** (separat `db push`).
- **curl scheitert an lokaler TLS-Interception** (Exit 35) → `Invoke-WebRequest`; PS 5.1 ohne `-SkipHttpErrorCheck`, Status via `$_.Exception.Response.StatusCode`.
- **Client-orchestrierte Step-Loops** (1 LLM-Call/Wiederholung) halten lange Läufe in Edge-Grenzen; Datenmodell (`completedReps`-Zählung + unique `(run_id, rep_index)`) ist resume-fähig + idempotent.
- **Untypisierter Supabase-Client + strictTypeChecked:** `any` aus `.maybeSingle()` über typisierten Mapper-Parameter lautern (`toView`/`toStepState`), nie Cast + Zugriff.
- **Sichtbarkeits-Default** user-scoped explizit `'private'`. **RLS + DELETE/UPDATE:** 0-Row-Match ist kein Erfolg. **Child-RLS** via exists-Subquery auf Parent.

---

## Pausierte Themen

Keine. S-04 ist archiviert; nächster Slice S-05 ist noch nicht gestartet.

---

## Session-Resume

Fuer neue Session: `/dtb:workflow-resume`
