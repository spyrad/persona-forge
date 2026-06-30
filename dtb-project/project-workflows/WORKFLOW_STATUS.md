# Workflow-Status: persona-forge

**Letztes Update:** 2026-06-29 (Session 1)
**Letzter Session-Log:** `dtb-project/project-changelog/2026-06/2026-06-29.md`

---

## Aktueller Stand

| Kennzahl              | Wert                                                                                                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Laufende Arbeit**   | 10x-Change `ui-redesign` **LIVE** (`3de4c30`): CI-Run `28399841968` grün (`ci`+`integration`+`deploy`), **Prod HTTP 200**. Offen: E2E (6.5) — kein CI-e2e-Job, lokal Docker n/a. |
| **Naechster Schritt** | `/10x-archive ui-redesign` (E2E-Follow-up notiert), dann Kurs Modul 4. Optional vorher: E2E lokal mit Docker nachziehen.                                                         |
| **Blocker**           | Keine. E2E (6.5) als Follow-up offen — Risiko gering (Pure-Visual, rollenbasierte Selektoren).                                                                                   |

---

## Offene Aufgaben

- [ ] **`/10x-archive ui-redesign`** — Change abschließen/archivieren (Deploy ist grün, Prod 200).
- [ ] **E2E (6.5) nachziehen** wenn Docker da: `npm run test:e2e` (kein CI-e2e-Job; nur Follow-up, Risiko gering).
- [ ] **F3-Follow-up:** `ENCRYPTION_KEY`-Worker-Secret-Stand verifizieren → ggf. in `ci.yml`-`secrets:`-Sync (notiert in `context/archive/2026-06-25-sentry-monitoring/follow-ups/review-fixes.md`).
- [ ] **OEJTS-Items** als gemeinfreie Quelle dokumentieren — Owner: Damian.
- [ ] **Repo-Description + Topics** auf GitHub setzen — manueller Schritt.
- [ ] Vorbestehender uncommitteter Edit `dtb-project/.../2026-06-25.md` reviewen/committen.

---

## Abgeschlossene Meilensteine (kompakt)

| Datum      | Meilenstein                                      | Ergebnis                                                                                                              | Details                                   |
| ---------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 2026-06-29 | **`ui-redesign` — 6 Phasen live**                | shadcn-Token-System (Teal, hell-first), globale Topbar + Card-Hub, vollwertiger Dark Mode, Charts Teal/Amber; gepusht | `4740727`→`3de4c30`, `2026-06-29.md` (S1) |
| 2026-06-26 | `sentry-monitoring` geschlossen + archiviert     | Triage (Secret-Scrubber + Gotcha) gepusht, CI grün, IP-Toggle an; archiviert                                          | `66a36f0`, `2026-06-26.md`                |
| 2026-06-25 | Sentry-Produktions-Monitoring (s03e05) — live    | Server-only `withSentry`, captureConsole, Source-Maps, PII gescrubbt; Review APPROVED                                 | `c068c87`–`0adc977`, `2026-06-25.md`      |
| 2026-06-25 | Playwright-E2E-Lernschicht (s03e04) — live       | Scaffold + storageState-Auth; E2E-gated Node-Adapter isoliert Prod-Secrets                                            | `24201bd`→`cab1f06`, `2026-06-25.md`      |
| 2026-06-25 | Test-Rollout KOMPLETT — `integration`-CI-Blocker | `ci`+`integration` grün; Phase-3-Change archiviert                                                                    | `1b2c0ac`→`b6c7589`, `2026-06-25.md`      |
| 2026-06-18 | S-04/S-05 (measurement-run, distribution) live   | OEJTS-Lauf end-to-end + Verteilung/Typ-Stabilität je Achse                                                            | `d06afbe`, `2eb4da5`                      |
| 2026-06-15 | S-01–S-03 (Auth, Model-Config, Persona) live     | E-Mail-Auth, verschl. Key, Persona-Katalog                                                                            | `72fa7ce`, `3d8bb4e`                      |

---

## Gotchas (Referenz)

- **UI-Tokens:** Farben **nur** über semantische Tokens (`bg-background`/`text-foreground`/`border-border`/`text-primary`=Teal/`text-destructive`/`text-success`; Charts `--chart-1` Teal / `--chart-2` Amber) — **keine** Literale. Tokens in `src/styles/global.css`. Dark Mode via `.dark` auf `<html>` (No-Flash-Script in `Layout.astro` + `ThemeToggle`, persistiert in `localStorage.theme`). Details: `CLAUDE.md` Conventions.
- **Lint lokal (Windows):** `npm run lint` zeigt massenhaft `Delete ␍` (CRLF) — reines Zeilenenden-Artefakt, in CI/Linux irrelevant; husky/lint-staged fixt es beim Commit. `npm run lint:fix` churnt dabei repo-weite CRLF auf unbeteiligten Dateien (vor Commit per `git checkout --` zurücksetzen, nur Touched-Set stagen).
- **Push auf `main` = Prod-Deploy**; **CI-Fail blockt deploy lautlos** → nach Push Jobs/Steps per REST-API prüfen (`gh` nicht installiert; `curl.exe --ssl-no-revoke`).
- **Resume-Hygiene:** canonical Status hier; bei Resume `git ls-remote origin main` gegen lokalen HEAD prüfen.

---

## Pausierte Themen

Keine.

---

## Session-Resume

Fuer neue Session: `/dtb:workflow-resume`
