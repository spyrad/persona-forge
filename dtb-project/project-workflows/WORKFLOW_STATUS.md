# Workflow-Status: persona-forge

**Letztes Update:** 2026-06-23 (Session 3)
**Letzter Session-Log:** `dtb-project/project-changelog/2026-06/2026-06-23.md`

---

## Aktueller Stand

| Kennzahl              | Wert                                                                                                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Laufende Arbeit**   | **Keine offene Implementierung.** Test-Rollout Phase 2 (`testing-run-integrity-ssrf`) komplett, reviewt (APPROVED) + archiviert; `main` lokal = remote = `fe87873`, deployt (CI `ci`+`deploy` grün, wrangler ausgeführt). |
| **Naechster Schritt** | **Rollout-Phase 3** (`npm run test` als CI-Pre-Deploy-Gate) via `/10x-new` — letzte Phase aus `test-plan.md` §3.                                                                                                          |
| **Blocker**           | Keine. (Integration-Tests brauchen lokales Docker-Supabase: `npx supabase start` + `.env.test`.)                                                                                                                          |

---

## Offene Aufgaben

- [ ] **Rollout-Phase 3** (`npm run test` als CI-Pre-Deploy-Gate) via `/10x-new` — schließt „CI-Lint-Fail skippt Deploy lautlos"; letzte test-plan-Phase.
- [ ] **Stale Root-`WORKFLOW_STATUS.md` (06-13) auflösen** — canonical ist diese Datei; das Duplikat hat einen früheren Resume fehlgeleitet.

---

## Abgeschlossene Meilensteine (kompakt)

| Datum      | Meilenstein                                                  | Ergebnis                                                             | Details                                      |
| ---------- | ------------------------------------------------------------ | -------------------------------------------------------------------- | -------------------------------------------- |
| 2026-06-23 | **Test-Rollout Phase 2 (R4+R3) impl + reviewt + archiviert** | 74 itests (von 54) + 48 units grün; APPROVED; deployt                | `d23c477`–`fe87873`, `2026-06-23.md` (S3)    |
| 2026-06-23 | Test-Rollout Phase 1 (Integration Security Gate)             | Harness + Risk #1/#2/#5; reviewt + archiviert                        | `834a3d4`–`0bdc87e`, `2026-06-23.md` (S1/S2) |
| 2026-06-22 | Test-Plan geschrieben + S-08 Close-out (MVP komplett)        | `test-plan.md` (5 Risiken, 3 Phasen); OEJTS-MVP im Tracking komplett | `6d3c825`, `2026-06-22.md`                   |
| 2026-06-21 | S-08 `side-by-side-comparison` impl + reviewt                | Zwei-Läufe-Vergleich; impl-review APPROVED                           | `70153cd`, `2026-06-21.md`                   |
| 2026-06-18 | S-04/S-05 (measurement-run, distribution) live               | OEJTS-Lauf end-to-end + Verteilung/Typ-Stabilität je Achse           | `d06afbe`, `2eb4da5`                         |
| 2026-06-15 | S-01–S-03 (Auth, Model-Config, Persona) live                 | E-Mail-Auth, verschl. Key, Persona-Katalog                           | `72fa7ce`, `3d8bb4e`                         |

---

## Gotchas (Referenz)

- **Integration-Tests:** `npm run test:integration` braucht `npx supabase start` (Docker) + `.env.test` (aus `npx supabase status`; siehe `.env.test.example`). Safety-Guard (Host-Parse) verweigert nicht-lokale `SUPABASE_URL`. Noch KEIN CI-Gate (Phase 3).
- **Integration-Harness:** Code in `src/test/integration/`. Zwei-Account-Fixture (`accounts.ts`), Domänen-Builder + Run-Builder (`fixtures.ts`: `makeCompletedRun`/`makePendingRun`/`makeRunningRun`/`makeFailedRun`), In-Process-Route-Aufrufe (`route-context.ts`: `makeApiContext`, **`authedCookieHeader`** für auth-gated Handler).
- **LLM-Mock (`llm-mock.ts`):** `vi.stubGlobal("fetch")` trifft AUCH supabase-js — der Mock reicht lokale Calls (Host `127.0.0.1`/`localhost`) durch, mockt nur die Outbound-Kante. IMMER `restoreLlm()` in `afterEach`.
- **SSRF-Guard an 2 Sites:** test-connection (Route) + `chatCompletion` (Run-Step), kein gemeinsamer Wrapper; im Run-Step wirft er VOR dem fetch (dort kein Mock nötig).
- **Migrations-Push separat:** `! npx supabase db push` für neue Policy/Spalte/Trigger (Worker-Deploy appliziert KEINE Migration).
- **Push auf `main` = Prod-Deploy** (braucht User-`!`); **CI-Lint blockt deploy lautlos** → nach Push Jobs/Steps einzeln prüfen (REST + `curl.exe --ssl-no-revoke`; zuletzt 2026-06-23 `ci`+`deploy`+wrangler grün).
- **Zwei-Account-RLS:** Harness legt Test-User programmatisch an (anon-key-`signUp`, Timestamp-Mail) — Playwright-Accounts bleiben für E2E (Phase 3).
- **Resume-Hygiene:** canonical Status ist `dtb-project/project-workflows/WORKFLOW_STATUS.md` (NICHT die Root-Datei); bei Resume `git ls-remote origin` gegen `origin/main` prüfen.

---

## Pausierte Themen

Keine.

---

## Session-Resume

Fuer neue Session: `/dtb:workflow-resume`
