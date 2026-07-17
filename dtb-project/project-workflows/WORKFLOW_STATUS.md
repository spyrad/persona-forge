# Workflow-Status: persona-forge

**Letztes Update:** 2026-07-17
**Letzter Session-Log:** `dtb-project/project-changelog/2026-07/2026-07-17.md` (Session 3)

---

## Status (generiert aus Artefakten — nicht manuell editieren)

| Item              | Status (abgeleitet) | Fortschritt | Naechster Schritt            |
| ----------------- | ------------------- | ----------- | ---------------------------- |
| HEXACO-Instrument | In Arbeit           | 14/17       | 5.1 Fehlerpfad + volle Suite |

---

## Kontext (manuell)

| Kennzahl    | Wert                                                                                                                                                                                                                                                                                                       |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Blocker** | Keine.                                                                                                                                                                                                                                                                                                     |
| **Notizen** | Phase 4 (`6c9a31b`) committet, aber **Auth-Seiten-Sichtprüfung (Result/Profil/Dashboard, Light/Dark) offen** — nur Landing von Claude verifiziert. Phase 2–4 (`0d80ae9`/`332ea71`/`6c9a31b`) **nur lokal, nicht gepusht**; Remote-DB hat die Migration bereits. Dev-Server + lokales Supabase laufen noch. |

---

## Offene Aufgaben

- [ ] **Auth-Seiten-Sichtprüfung nachholen** (Damian, Light/Dark) — `/runs`-Result (dimensional, kein Typ-Block, „Midpoint"), Modell-Profil (HEXACO-Sektion + „Public domain"-Attribution), `/dashboard` (kein OEJTS-Regress); VOR Phase 5 / Abnahme
- [ ] **Phase 5 umsetzen** — `/dtb:implement hexaco-instrument phase 5` (5.1 Fehlerpfad + volle Suite, 5.2 E2E-Kette `/10x-e2e`, 5.3 PR + Verdict-Gate + Prod-Abnahme)
- [ ] **Push Phase 2–4** — Push = Prod-Deploy; Verdict ist Required Check → PR-Weg (5.3), nicht direkt pushen; nach Push `gh run list --branch main`
- [ ] **Champion abschliessen** — `/10x-archive ci-review-agent`; PR #3–#11 in `evidence.md`. **Job-Logs verfallen ~07.10.**
- [ ] **Sammel-Einreichung Termin 2 (10.08.):** Builder + Architect + Champion
- [ ] **Ideen-Inbox:** #1 Task-based evals, #5 Live-Run-Visualisierung, #6 Combobox-Ersatz, #7 UI-Konzepte, #8 SD3, #9 HEXACO-100, #10 Repo-LICENSE (alle Offen)
- [ ] **Lektion-Kandidat:** „generisch deklariert ≠ generisch gebaut" — ggf. `/dtb:lesson`

---

## Abgeschlossene Meilensteine (kompakt)

| Datum      | Meilenstein                                                        | Ergebnis                                                                                                          | Details                       |
| ---------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 2026-07-17 | **HEXACO Phase 4: Darstellung + Attribution + Landing**            | Result ohne Typ-Code, HEXACO-Profil/Vergleich-Sektion, `InstrumentAttribution`, Landing live; 274/274 (`6c9a31b`) | `2026-07-17.md` (S3)          |
| 2026-07-17 | **HEXACO Phase 3: Eingabe + Formular + End-to-end**                | Prod-Browser-Lauf 5/5 verwertbar, 6 Verteilungen; Integration 81/81 (`332ea71`)                                   | `2026-07-17.md` (S2)          |
| 2026-07-17 | **HEXACO Phase 2: Definition + Scoring + Attribution + Migration** | 60 IPIP-Items, 12 Keying-Tests, `kind='hexaco'`-Migration (remote via `db push`) (`0d80ae9`)                      | `2026-07-17.md` (S2)          |
| 2026-07-17 | **HEXACO Phase 1: Datenmodell + Registry (Enabler)**               | Item-Union, `midpoint`, Registry; runs.ts OEJTS-frei (`5cdac4b`, gepusht)                                         | `2026-07-17.md` (S1)          |
| 2026-07-16 | HEXACO-Instrument geplant + reviewt                                | Discovery→Spec→Plan (5 Ph./17 Schr.)→Review REVISE eingearbeitet                                                  | `features/hexaco-instrument/` |
| 2026-07-15 | Modellname-Combobox + Dashboard Mission Control archiviert         | beide abgenommen; `features/` geleert                                                                             | `archive/ARCHIVE_LOG.md`      |

