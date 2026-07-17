# Workflow-Status: persona-forge

**Letztes Update:** 2026-07-17
**Letzter Session-Log:** `dtb-project/project-changelog/2026-07/2026-07-17.md` (Session 1)

---

## Status (generiert aus Artefakten — nicht manuell editieren)

| Item              | Status (abgeleitet) | Fortschritt | Naechster Schritt                        |
| ----------------- | ------------------- | ----------- | ---------------------------------------- |
| HEXACO-Instrument | In Arbeit           | 3/17        | 2.1 IPIP-HEXACO-60 Instrument-Definition |

---

## Kontext (manuell)

| Kennzahl    | Wert                                                                                                                                                                                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Blocker** | Keine.                                                                                                                                                                                                                                                                          |
| **Notizen** | Phase 1 (Enabler) fertig, committet + **gepusht** (`5cdac4b`/`bddd38e`, Deploy-Lauf siehe S1). Item-Quelle entschieden: kuratierte 60er-Auswahl aus den IPIP-HEXACO-Skalen (kein kanonisches „IPIP-HEXACO-60"!), Referenz `context/foundation/instruments/ipip-hexaco-60.json`. |

---

## Offene Aufgaben

- [ ] **Phase 2 umsetzen** — `/dtb:implement hexaco-instrument phase 2` (2.1 Definition aus Referenz-JSON, 2.2 Scoring-Test, 2.3 Smoke-Lauf, 2.4 Attribution, 2.5 Migration; Migration VOR Code-Deploy)
- [ ] **Champion abschliessen** — `/10x-archive ci-review-agent`; PR #3–#11 in `evidence.md`. **Job-Logs verfallen ~07.10.**
- [ ] **Sammel-Einreichung Termin 2 (10.08.):** Builder + Architect + Champion
- [ ] **Ideen-Inbox:** #1 Task-based evals, #5 Live-Run-Visualisierung, #6 Combobox-Ersatz, #7 UI-Konzepte, #8 SD3, #9 HEXACO-100, #10 Repo-LICENSE (alle Offen)
- [ ] **Lektion-Kandidat:** „generisch deklariert ≠ generisch gebaut" (Instrument-Interface war OEJTS-gepraegt) — ggf. `/dtb:lesson`

---

## Abgeschlossene Meilensteine (kompakt)

| Datum      | Meilenstein                                                | Ergebnis                                                                                                           | Details                        |
| ---------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| 2026-07-17 | **HEXACO Phase 1: Datenmodell + Registry (Enabler)**       | Item-Union bipolar\|Likert, `midpoint`, Registry mit Fehlerpfad; runs.ts OEJTS-frei; 258/258 Tests (`5cdac4b`)     | `2026-07-17.md` (S1)           |
| 2026-07-17 | **Item-Quelle entschieden + bezogen**                      | Kein kanonisches IPIP-HEXACO-60 (Befund); deterministische 60er-Auswahl (30/30 Keying), public domain              | `ipip-hexaco-60.json`          |
| 2026-07-16 | HEXACO-Instrument geplant + reviewt                        | Discovery→Spec→Plan (5 Ph./17 Schr.)→Review **REVISE** eingearbeitet (Reviewed); IPIP-Quelle; #8/#9/#10 abgeleitet | `features/hexaco-instrument/`  |
| 2026-07-15 | Modellname-Combobox + Dashboard Mission Control archiviert | beide abgenommen; `features/` geleert                                                                              | `archive/ARCHIVE_LOG.md`       |
| 2026-07-14 | Model Compare abgenommen + archiviert                      | Prod-Abnahme; `archive/model-compare/`                                                                             | `2026-07-14.md` (S4)           |
| 2026-07-09 | Landing „Live Instrument" + CI-Review-Agent                | PR #3; Verdict-Gate belegt                                                                                         | `2026-07-09.md`, `evidence.md` |

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
- **`AxisScale.cutoff` traegt seit p1 den `midpoint`** der Achse (Feldname stabil fuer Charts); Modaltyp nur bei `hasModalType: true` (OEJTS).

---

## Pausierte Themen

Keine.

---

## Handoff

**Naechster Befehl:** `/dtb:implement hexaco-instrument phase 2` — Phase 1 committet + gepusht (`5cdac4b`/`bddd38e`, 3/17); erster Schritt 2.1 (HEXACO-Definition aus `context/foundation/instruments/ipip-hexaco-60.json`). 3x3-Stopp nach 2.3 (Smoke-Lauf).
**Empfehlung:** Neue Session mit `/clear` starten, dann `/dtb:workflow-resume` (stellt Kontext her), danach obigen Befehl.
