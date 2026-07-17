# Workflow-Status: persona-forge

**Letztes Update:** 2026-07-17
**Letzter Session-Log:** `dtb-project/project-changelog/2026-07/2026-07-17.md` (Session 2)

---

## Status (generiert aus Artefakten — nicht manuell editieren)

| Item              | Status (abgeleitet) | Fortschritt | Naechster Schritt               |
| ----------------- | ------------------- | ----------- | ------------------------------- |
| HEXACO-Instrument | In Arbeit           | 11/17       | 4.1 Lauf-Ergebnis ohne Typ-Code |

---

## Kontext (manuell)

| Kennzahl    | Wert                                                                                                                                                                                                                                                                                         |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Blocker** | Keine.                                                                                                                                                                                                                                                                                       |
| **Notizen** | Phase 2 (`0d80ae9`) + Phase 3 (`332ea71`) lokal committet, **nicht gepusht**. Remote-DB hat die `hexaco`-Migration bereits (`db push`, additiv/kompatibel), der deployte Worker noch nicht → Push sinnvoll nach Phase 4/5 bündeln. Dev-Server + lokales Supabase laufen noch (Housekeeping). |

---

## Offene Aufgaben

- [ ] **Phase 4 umsetzen** — `/dtb:implement hexaco-instrument phase 4` (4.1 Result ohne Typ-Code + Untertitel, 4.2 Profil/Vergleich/Dashboard-Sektion analog Steadfastness, 4.3 Attribution parametrisieren + Landing live)
- [ ] **Push Phase 2+3** — Push auf `main` = Prod-Deploy; nach Push `gh run list --branch main` (CI-Fail blockt Deploy lautlos)
- [ ] **Champion abschliessen** — `/10x-archive ci-review-agent`; PR #3–#11 in `evidence.md`. **Job-Logs verfallen ~07.10.**
- [ ] **Sammel-Einreichung Termin 2 (10.08.):** Builder + Architect + Champion
- [ ] **Ideen-Inbox:** #1 Task-based evals, #5 Live-Run-Visualisierung, #6 Combobox-Ersatz, #7 UI-Konzepte, #8 SD3, #9 HEXACO-100, #10 Repo-LICENSE (alle Offen)
- [ ] **Lektion-Kandidat:** „generisch deklariert ≠ generisch gebaut" — ggf. `/dtb:lesson`

---

## Abgeschlossene Meilensteine (kompakt)

| Datum      | Meilenstein                                                        | Ergebnis                                                                                                              | Details                       |
| ---------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 2026-07-17 | **HEXACO Phase 3: Eingabe + Formular + End-to-end**                | HEXACO im Lauf-Formular wählbar; Prod-Browser-Lauf 5/5 verwertbar, 6 Verteilungen; Integration 81/81 (`332ea71`)      | `2026-07-17.md` (S2)          |
| 2026-07-17 | **HEXACO Phase 2: Definition + Scoring + Attribution + Migration** | 60 IPIP-Items, 12 Keying-Tests, `InstrumentAttribution`, `kind='hexaco'`-Migration (remote via `db push`) (`0d80ae9`) | `2026-07-17.md` (S2)          |
| 2026-07-17 | **HEXACO Phase 1: Datenmodell + Registry (Enabler)**               | Item-Union bipolar\|Likert, `midpoint`, Registry; runs.ts OEJTS-frei (`5cdac4b`, gepusht)                             | `2026-07-17.md` (S1)          |
| 2026-07-16 | HEXACO-Instrument geplant + reviewt                                | Discovery→Spec→Plan (5 Ph./17 Schr.)→Review REVISE eingearbeitet; IPIP-Quelle entschieden                             | `features/hexaco-instrument/` |
| 2026-07-15 | Modellname-Combobox + Dashboard Mission Control archiviert         | beide abgenommen; `features/` geleert                                                                                 | `archive/ARCHIVE_LOG.md`      |
| 2026-07-14 | Model Compare abgenommen + archiviert                              | Prod-Abnahme; `archive/model-compare/`                                                                                | `2026-07-14.md` (S4)          |

---

## Kurs-Standort (10xDevs)

Module 1–4 = **20/20 ✅**. **10xBuilder** + **10xArchitect** einreichbereit.
**10xChampion (Modul 5): Badge-Nachweis erbracht**, Lernmodul 3/5. Termine: 2. = **10.08.** · 3. = 14.09.

---

## Gotchas (Referenz)

- **Deploy-Reihenfolge (belegt S2):** Dev-Server läuft gegen die Remote-DB — ein neuer `kind`/Constraint muss dort VOR dem Code-Test angewandt sein (`migration list --linked` → `db push`), sonst `runs_kind_check`-Violation. Push auf `main` = Prod-Deploy.
- **Constraint-Migration namens-robust:** inline-Checks droppen per `DO`-Block über `pg_get_constraintdef ilike '%spalte%'`, nicht über den vermuteten `<tabelle>_<spalte>_check`-Namen (leere DB deckt Namensfehler bei `db reset` nicht auf).
- **`astro:env/server` bricht Vitest:** Services, die es (transitiv) importieren, im Test-Pfad dynamisch importieren (Muster `dashboard.ts`).
- **Item-Instrument-Pfad ist generisch:** Ergebnis-/Step-Dispatch routet alles außer `steadfastness` über die Registry (`instrument_id`); nur `createRun` musste den echten `kind` persistieren.
- **`AxisScale.cutoff` trägt den `midpoint`** der Achse (Feldname stabil für Charts); Modaltyp nur bei `hasModalType: true` (OEJTS).
- **Prod-DB-Migrationen:** vor `db push` immer `migration list --linked`; Auto-Mode blockt Prod-DB-Befehle → User via `!`.
- **`ENCRYPTION_KEY` MUSS = `.dev.vars`/`.env`-Key**, sonst haengen Laeufe 0/N.
- **Verdict ist Required Status Check** auf `main` — direkte Pushes bypassen ihn (Admin); PR-Weg nutzen, wenn das Gate greifen soll.
- **`persona_id null` heisst „Persona geloescht"** — Baseline nur ueber `isBaselineRun` (Lektion L1).
- **Dev-SSR/Hydration:** „Invalid hook call" harmlos; Playwright-fill vor Hydration → `astro-island:not([ssr])`-Wait.
- **Squash-Merge:** danach `git fetch` + `git reset --hard origin/main`, kein `git pull`.

---

## Pausierte Themen

Keine.

---

## Handoff

**Naechster Befehl:** `/dtb:implement hexaco-instrument phase 4` — Phase 3 committet (`332ea71`, 11/17); erster offener Schritt 4.1 (Lauf-Ergebnis ohne Typ-Code: `RunResult.tsx` „derived type"-Block + `[id].astro`-Untertitel für HEXACO). 3x3-Stopp nach 4.3.
**Empfehlung:** Neue Session mit `/clear` starten, dann `/dtb:workflow-resume` (stellt Kontext her), danach obigen Befehl.
