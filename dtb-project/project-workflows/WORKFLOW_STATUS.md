# Workflow-Status: persona-forge

**Letztes Update:** 2026-06-21 (Session 3)
**Letzter Session-Log:** `dtb-project/project-changelog/2026-06/2026-06-21.md`

---

## Aktueller Stand

| Kennzahl              | Wert                                                                                                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Laufende Arbeit**   | **Keine — S-07 abgeschlossen/live; Altlasten Husky-Hook + F6 Trigger-Idempotenz erledigt.** Offen nur: Aufräum-Commit `0df2b99` (Husky-`prepare` + F6-Migration) ist lokal, **noch nicht gepusht** (1 vor `origin/main`). |
| **Naechster Schritt** | **`! git push`** (`0df2b99` → `main`, Auto-Deploy), danach CI-Deploy-Run prüfen — dann **S-08 `side-by-side-comparison`** (`/10x-plan side-by-side-comparison`; Prereq S-05 ✅).                                          |
| **Blocker**           | Keine.                                                                                                                                                                                                                    |

---

## Offene Aufgaben

- [ ] `! git push` für `0df2b99` (→ Prod-Deploy) + CI-Deploy-Run prüfen — Kontext: Diff = `prepare`-Script + Migrationsdatei (remote schon appliziert)
- [ ] S-08 `side-by-side-comparison` (Zwei-Läufe-Vergleich; Prereq S-05 ✅) — letzter geplanter MVP-Slice
- [ ] Stale-Duplikat klären: Root-`WORKFLOW_STATUS.md` (Stand 2026-06-13, veraltet) vs. kanonisch `dtb-project/project-workflows/WORKFLOW_STATUS.md`; CLAUDE.md nennt die Root-Datei → angleichen
- [ ] Optional: S-06/S-07-Deploy bei Gelegenheit im Cloudflare-Dashboard sichten

---

## Abgeschlossene Meilensteine (kompakt)

| Datum      | Meilenstein                                               | Ergebnis                                                                                                                               | Details                                                      |
| ---------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 2026-06-21 | **S-07-Deploy verifiziert + Altlasten Husky/F6 erledigt** | CI run #30 `ci`+`deploy` beide success, Live HTTP 200; Husky aktiviert (`prepare`); F6 idempotente Trigger-Migration remote appliziert | `0df2b99` (ungepusht), `2026-06-21.md` (S3)                  |
| 2026-06-21 | **S-07 abgeschlossen + archiviert + gepusht/live**        | Sichtbarkeit privat/global (Toggle+Default+UI+Gate); impl-review APPROVED; Zwei-Account-Matrix grün; `→ main`                          | `context/archive/2026-06-20-visibility-controls/`, `5c2b5f8` |
| 2026-06-20 | **S-06 abgeschlossen + gepusht/live**                     | Live-Token-Zähler; APPROVED, archiviert, `→ main`                                                                                      | `614b4ea`, `a1bf59e`, `160ee06`                              |
| 2026-06-19 | S-05 abgeschlossen + live                                 | Verteilung/Typ-Stabilität je Achse (Leitstern); Gate 11/11                                                                             | `17dfcb3`, `2eb4da5`                                         |
| 2026-06-18 | S-04 abgeschlossen + live                                 | `/runs`-UI, OEJTS-Lauf end-to-end                                                                                                      | `2f3ba29`, `d06afbe`                                         |
| 2026-06-17 | S-03 abgeschlossen + deployed                             | Persona-Katalog, F1-Privacy-Fix                                                                                                        | `3d8bb4e`                                                    |
| 2026-06-16 | S-02 abgeschlossen + deployed                             | Model-Config + E2E-Gate                                                                                                                | `92192ce`                                                    |
| 2026-06-15 | S-01 impl-reviewt + archiviert                            | E-Mail-Auth, F1–F5 gefixt & live                                                                                                       | `72fa7ce`                                                    |

---

## Gotchas (Referenz)

- **Husky aktiv halten:** `package.json` braucht `"prepare": "husky"`, sonst setzt `npm ci` `core.hooksPath` nicht → pre-commit/lint-staged feuert nicht (lokale Commits umgehen Lint/Format still). Stand 2026-06-21 gefixt + verifiziert.
- **GitHub-Actions ohne `gh`:** Status via REST-API (`curl.exe --ssl-no-revoke` auf `/actions/runs` + `/runs/{id}/jobs`, public Repo, unauth). Run-Conclusion `success` schließt **geskippten** Deploy-Job nicht aus → Jobs/Steps einzeln prüfen (`deploy` + `wrangler-action` = success).
- **Zwei-Account-RLS-Test:** Playwright teilt einen Cookie-Jar → B einloggen verdrängt A. Testaccounts `md.motion.value@gmail.com` (A) / `damian.spyra@googlemail.com` (B), Passwort `Dupadupa19`; sequenzieller Wechsel A→B→A. Auth-Wechsel über `POST /api/auth/signin` (FormData), nicht die transient crashende SSR-Form. Gate-Testdaten danach aufräumen.
- **Transienter Dev-Server-500 / leere SSR-Seite:** 500 oder 0-Byte-Render direkt nach Vite-`✨ dependencies optimized … reloading` ist environmental (zwei React-Kopien / Modul-Reload in-flight) — abwarten, wiederholen.
- **Migrations-Push separat:** Dev-Server läuft gegen Prod-Supabase; neue Policy/Spalte/Trigger braucht `! npx supabase db push`. **Worker-Deploy appliziert KEINE Migration.** Stand prüfen: `npx supabase migration list` (Local == Remote).
- **RLS-NULL-Semantik:** owner-gescopte Policies (`owner_id = (select auth.uid())`) blocken globale Seed-Objekte (owner_id NULL) automatisch (`NULL = uid` → nicht true). FR-008-Immutability app-seitig (Service patcht nur `{visibility, updated_at}`).
- **OEJTS:** `score = const + Σ(sign·value)`, `>24` → high-Pol; on-the-fly-Auswertung (keine Migration). Lizenz CC BY-NC-SA 4.0 (privat/MVP OK).
- **Prod-Worker-URL:** `persona-forge.damian-spyra-ai.workers.dev`. **Push auf `main` (= Prod-Deploy)** braucht User-`!`-Kommando (Auto-Mode blockt). **CI-Lint blockt deploy lautlos** → nach Push deploy-Job prüfen.
- **Windows/PS:** `git mv` kann am Lock scheitern → `Move-Item` + `git add -A`. **Bash-Tool ≠ PowerShell**.

---

## Pausierte Themen

Keine.

---

## Session-Resume

Fuer neue Session: `/dtb:workflow-resume`
