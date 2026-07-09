---
change_id: ci-review-agent
date: 2026-07-09
purpose: Champion-Beweise (10xDevs Modul 5, Lektion 3)
---

# CI-Review-Agent — Verifikations-Belege

E2E-Nachweis der Pipeline an **PR #2** (`test/ai-review-e2e` → `main`), einem
Test-PR mit einer absichtlich RLS-losen Migration. Der PR wurde **nicht gemergt**
und nach der Verifikation geschlossen; die fehlerhafte Migration hat `main` nie
berührt.

- PR: https://github.com/spyrad/persona-forge/pull/2
- Workflow: `.github/workflows/ai-review.yml`
- Composite Action: `.github/actions/ai-review/action.yml`

## Was der Test-PR enthielt

`supabase/migrations/20260709900000_ai_review_e2e_probe.sql` — eine Tabelle ohne
`enable row level security`, dazu eine `for all using (true)`-Sammelpolicy und
kein Index auf `owner_id`. Unabhängig bestätigt: der automatische
Security-Review von Claude Code flaggte dieselben Verstöße.

## Beobachtete Läufe

| Run         | Commit                   | Verdict | Findings | Diff                            | Dauer  | Tokens |
| ----------- | ------------------------ | ------- | -------- | ------------------------------- | ------ | ------ |
| 29000223812 | `1fa2b15`                | failed  | 3        | 151.573 → 56.883 (10 verworfen) | 8,9 s  | 18.950 |
| 29002576261 | `eddde1b`                | failed  | 3        | 153.865 → 113.502 (3 verworfen) | 29,7 s | 35.710 |
| 29002694530 | `eddde1b` (Label-Re-Run) | failed  | 2        | —                               | —      | —      |

Der mittlere Lauf zeigt die Wirkung der Nacharbeit aus `95efbc0`: Budget von 60k
auf 120k Zeichen, Doku hinter Code priorisiert → statt zehn nur noch drei
verworfene Dateien, und trotz 60 % mehr geprüftem Code keine zusätzlichen
Findings. Der Reviewer produziert kein Rauschen.

## Verifizierte Kriterien

| Schritt                  | Nachweis                                                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 3.3 Label + roter Status | Label `ai-cr:failed`; Commit-Status `ai-review/verdict: failure — 2 Finding(s), Schnitt 8.5/10`                                                        |
| 3.4 Kommentar-Dedup      | Kommentar-ID `4922648343` → `4922824459` → `4922962894`; Anzahl bleibt konstant **1**                                                                  |
| 3.5 Label-Re-Run         | Label `ai-cr:review` erzeugte Run 29002694530; Schritt „Re-Run-Label wieder entfernen" = success; Label danach entfernt, `ai-cr:failed` blieb          |
| 3.6 Merge-Sperre         | Branch-Protection auf `main` mit Required Check `ai-review/verdict` (`enforce_admins: false`); `gh pr view 2` meldet `mergeStateStatus: BLOCKED`       |
| 3.7 Entkopplung          | `ai-review.yml` reagiert nur auf `pull_request`; `ci.yml` `deploy` hat `needs: [ci, integration]` — der Reviewer kann den Prod-Deploy nicht blockieren |

## Scorecard aus dem PR-Kommentar

```
## ❌ AI Code Review: nicht bestanden

| | Kriterium | Score |
| :-: | --- | :-: |
| ✅ | Konventions-Konformitaet (UI) | 10/10 |
| ✅ | API-Route-Quartett | 10/10 |
| ❌ | Datensicherheit & RLS | 1/10 |
| ✅ | Test-Abdeckung nach Risikoklasse | 10/10 |
| ✅ | Scope- & Plan-Treue | 10/10 |
| ✅ | Architektur- & Pattern-Konsistenz | 10/10 |

**Durchschnitt:** 8.5/10

### Warum blockiert
- Datensicherheit & RLS: 1/10 liegt unter der Mindestpunktzahl von 5 (2x kritisch).

| Schwere | Regel | Datei |
| --- | --- | --- |
| 🔴 kritisch | `missing-rls` | `supabase/migrations/20260709900000_ai_review_e2e_probe.sql` |
| 🔴 kritisch | `blanket-policy` | `supabase/migrations/20260709900000_ai_review_e2e_probe.sql` |
```

Bemerkenswert: nur `dataSafety` fällt. Die fünf anderen Kriterien bleiben bei
10/10, obwohl der Diff das gesamte Feature enthält — der Reviewer bestraft nicht
pauschal, und `scopeDiscipline` bleibt sauber, weil der PR-Body die Test-Migration
ankündigt.

## Beobachtete Reststreuung

Zwischen den Läufen auf demselben Commit schwankte die Zahl der Findings zwischen
3 und 2: `missing-owner-index` (severity `observation`) wurde einmal nicht
gemeldet. Score und Verdict blieben identisch, weil die beiden kritischen Findings
`dataSafety` ohnehin auf 1 drücken. Genau das ist der Zweck des Findings-Designs —
Beobachtungen dürfen streuen, das Merge-Gate nicht. Systematische Messung folgt in
Phase 4 (promptfoo).

## Infrastruktur-Notiz

Während der Verifikation lief eine GitHub-Störung („Delays starting Actions runs",
Beginn 04:34 UTC). Vier von sieben Läufen wurden ohne zugewiesenen Runner nach
~15 Minuten abgebrochen (`conclusion: cancelled`, `steps: 0`). Auch der
unveränderte `CI`-Workflow war betroffen. Kein Bezug zum Reviewer-Code.
