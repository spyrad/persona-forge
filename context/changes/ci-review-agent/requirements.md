---
change_id: ci-review-agent
date: 2026-07-09
author: Damian
status: decided
---

# Requirements: CI-Review-Agent

## Zweck

Ein LLM-basierter PR-Reviewer als CI-Pipeline-Step. Er ist ein **semantischer
Linter** für genau das, was die mechanischen Gates (`strictTypeChecked`,
Prettier, `react-compiler`, `jsx-a11y`) nicht sehen. Er prüft **nicht** nach,
was ESLint bereits fängt.

## Input

- PR-Titel
- PR-Body
- `git diff` (Basis-Branch → HEAD; `checkout` mit `fetch-depth: 0`)

## Output

JSON: 6 Kriterien mit Score 1–10 + Verdict.

**Korrigiert in Phase 2 (2026-07-09):** Die Scores kommen **nicht** vom LLM. Das
Modell liefert nur Findings aus einem festen Regel-Katalog (Regel-ID, Datei,
Beleg); `verdict.ts` leitet Schweregrad, Score und Verdict deterministisch ab.
Grund: gemessene Noten-Streuung liess das Verdict bei identischem Diff kippen
(siehe `context/foundation/lessons.md`). Die sechs Kriterien unten bleiben
unverändert — sie strukturieren jetzt den Regel-Katalog statt einer Notenskala.

## Side-Effects

- PR-Kommentar mit der Scorecard (Dedup-Marker; post-new-then-delete-old)
- Labels `ai-cr:passed` / `ai-cr:failed`
- Verdict als **separater Commit-Status** (`POST /statuses`) — muss Required
  Status Check werden. Ein in-YAML-`needs:` allein lässt `ai-cr:failed`
  still durchmergen (`context/foundation/lessons.md:12-17`).
- On-demand-Re-Run über das Label `ai-cr:review`

## Die 6 Review-Kriterien

Jedes Kriterium zielt auf eine **nein**-Zeile aus `research.md` Abschnitt A
(= nicht mechanisch gefangen). Kriterium 5 stammt aus der Finding-Grammatik in
Abschnitt D.

### 1. Konventions-Konformität (UI)

- **1:** Farb-Literale (`text-white`, `bg-white/10`, `*-blue-*`,
  Gradient-Headlines); manuelle Klassen-Konkatenation statt `cn()`;
  `client:load` auf statischem Markup.
- **10:** Ausschließlich semantische Tokens aus `src/styles/global.css`;
  Klassen über `cn()` gemerged; React-Insel nur bei echter Interaktivität.
- **Akzeptierter Sonderfall:** generierte shadcn/ui-Komponenten unter
  `src/components/ui/` (z. B. `button.tsx:14`).

### 2. API-Route-Quartett

- **1:** Route ohne `export const prerender = false`; lowercase-Handler;
  ungeprüfter Request-Body; kein `requireUser`.
- **10:** Alle vier zusammen — `prerender = false`, uppercase-Export
  (`GET`/`POST`/`PUT`/`DELETE`), zod-`safeParse` auf dem Input, `requireUser`
  plus die zentralen Helper aus `@/lib/api-responses`.

### 3. Datensicherheit & RLS

- **1:** Neue Tabelle ohne `enable row level security` oder mit einer
  `for all`-Sammelpolicy; Secret im Klartext im Code; ungeprüfte externe URL
  (SSRF).
- **10:** RLS aktiviert; eine Policy je Operation × Rolle (`to authenticated`);
  `(select auth.uid())` statt nacktem `auth.uid()`; Index auf `owner_id`;
  Keys nur über Env oder verschlüsselt in der DB; externe URLs über
  `isPublicHttpsUrl`.
- **Referenzmuster:** `supabase/migrations/20260616051425_model_configs.sql:29-48`

### 4. Test-Abdeckung nach Risikoklasse

- **1:** Sicherheits- oder DB-nahe Änderung ohne Test; oder ein Test im
  falschen Glob (z. B. `*.test.ts`, der gegen Supabase läuft).
