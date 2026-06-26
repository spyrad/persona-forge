# Workflow-Status: persona-forge

**Letztes Update:** 2026-06-26 (Session 2)
**Letzter Session-Log:** `dtb-project/project-changelog/2026-06/2026-06-26.md`

---

## Aktueller Stand

| Kennzahl              | Wert                                                                                                                                                                                |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Laufende Arbeit**   | Kein aktiver Change. `sentry-monitoring` **vollständig geschlossen** (implementiert → reviewt APPROVED → Triage → live → **archiviert**). Sentry-IP-Storage-Toggle (3.6) aktiviert. |
| **Naechster Schritt** | Kein aktives Feature. Neues via `/dtb:feature-start` oder Backlog-Ideen (Cross-Device E-Mail-Confirm, Custom SMTP).                                                                 |
| **Blocker**           | Keine. `origin/main = b085a1c`, lokal = remote, CI grün, working tree clean.                                                                                                        |

---

## Offene Aufgaben

- [x] **Sentry „Prevent Storing of IP Addresses"** aktiviert (Resthaken 3.6 — Projekt `javascript-astro`, `damians-org.sentry.io`; Client-IP-Server-Inferenz nun aus).
- [ ] **F3-Follow-up (separater Change):** `ENCRYPTION_KEY`-Worker-Secret-Stand verifizieren → ggf. in `ci.yml`-`secrets:`-Sync aufnehmen. Notiert in der archivierten `context/archive/2026-06-25-sentry-monitoring/follow-ups/review-fixes.md`.
- [ ] **OEJTS-Items als gemeinfreie Quelle** dokumentieren — Owner: Damian.
- [ ] **Repo-Description + Topics** auf GitHub setzen — manueller Schritt.

---

## Abgeschlossene Meilensteine (kompakt)

| Datum      | Meilenstein                                           | Ergebnis                                                                                                                             | Details                                      |
| ---------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| 2026-06-26 | **`sentry-monitoring` geschlossen + archiviert**      | Triage (F1 Secret-Scrubber + F2 CLAUDE.md-Gotcha) gepusht, CI grün (ci+integration+deploy), Prod 200; IP-Toggle 3.6 an; archiviert   | `66a36f0`, `2026-06-26.md` (S1)              |
| 2026-06-25 | **Sentry-Produktions-Monitoring (s03e05) — live**     | Server-only `withSentry`-Entry, captureConsole, Source-Maps verifiziert (Trace `sentry-check.ts:26`), PII gescrubbt; Review APPROVED | `c068c87`–`0adc977`, `2026-06-25.md` (S3/S4) |
| 2026-06-25 | Playwright-E2E-Lernschicht (s03e04) — live            | Scaffold + storageState-Auth + Risk-#5-Spec; E2E-gated Node-Adapter isoliert Prod-Secrets                                            | `24201bd`→`cab1f06`, `2026-06-25.md` (S2)    |
| 2026-06-25 | Test-Rollout KOMPLETT — `integration`-CI-Blocker      | PR #1: Nebenläufigkeitstest entflackt; `ci`+`integration` grün; Phase-3-Change archiviert                                            | `1b2c0ac`→`b6c7589`, `2026-06-25.md` (S1)    |
| 2026-06-23 | Test-Rollout Phase 2/3 (Quality-gates) impl + reviewt | Unit+Integration als CI-Pre-Deploy-Gate; Branch-Protection (Required Checks)                                                         | `99f6e52`–`9d03c7e`, `2026-06-23/24.md`      |
| 2026-06-18 | S-04/S-05 (measurement-run, distribution) live        | OEJTS-Lauf end-to-end + Verteilung/Typ-Stabilität je Achse                                                                           | `d06afbe`, `2eb4da5`                         |
| 2026-06-15 | S-01–S-03 (Auth, Model-Config, Persona) live          | E-Mail-Auth, verschl. Key, Persona-Katalog                                                                                           | `72fa7ce`, `3d8bb4e`                         |

---

## Gotchas (Referenz)

- **Sentry (s03e05):** Server-only via `sentry.server.config.ts` (`withSentry` am Worker-Entry, `wrangler.jsonc` `main`). DSN = Worker-Secret (`env.SENTRY_DSN`, NICHT `astro:env`); Source-Maps via `@sentry/vite-plugin` nur im **deploy**-Build (Guard: AUTH*TOKEN+ORG+PROJECT). EU-Region `de.sentry.io`. Lesbare Traces nur bei **Error-Objekt**-Capture (nicht `console.error(String)`). 4 GitHub-Secrets: `SENTRY_DSN`/`SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT`. **Secret-Scrubber** (`beforeSend`/`beforeBreadcrumb`) filtert JWT/`sb*\*`/Bearer/`postgres://` aus Freitext-Feldern. Worker-Entry importiert **internen** Adapter-Pfad → lockstep bei Astro-Major.
- **Push auf `main` = Prod-Deploy** (braucht User-`!`); **CI-Fail blockt deploy lautlos** → nach Push Jobs/Steps per REST-API prüfen (`gh` nicht installiert; `curl.exe --ssl-no-revoke`).
- **CI-rot ≠ Infra-Bug:** echte Step-Logs vor Hypothese ziehen.
- **Lint lokal (Windows):** `npm run lint` zeigt massenhaft `Delete ␍` (CRLF) — reines Zeilenenden-Artefakt, in CI/Linux irrelevant; husky/lint-staged fixt es beim Commit.
- **Resume-Hygiene:** canonical Status hier; bei Resume `git ls-remote origin main` gegen lokalen HEAD prüfen.

---

## Pausierte Themen

Keine.

---

## Session-Resume

Fuer neue Session: `/dtb:workflow-resume`
