# Workflow-Status: persona-forge

**Letztes Update:** 2026-06-25 (Session 1)
**Letzter Session-Log:** `dtb-project/project-changelog/2026-06/2026-06-25.md`

---

## Aktueller Stand

| Kennzahl              | Wert                                                                                                                                                                                                                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Laufende Arbeit**   | **Keine offene Implementierung.** Test-Rollout KOMPLETT (alle 3 Phasen). Phase 3 (`testing-quality-gates-wiring`) implementiert + archiviert; der `integration`-CI-Blocker ist GELÖST (PR #1 → merge `b6c7589`). `main` lokal = remote = `b6c7589` + lokale Doc-Commits (`bb18dee` Archiv, Status) noch ungepusht. |
| **Naechster Schritt** | **Test-Rollout abgeschlossen** — kein aktives Feature. Neues Feature via `/dtb:feature-start`, oder Backlog-Ideen (`BACKLOG.md`: Cross-Device E-Mail-Confirm, Custom SMTP). Vorher: lokale Doc-Commits auf `main` pushen (= Prod-Deploy).                                                                          |
| **Blocker**           | Keine. (Integration-Tests brauchen lokales Docker-Supabase: `npx supabase start` + `.env.test`.)                                                                                                                                                                                                                   |

---

## Offene Aufgaben

- [x] ~~**Rollout-Phase 3** (CI-Test-Gate)~~ — erledigt + archiviert; `integration`-Blocker gelöst (2026-06-25).
- [ ] **Lokale Doc-Commits pushen** — `bb18dee` (Archiv) + Status-Update auf `main` (= Prod-Deploy, braucht User-`!`).
- [ ] **Stale Root-`WORKFLOW_STATUS.md` (06-13) auflösen** — canonical ist diese Datei; das Duplikat hat einen früheren Resume fehlgeleitet.

---

## Abgeschlossene Meilensteine (kompakt)

| Datum      | Meilenstein                                                  | Ergebnis                                                                                  | Details                                         |
| ---------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 2026-06-25 | **Test-Rollout KOMPLETT — `integration`-CI-Blocker gelöst**  | PR #1: Nebenläufigkeitstest entflackt; `ci`+`integration` grün; Phase-3-Change archiviert | `1b2c0ac`→`b6c7589`, `bb18dee`, `2026-06-25.md` |
| 2026-06-24 | Test-Rollout Phase 3 (Quality-gates wiring) impl             | Unit+Integration als CI-Pre-Deploy-Gate; Branch-Protection (Required Checks)              | `99f6e52`–`9d03c7e`, `2026-06-24.md` (S1)       |
| 2026-06-23 | **Test-Rollout Phase 2 (R4+R3) impl + reviewt + archiviert** | 74 itests (von 54) + 48 units grün; APPROVED; deployt                                     | `d23c477`–`fe87873`, `2026-06-23.md` (S3)       |
| 2026-06-23 | Test-Rollout Phase 1 (Integration Security Gate)             | Harness + Risk #1/#2/#5; reviewt + archiviert                                             | `834a3d4`–`0bdc87e`, `2026-06-23.md` (S1/S2)    |
| 2026-06-22 | Test-Plan geschrieben + S-08 Close-out (MVP komplett)        | `test-plan.md` (5 Risiken, 3 Phasen); OEJTS-MVP im Tracking komplett                      | `6d3c825`, `2026-06-22.md`                      |
| 2026-06-21 | S-08 `side-by-side-comparison` impl + reviewt                | Zwei-Läufe-Vergleich; impl-review APPROVED                                                | `70153cd`, `2026-06-21.md`                      |
| 2026-06-18 | S-04/S-05 (measurement-run, distribution) live               | OEJTS-Lauf end-to-end + Verteilung/Typ-Stabilität je Achse                                | `d06afbe`, `2eb4da5`                            |
| 2026-06-15 | S-01–S-03 (Auth, Model-Config, Persona) live                 | E-Mail-Auth, verschl. Key, Persona-Katalog                                                | `72fa7ce`, `3d8bb4e`                            |

---

## Gotchas (Referenz)

- **Integration-Tests:** `npm run test:integration` braucht `npx supabase start` (Docker) + `.env.test` (aus `npx supabase status`; siehe `.env.test.example`). Safety-Guard (Host-Parse) verweigert nicht-lokale `SUPABASE_URL`. **CI-Gate seit Phase 3 aktiv** — eigener `integration`-Job (slim Service-Set) + `deploy: needs: [ci, integration]` + Branch-Protection Required Checks.
- **Integration-Harness:** Code in `src/test/integration/`. Zwei-Account-Fixture (`accounts.ts`), Domänen-Builder + Run-Builder (`fixtures.ts`: `makeCompletedRun`/`makePendingRun`/`makeRunningRun`/`makeFailedRun`), In-Process-Route-Aufrufe (`route-context.ts`: `makeApiContext`, **`authedCookieHeader`** für auth-gated Handler).
- **LLM-Mock (`llm-mock.ts`):** `vi.stubGlobal("fetch")` trifft AUCH supabase-js — der Mock reicht lokale Calls (Host `127.0.0.1`/`localhost`) durch, mockt nur die Outbound-Kante. IMMER `restoreLlm()` in `afterEach`.
- **SSRF-Guard an 2 Sites:** test-connection (Route) + `chatCompletion` (Run-Step), kein gemeinsamer Wrapper; im Run-Step wirft er VOR dem fetch (dort kein Mock nötig).
- **Migrations-Push separat:** `! npx supabase db push` für neue Policy/Spalte/Trigger (Worker-Deploy appliziert KEINE Migration).
- **Push auf `main` = Prod-Deploy** (braucht User-`!`); **CI-Lint blockt deploy lautlos** → nach Push Jobs/Steps einzeln prüfen (REST + `curl.exe --ssl-no-revoke`; zuletzt 2026-06-23 `ci`+`deploy`+wrangler grün).
- **Zwei-Account-RLS:** Harness legt Test-User programmatisch an (anon-key-`signUp`, Timestamp-Mail) — Playwright-Accounts bleiben für E2E (Phase 3).
- **Resume-Hygiene:** canonical Status ist `dtb-project/project-workflows/WORKFLOW_STATUS.md` (NICHT die Root-Datei); bei Resume `git ls-remote origin` gegen `origin/main` prüfen.
- **CI-rot ≠ Infra-Bug — echte Logs vor Hypothese (Lehre 2026-06-25):** Der `integration`-Blocker war NICHT die vermutete Key-Form (`ANON_KEY` JWT vs. `sb_publishable_`). Beide Key-Formen + slim-Service-Set laufen lokal grün — die Leithypothese war eine Sackgasse. Echte Ursache: der Nebenläufigkeitstest in `run-integrity.itest.ts` erwartete genau **eine** Repetition bei zwei parallelen `processNextRepetition`-Calls; je nach Interleaving entstehen aber 1 (eng verzahnt → `23505`-Catch) ODER 2 (sequenziell → rep_index 1 & 2) — **beide datenkonsistent** (unique `(run_id,rep_index)`). Lokal stabil 1 (grün), CI stabil 2 (rot) = Heisenbug. Fix: Test auf ehrliche Eigenschaft (kein Duplikat/Lücke/Überschreiten) gelockert, Produktlogik unverändert. **Lehre:** bei „CI rot / lokal grün" zuerst die echten Schritt-Logs ziehen (`gh run view --log-failed`), bevor man eine Hypothese auf `main` pusht — `gh` via `winget install GitHub.cli --source winget` (msstore-Quelle scheitert an TLS-Interception).

---

## Pausierte Themen

Keine.

---

## Session-Resume

Fuer neue Session: `/dtb:workflow-resume`
