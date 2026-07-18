# Workflow-Status: persona-forge

**Letztes Update:** 2026-07-18
**Letzter Session-Log:** `dtb-project/project-changelog/2026-07/2026-07-18.md` (Session 1)

---

## Status (generiert aus Artefakten — nicht manuell editieren)

Kein aktives Feature. (HEXACO-Instrument abgenommen + archiviert 2026-07-18 → `archive/hexaco-instrument/`.)

---

## Kontext (manuell)

| Kennzahl    | Wert                                                                                                                                                                                                                                                             |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Blocker** | Keine.                                                                                                                                                                                                                                                           |
| **Notizen** | HEXACO live auf Prod (2 PRs: `42ddb42` Phase 2–5, `8e8b7fb` Review-Fix F1/F2; je Verdict 10.0/10). Impl-Review triagiert: F1/F2 FIXED, F3–F6 Nits SKIPPED (`features/hexaco-instrument/review.md`). Lokales Supabase + Docker laufen noch (`npx supabase stop`). |

---

## Offene Aufgaben

- [ ] **Kit-Sync** — `/dtb:kit-sync sync`: 5 Updates (`skills/CLAUDE.md`, `dtb-feature-discover/-plan`, `dtb-implement`, `dtb-repo-sync`) + neuer `dtb-commit-and-push`
- [ ] **Champion abschliessen** — `/10x-archive ci-review-agent`; PR #3–#11 in `evidence.md`. Job-Logs Verfall ~07.10.
- [ ] **Sammel-Einreichung Termin 2 (10.08.):** Builder + Architect + Champion
- [ ] **Lektion-Kandidat** — „generisch gebaut → generisch benennen" (Review-F3) via `/dtb:lesson`
- [ ] **Ideen-Inbox** (offen): #1 Task-based evals, #5 Live-Run-Visualisierung, #6 Combobox-Ersatz, #7 UI-Konzepte, #8 SD3, #9 HEXACO-100, #10 Repo-LICENSE

---

## Abgeschlossene Meilensteine (kompakt)

| Datum      | Meilenstein                                                | Ergebnis                                                                                                        | Details                       |
| ---------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 2026-07-18 | **HEXACO Phase 5 + Impl-Review: Abschluss + Abnahme**      | 17/17; PR #12 (`42ddb42`) + Review-Fix PR #13 (`8e8b7fb`), beide deployt + prod-abgenommen; F1/F2 FIXED         | `2026-07-18.md` (S1)          |
| 2026-07-17 | HEXACO Phase 2–4: Definition→Formular→Darstellung          | Prod-Lauf 5/5 verwertbar, 6 Faktor-Verteilungen; Result ohne Typ-Code, Attribution datengetrieben, Landing live | `2026-07-17.md` (S1–S3)       |
| 2026-07-16 | HEXACO-Instrument geplant + reviewt                        | Discovery→Spec→Plan (5 Ph./17 Schr.)→Review REVISE eingearbeitet                                                | `features/hexaco-instrument/` |
| 2026-07-15 | Modellname-Combobox + Dashboard Mission Control archiviert | beide abgenommen; `features/` geleert                                                                           | `archive/ARCHIVE_LOG.md`      |

---

## Kurs-Standort (10xDevs)

Module 1–4 = **20/20 ✅**. **10xBuilder** + **10xArchitect** einreichbereit.
**10xChampion (Modul 5): Badge-Nachweis erbracht**, Lernmodul 3/5. Termine: 2. = **10.08.** · 3. = 14.09.

---

## Gotchas (Referenz)

- **`kind` und `instrument_id` serverseitig gebunden (seit `8e8b7fb`):** `createRun` leitet `instrument_id` aus `kind` ab (`ITEM_INSTRUMENT_ID_BY_KIND`); Client-`instrumentId` wird ignoriert. Profil-Auflösung teilt jetzt die Registry-Regel von `getRunResult` (`getInstrument(instrument_id)`).
- **E2E-Seed HEXACO-fähig:** `tests/e2e/support/seed.ts` `seedBaselineModel({ instrument, kind })` (Default OEJTS). Volle E2E-Suite parallel flakt am Cold-`.vite`-Cache → `--workers=1` für verlässliche lokale Läufe.
- **Squash-Merge:** danach `git fetch` + `git reset --hard origin/main`, kein `git pull`. Verdict ist Required Status Check auf `main` → PR-Weg, kein Direkt-Push.
- **Prod-DB-Migrationen:** vor `db push` immer `migration list --linked` (blockt in Auto-Mode → User via `!`). `20260717184500_hexaco` ist remote applied.
- **`RunResult`/`aggregateRun` dispatchen auf die Aggregat-Form (`hasModalType`), nicht auf `run.kind`** → HEXACO kann keinen OEJTS-Typ-Code rendern, selbst bei falschem Badge.
- **`ENCRYPTION_KEY` MUSS = `.dev.vars`/`.env`-Key**, sonst haengen Laeufe 0/N. E2E nutzt separaten Node-Adapter (`.env.e2e`), Prod-Configs unberührt.

---

## Pausierte Themen

Keine.

---

## Handoff

**Naechster Befehl:** `/dtb:workflow-next` — kein aktives Feature (HEXACO archiviert). Priorisierte Backlog-Optionen: `/dtb:kit-sync sync` (5 Updates + neuer Skill), `/10x-archive ci-review-agent` (Champion, Einreichung 10.08.), oder ein neues Instrument via `/dtb:feature-start` (#8 SD3 / #9 HEXACO-100).
**Empfehlung:** Neue Session mit `/clear` starten, dann `/dtb:workflow-resume` (stellt Kontext her), danach obigen Befehl.
