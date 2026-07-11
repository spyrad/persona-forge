# Workflow-Status: persona-forge

**Letztes Update:** 2026-07-11
**Letzter Session-Log:** `dtb-project/project-changelog/2026-07/2026-07-11.md` (Session 3)

---

## Status (generiert aus Artefakten — nicht manuell editieren)

| Item          | Status (abgeleitet)   | Fortschritt | Naechster Schritt                                                  |
| ------------- | --------------------- | ----------- | ------------------------------------------------------------------ |
| Model Compare | In Arbeit (gestartet) | 0/17        | 1.1 Typen + Validierung (personaId optional, isBaselineRun-Helper) |

---

## Kontext (manuell)

| Kennzahl            | Wert                                                                                                                                                                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Laufende Arbeit** | Model Compare (Phase 1: Baseline-Läufe) — `features/model-compare/plan.md`                                                                                                                                                                    |
| **Blocker**         | Keine.                                                                                                                                                                                                                                        |
| **Notizen**         | Champion-Einreichung Termin 2 = **10.08.** bleibt inhaltliche Priorität VOR der Model-Compare-Umsetzung. Plan-Status: Reviewed (plan-review REVISE → 6 Entscheidungen eingearbeitet, ENTSCHEIDUNGSPUNKT nach Phase 3). `lessons.md` neu (L1). |

---

## Offene Aufgaben

- [ ] **Champion abschließen** — `/10x-archive ci-review-agent`; grüne Läufe PR #3–#7 in `evidence.md` (Run-IDs im Session-Log 2026-07-11 S2). **Job-Logs verfallen ~07.10.**
- [ ] **Sammel-Einreichung Termin 2 (10.08.):** Builder + Architect (`context/architect-report.md`) + Champion (`context/changes/ci-review-agent/evidence.md`).
- [ ] **Planungs-Artefakte committen** — 7 uncommittete Pfade (features/model-compare/, INBOX.md, lessons.md, BACKLOG.md, Changelog, Status).
- [ ] **Model Compare umsetzen** — `/dtb:feature-start`, Plan `features/model-compare/plan.md` (5 Phasen/17 Schritte).
- [ ] **Kit-Drift (optional):** `/dtb:kit-sync sync` — 4 Agents zeigen „Update verfügbar" ggü. `66c6f27`.
- [ ] **Ideen-Inbox:** #1 Task-based evals, #3 Test-Palette, #4 Dashboard-Visualisierung, #5 Live-Run-Visualisierung (alle Offen; `/dtb:idea-review`).
- [ ] **Geparkte Minors:** Live-Progress 0 Tokens; Generierungs-Fehler ohne Rep-Detail; DRY `tryParseJson`; Badge-Markup 4×; Banner rendert vor Ruler; aria-hidden Ruler-Träger; tabular-nums nur RunRunner.

---

## Abgeschlossene Meilensteine (kompakt)

| Datum      | Meilenstein                                        | Ergebnis                                                                                  | Details                                         |
| ---------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 2026-07-11 | Model Compare geplant (Discovery→Spec→Plan→Review) | Plan Reviewed, 5 Phasen/17 Schritte; Baseline-Läufe als tragende Entscheidung; Lektion L1 | `2026-07-11.md` (S3), `features/model-compare/` |
| 2026-07-11 | Design-Angleich Stufe B+C live — App einsprachig   | 6 Inseln editorial/EN, en-GB, AuthCardHeader; 3 PRs à 10.0/10                             | `2026-07-11.md` (S1), PR #5/#6/#7               |
| 2026-07-10 | Design-Angleich Stufe A (Chrome) live              | AppLayout, 9 Seiten, Copy EN; ai-review 10.0/10                                           | `2026-07-10.md`, PR #4                          |
| 2026-07-09 | Landing „Live Instrument" live                     | Canvas-Simulation, 5 Sektionen, OEJTS-Attribution                                         | `2026-07-09.md` (S2), PR #3                     |
| 2026-07-09 | CI-Review-Agent KOMPLETT + beide Gate-Richtungen   | rot: PR #2, grün: PR #3–#7                                                                | `2026-07-09.md` (S1), `evidence.md`             |
| 2026-07-05 | Zertifizierungs-Entscheidung: Champion             | Alle 3 Badges zusammen bei Termin 2/3                                                     | `2026-07-05.md`                                 |
| 2026-07-02 | Feature: Standhaftigkeit (2. Test-Typ)             | `kind`-Diskriminator; CI/Prod grün                                                        | `528d626`, `2026-07-02.md`                      |
| 2026-07-01 | Modul-4 (10xArchitect) KOMPLETT                    | 4/4 Artefakte + Report                                                                    | `context/architect-report.md`                   |

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
- **Dev-SSR/Hydration:** „Invalid hook call" harmlos; Playwright-fill vor Insel-Hydration wird zurückgewischt → `astro-island:not([ssr])`-Wait. Memory `persona-forge-dev-ssr-noise`.
- **Umlaut-Grep beweist keine Einsprachigkeit** — Sichtprüfung nötig.
- **Lokales Supabase-Volume driftet:** nach neuen Migrationen `npx supabase db reset --local`.
- **Astro rendert `client:visible`-Inseln serverseitig mit** — Fallback braucht aktives Verstecken.
- **z.ai:** kein `json_schema`, Coding-Key → `/coding/paas/v4`, `thinking:disabled` spart 3,4×; Verhalten bei leerem System-Prompt ungeklärt → Provider-Spike in Plan-Schritt 1.2. Memory `persona-forge-zai-provider`.
- **Verdict ist Required Status Check** auf `main` (`ai-review/verdict`, `enforce_admins: false`).
- **Prod-DB-Migrationen:** vor `db push` immer `migration list --linked`. Memory `persona-forge-migrations`.
- **`ENCRYPTION_KEY` MUSS = `.dev.vars`/`.env`-Key**, sonst hängen Läufe 0/N.
- **Push auf `main` = Prod-Deploy**; CI-Fail blockt Deploy lautlos → nach Push `gh run list --branch main`.
- **kit-sync:** Maschinen-Ebene; Lock `~/.claude/dtb-lock.json` (Quelle `master@66c6f27`). Nach Kit-Updates `/dtb:kit-sync check`.
- **`persona_id null` heißt „Persona gelöscht", nicht „ohne Persona"** — Baseline-Erkennung nur über `isBaselineRun` (null + leerer Snapshot). Lektion L1 in `project-rules/lessons.md`.

---

## Pausierte Themen

Keine.

---

## Handoff

**Naechster Befehl:** `/10x-archive ci-review-agent` (Champion abschließen, Priorität vor Umsetzung) — danach `/dtb:feature-start` für Model Compare (Schritt 1.1).
**Empfehlung:** Neue Session mit `/clear` starten, dann `/dtb:workflow-resume` (stellt Kontext her), danach obigen Befehl.
