---
change_id: ci-review-agent
title: CI-Review-Agent — LLM-PR-Reviewer in der Pipeline (Champion-Projekt M5L3)
status: implementing
created: 2026-07-08
updated: 2026-07-09
archived_at: null
---

## Notes

Champion-Projekt (10xDevs Modul 5, L3). LLM-basierter PR-Reviewer als CI-Pipeline-Step.

**Blueprint** = Referenz-`requirements.md` aus s05e03: PR-Titel + Body + `git diff` als Input
→ 6 Kriterien (1–10) + Verdict → Side-Effects = PR-Kommentar + Labels
`ai-cr:passed`/`ai-cr:failed`, On-demand-Re-Run via Label `ai-cr:review`.

**SDK final entschieden (2026-07-09, nach `/10x-research`):** Vercel AI SDK 6 (assemble).
`review.ts` ist ein isoliertes CI-Script → Bruch mit dem null-SDK-Hausstil ist billig;
Baustufe 2–3 braucht Tools. Vorbehalt: z.ai-`thinking:disabled` muss über
`providerOptions`/`extraBody` durchgereicht werden. `ToolLoopAgent` als Scorer
(`Output.object`, zunächst null Tools), Kosten-Bramka `stopWhen: stepCountIs(N)` +
`onStepFinish` (Token-Messung) — nie `isLoopFinished()` ohne Limit.

**Kosten:** z.ai Coding-Plan (`api.z.ai/api/coding/paas/v4`, Flat) via Custom-Provider/`baseURL`;
GLM `thinking:disabled`. Siehe Memory `persona-forge-zai-provider`.

**Baustufen:** (1) lokale Erstversion `git diff | npx tsx review.ts` → JSON (5–6 Kriterien
1–10 + Verdict); (2) CI + Human-in-the-Loop (Composite Action, `using: composite`,
fremde Actions `@<sha>` pinnen, `checkout` mit `fetch-depth: 0`); (3) promptfoo als
Regressions-Gate (z.ai/GLM + 1–2 Modelle via OpenRouter).

**Kriterien festgelegt (2026-07-09):** 6 Stück, je mit „1"-/„10"-Zustand, in
`requirements.md`. Vier zielen auf Codebase-Konventionen (UI-Tokens, API-Quartett,
RLS/Safety, Architektur-Platzierung), dazu Test-Abdeckung nach Risikoklasse und
Scope-Treue.

**Offen für den Plan:** Diff-Größe/Token-Budget (Kappung/Segmentierung) und das
Trigger-Modell (nur `ai-cr:review`-Label vs. auch automatisch auf `pull_request`;
Fork-PRs ohne Secrets).

Deadline-Anker: Termin 2 = 10.08. Beweise (Pipeline-View, Job-Logs, PR-Kommentar) für L3 sammeln.
