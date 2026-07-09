# Workflow-Status: persona-forge

**Letztes Update:** 2026-07-09 (Session 1)
**Letzter Session-Log:** `dtb-project/project-changelog/2026-07/2026-07-09.md`

---

## Aktueller Stand

| Kennzahl              | Wert                                                                                                                                                                                                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Laufende Arbeit**   | **Modul 5 (Champion) — Bau abgeschlossen.** Change `ci-review-agent` `status: implemented`, alle 4 Phasen verifiziert, auf `main` deployt (`d4344f9`). Reviewer ist scharf: nächster PR gegen `main` bekommt Scorecard, Label und Commit-Status; rotes Verdict sperrt den Merge. |
| **Naechster Schritt** | **`/10x-archive ci-review-agent`**, dann Champion-Einreichung zusammen mit Builder + Architect. Deadline-Anker: Termin 2 = **10.08.**                                                                                                                                            |
| **Blocker**           | Keine.                                                                                                                                                                                                                                                                           |

---

## Offene Aufgaben

- [ ] **Change archivieren** — `/10x-archive ci-review-agent` (Status `implemented`, Belege in `evidence.md`).
- [ ] **Sammel-Einreichung Termin 2 (10.08.) oder 3 (14.09.):** Builder + Architect (`context/architect-report.md`, fertig) + Champion (`context/changes/ci-review-agent/evidence.md`) — zusammen, kein Nachreichen. **Job-Logs verfallen ~07.10.** (90-Tage-Retention); PR-Kommentar bleibt dauerhaft.
- [ ] **Optional: Timeout im Scorer** — ein hängender z.ai-Call blockiert den `ai-review`-Job bis zum Job-Limit (bewusst offen gelassen).
- [ ] **Optional: zweiter promptfoo-Provider** für einen Modellvergleich (OpenRouter/Anthropic-Key nötig; zwei Zeilen in `promptfooconfig.yaml`).
- [ ] **Geparkte Minors (SDD-Ledger):** Live-Progress 0 Tokens während Runden; Generierungs-Fehler ohne Rep-Detail; DRY-Duplikat `tryParseJson`.

---

## Abgeschlossene Meilensteine (kompakt)

| Datum      | Meilenstein                                           | Ergebnis                                                                                                                                        | Details                                                  |
| ---------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 2026-07-09 | **CI-Review-Agent KOMPLETT (4 Phasen) + Prod-Deploy** | LLM-PR-Reviewer live; Merge-Gate über Required Status Check. Findings statt Noten; 7 von 18 Regeln deterministisch im Code. E2E an PR #2 belegt | `2026-07-09.md`, `evidence.md`, `d4344f9`                |
| 2026-07-08 | **Change `ci-review-agent` + `/10x-research`**        | Change eröffnet; 3-Agent-Research → `research.md`. SDK-Frage geerdet neu geöffnet; Kriterien-Kern isoliert                                      | `2026-07-08.md` (S2), `context/changes/ci-review-agent/` |
| 2026-07-08 | **SDK entschieden + s05e03 quergelesen**              | Vercel AI SDK 6 (assemble) — jetzt durch Research wieder in Prüfung; CI-/HITL-Muster geklärt                                                    | `2026-07-08.md` (S1)                                     |
| 2026-07-06 | **Modul 5 gestartet: s05e01 + s05e02**                | Opportunity Map → CI-Review-Agent als Kandidat                                                                                                  | `context/team/opportunity-map.md`, `2026-07-06.md`       |
| 2026-07-05 | **Zertifizierungs-Entscheidung: Champion**            | Termin 1 ausgelassen; alle 3 Badges zusammen bei Termin 2/3                                                                                     | `2026-07-05.md`                                          |
| 2026-07-03 | **OEJTS-Lizenz korrigiert**                           | CC BY-NC-SA 4.0, nicht gemeinfrei; Attributions-Doku                                                                                            | `docs/instruments/oejts-attribution.md`                  |
| 2026-07-02 | **Feature: Standhaftigkeit (2. Test-Typ)**            | `kind`-Diskriminator; Prüfling×Gegenspieler; CI/Prod grün                                                                                       | `528d626`, `2026-07-02.md`                               |
| 2026-07-01 | **Modul-4 (10xArchitect) KOMPLETT**                   | 4/4 Artefakte + Architektur-Report (einreichbereit)                                                                                             | `context/architect-report.md`                            |

