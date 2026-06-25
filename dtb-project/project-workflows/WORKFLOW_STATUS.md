# Workflow-Status: persona-forge

**Letztes Update:** 2026-06-25 (Session 2)
**Letzter Session-Log:** `dtb-project/project-changelog/2026-06/2026-06-25.md`

---

## Aktueller Stand

| Kennzahl              | Wert                                                                                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Laufende Arbeit**   | **Keine offene Implementierung.** Playwright-E2E-Lernschicht (s03e04) komplett, reviewt, nach `main` gemergt (`21c36d7`). Unit 48/48 + E2E 4/4 grün. |
| **Naechster Schritt** | Kurs `s03e05` (Debugging vom Stack-Trace), oder Backlog-Ideen (Cross-Device Confirm, Custom SMTP). E2E: bei Bedarf `npx supabase stop`.              |
| **Blocker**           | Keine. (E2E braucht lokales Docker-Supabase + `.env.e2e`; siehe `tests/e2e/README.md`.)                                                              |

---

## Offene Aufgaben

- [ ] **OEJTS-Items als gemeinfreie Quelle fixieren/dokumentieren** — Owner: Damian. (Quellen-/Lizenz-Doku; alle Achsen live.)
- [ ] **Repo-Description + Topics auf GitHub setzen** — manueller Schritt.
- [ ] **Kurs `s03e05`** (Debugging vom Stack-Trace) — nächste Lektion; mit dem `run-integrity`-Heisenbug faktisch begonnen.

---

## Abgeschlossene Meilensteine (kompakt)

| Datum      | Meilenstein                                              | Ergebnis                                                                                  | Details                                      |
| ---------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------- |
| 2026-06-25 | **Playwright-E2E-Lernschicht (s03e04)**                  | Scaffold + storageState-Auth + Risk-#5-Spec; E2E-gated Node-Adapter isoliert Prod-Secrets | `24201bd`→`21c36d7`, `2026-06-25.md` (S2)    |
| 2026-06-25 | Test-Rollout KOMPLETT — `integration`-CI-Blocker gelöst  | PR #1: Nebenläufigkeitstest entflackt; `ci`+`integration` grün; Phase-3-Change archiviert | `1b2c0ac`→`b6c7589`, `2026-06-25.md` (S1)    |
| 2026-06-24 | Test-Rollout Phase 3 (Quality-gates wiring) impl         | Unit+Integration als CI-Pre-Deploy-Gate; Branch-Protection (Required Checks)              | `99f6e52`–`9d03c7e`, `2026-06-24.md` (S1)    |
| 2026-06-23 | Test-Rollout Phase 2 (R4+R3) impl + reviewt + archiviert | 74 itests + 48 units grün; APPROVED; deployt                                              | `d23c477`–`fe87873`, `2026-06-23.md` (S3)    |
| 2026-06-23 | Test-Rollout Phase 1 (Integration Security Gate)         | Harness + Risk #1/#2/#5; reviewt + archiviert                                             | `834a3d4`–`0bdc87e`, `2026-06-23.md` (S1/S2) |
| 2026-06-22 | Test-Plan geschrieben + S-08 Close-out (MVP komplett)    | `test-plan.md` (5 Risiken, 3 Phasen); OEJTS-MVP komplett                                  | `6d3c825`, `2026-06-22.md`                   |
| 2026-06-21 | S-08 `side-by-side-comparison` impl + reviewt            | Zwei-Läufe-Vergleich; impl-review APPROVED                                                | `70153cd`, `2026-06-21.md`                   |
| 2026-06-18 | S-04/S-05 (measurement-run, distribution) live           | OEJTS-Lauf end-to-end + Verteilung/Typ-Stabilität je Achse                                | `d06afbe`, `2eb4da5`                         |
| 2026-06-15 | S-01–S-03 (Auth, Model-Config, Persona) live             | E-Mail-Auth, verschl. Key, Persona-Katalog                                                | `72fa7ce`, `3d8bb4e`                         |

---

## Gotchas (Referenz)

- **E2E (Playwright, s03e04):** `npm run test:e2e` braucht Docker-Supabase (`npx supabase start`) + `.env.e2e` (siehe `tests/e2e/README.md`). E2E nutzt einen **E2E-gated Node-Adapter** (`@astrojs/node`, nur bei `process.env.E2E`), weil der Cloudflare-Dev-Adapter `process.env` mit der **Prod**-`.dev.vars` überschreibt. `@astrojs/node@^10.1.4` ist an Astro 6 gepinnt — bei Astro-Major in lockstep auf `@11` bumpen. Bewusst KEIN Deploy-Gate (`test-plan.md` §6.3).
- **Integration-Tests:** `npm run test:integration` braucht `npx supabase start` (Docker) + `.env.test`. Safety-Guard verweigert nicht-lokale `SUPABASE_URL`. **CI-Gate aktiv** (eigener `integration`-Job, `deploy: needs: [ci, integration]`, Branch-Protection).
- **Push auf `main` = Prod-Deploy** (braucht User-`!`); **CI-Lint blockt deploy lautlos** → nach Push Jobs/Steps einzeln prüfen.
- **CI-rot ≠ Infra-Bug — echte Logs vor Hypothese (Lehre 2026-06-25):** Bei „CI rot / lokal grün" zuerst `gh run view --log-failed` ziehen, bevor man eine Hypothese auf `main` pusht. `gh` via `winget install GitHub.cli --source winget`.
- **Resume-Hygiene:** canonical Status ist `dtb-project/project-workflows/WORKFLOW_STATUS.md`; bei Resume `git ls-remote origin` gegen `origin/main` prüfen.

---

## Pausierte Themen

Keine.

---

## Session-Resume

Fuer neue Session: `/dtb:workflow-resume`
