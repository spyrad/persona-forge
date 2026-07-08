# Workflow-Status: persona-forge

**Letztes Update:** 2026-07-08 (Session 1)
**Letzter Session-Log:** `dtb-project/project-changelog/2026-07/2026-07-08.md`

---

## Aktueller Stand

| Kennzahl              | Wert                                                                                                                                                                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Laufende Arbeit**   | **Modul 5 (Champion-Pfad, ~3/5).** SDK **bestätigt: Vercel AI SDK 6** (assemble). s05e01–e03 durchgearbeitet. CI-Review-Agent ist planungsreif — Blueprint = Referenz-`requirements.md` aus s05e03 (PR-Titel+Body+Diff → 6 Kriterien → Kommentar+Labels). |
| **Naechster Schritt** | **`/10x-new` für Change „CI-Review-Agent"** (+ `requirements.md`) → `/10x-research` → `/10x-plan`. Optional vorab die 5–6 Review-Kriterien festlegen (Aufgabe 1). Deadline-Anker: Termin 2 = 10.08.                                                       |
| **Blocker**           | Keine.                                                                                                                                                                                                                                                    |

---

## Offene Aufgaben

- [ ] **`/10x-new` „CI-Review-Agent"** — lokale Erstversion `git diff | npx tsx review.ts` → JSON (5–6 Kriterien 1–10 + Verdict), dann CI + Human-in-the-Loop. Vercel `ToolLoopAgent` als Scorer (`Output.object`), Kosten-Bramka `stopWhen: stepCountIs(N)`.
- [ ] **Review-Kriterien (Aufgabe 1)** festlegen — 5–6 Dimensionen, je „1"- und „10"-Zustand; Input für `requirements.md`.
- [ ] **promptfoo-Regressions-Gate** — z.ai/GLM + 1–2 Modelle via OpenRouter, 1 komplexer Diff mit bekannten Fehlern; Asserts `is-json`/`llm-rubric`/`javascript`.
- [ ] **Champion-Beweise (L3)** — Pipeline-View, Job-Logs, PR-Kommentar sammeln.
- [ ] **Sammel-Einreichung Termin 2 (10.08.) oder 3 (14.09.):** Builder + Architect (`context/architect-report.md`, fertig) + Champion — zusammen, kein Nachreichen.
- [ ] **Optional:** CI-Review-Agent in `BACKLOG.md`; README/BACKLOG um „Standhaftigkeit" ergänzen; Repo-LICENSE (SA-Pflicht OEJTS beachten).
- [ ] **Geparkte Minors (SDD-Ledger):** Live-Progress 0 Tokens während Runden; Generierungs-Fehler ohne Rep-Detail; DRY-Duplikat `tryParseJson`.

---

## Abgeschlossene Meilensteine (kompakt)

| Datum      | Meilenstein                                | Ergebnis                                                                                              | Details                                                  |
| ---------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 2026-07-08 | **SDK entschieden + s05e03 quergelesen**   | Vercel AI SDK 6 (assemble) bestätigt; CI-/HITL-Muster + Champion-Beweis-Struktur geklärt              | `2026-07-08.md` (S1)                                     |
| 2026-07-06 | **Modul 5 gestartet: s05e01 + s05e02**     | Opportunity Map → CI-Review-Agent als Kandidat; SDK-Empfehlung Vercel AI SDK 6                        | `context/team/opportunity-map.md`, `2026-07-06.md` (S1)  |
| 2026-07-05 | **Zertifizierungs-Entscheidung: Champion** | Termin 1 (5.07.) ausgelassen; alle 3 Badges zusammen bei Termin 2/3. Modul 5 als Fokus                | `2026-07-05.md` (S1)                                     |
| 2026-07-03 | **OEJTS-Lizenz korrigiert + dokumentiert** | Quelle verifiziert: **CC BY-NC-SA 4.0**, nicht gemeinfrei. Attributions-Doku + Fixes in 5 Docs        | `docs/instruments/oejts-attribution.md`, `2026-07-03.md` |
| 2026-07-02 | **Feature: Standhaftigkeit (2. Test-Typ)** | `kind`-Diskriminator; Prüfling×Gegenspieler; Score+Breakdown. 11 SDD-Tasks, Opus-Review, CI/Prod grün | `64b7bf6`→`528d626`, `2026-07-02.md` (S3)                |
| 2026-07-01 | **Modul-4 (10xArchitect) KOMPLETT**        | 4/4 Artefakte + Architektur-Report (PL, einreichbereit)                                               | `context/architect-report.md`                            |

---

## Kurs-Standort (10xDevs)

Module 1–4 = **20/20 ✅**. **10xBuilder** (M1–3) + **10xArchitect** (M3–4) einreichbereit.
**10xChampion** = Modul 5 (Team-AI + CI/CD) → **~3/5** (s05e01–e03 gelesen, Bau steht aus).
Champion-Beweis: **ein** Projekt reicht — CI-Review-Pipeline (L2+L3) _oder_ Shared AI Registry (L4).
Termine: 1. = 5.07. (ausgelassen) · **2. = 10.08.** · 3. (final) = 14.09.

---

## Gotchas (Referenz)

- **SDK entschieden = Vercel AI SDK 6** (assemble). Kosten-Achse: nicht SDK vs. API, sondern Plan/Auth. Vercel + **z.ai Coding-Plan** (`/coding/paas/v4`, Flat) = keine Per-Token-Kosten; Claude Agent SDK könnte Max-Subscription nutzen (CI-Limits/Terms prüfen). CI-Bramka: `stopWhen: stepCountIs(N)`, nie `isLoopFinished()` ohne Limit.
- **s05e03-Bauplan:** Composite Action (`using: composite`, `@<sha>` pinnen), `checkout` braucht `fetch-depth: 0` für `git diff`, Kriterien getrennt von Mechanik (`10x-impl-review-ci`), promptfoo als Regressions-Gate.
- **z.ai:** Coding-Plan-Key braucht `api.z.ai/api/coding/paas/v4` (sonst 429) → im AI SDK Custom-Provider/`baseURL`; GLM via `thinking:disabled` aus. Memory `persona-forge-zai-provider`.
- **Prod-DB-Migrationen:** vor `db push` immer `migration list --linked`, ggf. `migration repair --status applied`. Auto-Mode blockt Prod-DB → per `!`. Memory `persona-forge-migrations`.
- **OEJTS = CC BY-NC-SA 4.0**, nicht gemeinfrei — Attribution `docs/instruments/oejts-attribution.md`.
- **`ENCRYPTION_KEY` MUSS = `.dev.vars`/`.env`-Key** (Prod+Dev teilen DB `lccaundrniuievkmusko`), sonst Läufe hängen 0/N.
- **Push auf `main` = Prod-Deploy** (Auto-Mode blockt `git push` → per `!`); CI-Fail blockt Deploy lautlos → nach Push CI per REST prüfen (`branch=main`).
- **`gh` CLI installiert** (winget), auth `spyrad` (`repo`-Scope).

---

## Pausierte Themen

Keine.

---

## Session-Resume

Fuer neue Session: `/dtb:workflow-resume`
