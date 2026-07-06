# Workflow-Status: persona-forge

**Letztes Update:** 2026-07-06 (Session 1)
**Letzter Session-Log:** `dtb-project/project-changelog/2026-07/2026-07-06.md`

---

## Aktueller Stand

| Kennzahl              | Wert                                                                                                                                                                                                                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Laufende Arbeit**   | **Modul 5 gestartet (Champion-Pfad, ~2/5).** s05e01 durchgearbeitet → Opportunity Map (`context/team/opportunity-map.md`); Kandidat = **CI-Review-Agent** (10xChampion-Projekt a). s05e02 gelesen → SDK-Empfehlung **Vercel AI SDK 6** (noch zu bestätigen). Praktischer Teil = Bau des Review-Agenten, startet mit `/10x-new`. |
| **Naechster Schritt** | SDK bestätigen; dann **s05e03 querlesen** (CI-Verdrahtung + HITL, produziert Champion-Beweise) **oder direkt `/10x-new`** für Change „CI-Review-Agent". Deadline-Anker: Termin 2 = 10.08.                                                                                                                                       |
| **Blocker**           | Keine.                                                                                                                                                                                                                                                                                                                          |

---

## Offene Aufgaben

- [ ] **SDK final bestätigen** — Vercel AI SDK 6 (empfohlen, assemble/Modell-Frei) vs. Claude Agent SDK (fertiges `total_cost_usd`+`maxBudgetUsd`). Kontext: `2026-07-06.md`.
- [ ] **CI-Review-Agent bauen (Modul 5, L2+L3):** lokale Version `git diff | npx tsx review.ts` → JSON (5 Kriterien 1–10 + pass/fail + Summary), dann Verdrahtung in GitHub Actions + Human-in-the-Loop. Champion-Beweise (Pipeline-View, Logs, PR-Screenshot) entstehen in L3.
- [ ] **Restliche Modul-5-Lektionen:** s05e03 Review in CI/CD → s05e04 Shared AI Registry → s05e05 Async/Remote Agents.
- [ ] **Sammel-Einreichung Termin 2 (10.08.) oder 3 (14.09.):** Builder + Architect (`context/architect-report.md`, fertig) + Champion — alles ZUSAMMEN, kein Nachreichen.
- [ ] **Optional:** CI-Review-Agent als Feature in `BACKLOG.md` aufnehmen; README/BACKLOG um „Standhaftigkeit" ergänzen; Repo-LICENSE erwägen (SA-Pflicht des OEJTS-Teils beachten).
- [ ] **Geparkte Minors (SDD-Ledger, kein Blocker):** Live-Progress 0 Tokens während Runden; Generierungs-Fehler ohne Rep-Detail; DRY-Duplikat `tryParseJson`.

---

## Abgeschlossene Meilensteine (kompakt)

| Datum      | Meilenstein                                | Ergebnis                                                                                              | Details                                                  |
| ---------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 2026-07-06 | **Modul 5 gestartet: s05e01 + s05e02**     | Opportunity Map erstellt → CI-Review-Agent als Kandidat; SDK-Empfehlung Vercel AI SDK 6               | `context/team/opportunity-map.md`, `2026-07-06.md` (S1)  |
| 2026-07-05 | **Zertifizierungs-Entscheidung: Champion** | Termin 1 (5.07.) ausgelassen; alle 3 Badges zusammen bei Termin 2/3. Modul 5 als Fokus                | `2026-07-05.md` (S1)                                     |
| 2026-07-03 | **OEJTS-Lizenz korrigiert + dokumentiert** | Quelle verifiziert: **CC BY-NC-SA 4.0**, nicht gemeinfrei. Attributions-Doku + Fixes in 5 Docs        | `docs/instruments/oejts-attribution.md`, `2026-07-03.md` |
| 2026-07-02 | **Feature: Standhaftigkeit (2. Test-Typ)** | `kind`-Diskriminator; Prüfling×Gegenspieler; Score+Breakdown. 11 SDD-Tasks, Opus-Review, CI/Prod grün | `64b7bf6`→`528d626`, `2026-07-02.md` (S3)                |
| 2026-07-01 | **Modul-4 (10xArchitect) KOMPLETT**        | 4/4 Artefakte + Architektur-Report (PL, einreichbereit)                                               | `context/architect-report.md`                            |
| 2026-06-25 | **Test-Rollout KOMPLETT**                  | `ci`+`integration`-CI-Gate; E2E-Lernschicht                                                           | `1b2c0ac`→`b6c7589`, `2026-06-25.md`                     |

---

## Kurs-Standort (10xDevs)

Module 1–4 = **20/20 ✅**. **10xBuilder** (M1–3) + **10xArchitect** (M3–4) einreichbereit.
**10xChampion** = Modul 5 (Team-AI + CI/CD) → **~2/5** (s05e01+e02 gelesen, Bau steht aus).
Champion-Beweis: **ein** Projekt reicht — CI-Review-Pipeline (L2+L3) _oder_ Shared AI Registry (L4).
Termine: 1. = 5.07. (ausgelassen) · **2. = 10.08.** · 3. (final) = 14.09.

---

## Gotchas (Referenz)

- **SDK-Wahl:** fertiger Agent (Claude/Codex/Cursor SDK) vs. assemble (Vercel AI SDK 6, OpenRouter). CI braucht expliziten Key. CLAUDE.md gezielt via `readFileSync`→`instructions` einspeisen, nicht auto-laden. Lektion `s05e02`.
- **z.ai:** Coding-Plan-Key braucht `api.z.ai/api/coding/paas/v4` (sonst 429) → im AI SDK Custom-Provider/`baseURL`; GLM via `thinking:disabled` aus. Memory `persona-forge-zai-provider`.
- **Prod-DB-Migrationen:** Remote-Historie driftet — vor `db push` immer `migration list --linked`, ggf. `migration repair --status applied`. Auto-Mode blockt Prod-DB → per `!`. Memory `persona-forge-migrations`.
- **OEJTS = CC BY-NC-SA 4.0**, nicht gemeinfrei — Attribution `docs/instruments/oejts-attribution.md`. NC blockt Monetarisierung; SA bindet abgeleiteten Item-Satz.
- **`ENCRYPTION_KEY` MUSS = `.dev.vars`/`.env`-Key** (Prod+Dev teilen DB `lccaundrniuievkmusko`), sonst Läufe hängen 0/N.
- **Push auf `main` = Prod-Deploy** (Auto-Mode blockt `git push` → per `!`); CI-Fail blockt Deploy lautlos → nach Push CI per REST prüfen (`branch=main`).
- **`gh` CLI installiert** (winget), auth `spyrad` (`repo`-Scope).

---

## Pausierte Themen

Keine.

---

## Session-Resume

Fuer neue Session: `/dtb:workflow-resume`
