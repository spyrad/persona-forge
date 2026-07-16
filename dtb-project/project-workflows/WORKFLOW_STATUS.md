# Workflow-Status: persona-forge

**Letztes Update:** 2026-07-16
**Letzter Session-Log:** `dtb-project/project-changelog/2026-07/2026-07-16.md` (Session 1)

---

## Status (generiert aus Artefakten — nicht manuell editieren)

| Item              | Status (abgeleitet) | Fortschritt | Naechster Schritt                                          |
| ----------------- | ------------------- | ----------- | ---------------------------------------------------------- |
| HEXACO-Instrument | Geplant             | 0/17        | `/dtb:feature-start` (Plan Reviewed, REVISE eingearbeitet) |

---

## Kontext (manuell)

| Kennzahl    | Wert                                                                                                                                                                                                                                                                                                  |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Blocker** | Keine.                                                                                                                                                                                                                                                                                                |
| **Notizen** | Feature `hexaco-instrument` aus Idee #3 geplant (Alignment-Fokus, HEXACO via **IPIP-HEXACO-60 public domain**); Plan-Review = **REVISE** → 7 Entscheidungen eingearbeitet, Plan **Reviewed** (0/17). SD3 = Inbox #8, HEXACO-100 = #9, LICENSE-Datei = #10. Champion-Einreichung Termin 2 = **10.08.** |

---

## Offene Aufgaben

- [ ] **Feature umsetzen** `hexaco-instrument` — `/dtb:feature-start` (Plan Reviewed, 0/17); erster Schritt 1.1 (Instrument-Interface generalisieren)
- [ ] **IPIP-HEXACO-60 Items + Keying** von ipip.ori.org beziehen (Plan-Schritt 2.1) — vor `feature-start`
- [ ] **Planungs-Artefakte committen** (discovery/spec/plan, INBOX, BACKLOG) als `docs(workflow)`
- [ ] **Champion abschliessen** — `/10x-archive ci-review-agent`; PR #3–#11 in `evidence.md`. **Job-Logs verfallen ~07.10.**
- [ ] **Sammel-Einreichung Termin 2 (10.08.):** Builder + Architect + Champion
- [ ] **Ideen-Inbox:** #1 Task-based evals, #5 Live-Run-Visualisierung, #6 Combobox-Ersatz, #7 UI-Konzepte, #8 SD3, #9 HEXACO-100, #10 Repo-LICENSE (alle Offen)
- [ ] **Lektion-Kandidat:** „generisch deklariert ≠ generisch gebaut" (Instrument-Interface war OEJTS-gepraegt) — ggf. `/dtb:lesson`

---

## Abgeschlossene Meilensteine (kompakt)

| Datum      | Meilenstein                                                | Ergebnis                                                                                                                   | Details                        |
| ---------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| 2026-07-16 | **HEXACO-Instrument geplant + reviewt**                    | Discovery→Spec→Plan (5 Ph./17 Schr.)→Review **REVISE** eingearbeitet (Reviewed); IPIP-HEXACO-60 (PD); #8/#9/#10 abgeleitet | `features/hexaco-instrument/`  |
| 2026-07-16 | DERIVED_STATE_RULES-Seed nachgezogen                       | Seed (Klasse B) fehlte; byte-genau aus Kit `@0a82850`; `dc4e50d` deployt (Lauf `29469143963` gruen)                        | `2026-07-16.md` (S1)           |
| 2026-07-15 | Modellname-Combobox + Dashboard Mission Control archiviert | beide abgenommen; `features/` geleert                                                                                      | `archive/ARCHIVE_LOG.md`       |
| 2026-07-14 | Model Compare abgenommen + archiviert                      | Prod-Abnahme; `archive/model-compare/`                                                                                     | `2026-07-14.md` (S4)           |
| 2026-07-09 | Landing „Live Instrument" + CI-Review-Agent                | PR #3; Verdict-Gate belegt                                                                                                 | `2026-07-09.md`, `evidence.md` |

