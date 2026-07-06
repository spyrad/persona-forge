# Opportunity Map

## Context

- **Project / context**: persona-forge (Solo-Projekt, Astro 6 + React 19 + Supabase + Cloudflare Workers, CI auf GitHub Actions). Friction-Signale aus der echten Solo-Arbeit, destilliert aus WORKFLOW_STATUS, Gotchas (CLAUDE.md) und Memories.
- **Data constraint**: mock / lokal / read-only / nicht-sensibel (eigener Repo-Code, PR-Diffs, CI-Logs, Migrations-Metadaten). Erste Version darf leichtgewichtig starten — kein Access-Control/Audit vorab.
- **Date**: 2026-07-06
- **Lektion**: 10xDevs Modul 5, L1 (AI Internal Builders); Champion-Pfad, Ziel-Projekt (a) CI/CD-Review-Pipeline.

## Map

| Signal                          | Existing / default response                                            | Thin complement                                                                    | First useful version                             | Data risk                     | Direction if valuable                 |
| ------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------- | ------------------------------------- |
| 1 Review-Flaschenhals           | CODEOWNERS, Required-Checks, ESLint, manueller Opus-Review             | LLM-Review-Job über PR-Diff vs. CLAUDE.md-Konventionen, postet Kommentar           | Lokaler Review über 1 alten PR-Diff → Markdown   | read-only, eigener Code       | **Review / CI gate**                  |
| 2 CI-Fail blockt Deploy lautlos | GitHub-Mails bei Fail; Fix = `deploy needs: ci` im Workflow-Graph      | — (Config-Fix schlägt Helper)                                                      | —                                                | read-only                     | Wait / kein Build                     |
| 3 Prod-DB-Migrations-Drift      | `migration list --linked`, `migration repair` (manuell)                | Diff lokal `supabase/migrations/` vs. remote `schema_migrations`, Pre-Push-Warnung | Lokaler Drift-Report aus `migration list`-Output | read-only Metadaten (Prod-DB) | Review / CI gate                      |
| 4 Doku-/Status-Sync             | dtb-Skills (`workflow-checkpoint`/`resume`/`session-summary`) lösen es | — (schon abgedeckt)                                                                | —                                                | read-only                     | Wait / kein Build                     |
| 5 Env-/Secrets-Parität          | manuell (kein natives Tool)                                            | Key-Namen-Diff `.dev.vars` / `.env` / `gh secret list` (nur Namen, keine Werte)    | Lokaler Key-Set-Diff                             | read-only (nur Key-Namen)     | Internal tool (klein, niederfrequent) |

## Recommended First Candidate

```text
Kandidat:
CI Review-Agent (PR-Kommentator gegen Projekt-Konventionen)

Liest:
PR-Diff (GitHub Actions PR-Event) + Projekt-Regeln aus CLAUDE.md
(Token-statt-Farb-Literal, kein "use client", RLS auf neuer Tabelle,
API-Route zod-validiert, Test-Coverage-Lücken)

Gibt zurück:
Einen strukturierten Review-Kommentar am PR (Drift/Pattern/Coverage),
mit Verweis auf die betroffenen Dateien+Zeilen — Human-in-the-Loop.

Macht nicht:
Kein Auto-Merge, kein Auto-Fix, kein Ersatz für Required-Checks/CODEOWNERS,
kein eigener State/DB, keine Blockade des Merges (nur Kommentar).

Datenrisiko:
mock/lokal/read-only/nicht-sensibel — eigener Repo-Code. Erste Version läuft
lokal über einen alten PR-Diff, bevor irgendetwas in die CI verdrahtet wird.

Richtung falls wertvoll:
Internal tool → Review / CI gate. Exakt das 10xChampion-Projekt (a),
gebaut über M5L2 (Team-Agent aus SDK) + M5L3 (Code Review in CI/CD).
```

## Why This Candidate

Signal 1 wiederholt sich bei _jedem_ PR, verbindet zwei Quellen (Diff + Konventionen), hat heute echten manuellen Schmerz (Opus-Reviews von Hand), ist read-only auf einem alten PR testbar und ersetzt keine Plattform-Verantwortung (kommentiert nur, blockt nicht). Klarste Weiterrichtung: es _ist_ der Champion-Beweis (M5L2+L3). Bonus: der Lektions-Paket-Skill `10x-impl-review-ci` liegt bereits lokal und deckt genau diesen Kandidaten.

Signal 3 ist der zweitbeste echte Helper, aber seltener als PRs und Prod-DB-nah. Signal 5 ist echt, aber niederfrequent. Signale 2 und 4 sind ehrlich **kein Build** — ein Config-Fix (`deploy needs: ci`) bzw. schon durch die dtb-Skills gelöst.

## Next Direction If Valuable

Gewählter nächster Zug: **direkt bauen** → `/10x-new` → `/10x-research` → `/10x-plan` → `/10x-implement`. Der enge Signal-Fokus, die klare erste Version und die verstandenen Risiken rechtfertigen den direkten Bau. Führt inhaltlich in Modul 5, L2 (Team-Agent aus SDK) und L3 (Code Review in CI/CD) und produziert die Champion-Beweise: Pipeline-View + Job, Logs, Screenshot des LLM-Review-Kommentars an einem PR.