---

## Kurs-Standort (10xDevs)

Module 1–4 = **20/20 ✅**. **10xBuilder** (M1–3) + **10xArchitect** (M3–4) einreichbereit.
**10xChampion** = Modul 5 → **Bau fertig**: CI-Review-Pipeline gebaut, verifiziert, deployt (L2+L3).
Beweise in `context/changes/ci-review-agent/evidence.md` (PR #2, Job-Logs, Scorecard, Merge-Sperre).
Alle drei Badges zusammen einreichen. Termine: 2. = **10.08.** · 3. = 14.09.

---

## Gotchas (Referenz)

- **Volles Lint lokal:** `npm run lint` erstickt hier an CRLF (`core.autocrlf=true`, Repo speichert LF). Der CI-äquivalente Check ist `npx eslint . --rule '{"prettier/prettier":"off"}'`. Teilmengen zu linten hat schon einen CI-Fail durchgelassen.
- **`lint-staged` darf `package-lock.json` nicht anfassen** — Glob ist jetzt `!(package-lock).{json,css,md}`. Ein von Prettier umformatierter Lockfile bricht `npm ci` still.
- **Werkzeuge nicht als devDependency:** promptfoo blähte den Lockfile um ~17k Zeilen und wurde in jedem CI-Job installiert. `eval:review` nutzt `npx -y promptfoo@<pin>`.
- **`scripts/ai-review.ts` läuft außerhalb Astro** → `astro:env/server` bricht unter plain `tsx` → Config aus `process.env` (`ZAI_BASE_URL`/`ZAI_API_KEY`/`REVIEW_MODEL`); DB/Krypto-Pfad (`getDecryptedTarget`, RLS-Session-gebunden) NICHT nutzbar.
- **z.ai kennt kein `response_format: json_schema`**, nur `json_object` → `supportsStructuredOutputs: false`; die Struktur-Vorgabe muss in den Prompt, `Output.object` validiert nur. Coding-Plan-Key braucht `api.z.ai/api/coding/paas/v4` (sonst 429). `thinking:disabled` über `providerOptions` spart Faktor 3,4 Laufzeit. Memory `persona-forge-zai-provider`.
- **Was abzählbar ist, gehört nicht ins LLM** (`lessons.md`): glm-5.2 übersah `missing-rls` in 1/3 Läufen, mit geschärftem Prompt 0/5. `static-checks.ts` prüft die 7 syntaktischen Regeln per Regex (5/5).
- **Verdict ist Required Status Check** auf `main` (`ai-review/verdict`, `enforce_admins: false`) — in-YAML `needs:` allein lässt `ai-cr:failed`-Merge still durch.
- **Prod-DB-Migrationen:** vor `db push` immer `migration list --linked`. Auto-Mode blockt Prod-DB → per `!`. Memory `persona-forge-migrations`.
- **`ENCRYPTION_KEY` MUSS = `.dev.vars`/`.env`-Key** (Prod+Dev teilen DB), sonst Läufe hängen 0/N.
- **Push auf `main` = Prod-Deploy**; CI-Fail blockt Deploy lautlos → nach Push CI per REST prüfen (`gh run list --branch main`).
- **`gh` CLI installiert** (winget), auth `spyrad` (`repo`-Scope).

---

## Pausierte Themen

Keine.

---

## Session-Resume

Fuer neue Session: `/dtb:workflow-resume`
