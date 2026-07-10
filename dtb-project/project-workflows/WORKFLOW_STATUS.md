# Workflow-Status: persona-forge

**Letztes Update:** 2026-07-10
**Letzter Session-Log:** `dtb-project/project-changelog/2026-07/2026-07-10.md`

---

## Aktueller Stand

| Kennzahl              | Wert                                                                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Laufende Arbeit**   | Keine offene Baustelle. **Design-Angleich Stufe A gemerged** (PR #4, `9b17272`); Prod-Deploy-Run `29070452216` lief beim Checkpoint noch (Monitor aktiv). |
| **Naechster Schritt** | `/10x-archive ci-review-agent` + PR #3/#4 als grüne Belege in `evidence.md` (Champion-Einreichung 10.08.). Danach Design-Stufe B.                         |
| **Blocker**           | Keine.                                                                                                                                                    |

---

## Offene Aufgaben

- [ ] **Deploy-Run bestätigen** — `gh run list --branch main`; Run `29070452216` war bei Checkpoint `in_progress`.
- [ ] **Change archivieren** — `/10x-archive ci-review-agent`; PR #3 und PR #4 als grüne Live-Läufe in `evidence.md` nachtragen (PR #2 belegt rot). **Job-Logs verfallen ~07.10.**
- [ ] **Sammel-Einreichung Termin 2 (10.08.):** Builder + Architect (`context/architect-report.md`) + Champion (`context/changes/ci-review-agent/evidence.md`).
- [ ] **Design-Stufe B: Anzeige-Flächen** — `axis-chart.tsx`, `RunResult`, `RunComparison`, Karten-Rhythmus, `tabular-nums`. Erbt Vokabular aus `AppLayout`/Spec Stufe A.
- [ ] **Design-Stufe C: Arbeitsflächen** — `ModelConfigManager`, `PersonaCatalog`, `RunRunner` (Formulare, Listen, Empty States) + Englisch-Umstellung der Insel-Texte; dabei Auth-Header-Duplikat auflösen (`AuthCardHeader`).
- [ ] **Optional: „Task-based evals" ins PRD** — steht auf der Landing als `planned`, nirgends spezifiziert.
- [ ] **Optional: Timeout im Scorer** — hängender z.ai-Call blockiert `ai-review` bis zum Job-Limit.
- [ ] **Optional: zweiter promptfoo-Provider** für Modellvergleich.
- [ ] **Geparkte Minors:** Live-Progress 0 Tokens; Generierungs-Fehler ohne Rep-Detail; DRY `tryParseJson`; Badge-Markup 4×; Banner rendert vor Ruler (missing-config-Zustand); aria-hidden-Konvention Ruler-Träger.

---

## Abgeschlossene Meilensteine (kompakt)

| Datum      | Meilenstein                                          | Ergebnis                                                                                                                | Details                                    |
| ---------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| 2026-07-10 | **Design-Angleich Stufe A (Chrome) live**            | AppLayout (Serif/Eyebrow/Ruler/page-enter, 6xl), 9 Seiten umgestellt, Copy EN; Unit 198/198, E2E 4/4, ai-review 10.0/10 | `2026-07-10.md`, PR #4, Spec+Plan in docs/ |
| 2026-07-09 | **Landing Page „Live Instrument" live**              | Canvas-Live-Simulation, 5 Sektionen, OEJTS-Attribution korrekt                                                          | `2026-07-09.md` (S2), PR #3                |
| 2026-07-09 | **CI-Review-Agent KOMPLETT + beide Gate-Richtungen** | LLM-PR-Reviewer live; rot: PR #2, grün: PR #3 (und erneut PR #4)                                                        | `2026-07-09.md` (S1), `evidence.md`        |
| 2026-07-05 | **Zertifizierungs-Entscheidung: Champion**           | Alle 3 Badges zusammen bei Termin 2/3                                                                                   | `2026-07-05.md`                            |
| 2026-07-03 | **OEJTS-Lizenz korrigiert**                          | CC BY-NC-SA 4.0; im Landing-Footer ausgewiesen                                                                          | `docs/instruments/oejts-attribution.md`    |
| 2026-07-02 | **Feature: Standhaftigkeit (2. Test-Typ)**           | `kind`-Diskriminator; CI/Prod grün                                                                                      | `528d626`, `2026-07-02.md`                 |
| 2026-07-01 | **Modul-4 (10xArchitect) KOMPLETT**                  | 4/4 Artefakte + Report                                                                                                  | `context/architect-report.md`              |

---

## Kurs-Standort (10xDevs)

Module 1–4 = **20/20 ✅**. **10xBuilder** + **10xArchitect** einreichbereit.
**10xChampion (Modul 5): Badge-Nachweis erbracht**, Lernmodul 3/5. Alle drei Badges
zusammen einreichen. Termine: 2. = **10.08.** · 3. = 14.09.

---

## Gotchas (Referenz)

- **Volles Lint lokal:** `npx eslint . --rule '{"prettier/prettier":"off"}'` (CRLF); nie Teilmengen linten.
- **`lint-staged` darf `package-lock.json` nicht anfassen.** Prettier zerlegt außerdem `astro`-Codefences in Markdown-Docs (→ `text`-Fence nutzen).
- **Squash-Merge:** danach `git reset --hard origin/main`, kein `git pull`.
- **Dev-SSR-Rauschen ist pre-existing:** „Invalid hook call" im Dev-Log harmlos; erster Request nach kaltem `.vite`-Cache kann abbrechen → reload + main-Baseline, bevor der eigene Diff verdächtigt wird. Memory `persona-forge-dev-ssr-noise`.
- **Astro rendert `client:visible`-Inseln serverseitig mit** — Fallback braucht aktives Verstecken.
- **CSS-Reveal braucht JS-Gating** (`.js .reveal`); `page-enter` bewusst CSS-only ohne Gating.
- **z.ai:** kein `json_schema`, Coding-Key → `/coding/paas/v4`, `thinking:disabled` spart 3,4×. Memory `persona-forge-zai-provider`.
- **Verdict ist Required Status Check** auf `main` (`ai-review/verdict`, `enforce_admins: false`).
- **Prod-DB-Migrationen:** vor `db push` immer `migration list --linked`. Memory `persona-forge-migrations`.
- **`ENCRYPTION_KEY` MUSS = `.dev.vars`/`.env`-Key**, sonst hängen Läufe 0/N.
- **Push auf `main` = Prod-Deploy**; CI-Fail blockt Deploy lautlos → nach Push `gh run list --branch main`.

---

## Pausierte Themen

Keine.

---

## Session-Resume

Fuer neue Session: `/dtb:workflow-resume`