---

## Kurs-Standort (10xDevs)

Module 1–4 = **20/20 ✅**. **10xBuilder** + **10xArchitect** einreichbereit.
**10xChampion (Modul 5): Badge-Nachweis erbracht**, Lernmodul 3/5. Termine: 2. = **10.08.** · 3. = 14.09.

---

## Gotchas (Referenz)

- **`RunAggregate.hasModalType`** trennt „dimensional" (HEXACO, kein Typ-Code) von „Modaltyp unvollständig" (OEJTS-Dropout) — beide haben `modalType:null`, die UI verzweigt über das Flag.
- **AxisChart-Referenzlinie:** `referenceLabel`-Prop („Cutoff" Modaltyp-Schwelle vs. „Midpoint" dimensional); Default „Cutoff".
- **Attribution ist datengetrieben:** `ATTRIBUTION_BY_KIND` (aus `Instrument.attribution`); `InstrumentAttribution`-Komponente je gezeigtem Instrument, kein statischer OEJTS-Block mehr.
- **Deploy-Reihenfolge (belegt S2):** Dev-Server läuft gegen die Remote-DB — neuer `kind`/Constraint muss dort VOR dem Code-Test angewandt sein (`migration list --linked` → `db push`), sonst `runs_kind_check`-Violation.
- **Constraint-Migration namens-robust:** inline-Checks per `DO`-Block über `pg_get_constraintdef ilike '%spalte%'` droppen, nicht über vermuteten Namen.
- **Item-Instrument-Pfad ist generisch:** Ergebnis-/Step-Dispatch routet alles außer `steadfastness` über die Registry; nur `createRun` persistiert den echten `kind`.
- **`astro:env/server` bricht Vitest:** transitive Importeure im Test-Pfad dynamisch importieren (Muster `dashboard.ts`).
- **Prod-DB-Migrationen:** vor `db push` immer `migration list --linked`; Auto-Mode blockt Prod-DB-Befehle → User via `!`.
- **`ENCRYPTION_KEY` MUSS = `.dev.vars`/`.env`-Key**, sonst haengen Laeufe 0/N.
- **Verdict ist Required Status Check** auf `main` — direkte Pushes bypassen ihn (Admin); PR-Weg nutzen, wenn das Gate greifen soll.
- **`persona_id null` heisst „Persona geloescht"** — Baseline nur ueber `isBaselineRun` (Lektion L1).
- **Dev-SSR/Hydration:** „Invalid hook call" harmlos; `.reveal`-Landing-Karten sind im Headless bis zum IntersectionObserver-Trigger verborgen (für Screenshots opacity/transform forcieren).
- **Squash-Merge:** danach `git fetch` + `git reset --hard origin/main`, kein `git pull`.

---

## Pausierte Themen

Keine.

---

## Handoff

**Naechster Befehl:** `/dtb:implement hexaco-instrument phase 5` — Phase 4 committet (`6c9a31b`, 14/17); erster offener Schritt 5.1 (Registry-Fehlerpfad-Test + volle Suite). **Vorher offen:** Auth-Seiten-Sichtprüfung (Result/Profil/Dashboard, Light/Dark) — Landing ist verifiziert.
**Empfehlung:** Neue Session mit `/clear` starten, dann `/dtb:workflow-resume` (stellt Kontext her), danach obigen Befehl.
