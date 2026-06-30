# Workflow-Status: persona-forge

**Letztes Update:** 2026-06-30 (Session 2)
**Letzter Session-Log:** `dtb-project/project-changelog/2026-06/2026-06-30.md`

---

## Aktueller Stand

| Kennzahl              | Wert                                                                                                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Laufende Arbeit**   | Kurs **Modul 4 (10xArchitect)**. L2 (Projekt-Map) fertig in `context/map/` (4 Artefakte, untracked). Kein aktiver Code-Change. `origin/main = 9245acf`, lokal = remote, Prod 200. |
| **Naechster Schritt** | **L3 (s04e03)** Feature-Analyse auf dem Run-Flow → `research.md`. Termin-Entscheidung am **2026-07-02**.                                                                          |
| **Blocker**           | Keine.                                                                                                                                                                            |

---

## Offene Aufgaben

- [ ] **L3 (s04e03)** Feature-Analyse Run-Flow: end-to-end-Trace, Test-Lücken, Blast-Radius, ast-grep → `research.md`.
- [ ] **Termin-Entscheidung 2026-07-02:** Builder allein (5. Juli, Auszeichnung) vs. Builder+Architect (10. Aug); kein Nachreichen.
- [ ] `context/map/`-Artefakte committen (noch untracked).
- [ ] Map gegen eigenes Wissen verteidigen (Review Risikozonen + Astro-Blind-Spots).
- [ ] **F3-Follow-up:** `ENCRYPTION_KEY`-Worker-Secret-Stand verifizieren → ggf. `ci.yml`-`secrets:`-Sync.
- [ ] **OEJTS-Items** als gemeinfreie Quelle dokumentieren — Owner: Damian.
- [ ] **Repo-Description + Topics** auf GitHub setzen — manueller Schritt.
- [ ] Vorbestehende uncommittete Doku-Edits (`2026-06-25.md`) reviewen/committen oder verwerfen.

---

## Abgeschlossene Meilensteine (kompakt)

| Datum      | Meilenstein                                        | Ergebnis                                                                                                              | Details                              |
| ---------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 2026-06-30 | **Modul-4 L2: Projekt-Map**                        | Wide-Scan (git/dependency-cruiser/madge) → 4 Artefakte; Run-Flow als Zentrum, keine Zyklen, Astro-Grenze dokumentiert | `2026-06-30.md` (S2), `context/map/` |
| 2026-06-30 | **E2E (6.5) nachgezogen** — `ui-redesign` komplett | `npm run test:e2e` 4 passed (Risk #5 Auth-Redirect + Seed); Node-Adapter-Isolation bestätigt, kein Code-Diff          | `2026-06-30.md` (S1)                 |
| 2026-06-30 | **`ui-redesign` live + archiviert**                | shadcn-Token-System (Teal, hell-first), Topbar + Card-Hub, Dark Mode, Charts; Prod 200; archiviert                    | `4740727`→`9245acf`, `2026-06-29.md` |
| 2026-06-26 | `sentry-monitoring` geschlossen + archiviert       | Triage (Secret-Scrubber + Gotcha) gepusht, CI grün, IP-Toggle an; archiviert                                          | `66a36f0`, `2026-06-26.md`           |
| 2026-06-25 | Sentry-Produktions-Monitoring (s03e05) — live      | Server-only `withSentry`, captureConsole, Source-Maps, PII gescrubbt; Review APPROVED                                 | `c068c87`–`0adc977`, `2026-06-25.md` |
| 2026-06-25 | Test-Rollout KOMPLETT — `integration`-CI-Blocker   | `ci`+`integration` grün; Phase-3-Change archiviert; E2E-Lernschicht (s03e04) live                                     | `1b2c0ac`→`b6c7589`, `2026-06-25.md` |
| 2026-06-18 | S-04/S-05 (measurement-run, distribution) live     | OEJTS-Lauf end-to-end + Verteilung/Typ-Stabilität je Achse                                                            | `d06afbe`, `2eb4da5`                 |
| 2026-06-15 | S-01–S-03 (Auth, Model-Config, Persona) live       | E-Mail-Auth, verschl. Key, Persona-Katalog                                                                            | `72fa7ce`, `3d8bb4e`                 |

---

## Gotchas (Referenz)

- **Modul-4-Artefakte:** L2-Map in `context/map/` (`artifact-1/2/3` + `repo-map.md`). Kern = Run-Flow (`services/runs`+`instruments/oejts`). Methodengrenze: `.astro` ist für statische Graph-Tools unsichtbar (`dependency-cruiser`/`madge`).
- **UI-Tokens (ui-redesign):** Farben **nur** über semantische Tokens (`bg-background`/`text-foreground`/`text-primary`=Teal/`text-destructive`/`text-success`; Charts `--chart-1`/`--chart-2`) — keine Literale. Dark Mode via `.dark` (No-Flash-Script + `ThemeToggle`). Details: `CLAUDE.md`.
- **CI hat KEINEN e2e-Job:** Deploy-Gate = `ci`+`integration`. E2E (`npm run test:e2e`) braucht lokales Docker/Supabase.
- **Lint lokal (Windows):** `npm run lint` zeigt massenhaft `Delete ␍` (CRLF) — Artefakt, in CI irrelevant; husky fixt beim Commit. `lint:fix` churnt repo-weite CRLF (vor Commit per `git checkout --` zurücksetzen, nur Touched-Set stagen).
- **Push auf `main` = Prod-Deploy**; **CI-Fail blockt deploy lautlos** → nach Push Jobs/Steps per REST-API prüfen (`gh` nicht installiert; `curl.exe --ssl-no-revoke`).
- **Resume-Hygiene:** canonical Status hier; bei Resume `git ls-remote origin main` gegen lokalen HEAD prüfen.

---

## Pausierte Themen

Keine.

---

## Session-Resume

Fuer neue Session: `/dtb:workflow-resume`
