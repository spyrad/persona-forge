# CI-Review-Agent — Plan Brief

> Full plan: `context/changes/ci-review-agent/plan.md`
> Requirements: `context/changes/ci-review-agent/requirements.md`
> Research: `context/changes/ci-review-agent/research.md`

## What & Why

Ein LLM-basierter PR-Reviewer, der als CI-Step läuft und sechs projektspezifische
Kriterien mit 1–10 bewertet. Er ist ein **semantischer Linter** für genau das, was
ESLint nicht sehen kann: Farb-Token-Disziplin, RLS-Vollständigkeit, das
API-Route-Quartett, Code-Platzierung. Gleichzeitig ist er das Champion-Projekt für
10xDevs Modul 5, Lektion 3.

## Starting Point

Das Projekt hat drei CI-Jobs (`ci`, `integration`, `deploy`) und macht alle
LLM-Calls ohne SDK, über einen handgeschriebenen fetch-Client
(`src/lib/llm/openai-compatible.ts:142`). Weder `tsx` noch `ai`/`@ai-sdk/*` sind
installiert; `.github/actions/` existiert nicht. Die mechanischen Gates
(`strictTypeChecked`, Prettier, `react-compiler`, `jsx-a11y`) decken Typen,
Format, Hooks und a11y bereits ab — der Reviewer darf sie nicht nachprüfen.

## Desired End State

Ein PR gegen `main` trägt binnen einer Minute eine Scorecard als Kommentar, ein
Label `ai-cr:passed` oder `ai-cr:failed`, und einen Commit-Status
`ai-review/verdict`. Ist der Status rot, sperrt die Branch-Protection den Merge.
Ein erneuter Lauf lässt sich über das Label `ai-cr:review` anstoßen. Fork-PRs
werden übersprungen; ein LLM-Ausfall kann den Prod-Deploy nie blockieren.

## Key Decisions Made

| Decision         | Choice                                                                    | Why (1 sentence)                                                                                                                       | Source       |
| ---------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| SDK              | Vercel AI SDK 6 (`ToolLoopAgent` + `Output.object`)                       | `review.ts` ist isoliertes CI-Script — der Bruch mit dem null-SDK-Hausstil kostet nichts und schenkt den Tool-Loop für spätere Stufen. | Requirements |
| Kriterien        | 6, je mit „1"-/„10"-Zustand                                               | Vier zielen auf Codebase-Konventionen, dazu Test-Abdeckung und Scope-Treue.                                                            | Requirements |
| Diff-Budget      | Filtern → priorisieren → kappen                                           | Reine Kappung ließe ein Lockfile-Update die Migration verdrängen; der Reviewer bewertete dann Rauschen.                                | Plan         |
| Trigger          | Auto auf `pull_request`, Fork-Skip, Label-Re-Run                          | Ein Gate, das man anstoßen muss, wird vergessen; `pull_request_target` wäre eine Rechteausweitungs-Lücke.                              | Plan         |
| Verdict          | Deterministisch im Code (ein Kriterium < 5 **oder** Schnitt < 7 → failed) | Ein Merge-Gate muss reproduzierbar und unit-testbar sein; das LLM liefert nur Scores.                                                  | Plan         |
| CI-Kopplung      | Eigener Workflow, `ci.yml` unberührt                                      | Ein z.ai-429 darf keinen Prod-Deploy blockieren; die Sperre entsteht über einen separaten Commit-Status.                               | Plan         |
| Test-Tiefe       | Unit auf `prepareDiff` + `decideVerdict`                                  | Genau die Logik, die still das Falsche tun kann, ist deterministisch abgedeckt.                                                        | Plan         |
| Code-Platzierung | Logik in `src/lib/ai-review/`, Entry in `scripts/`                        | `vitest.config.ts:13` sammelt nur `src/**/*.test.ts` — außerhalb liegende Logik wäre ungetestet.                                       | Plan         |

