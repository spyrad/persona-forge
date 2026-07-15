# Workflow-Status: persona-forge

**Letztes Update:** 2026-07-15
**Letzter Session-Log:** `dtb-project/project-changelog/2026-07/2026-07-15.md` (Session 1)

---

## Status (generiert aus Artefakten — nicht manuell editieren)

| Item                      | Status (abgeleitet) | Fortschritt | Naechster Schritt                                 |
| ------------------------- | ------------------- | ----------- | ------------------------------------------------- |
| Dashboard Mission Control | In Arbeit           | 8/13        | 2.3 Sichtpruefung Light/Dark, dann 3.4 Hero-Tests |

---

## Kontext (manuell)

| Kennzahl    | Wert                                                                                                                                                                                                           |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Blocker** | Keine.                                                                                                                                                                                                         |
| **Notizen** | Feature-Branch `feat/dashboard-mission-control` (3 Commits, PR bewusst offen); Plan Reviewed (REVISE → 8 Entscheidungen, u. a. SVG+CSS statt Canvas — keine Insel). Champion-Einreichung Termin 2 = **10.08.** |

---

## Offene Aufgaben

- [ ] **Sichtpruefung `/dashboard`** (Schritt 2.3) — `npm run dev`, Light/Dark + Hero-Optik; Feintuning vor dem PR
- [ ] **Block 4:** 3.4 Unit-Tests `hero-layout`, 4.1 E2E (`/10x-e2e`), 4.2 Full Suite + PR (Verdict-Gate)
- [ ] **Workflow-Doku committen** — spec/plan/BACKLOG/INBOX/STATUS uncommitted auf dem Feature-Branch
- [ ] **Autofill-Fix in Prod verifizieren + Combobox abnehmen** — deployt via `1cb0fac`; 2 offene Live-Kriterien in `FEATURE_MODEL_NAME_COMBOBOX.md`
- [ ] **Champion abschliessen** — `/10x-archive ci-review-agent`; PR #3–#10 in `evidence.md`. **Job-Logs verfallen ~07.10.**
- [ ] **Sammel-Einreichung Termin 2 (10.08.):** Builder + Architect + Champion
- [ ] **Altbestand:** `features/FEATURE_MODEL_NAME_COMBOBOX.md` → `/dtb:migrate-change-folders` oder archivieren
- [ ] **Ideen-Inbox:** #1 Task-based evals, #3 Test-Palette, #5 Live-Run-Visualisierung, #6 Combobox-Ersatz (alle Offen)
- [ ] **Geparkte Minors:** unveraendert (Connection-Test-Fallback 401; Picker `client:visible`; Live-Progress 0 Tokens; DRY `tryParseJson`; Badge-Markup; Banner/Ruler; tabular-nums; Node-20-Deprecation; Compare-Tooltip; Platzhalter `gpt-4o`)

---

## Abgeschlossene Meilensteine (kompakt)

| Datum      | Meilenstein                                           | Ergebnis                                                                                          | Details                                                     |
| ---------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 2026-07-15 | Dashboard Mission Control: Spec→Plan→Review→Phase 1–3 | Plan Reviewed (8 Entscheidungen); Summary-Service + Register + Orbit-Hero gebaut; 240 Tests gruen | `2026-07-15.md` (S1), `features/dashboard-mission-control/` |
| 2026-07-15 | Autofill-Fix deployt                                  | `1cb0fac` auf `main`, CI+Deploy gruen; Prod-Verifikation offen                                    | `2026-07-15.md` (S1)                                        |
| 2026-07-14 | Model Compare abgenommen + archiviert                 | Prod-Abnahme; `archive/model-compare/`, Commit `0485b2f`                                          | `2026-07-14.md` (S4), `archive/ARCHIVE_LOG.md`              |
| 2026-07-14 | Discovery „Dashboard Mission Control" + Kit-Sync      | fable-25 analysiert; Kit `66c6f27`→`a7170e5`                                                      | `2026-07-14.md` (S5)                                        |
| 2026-07-11 | Model Compare Phasen 1–4 + Design einsprachig         | Baseline/Profile/Compare live; PR #5–#9                                                           | `2026-07-11.md`, `2026-07-13.md`                            |
| 2026-07-09 | Landing „Live Instrument" + CI-Review-Agent           | PR #3; Verdict-Gate beide Richtungen belegt                                                       | `2026-07-09.md`, `evidence.md`                              |

---

## Kurs-Standort (10xDevs)

Module 1–4 = **20/20 ✅**. **10xBuilder** + **10xArchitect** einreichbereit.
**10xChampion (Modul 5): Badge-Nachweis erbracht**, Lernmodul 3/5. Termine: 2. = **10.08.** · 3. = 14.09.

---

## Gotchas (Referenz)

- **Volles Lint lokal:** `npx eslint . --rule '{"prettier/prettier":"off"}'` (CRLF); nie Teilmengen linten.
- **`lint-staged` darf `package-lock.json` nicht anfassen.** Prettier zerlegt `astro`-Codefences in Markdown.
- **Squash-Merge:** danach `git reset --hard origin/main`, kein `git pull`.
- **E2E braucht Docker + lokales Supabase**; Seed per DB-Insert (`tests/e2e/support/seed.ts`) mit `playwright/.auth/`-Credentials.
- **Dev-SSR/Hydration:** „Invalid hook call" harmlos; Playwright-fill vor Hydration → `astro-island:not([ssr])`-Wait.
- **`astro:env/server` bricht Vitest:** Services, die es (transitiv) importieren, im Test-Pfad dynamisch importieren (Muster `dashboard.ts`).
- **Connection-Test ≠ Lauf-Pfad:** Test probt `GET /models` — Anthropic-Compat deckt nur `/chat/completions` → 401 trotz korrekter Config.
- **Anthropic via OpenAI-Compat:** `https://api.anthropic.com/v1` + Modell-IDs ohne Datums-Suffix.
- **Chart-Serien-Farben:** `chart-1..4` = Teal/Amber/Blau/Pink (CVD-validiert, PR #9).
- **Lokales Supabase-Volume driftet:** nach neuen Migrationen `npx supabase db reset --local`.
- **Verdict ist Required Status Check** auf `main` — direkte Pushes bypassen ihn (Admin); PR-Weg nutzen, wenn das Gate greifen soll.
- **Prod-DB-Migrationen:** vor `db push` immer `migration list --linked`.
- **`ENCRYPTION_KEY` MUSS = `.dev.vars`/`.env`-Key**, sonst haengen Laeufe 0/N.
- **Push auf `main` = Prod-Deploy**; CI-Fail blockt Deploy lautlos → nach Push `gh run list --branch main`.
- **`persona_id null` heisst „Persona geloescht"** — Baseline nur ueber `isBaselineRun` (Lektion L1).
- **kit-sync:** Lock `~/.claude/dtb-lock.json` (Quelle `master@a7170e5`).
- **Natives `<datalist>`:** Browser rendert selbst (Tokens wirkungslos); Autofill-Historie → `autoComplete="off"`; Ersatz = Idee #6.

---

## Pausierte Themen

Keine.

---

## Handoff

**Naechster Befehl:** Weiterarbeit am Feature (Block 4: 3.4 Hero-Tests → 4.1 E2E → 4.2 PR) — davor Sichtpruefung `/dashboard` durch Damian (Schritt 2.3, `npm run dev`).
**Empfehlung:** Neue Session mit `/clear` starten, dann `/dtb:workflow-resume` (stellt Kontext her), danach obigen Befehl.
