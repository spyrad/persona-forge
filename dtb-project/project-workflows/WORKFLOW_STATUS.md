# Workflow-Status: persona-forge

**Letztes Update:** 2026-06-23 (Session 1)
**Letzter Session-Log:** `dtb-project/project-changelog/2026-06/2026-06-23.md`

---

## Aktueller Stand

| Kennzahl              | Wert                                                                                                                                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Laufende Arbeit**   | **Test-Rollout Phase 1 (`testing-integration-security-gate`) implementiert** — 4 Phasen, 54 Integration- + 48 Unit-Tests grün; `change.md` → `implemented`. **5 Commits lokal (`834a3d4`→`8d0e80e`), noch nicht gepusht.** |
| **Naechster Schritt** | **`! git push`** (remote `main` = `16e305c`), dann optional `/10x-impl-review testing-integration-security-gate` + `/10x-archive`. Danach Rollout-Phase 2 (R4 Lauf-Integrität + R3 SSRF).                                  |
| **Blocker**           | Keine. (Integration-Tests brauchen lokales Docker-Supabase: `npx supabase start` + `.env.test`.)                                                                                                                           |

---

## Offene Aufgaben

- [ ] **Push** 5 Commits → `main` (Test-Code + `context/`/`dtb-project/`-Doku; kein Worker-Runtime-Effekt). Danach CI-Deploy-Job sichten.
- [ ] Optional **`/10x-impl-review testing-integration-security-gate`** (Voll-Review) → dann **`/10x-archive`** (Slice schließen).
- [ ] **Rollout-Phase 2** (R4 Lauf-Integrität + R3 SSRF) via `/10x-new testing-run-integrity-ssrf` — siehe `test-plan.md` §3.
- [ ] **Rollout-Phase 3** (`npm run test` als CI-Pre-Deploy-Gate) — schließt „CI-Lint-Fail skippt Deploy lautlos".
- [ ] **Stale Root-`WORKFLOW_STATUS.md` (06-13) auflösen** — canonical ist diese Datei; das Duplikat hat den 06-23-Resume fehlgeleitet.

---

## Abgeschlossene Meilensteine (kompakt)

| Datum      | Meilenstein                                           | Ergebnis                                                             | Details                              |
| ---------- | ----------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------ |
| 2026-06-23 | **Test-Rollout Phase 1 implementiert (Modul 3)**      | Integration-Harness + Risk #1/#2/#5; 54 itests + 48 units grün       | `834a3d4`–`8d0e80e`, `2026-06-23.md` |
| 2026-06-22 | Test-Plan geschrieben + S-08 Close-out (MVP komplett) | `test-plan.md` (5 Risiken, 3 Phasen); OEJTS-MVP im Tracking komplett | `6d3c825`, `2026-06-22.md`           |
| 2026-06-21 | S-08 `side-by-side-comparison` impl + reviewt         | Zwei-Läufe-Vergleich; impl-review APPROVED                           | `70153cd`, `2026-06-21.md`           |
| 2026-06-20 | S-06/S-07 (run-control+tokens, visibility) live       | Live-Token-Zähler + Sichtbarkeit privat/global                       | `160ee06`, `f526e3c`                 |
| 2026-06-18 | S-04/S-05 (measurement-run, distribution) live        | OEJTS-Lauf end-to-end + Verteilung/Typ-Stabilität je Achse           | `d06afbe`, `2eb4da5`                 |
| 2026-06-15 | S-01–S-03 (Auth, Model-Config, Persona) live          | E-Mail-Auth, verschl. Key, Persona-Katalog                           | `72fa7ce`, `3d8bb4e`                 |

---

## Gotchas (Referenz)

- **Integration-Tests:** `npm run test:integration` braucht `npx supabase start` (Docker) + `.env.test` (aus `npx supabase status`; siehe `.env.test.example`). `npx supabase db reset` nötig, falls Migrationen fehlen. Safety-Guard verweigert nicht-lokale `SUPABASE_URL`. Noch KEIN CI-Gate.
- **Neues Astro-Top-Level-Route-File → workerd-Dev-Server-Neustart** (laufender Server sonst 500).
- **Neue lucide-Imports → Vite-Dep-Re-Opt-Hydration-404:** präsentationale Astro-Inseln ohne `client:load` statisch rendern (`lessons.md`).
- **Tailwind-Klassen immer via `cn()`** (prettier-plugin-tailwindcss trimmt Literale). **Husky aktiv halten** (`"prepare": "husky"`).
- **Migrations-Push separat:** `! npx supabase db push` für neue Policy/Spalte/Trigger (Worker-Deploy appliziert KEINE Migration).
- **Push auf `main` = Prod-Deploy** (braucht User-`!`); **CI-Lint blockt deploy lautlos** → nach Push Jobs/Steps einzeln prüfen (`gh`-frei via REST + `curl.exe --ssl-no-revoke`).
- **Zwei-Account-RLS:** Integration-Harness legt Test-User programmatisch an (anon-key-`signUp`, Timestamp-Mail) — Playwright-Accounts (`md.motion.value@gmail.com`/`damian.spyra@googlemail.com`, PW `Dupadupa19`) bleiben für E2E (Phase 3).
- **Resume-Hygiene:** canonical Status ist `dtb-project/project-workflows/WORKFLOW_STATUS.md` (NICHT die Root-Datei); bei Resume `git ls-remote origin` gegen `origin/main` prüfen.

---

## Pausierte Themen

Keine.

---

## Session-Resume

Fuer neue Session: `/dtb:workflow-resume`