## Scope

**In scope:** Diff-Aufbereitung, zod-Schema der 6 Kriterien, deterministische
Verdict-Schwelle, Unit-Tests, z.ai-Provider mit `thinking:disabled`, Composite
Action, eigener Workflow, PR-Kommentar mit Dedup, Labels, Commit-Status,
promptfoo-Regressions-Gate.

**Out of scope:** Nachprüfen mechanischer ESLint-Gates; Tools im Agent
(`readPlan`/`postPrComment`); DB-/Krypto-Zugriff aus dem CI; `pull_request_target`
und Fork-Support; Änderungen an `ci.yml`; gewichtete Score-Schwellen.

## Architecture / Approach

Die reine Logik lebt in `src/lib/ai-review/` (Vitest greift, `@/*`-Alias gilt),
nur der SDK-Call und der `process.env`-Zugriff in `scripts/ai-review.ts`. Das
spiegelt die Trennung, die das Projekt schon zwischen `crypto.ts` (rein) und
`encryption-key.ts` (Astro-Env) zieht.

Fluss: `git diff` → `prepareDiff` (filtern, priorisieren, kappen) → `buildPrompt`
→ `ToolLoopAgent` mit `Output.object` gegen z.ai/GLM → `decideVerdict` → Action
postet Kommentar, Labels, Commit-Status.

## Phases at a Glance

| Phase             | What it delivers                                    | Key risk                                                           |
| ----------------- | --------------------------------------------------- | ------------------------------------------------------------------ |
| 1. Reiner Kern    | `prepareDiff`, Schema, `decideVerdict` + Unit-Tests | Priorisierungs-Heuristik verwirft versehentlich Relevantes         |
| 2. Scorer-Entry   | `git diff \| npx tsx` gibt JSON                     | `thinking:disabled` greift nicht → GLM reasont, CI wird langsam    |
| 3. CI-Verdrahtung | Action, Workflow, Labels, Commit-Status             | Required Status Check vergessen → `ai-cr:failed` mergt still durch |
| 4. promptfoo      | Regressions-Gate über mehrere Modelle               | Referenz-Diff deckt zu wenige Fehlerklassen ab                     |

**Prerequisites:** GitHub-Secret `ZAI_API_KEY`, Variablen `ZAI_BASE_URL`
(volle URL `https://api.z.ai/api/coding/paas/v4`) und `REVIEW_MODEL`;
`gh` CLI ist installiert und authentifiziert.

**Estimated effort:** ~2–3 Sessions über vier Phasen. Deadline-Anker: Termin 2 am 10.08.

## Open Risks & Assumptions

- **`thinking:disabled` über `providerOptions`** ist aus der SDK-Doku abgeleitet,
  nicht gegen z.ai verifiziert. Greift es nicht, ist `transformRequestBody` der
  Fallback. Wird in Phase 2 an der Latenz gemessen.
- **`supportsStructuredOutputs` bei GLM** ist ungeprüft. Lehnt das Modell
  `response_format: json_schema` ab, muss der Provider auf tolerantes
  JSON-Parsing zurückfallen — das Muster liegt in `oejts-run.ts:106` bereit.
- **Der Required Status Check ist ein manueller Klick** in den GitHub-Settings.
  YAML kann ihn nicht ausdrücken; ohne ihn ist das gesamte Gate wirkungslos.
- **Ein PR ohne Konventions-Berührung** liefert wenig Signal; Kriterium 5
  (Scope-Treue) trägt dann allein das Urteil.

## Success Criteria (Summary)

- Ein PR mit RLS-loser Migration bekommt `ai-cr:failed`, und der Merge-Button
  ist gesperrt.
- Ein sauberer PR bekommt `ai-cr:passed`, ohne dass der Reviewer mechanisch
  gefangene Themen moniert.
- Ein z.ai-Ausfall färbt den Reviewer rot, lässt `ci` und `deploy` aber unberührt.
