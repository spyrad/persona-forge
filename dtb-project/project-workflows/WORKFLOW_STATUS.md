# Workflow-Status: persona-forge

**Letztes Update:** 2026-07-03 (Session 1)
**Letzter Session-Log:** `dtb-project/project-changelog/2026-07/2026-07-03.md`

---

## Aktueller Stand

| Kennzahl              | Wert                                                                                                                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Laufende Arbeit**   | Doku-/Housekeeping abgeschlossen: Repo-Description+Topics live gesetzt, OEJTS-Lizenz korrigiert (CC BY-NC-SA 4.0, nicht gemeinfrei). **7 Doku-Änderungen uncommitted** (`origin/main = 528d626`, Prod live, kein Code berührt). |
| **Naechster Schritt** | **Termin-Entscheidung Sa 2026-07-04** (Builder+Architect Termin 1 vs. Champion später) + Architektur-Report einreichen. Zuvor Doku-Änderungen committen.                                                                        |
| **Blocker**           | Keine.                                                                                                                                                                                                                          |

---

## Offene Aufgaben

- [ ] **Termin-Entscheidung Sa 2026-07-04:** Builder+Architect in Termin 1 (5.07., Auszeichnung + Demo-Day-Chance, „ein Formular, einmal") vs. 🏆 Champion später (Modul 5 bauen, ~0/5, dann ohne Auszeichnung). Alle 3 Badges auch bis Termin 3 (14.09.) möglich.
- [ ] **Architektur-Report einreichen** — `context/architect-report.md` ins Zert-Formular (letzte Kurswoche).
- [ ] **Doku-Änderungen committen** (`/10x-commit-push`) — 6 geänderte + 1 neue Datei (`docs/instruments/`).
- [ ] **Optional:** README/BACKLOG um „Standhaftigkeit" ergänzen; Repo-LICENSE erwägen (muss SA-Pflicht des OEJTS-Teils berücksichtigen).
- [ ] **Geparkte Minors (SDD-Ledger, kein Blocker):** Live-Progress 0 Tokens während Runden; Generierungs-Fehler ohne Rep-Detail; DRY-Duplikat `tryParseJson`.

---

## Abgeschlossene Meilensteine (kompakt)

| Datum      | Meilenstein                                | Ergebnis                                                                                                         | Details                                                       |
| ---------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 2026-07-03 | **OEJTS-Lizenz korrigiert + dokumentiert** | Quelle verifiziert: **CC BY-NC-SA 4.0**, nicht gemeinfrei. Attributions-Doku + „gemeinfrei"-Fixes in 5 Docs      | `docs/instruments/oejts-attribution.md`, `2026-07-03.md` (S1) |
| 2026-07-03 | **GitHub Repo-Description + Topics**       | Description (beide Test-Typen) + 14 Topics live gesetzt; `gh` installiert + authentifiziert (`spyrad`)           | `2026-07-03.md` (S1)                                          |
| 2026-07-02 | **Feature: Standhaftigkeit (2. Test-Typ)** | `kind`-Diskriminator; Prüfling×Gegenspieler; Score+Breakdown. 11 SDD-Tasks, Opus-Review, CI/Prod grün, Live 80 % | `64b7bf6`→`528d626`, `2026-07-02.md` (S3)                     |
| 2026-07-02 | **Feature: Fehler-Sichtbarkeit**           | Upstream-`error.message` leak-sicher durchgereicht + UI live+aggregiert; Live-Smoke abgenommen                   | `d9d3a09`→`9f0d3e0`, `2026-07-02.md` (S2/S3)                  |
| 2026-07-01 | **Feature: z.ai `thinking:disabled`**      | Host-Gate `isZaiEndpoint`; GLM-Läufe ~2,8 s statt 9–16 s; 77/77                                                  | `a8753de`→`c5631f0`, `2026-07-01.md` (S4)                     |
| 2026-07-01 | **Feature: Lauf-/Wiederholungs-Timing**    | Migration `duration_ms`+`finished_at`; Timing in Ergebnis/Live/Liste                                             | `31e9383`→`dfe0170`, `2026-07-01.md` (S4)                     |
| 2026-07-01 | **Modul-4 (10xArchitect) KOMPLETT**        | 4/4 Artefakte + Architektur-Report (PL, einreichbereit)                                                          | `context/architect-report.md`                                 |
| 2026-06-25 | **Test-Rollout KOMPLETT**                  | `ci`+`integration`-CI-Gate; E2E-Lernschicht                                                                      | `1b2c0ac`→`b6c7589`, `2026-06-25.md`                          |

---

## Kurs-Standort (10xDevs, read-only Report S1)

Module 1–4 = **20/20 ✅**. **10xBuilder** (Pflicht, M1–3) + **10xArchitect** (M3–4) einreichbereit.
**10xChampion** basiert auf **Modul 5** (Team-AI + CI/CD) → aktuell ~0/5, bis Termin 1 nicht erreichbar.
Termine: **1. = 5.07.2026** (nur hier Auszeichnung) · 2. = 10.08. · 3. (final) = 14.09.

---

## Gotchas (Referenz)

- **OEJTS = CC BY-NC-SA 4.0**, nicht gemeinfrei — Attribution `docs/instruments/oejts-attribution.md`. NC blockt Monetarisierung; SA bindet abgeleiteten Item-Satz (kollidiert mit permissiver Repo-LICENSE); Repo hat keine LICENSE-Datei.
- **`gh` CLI installiert** (winget, `C:\Program Files\GitHub CLI\gh.exe`), auth `spyrad` (`repo`-Scope). Git-Bash: voller Pfad nötig bis Shell-Neustart.
- **Standhaftigkeit:** `runs.kind` (`oejts`|`steadfastness`); Orchestrierung `stepSteadfastness` (1 Runde/Schritt, ≤2 Calls). Reine Module `steadfastness-{run,aggregate}.ts`.
- **Prod-DB-Migrationen:** Remote-Historie driftet — vor `db push` immer `migration list --linked`, ggf. `migration repair --status applied`. Auto-Mode blockt Prod-DB → per `!`. Memory `persona-forge-migrations`.
- **z.ai:** Coding-Plan-Key braucht `api.z.ai/api/coding/paas/v4` (sonst 429); GLM via `thinking:disabled` aus. Memory `persona-forge-zai-provider`.
- **`ENCRYPTION_KEY` MUSS = `.dev.vars`/`.env`-Key** (Prod+Dev teilen DB `lccaundrniuievkmusko`), sonst Läufe hängen 0/N.
- **Push auf `main` = Prod-Deploy** (Auto-Mode blockt `git push` → per `!`); CI-Fail blockt Deploy lautlos → nach Push CI per REST prüfen (`branch=main`).

---

## Pausierte Themen

Keine.

---

## Session-Resume

Fuer neue Session: `/dtb:workflow-resume`
