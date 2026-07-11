# Workflow-Status: persona-forge

**Letztes Update:** 2026-07-11
**Letzter Session-Log:** `dtb-project/project-changelog/2026-07/2026-07-11.md` (Session 4)

---

## Status (generiert aus Artefakten — nicht manuell editieren)

| Item          | Status (abgeleitet) | Fortschritt | Naechster Schritt                                                           |
| ------------- | ------------------- | ----------- | --------------------------------------------------------------------------- |
| Model Compare | In Arbeit           | 10/17       | 1.4 Baseline-Daten fahren (Damian, läuft) → dann ENTSCHEIDUNGSPUNKT Phase 4 |

---

## Kontext (manuell)

| Kennzahl            | Wert                                                                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Laufende Arbeit** | Model Compare: Phasen 1–3 gebaut & deployt (4 Commits `53c5a00`…`048dcb5`, CI grün; letzter Lauf `29158760646` beim Checkpoint in progress). Profil-Seite `/models/profile?m=` live. |
| **Blocker**         | Keine. Sichtprüfung + Entscheidungspunkt warten auf Baseline-Läufe (1.4).                                                                                                            |
| **Notizen**         | Champion-Einreichung Termin 2 = **10.08.** weiter offen. Direkte `main`-Pushes bypassen das Verdict-Gate — für Phase 4 ggf. PR-Weg.                                                  |

---

## Offene Aufgaben

- [ ] **1.4 Baseline-Läufe** — je Modell ≥ 5 Reps via „No persona (baseline)" (Damian, parallel gestartet).
- [ ] **Sichtprüfung + ENTSCHEIDUNGSPUNKT Phase 4** — Profil mit echten Daten (Light+Dark); dann Entscheidung Compare bauen: ja/anders/später.
- [ ] **Champion abschließen** — `/10x-archive ci-review-agent`; grüne Läufe PR #3–#7 in `evidence.md` (Run-IDs im Log 2026-07-11 S2). **Job-Logs verfallen ~07.10.**
- [ ] **Sammel-Einreichung Termin 2 (10.08.):** Builder + Architect + Champion.
- [ ] **Kit-Drift (optional):** `/dtb:kit-sync sync` — 4 Agents „Update verfügbar" ggü. `66c6f27`.
- [ ] **Ideen-Inbox:** #1 Task-based evals, #3 Test-Palette, #4 Dashboard-Visualisierung, #5 Live-Run-Visualisierung (alle Offen).
- [ ] **Geparkte Minors:** Live-Progress 0 Tokens; Generierungs-Fehler ohne Rep-Detail; DRY `tryParseJson`; Badge-Markup 4×; Banner rendert vor Ruler; aria-hidden Ruler-Träger; tabular-nums nur RunRunner; Actions Node-20-Deprecation (`actions/*@v5`).

---

## Abgeschlossene Meilensteine (kompakt)

| Datum      | Meilenstein                                          | Ergebnis                                                                                    | Details                                                |
| ---------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 2026-07-11 | Model Compare Phasen 1–3 live                        | Baseline-Läufe + model-profiles-Service + Profil-Seite; 215 Unit-/80 Integration-Tests grün | `2026-07-11.md` (S4), `features/model-compare/plan.md` |
| 2026-07-11 | Model Compare geplant (Discovery→Spec→Plan→Review)   | Plan Reviewed, 5 Phasen/17 Schritte; Lektion L1                                             | `2026-07-11.md` (S3), `features/model-compare/`        |
| 2026-07-11 | Design-Angleich Stufe B+C live — App einsprachig     | 6 Inseln editorial/EN; 3 PRs à 10.0/10                                                      | `2026-07-11.md` (S1), PR #5/#6/#7                      |
| 2026-07-10 | Design-Angleich Stufe A (Chrome) live                | AppLayout, 9 Seiten, Copy EN                                                                | `2026-07-10.md`, PR #4                                 |
| 2026-07-09 | Landing „Live Instrument" + CI-Review-Agent komplett | PR #3; Gate beide Richtungen belegt                                                         | `2026-07-09.md`, `evidence.md`                         |
| 2026-07-05 | Zertifizierungs-Entscheidung: Champion               | Alle 3 Badges zusammen bei Termin 2/3                                                       | `2026-07-05.md`                                        |
| 2026-07-02 | Feature: Standhaftigkeit (2. Test-Typ)               | `kind`-Diskriminator; CI/Prod grün                                                          | `528d626`, `2026-07-02.md`                             |

---

## Kurs-Standort (10xDevs)

Module 1–4 = **20/20 ✅**. **10xBuilder** + **10xArchitect** einreichbereit.
**10xChampion (Modul 5): Badge-Nachweis erbracht**, Lernmodul 3/5. Termine: 2. = **10.08.** · 3. = 14.09.

---

## Gotchas (Referenz)

- **Volles Lint lokal:** `npx eslint . --rule '{"prettier/prettier":"off"}'` (CRLF); nie Teilmengen linten.
- **`lint-staged` darf `package-lock.json` nicht anfassen.** Prettier zerlegt `astro`-Codefences in Markdown.
- **Squash-Merge:** danach `git reset --hard origin/main`, kein `git pull`.
- **Dev-SSR/Hydration:** „Invalid hook call" harmlos; Playwright-fill vor Hydration → `astro-island:not([ssr])`-Wait. Memory `persona-forge-dev-ssr-noise`.
- **Umlaut-Grep beweist keine Einsprachigkeit** — Sichtprüfung nötig.
- **Lokales Supabase-Volume driftet:** nach neuen Migrationen `npx supabase db reset --local`.
- **z.ai:** kein `json_schema`, Coding-Key → `/coding/paas/v4`; leere System-Message wird seit `53c5a00` weggelassen statt gesendet. Memory `persona-forge-zai-provider`.
- **Verdict ist Required Status Check** auf `main` — **direkte Pushes bypassen ihn** (Admin); PR-Weg nutzen, wenn das Gate greifen soll.
- **Prod-DB-Migrationen:** vor `db push` immer `migration list --linked`. Memory `persona-forge-migrations`.
- **`ENCRYPTION_KEY` MUSS = `.dev.vars`/`.env`-Key**, sonst hängen Läufe 0/N.
- **Push auf `main` = Prod-Deploy**; CI-Fail blockt Deploy lautlos → nach Push `gh run list --branch main`.
- **`persona_id null` heißt „Persona gelöscht", nicht „ohne Persona"** — Baseline nur über `isBaselineRun` (Lektion L1); Alt-Läufe zählen im Profil als „persona runs excluded".
- **kit-sync:** Lock `~/.claude/dtb-lock.json` (Quelle `master@66c6f27`).

---

## Pausierte Themen

Keine.

---

## Handoff

**Naechster Befehl:** Weiterarbeit im Plan `features/model-compare/plan.md` — 1.4 Baseline-Läufe abschließen, dann Sichtprüfung + ENTSCHEIDUNGSPUNKT Phase 4 (Compare).
**Empfehlung:** Neue Session mit `/clear` starten, dann `/dtb:workflow-resume` (stellt Kontext her), danach obigen Befehl.
