# Workflow-Status: persona-forge

**Letztes Update:** 2026-07-14
**Letzter Session-Log:** `dtb-project/project-changelog/2026-07/2026-07-14.md` (Session 3)

---

## Status (generiert aus Artefakten — nicht manuell editieren)

| Item                | Status (abgeleitet) | Fortschritt | Naechster Schritt                      |
| ------------------- | ------------------- | ----------- | -------------------------------------- |
| _kein aktives Item_ | —                   | —           | Neues Feature via `/dtb:feature-start` |

---

## Kontext (manuell)

| Kennzahl            | Wert                                                                                                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Laufende Arbeit** | Kein aktives Feature. Model Compare ist abgenommen und archiviert (`archive/model-compare/`, 2026-07-14).                                                                  |
| **Blocker**         | Keine.                                                                                                                                                                     |
| **Notizen**         | Champion-Einreichung Termin 2 = **10.08.**. PR #8/#9/#10 sind frische Verdict-Gate-Belege für `evidence.md`. Repo aufgeräumt: nur noch `main`; `.superpowers/` gitignored. |

---

## Offene Aufgaben

- [ ] **Neues Feature starten** — `/dtb:feature-start` (Ideen-Inbox #1/#3/#4/#5).
- [ ] **Champion abschließen** — `/10x-archive ci-review-agent`; grüne Läufe PR #3–#10 in `evidence.md`. **Job-Logs verfallen ~07.10.**
- [ ] **Sammel-Einreichung Termin 2 (10.08.):** Builder + Architect + Champion.
- [ ] **Kit-Drift (optional):** `/dtb:kit-sync sync` — 4 Agents „Update verfügbar" ggü. `66c6f27`.
- [ ] **Ideen-Inbox:** #1 Task-based evals, #3 Test-Palette, #4 Dashboard-Visualisierung, #5 Live-Run-Visualisierung (alle Offen).
- [ ] **Geparkte Minors:** Connection-Test-Fallback bei 401 (Entscheidung offen); Picker `client:load`→`client:visible` (Finding PR #8); Live-Progress 0 Tokens; Generierungs-Fehler ohne Rep-Detail; DRY `tryParseJson`; Badge-Markup 4×; Banner rendert vor Ruler; aria-hidden Ruler-Träger; tabular-nums nur RunRunner; Actions Node-20-Deprecation (`actions/*@v5`).

---

## Abgeschlossene Meilensteine (kompakt)

| Datum      | Meilenstein                                          | Ergebnis                                                                                       | Details                                               |
| ---------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 2026-07-14 | **Model Compare fertig (17/17)** — Phase 5 live      | PR #10 (10.0/10) gemergt `19a8e8c`; Prod-Sichtprüfung bestanden; E2E 5/5 + 225 Unit-Tests grün | `2026-07-14.md` (S1), `archive/model-compare/plan.md` |
| 2026-07-13 | Model Compare Phase 4 live (Compare 2–4 Modelle)     | PR #8 (9.5/10) + Farb-Fix PR #9 (10.0/10); Prod-Sichtprüfung komplett                          | `2026-07-13.md` (S1), `archive/model-compare/plan.md` |
| 2026-07-11 | Model Compare Phasen 1–3 live                        | Baseline-Läufe + model-profiles-Service + Profil-Seite                                         | `2026-07-11.md` (S4), `archive/model-compare/plan.md` |
| 2026-07-11 | Model Compare geplant (Discovery→Spec→Plan→Review)   | Plan Reviewed, 5 Phasen/17 Schritte; Lektion L1                                                | `2026-07-11.md` (S3), `archive/model-compare/`        |
| 2026-07-11 | Design-Angleich Stufe B+C live — App einsprachig     | 6 Inseln editorial/EN; 3 PRs à 10.0/10                                                         | `2026-07-11.md` (S1), PR #5/#6/#7                     |
| 2026-07-10 | Design-Angleich Stufe A (Chrome) live                | AppLayout, 9 Seiten, Copy EN                                                                   | `2026-07-10.md`, PR #4                                |
| 2026-07-09 | Landing „Live Instrument" + CI-Review-Agent komplett | PR #3; Gate beide Richtungen belegt                                                            | `2026-07-09.md`, `evidence.md`                        |
| 2026-07-05 | Zertifizierungs-Entscheidung: Champion               | Alle 3 Badges zusammen bei Termin 2/3                                                          | `2026-07-05.md`                                       |

---

## Kurs-Standort (10xDevs)

Module 1–4 = **20/20 ✅**. **10xBuilder** + **10xArchitect** einreichbereit.
**10xChampion (Modul 5): Badge-Nachweis erbracht**, Lernmodul 3/5. Termine: 2. = **10.08.** · 3. = 14.09.

---

## Gotchas (Referenz)

- **Volles Lint lokal:** `npx eslint . --rule '{"prettier/prettier":"off"}'` (CRLF); nie Teilmengen linten.
- **`lint-staged` darf `package-lock.json` nicht anfassen.** Prettier zerlegt `astro`-Codefences in Markdown.
- **Squash-Merge:** danach `git reset --hard origin/main`, kein `git pull`.
- **E2E braucht Docker + lokales Supabase** (`npx supabase start`); Baseline-Daten kommen per DB-Insert (`tests/e2e/support/seed.ts`) — ein echter Lauf wären N LLM-Calls. Seed-Client meldet sich mit den Credentials aus `playwright/.auth/` als derselbe User an (sonst RLS-unsichtbar).
- **Dev-SSR/Hydration:** „Invalid hook call" harmlos; Playwright-fill vor Hydration → `astro-island:not([ssr])`-Wait. Memory `persona-forge-dev-ssr-noise`.
- **Connection-Test ≠ Lauf-Pfad:** Test probt `GET /models` (Bearer) — Anthropic-Compat deckt nur `/chat/completions` → 401 trotz korrekter Config. Memory `persona-forge-zai-provider`.
- **Anthropic via OpenAI-Compat:** `https://api.anthropic.com/v1` + exakte Modell-IDs ohne Datums-Suffix (`claude-sonnet-5`, `claude-opus-4-8`, `claude-haiku-4-5`).
- **Chart-Serien-Farben:** `chart-1..4` = Teal/Amber/Blau/Pink (CVD-validiert, PR #9); chart-3/4 nutzt nur `ModelComparison`.
- **Lokales Supabase-Volume driftet:** nach neuen Migrationen `npx supabase db reset --local`.
- **Verdict ist Required Status Check** auf `main` — **direkte Pushes bypassen ihn** (Admin); PR-Weg nutzen, wenn das Gate greifen soll.
- **Prod-DB-Migrationen:** vor `db push` immer `migration list --linked`. Memory `persona-forge-migrations`.
- **`ENCRYPTION_KEY` MUSS = `.dev.vars`/`.env`-Key**, sonst hängen Läufe 0/N.
- **Push auf `main` = Prod-Deploy**; CI-Fail blockt Deploy lautlos → nach Push `gh run list --branch main`.
- **`persona_id null` heißt „Persona gelöscht", nicht „ohne Persona"** — Baseline nur über `isBaselineRun` (Lektion L1).
- **kit-sync:** Lock `~/.claude/dtb-lock.json` (Quelle `master@66c6f27`).

---

## Pausierte Themen

Keine.

---

## Handoff

**Naechster Befehl:** `/10x-archive ci-review-agent` (Champion-Nachweis, zeitkritisch: Job-Logs verfallen ~07.10.) — danach `/dtb:feature-start` für das nächste Feature aus der Ideen-Inbox.
**Empfehlung:** Neue Session mit `/clear` starten, dann `/dtb:workflow-resume` (stellt Kontext her), danach obigen Befehl.
