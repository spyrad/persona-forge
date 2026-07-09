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

**Design-Korrektur in Phase 2 (2026-07-09): Findings statt Noten.** Der Plan liess
das LLM je Kriterium eine Note 1–10 vergeben. Gemessen (glm-5.2, `temperature: 0`,
derselbe Diff dreimal): `apiQuartet` schwankte zwischen 3 und 8, das Verdict kippte
`failed`→`passed`. Eine deterministische Schwelle auf einer gewürfelten Zahl ist
Scheinsicherheit. Jetzt liefert das Modell nur noch **Findings** aus einem festen
Regel-Katalog (18 Regeln, `z.enum`), je mit Datei und Beleg; Schweregrad und Score
leitet `verdict.ts` im Code ab. Ein Kriterium ohne Finding bekommt volle Punktzahl —
damit fällt auch das Falsch-Positiv weg, dass „nicht berührt" als Mangel gewertet wurde.

**Weitere Phase-2-Befunde:**

- z.ai-Coding-Endpunkt unterstützt **kein** `response_format: json_schema`, nur
  `json_object`. `Output.object` validiert deshalb nur; die Formvorgabe muss in den
  Prompt (`supportsStructuredOutputs: false`).
- SDK-Warnungen gehen per `console.warn` auf **stdout** und zerstörten das JSON →
  via `AI_SDK_LOG_WARNINGS` nach stderr umgeleitet.
- `process.exit()` löst auf Windows einen libuv-Assert aus, solange stdin schliesst →
  `process.exitCode` setzen.
- Installiert wurde `ai@7` (nicht 6); `ToolLoopAgent`/`Output`/`stepCountIs` unverändert,
  aber System-Prompt gehört in `instructions` (`role: "system"` wird abgelehnt).
- Kein Timeout gesetzt (bewusste Entscheidung) — ein hängender z.ai-Call blockiert den
  CI-Job bis zum Job-Limit. Offenes Risiko.

**Phase 3 verifiziert (2026-07-09):** E2E-Belege in `evidence.md` (PR #2, geschlossen
statt gemergt). Branch-Protection auf `main` gesetzt: `ai-review/verdict` als Required
Status Check, `enforce_admins: false` — der direkte Push-Deploy auf `main` bleibt möglich.
Repo-Setup: Secret `ZAI_API_KEY`, Variablen `ZAI_BASE_URL`/`REVIEW_MODEL`, drei
`ai-cr:*`-Labels.

**Nachjustiert nach dem ersten echten Lauf (`95efbc0`):** Doku (`.md`) und Manifeste
rangieren hinter jedem Code; Diff-Budget 60k → 120k Zeichen.

**Offen (Phase 4):** promptfoo-Regressions-Gate; Restschwankung bei
`architectureConsistency`/Beobachtungen systematisch messen; kein Timeout gesetzt —
ein hängender z.ai-Call blockiert den Job bis zum Job-Limit.

Deadline-Anker: Termin 2 = 10.08. Beweise (Pipeline-View, Job-Logs, PR-Kommentar) für L3 sammeln.