- **10:** Das Risiko trifft die richtige Ebene — Unit-Tests co-located als
  `*.test.ts`, Integration als `*.itest.ts` unter `src/test/integration/`.
- **Risiko-Liste kanonisch:** `context/foundation/test-plan.md`

### 5. Scope- & Plan-Treue

- **1:** Der Diff enthält Umbauten, die PR-Titel und -Body nicht ankündigen.
- **10:** Der Diff deckt genau das ab, was der PR beschreibt — keine
  Drive-by-Refactorings.

### 6. Architektur- & Pattern-Konsistenz

- **1:** Business-Logik direkt in der API-Route; Types lokal dupliziert;
  ein vorhandener Helper per Copy-Paste nachgebaut.
- **10:** Logik in `src/lib/services/`; shared Types (Entities, DTOs) in
  `src/types.ts`; bestehende Helper wiederverwendet.

## Entschiedene Fragen

### SDK: Vercel AI SDK 6

`ToolLoopAgent` als Scorer mit `Output.object`, zunächst ohne Tools.
Kosten-Bramka `stopWhen: stepCountIs(N)` + `onStepFinish` für die
Token-Messung; nie `isLoopFinished()` ohne Limit.

**Begründung:** `review.ts` ist ein isoliertes CI-Script, kein App-Code — der
Bruch mit dem null-SDK-Hausstil kostet dort nichts. Die Baustufen 2–3 brauchen
echte Tools (`readPlan`, `postPrComment`), für die der Tool-Loop samt
Schritt-Bramka fertig ist; im Hausstil-Weg müsste man ihn nachbauen. Dazu
Kurstreue (M5L3) und Lernwert.

**Ehrlicher Vorbehalt:** `thinking:{type:"disabled"}` ist ein z.ai-spezifisches
Body-Feld. `chatCompletion()` setzt es heute selbst über `isZaiEndpoint()`
(`src/lib/llm/openai-compatible.ts:128,152`). Im Vercel-SDK muss es über
`providerOptions`/`extraBody` am Custom-Provider durchgereicht werden — greift
das nicht, reasont GLM per Default und die CI-Läufe werden langsam. Ist im
Plan zu verifizieren.

### Kriterien-Schnitt: 6, wie oben

Safety bleibt als **ein** Kriterium (nicht in RLS + Key/SSRF gesplittet) —
kürzerer Prompt, weniger Rausch-Risiko. Scope-Treue (5) bleibt drin, damit der
Reviewer auch bei PRs urteilsfähig ist, die keine der Konventionen berühren.

## Runtime-Randbedingungen

- `review.ts` läuft außerhalb Astro. `astro:env/server` ist unter plain `tsx`
  nicht auflösbar → Config aus `process.env` (`ZAI_BASE_URL`, `ZAI_API_KEY`,
  `REVIEW_MODEL`).
- Der DB-/Krypto-Pfad (`getDecryptedTarget()`, RLS-session-gebunden) ist im CI
  **nicht** nutzbar — es gibt dort keine User-Session.
- z.ai-Coding-Plan verlangt die volle URL `api.z.ai/api/coding/paas/v4`,
  sonst 429 („insufficient balance").

## Baustufen

1. **Lokal:** `git diff | npx tsx review.ts` → JSON (6 Kriterien 1–10 + Verdict)
2. **CI + Human-in-the-Loop:** Composite Action (`using: composite`, fremde
   Actions an `@<sha>` gepinnt), `checkout` mit `fetch-depth: 0`, Label-Gate,
   Fork-PR-Block
3. **promptfoo als Regressions-Gate:** z.ai/GLM + 1–2 Vergleichsmodelle über
   OpenRouter, 1 komplexer Diff mit bekannten Fehlern

## Weiterhin offen (für den Plan)

- **Diff-Größe / Token-Budget:** Wie wird ein großer `git diff` gekappt oder
  segmentiert? `stepCountIs(N)` deckt Loop-Schritte, nicht die Input-Größe.
- **Trigger-Modell:** nur `ai-cr:review`-Label (on-demand) oder zusätzlich
  automatisch auf `pull_request`? Fork-PRs bekommen keine Secrets.
