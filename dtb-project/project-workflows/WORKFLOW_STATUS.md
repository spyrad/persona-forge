# Workflow-Status: persona-forge

**Letztes Update:** 2026-07-11
**Letzter Session-Log:** `dtb-project/project-changelog/2026-07/2026-07-11.md`

---

## Aktueller Stand

| Kennzahl              | Wert                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Laufende Arbeit**   | Keine offene Baustelle. **Design-Angleich KOMPLETT (A+B+C)** — PR #5/#6/#7 gemerged & deployt (`fb0f666`); App durchgehend englisch. |
| **Naechster Schritt** | `/10x-archive ci-review-agent` + PR #3–#7 als grüne Belege in `evidence.md` (Champion-Einreichung 10.08.).                           |
| **Blocker**           | Keine.                                                                                                                               |

---

## Offene Aufgaben

- [ ] **Change archivieren** — `/10x-archive ci-review-agent`; PR #3–#7 als grüne Live-Läufe in `evidence.md` nachtragen (PR #2 belegt rot). **Job-Logs verfallen ~07.10.**
- [ ] **Sammel-Einreichung Termin 2 (10.08.):** Builder + Architect (`context/architect-report.md`) + Champion (`context/changes/ci-review-agent/evidence.md`).
- [ ] **Optional: „Task-based evals" ins PRD** — steht auf der Landing als `planned`, nirgends spezifiziert.
- [ ] **Optional: Timeout im Scorer** — hängender z.ai-Call blockiert `ai-review` bis zum Job-Limit.
- [ ] **Optional: zweiter promptfoo-Provider** für Modellvergleich.
- [ ] **Geparkte Minors:** Live-Progress 0 Tokens; Generierungs-Fehler ohne Rep-Detail; DRY `tryParseJson`; Badge-Markup 4×; Banner rendert vor Ruler (missing-config); aria-hidden-Konvention Ruler-Träger; tabular-nums nur RunRunner (spec-gedeckt, Final-Review-Minor).

---

## Abgeschlossene Meilensteine (kompakt)

| Datum      | Meilenstein                                          | Ergebnis                                                                                                                       | Details                                       |
| ---------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| 2026-07-11 | **Design-Angleich Stufe B+C live — App einsprachig** | 6 Inseln editorial/EN, en-GB-Zeitformat, AuthCardHeader; 3 PRs à 10.0/10; E2E-Hydration-Fix; Final-Review 0 Critical/Important | `2026-07-11.md`, PR #5/#6/#7, Spec+Plan docs/ |
| 2026-07-10 | **Design-Angleich Stufe A (Chrome) live**            | AppLayout (Serif/Eyebrow/Ruler/page-enter, 6xl), 9 Seiten, Copy EN; ai-review 10.0/10                                          | `2026-07-10.md`, PR #4                        |
| 2026-07-09 | **Landing Page „Live Instrument" live**              | Canvas-Live-Simulation, 5 Sektionen, OEJTS-Attribution korrekt                                                                 | `2026-07-09.md` (S2), PR #3                   |
| 2026-07-09 | **CI-Review-Agent KOMPLETT + beide Gate-Richtungen** | LLM-PR-Reviewer live; rot: PR #2, grün: PR #3–#7                                                                               | `2026-07-09.md` (S1), `evidence.md`           |
| 2026-07-05 | **Zertifizierungs-Entscheidung: Champion**           | Alle 3 Badges zusammen bei Termin 2/3                                                                                          | `2026-07-05.md`                               |
| 2026-07-02 | **Feature: Standhaftigkeit (2. Test-Typ)**           | `kind`-Diskriminator; CI/Prod grün                                                                                             | `528d626`, `2026-07-02.md`                    |
| 2026-07-01 | **Modul-4 (10xArchitect) KOMPLETT**                  | 4/4 Artefakte + Report                                                                                                         | `context/architect-report.md`                 |

---

## Kurs-Standort (10xDevs)

Module 1–4 = **20/20 ✅**. **10xBuilder** + **10xArchitect** einreichbereit.
**10xChampion (Modul 5): Badge-Nachweis erbracht**, Lernmodul 3/5. Alle drei Badges
zusammen einreichen. Termine: 2. = **10.08.** · 3. = 14.09.

---

## Gotchas (Referenz)

- **Volles Lint lokal:** `npx eslint . --rule '{"prettier/prettier":"off"}'` (CRLF); nie Teilmengen linten.
- **`lint-staged` darf `package-lock.json` nicht anfassen.** Prettier zerlegt `astro`-Codefences in Markdown (→ `text`-Fence).
- **Squash-Merge:** danach `git reset --hard origin/main`, kein `git pull`.
- **Dev-SSR/Hydration:** „Invalid hook call" harmlos; kalter `.vite`-Cache bricht ersten Request ab; **Playwright-fill vor Insel-Hydration wird zurückgewischt** → `astro-island:not([ssr])`-Wait (in `auth.setup.ts`). Memory `persona-forge-dev-ssr-noise`.
- **Umlaut-Grep beweist keine Einsprachigkeit** — umlautfreies Deutsch (ThemeToggle) rutschte durch; Sichtprüfung nötig.
- **Lokales Supabase-Volume driftet:** nach neuen Migrationen `npx supabase db reset --local`, sonst fehlen Spalten.
- **Astro rendert `client:visible`-Inseln serverseitig mit** — Fallback braucht aktives Verstecken.
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