---

## Kurs-Standort (10xDevs)

Module 1–4 = **20/20 ✅**. **10xBuilder** + **10xArchitect** einreichbereit.
**10xChampion (Modul 5): Badge-Nachweis erbracht**, Lernmodul 3/5. Termine: 2. = **10.08.** · 3. = 14.09.

---

## Gotchas (Referenz)

- **DERIVED_STATE_RULES.md ist ein Seed (Klasse B):** nur `project-init` verteilt ihn, `kit-sync` nie. Bei Projekten vor Seed-Einfuehrung manuell aus dem Kit-Klon nachziehen (hashgleich, `git hash-object` vergleichen).
- **Prettier formatiert alle `*.md` im Pre-Commit** (lint-staged) — auch Seed-Dateien; nur Tabellen-Padding, Inhalt bleibt. Fuer Umlaut-Zeilen NIE `perl -pe` mit `\x{…}` (korrumpiert vorhandene UTF-8-Bytes) — ganze Zeile via UTF-8-Datei + `awk` ersetzen.
- **Volles Lint lokal:** `npx eslint . --rule '{"prettier/prettier":"off"}'` (CRLF); nie Teilmengen linten.
- **Squash-Merge:** danach `git fetch` + `git reset --hard origin/main`, kein `git pull`.
- **E2E braucht Docker + lokales Supabase**; Seed per DB-Insert (`tests/e2e/support/seed.ts`).
- **Dev-SSR/Hydration:** „Invalid hook call" harmlos; Playwright-fill vor Hydration → `astro-island:not([ssr])`-Wait.
- **`astro:env/server` bricht Vitest:** Services, die es (transitiv) importieren, im Test-Pfad dynamisch importieren (Muster `dashboard.ts`).
- **Connection-Test ≠ Lauf-Pfad:** Test probt `GET /models` — Anthropic-Compat deckt nur `/chat/completions` → 401 trotz korrekter Config.
- **Anthropic via OpenAI-Compat:** `https://api.anthropic.com/v1` + Modell-IDs ohne Datums-Suffix.
- **Chart-Serien-Farben:** `chart-1..4` = Teal/Amber/Blau/Pink (CVD-validiert, PR #9).
- **Verdict ist Required Status Check** auf `main` — direkte Pushes bypassen ihn (Admin); PR-Weg nutzen, wenn das Gate greifen soll.
- **Prod-DB-Migrationen:** vor `db push` immer `migration list --linked`.
- **`ENCRYPTION_KEY` MUSS = `.dev.vars`/`.env`-Key**, sonst haengen Laeufe 0/N.
- **Push auf `main` = Prod-Deploy**; CI-Fail blockt Deploy lautlos → nach Push `gh run list --branch main`.
- **`persona_id null` heisst „Persona geloescht"** — Baseline nur ueber `isBaselineRun` (Lektion L1).
- **kit-sync:** Lock `~/.claude/dtb-lock.json` (Quelle `master@0a82850`; Kit-Klon `Desktop/Projekte/claude-code-workflow-kit`).
- **Instrument-Datenmodell (S1 2026-07-16):** `Instrument`/`InstrumentItem` sind modaltyp-zentriert + bipolar-only — ein Likert-Instrument (HEXACO/IPIP) braucht Interface-Erweiterung, kein reines „Daten ergaenzen".

---

## Pausierte Themen

Keine.

---

## Handoff

**Naechster Befehl:** `/dtb:feature-start hexaco-instrument` — Plan ist **Reviewed** (REVISE eingearbeitet, 0/17), erster Schritt 1.1. Davor: Planungs-Artefakte committen (`docs(workflow)`) und die IPIP-HEXACO-60-Items/Keying beziehen (Schritt 2.1).
**Empfehlung:** Neue Session mit `/clear` starten, dann `/dtb:workflow-resume`. Planungs-Artefakte vorher committen (`docs(workflow)`).
