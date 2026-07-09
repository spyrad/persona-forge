# CI-Review-Agent Implementation Plan

## Overview

Ein LLM-basierter PR-Reviewer als eigener CI-Workflow. Er liest PR-Titel, PR-Body
und `git diff`, bewertet sechs projektspezifische Kriterien mit 1–10, und setzt
daraus ein deterministisches Verdict, das als Required Status Check den Merge
gatet. Er ist ein **semantischer Linter** für genau das, was ESLint nicht sieht —
und prüft bewusst nicht nach, was die mechanischen Gates bereits fangen.

Champion-Projekt für 10xDevs Modul 5, Lektion 3.

## Current State Analysis

- **Keine der benötigten Dependencies ist installiert.** Weder `tsx` noch
  `ai`/`@ai-sdk/*` stehen in `package.json:21-69`. Das Projekt macht heute alle
  LLM-Calls ohne SDK, über einen handgeschriebenen fetch-Client.
- **`chatCompletion()`** (`src/lib/llm/openai-compatible.ts:142`) ist ein reiner
  fetch-Client mit Retry, Timeout und SSRF-Härtung, inklusive
  `isZaiEndpoint()`-Toggle für `thinking:disabled` (`:128,152`). Er wäre unter
  `tsx` nutzbar — wir wählen trotzdem das SDK (siehe Implementation Approach).
- **`astro:env/server` bricht unter plain `tsx`** (Vite-Virtual-Module). Der
  App-Code liest Secrets ausschließlich darüber (`src/lib/encryption-key.ts:1`).
  Ein CI-Script hat zudem keine User-Session, also ist der DB-/Krypto-Pfad
  (`getDecryptedTarget()`, `src/lib/services/model-configs.ts:122`) unerreichbar.
- **`vitest.config.ts:13` sammelt nur `src/**/\*.test.ts`.** Logik, die außerhalb
von `src/` liegt, wird von den Unit-Tests schlicht nicht gesehen.
- **`.github/workflows/ci.yml`** hat drei Jobs: `ci`, `integration`, und `deploy`
  mit `needs: [ci, integration]`. Ein `.github/actions/`-Verzeichnis existiert
  nicht — die Composite Action ist Greenfield.
- **`context/foundation/lessons.md:12-17`**: Ein in-YAML-`needs:`-Gate ist nur die
  halbe Miete. Ohne Required Status Check in der Branch-Protection ist ein roter
  Lauf operativ unsichtbar.

## Desired End State

Ein PR gegen `main` löst automatisch einen `ai-review`-Lauf aus. Innerhalb einer
Minute trägt der PR entweder das Label `ai-cr:passed` oder `ai-cr:failed`, einen
Kommentar mit der 6-Kriterien-Scorecard samt Begründungen, und einen
Commit-Status `ai-review/verdict`. Ist der Status rot, lässt die Branch-Protection
den Merge-Button nicht zu. Ein erneuter Lauf lässt sich jederzeit über das Label
`ai-cr:review` anstoßen. Fork-PRs werden übersprungen, ohne den Lauf rot zu färben.

Verifikation: einen Test-PR mit einer absichtlich RLS-losen Migration öffnen. Der
Reviewer muss Kriterium 3 unter 5 bewerten, `ai-cr:failed` setzen, und der
Merge-Button muss gesperrt sein.

### Key Discoveries

- `ToolLoopAgent` + `Output.object` ist die bestätigte SDK-6-API:
  `new ToolLoopAgent({model, output: Output.object({schema}), stopWhen: stepCountIs(N)})`
  → `await agent.generate({prompt})` liefert `{output}`.
- **Die Struktur-Ausgabe zählt selbst als Step.** `stopWhen` muss also
  Tool-Schritte + 1 erlauben. Bei null Tools bedeutet das `stepCountIs(2)`.
- `createOpenAICompatible` spiegelt `providerOptions['<name>']` in den
  Request-Body. Damit ist `thinking: {type: "disabled"}` für z.ai/GLM ohne
  Patch erreichbar. `transformRequestBody` steht als Fallback bereit, falls das
  Feld nicht durchgereicht wird.
- Der z.ai-Coding-Plan verlangt die volle URL `api.z.ai/api/coding/paas/v4`;
  der Standard-Endpunkt quittiert einen Coding-Plan-Key mit 429
  („insufficient balance").
- `supabase/migrations/20260616051425_model_configs.sql:29-48` ist das
  RLS-Referenzmuster, gegen das Kriterium 3 urteilt.

## What We're NOT Doing

- **Keine Nachprüfung mechanischer Gates.** Typ-Sicherheit, Formatierung,
  Hook-Regeln und a11y fangen `strictTypeChecked`, Prettier, `react-compiler`
  und `jsx-a11y` bereits (`eslint.config.js:15,23,56,65,78`).
- **Keine Tools im Agent** in diesem Change. `readPlan`/`postPrComment` sind
  bewusst vertagt; der Agent ist zunächst ein reiner Scorer mit null Tools.
- **Kein Zugriff auf DB oder Krypto** aus `review.ts` — im CI existiert keine
  User-Session.
- **Kein `pull_request_target`.** Fork-PRs werden übersprungen, nicht mit
  Secrets bedient.
- **Keine Änderung an `ci.yml`.** Der Reviewer darf den Prod-Deploy nie blockieren.
- **Keine gewichteten Score-Schwellen.** Gewichte bleiben erfunden, bis eine
  promptfoo-Baseline sie stützt.

## Implementation Approach

Die reine Logik lebt in `src/lib/ai-review/` — dorthin greift `vitest.config.ts`,
und dort gilt der `@/*`-Alias. Nur der Entry-Point mit dem SDK-Call und dem
`process.env`-Zugriff liegt in `scripts/ai-review.ts`. Das ist exakt die
Runtime-Trennung, die das Projekt schon zwischen `crypto.ts` (rein, Key als
Parameter) und `encryption-key.ts` (Astro-Env) zieht.

**Warum das SDK und nicht `chatCompletion()`:** `review.ts` ist ein isoliertes
CI-Script, kein App-Code. Der Bruch mit dem null-SDK-Hausstil kostet dort nichts,
und die späteren Tool-Stufen bekommen den Loop samt Schritt-Bramka geschenkt,
statt ihn nachzubauen. Dazu Kurstreue (M5L3) und Lernwert.

**Warum ein eigener Workflow:** Ein z.ai-Ausfall oder ein 429 darf keinen
Prod-Deploy blockieren. Die Merge-Sperre entsteht stattdessen über einen separaten
Commit-Status in der Branch-Protection — die Lehre aus `lessons.md:12-17`,
angewandt auf einen nicht-deterministischen Dienst.

## Critical Implementation Details

**Path-Alias unter tsx.** `scripts/ai-review.ts` läuft außerhalb von Vite. Die
Auflösung von `@/*` ist dort nicht garantiert. Der Entry-Point importiert die
Kern-Module deshalb über relative Pfade (`../src/lib/ai-review/…`), nicht über
den Alias. Innerhalb von `src/lib/ai-review/` bleibt der Alias erlaubt, weil
diese Dateien nur von Vitest und (transitiv) von tsx geladen werden.

**Reihenfolge der Diff-Aufbereitung.** Erst filtern, dann priorisieren, dann
kappen. Wird zuerst gekappt, verdrängt ein `package-lock.json`-Update am Anfang
des Diffs die Migration am Ende — der Reviewer bewertet Rauschen und meldet grün.

## Phase 1: Reiner Kern + Unit-Tests

### Overview

Die gesamte deterministische Logik, ohne LLM und ohne Netz: Diff-Aufbereitung,
Output-Schema, Verdict-Schwelle. Diese Phase ist vollständig testbar und muss
grün sein, bevor der erste Token fließt.

### Changes Required

#### 1. Output-Schema der sechs Kriterien

**File**: `src/lib/ai-review/schema.ts`

**Intent**: Das zod-Schema, das der Agent per `Output.object` erfüllen muss, und
die davon abgeleiteten Types. Es ist die einzige Quelle für Kriterien-Namen —
Prompt, Kommentar-Rendering und Verdict lesen alle daraus.

**Contract**: Ein `reviewSchema` mit einem Array (oder Objekt) aus sechs
Einträgen, je `{criterion, score: 1..10, reasoning}`, plus ein `summary`-Feld.
Die sechs Kriterien-Keys entsprechen `requirements.md`: `uiConventions`,
`apiQuartet`, `dataSafety`, `testCoverage`, `scopeDiscipline`,
`architectureConsistency`. Exportiert `ReviewResult` als abgeleiteten Type.

#### 2. Diff-Aufbereitung

**File**: `src/lib/ai-review/diff.ts`

**Intent**: Einen rohen `git diff` in einen budgetierten, für die sechs Kriterien
maximal relevanten Text verwandeln. Drei Schritte in fester Reihenfolge: Rausch-
Dateien verwerfen, Rest nach Kriterien-Relevanz sortieren, dann auf ein
Zeichen-Budget kappen.

**Contract**: `prepareDiff(rawDiff: string, budget: number): {diff: string,
truncated: boolean, droppedFiles: string[]}`. Verworfen werden Lockfiles,
`dist/`, `node_modules/`, Snapshots und Binaries. Priorität absteigend:
`supabase/migrations/**` → `src/pages/api/**` → `*.astro`/`*.tsx` →
`src/lib/**` → Tests → Rest. Die Funktion ist rein: kein `fs`, kein `process`.

#### 3. Verdict-Schwelle

**File**: `src/lib/ai-review/verdict.ts`

**Intent**: Aus den sechs Scores deterministisch `passed` oder `failed` ableiten.
Diese Funktion ist das eigentliche Merge-Gate — sie muss reproduzierbar und
unabhängig vom Modell sein.

**Contract**: `decideVerdict(result: ReviewResult): {verdict: "passed" |
"failed", reasons: string[]}`. Regel: `failed`, sobald ein einzelnes Kriterium
unter 5 liegt **oder** der Durchschnitt unter 7 liegt. Die Schwellen liegen als
benannte Konstanten im Modul, nicht im Prompt.

#### 4. Unit-Tests

**File**: `src/lib/ai-review/diff.test.ts`, `src/lib/ai-review/verdict.test.ts`

**Intent**: Die beiden Fehlermodi absichern, die still das Falsche tun. Für
`diff.ts`: ein Diff, in dem ein großes Lockfile-Update vor einer RLS-Migration
steht — die Migration muss die Kappung überleben. Für `verdict.ts`: ein
Score-Satz mit einer einzelnen 4 bei durchschnittlich 8 muss `failed` ergeben,
und die Grenzfälle exakt auf 5 bzw. 7 müssen `passed` ergeben.

**Contract**: Vitest, Node-Env, keine Netzwerk-Aufrufe. Greift durch
`vitest.config.ts:13` (`src/**/*.test.ts`) automatisch.

### Success Criteria

#### Automated Verification

- Unit-Tests grün: `npm run test`
- Linting grün: `npm run lint`
- Typecheck grün: `npx astro check`

#### Manual Verification

- `prepareDiff` mit einem echten `git diff` aus diesem Repo aufrufen und prüfen,
  dass Migrationen und API-Routen oben stehen

---

## Phase 2: Scorer-Entry (Baustufe 1)

### Overview

Der erste echte LLM-Lauf, lokal. Ziel ist der Kurs-Meilenstein:
`git diff main... | npx tsx scripts/ai-review.ts` gibt die Scorecard als JSON aus.

### Changes Required

#### 1. Dependencies

**File**: `package.json`

**Intent**: `ai`, `@ai-sdk/openai-compatible` und `tsx` ergänzen. Alle drei
gehören in `devDependencies` — sie laufen ausschließlich im CI-Script, nie im
Astro-Build oder im Worker.

**Contract**: `npm i -D ai @ai-sdk/openai-compatible tsx`. Ein neues Script
`"ai-review": "tsx scripts/ai-review.ts"`. Die lokale TLS-Interception verlangt
gegebenenfalls `NODE_OPTIONS=--use-system-ca` (siehe CLAUDE.md).

#### 2. Prompt-Konstruktion

**File**: `src/lib/ai-review/prompt.ts`

**Intent**: Aus PR-Titel, PR-Body und aufbereitetem Diff den Prompt bauen. Die
Kriterien-Definitionen samt „1"- und „10"-Zustand stammen wörtlich aus
`requirements.md` und leben als Konstante hier — nicht verstreut im Entry-Point.

**Contract**: `buildPrompt({title, body, diff, truncated}): string`. Der Prompt
weist das Modell explizit an, mechanisch gefangene Themen (Typen, Formatierung,
Hooks, a11y) **nicht** zu bewerten. War der Diff gekappt, sagt der Prompt das,
damit das Modell fehlende Dateien nicht als fehlende Tests missdeutet.

#### 3. Entry-Point

**File**: `scripts/ai-review.ts`

**Intent**: Diff von stdin lesen, Config aus `process.env` ziehen, den
`ToolLoopAgent` mit dem z.ai-Provider laufen lassen, Verdict berechnen, Ergebnis
als JSON auf stdout schreiben.

**Contract**: Liest `ZAI_BASE_URL`, `ZAI_API_KEY`, `REVIEW_MODEL` und bricht mit
klarer Meldung ab, wenn eine fehlt. Importiert die Kern-Module über **relative**
Pfade. Exit-Code 0 bei `passed`, 1 bei `failed`, 2 bei technischem Fehler — die
Action unterscheidet später „Reviewer sagt nein" von „Reviewer ist kaputt".

Die Provider-Verdrahtung ist der einzige nicht-offensichtliche Teil, weil
`thinking` kein OpenAI-Standardfeld ist:

```ts
const zai = createOpenAICompatible({ name: "zai", apiKey, baseURL });

const agent = new ToolLoopAgent({
  model: zai(model),
  output: Output.object({ schema: reviewSchema }),
  stopWhen: stepCountIs(2), // null Tools, aber die Struktur-Ausgabe zählt als Step
});

const { output } = await agent.generate({
  prompt: buildPrompt(...),
  providerOptions: { zai: { thinking: { type: "disabled" } } },
});
```

Greift `providerOptions` nicht, ist `transformRequestBody` auf dem Provider der
Fallback. Verifikation: Latenz und `reasoning`-Felder in der Antwort beobachten.

### Success Criteria

#### Automated Verification

- Unit-Tests weiterhin grün: `npm run test`
- Linting grün: `npm run lint`
- Script läuft ohne Env-Vars nicht durch, sondern meldet die fehlende Variable

#### Manual Verification

- `git diff main... | npm run ai-review` gibt valides JSON mit sechs Scores
- Ein absichtlich RLS-loser Migrations-Diff wird bei Kriterium 3 unter 5 bewertet
- Die Antwort kommt ohne sichtbares Reasoning und in vertretbarer Zeit
  (`thinking:disabled` greift)

**Implementation Note**: Nach dieser Phase pausieren und die manuelle Prüfung
bestätigen lassen, bevor Phase 3 beginnt.

---

## Phase 3: CI + Human-in-the-Loop (Baustufe 2)

### Overview

Der Scorer wird zum Merge-Gate: Composite Action, eigener Workflow, PR-Kommentar,
Labels, Commit-Status.

### Changes Required

#### 1. Composite Action

**File**: `.github/actions/ai-review/action.yml`

**Intent**: Den Reviewer als wiederverwendbares Plugin kapseln — Node aufsetzen,
Deps installieren, Diff erzeugen, Script fahren, Ergebnis als Output liefern.

**Contract**: `using: composite`. Inputs: `zai-api-key`, `zai-base-url`,
`review-model`, `github-token`. Outputs: `verdict`, `scorecard` (JSON). Fremde
Actions werden an `@<sha>` gepinnt, nicht an Tags.

#### 2. Workflow

**File**: `.github/workflows/ai-review.yml`

**Intent**: Der Trigger und die Side-Effects. Läuft automatisch auf jedem PR aus
demselben Repo, überspringt Fork-PRs, und lässt sich über das Label
`ai-cr:review` erneut anstoßen.

**Contract**: `on: pull_request: [opened, synchronize, reopened]` plus
`pull_request: [labeled]`. Ein Guard-Step überspringt den Lauf bei
`github.event.pull_request.head.repo.fork == true`, ohne rot zu werden.
`actions/checkout` mit **`fetch-depth: 0`**, sonst existiert der Basis-Branch
lokal nicht und `git diff` läuft ins Leere. Permissions minimal:
`pull-requests: write`, `statuses: write`, `contents: read`.

#### 3. Side-Effects

**File**: `scripts/ai-review-report.ts` (oder als Steps in der Action)

**Intent**: Die Scorecard in einen PR-Kommentar rendern, die Labels setzen, und
das Verdict als separaten Commit-Status posten.

**Contract**: Der Kommentar trägt einen unsichtbaren Dedup-Marker
(`<!-- ai-cr -->`); bei erneutem Lauf wird der neue Kommentar gepostet und der
alte gelöscht, nicht umgekehrt — sonst steht der PR kurzzeitig ohne Review da.
Labels `ai-cr:passed`/`ai-cr:failed` schließen sich gegenseitig aus; das jeweils
andere wird entfernt. Das Verdict geht als `POST /statuses` mit dem Context
`ai-review/verdict` — **nicht** über den Job-Exit-Code, denn nur ein
Commit-Status kann Required Check werden.

### Success Criteria

#### Automated Verification

- Workflow-Syntax valide: `gh workflow view ai-review.yml` (oder `actionlint`)
- Bestehende Pipeline unverändert grün: `npm run test && npm run lint && npm run build`

#### Manual Verification

- Test-PR mit RLS-loser Migration bekommt `ai-cr:failed` und einen roten
  `ai-review/verdict`-Status
- Zweiter Push auf denselben PR ersetzt den Kommentar, statt einen zweiten anzuhängen
- Label `ai-cr:review` stößt einen erneuten Lauf an
- Nach dem Setzen von `ai-review/verdict` als Required Status Check in der
  Branch-Protection ist der Merge-Button bei rotem Verdict gesperrt
- Ein `push` auf `main` löst **keinen** Reviewer-Lauf aus, und `deploy` läuft
  unabhängig vom Reviewer

**Implementation Note**: Das Setzen des Required Status Check passiert in den
GitHub-Settings und lässt sich nicht in YAML ausdrücken (`lessons.md:12-17`).
Ohne diesen Schritt ist das Gate wirkungslos. Nach dieser Phase pausieren.

---

## Phase 4: promptfoo-Regressions-Gate (Baustufe 3)

### Overview

Absicherung gegen Prompt- und Modell-Drift: ein Referenz-Diff mit bekannten
Fehlern, gegen mehrere Modelle gefahren.

### Changes Required

#### 1. promptfoo-Konfiguration

**File**: `promptfoo.yaml`, `promptfoo/fixtures/known-bad.diff`

**Intent**: Einen komplexen Diff mit absichtlich eingebauten Fehlern (RLS fehlt,
Farb-Literal, API-Route ohne `prerender`) gegen z.ai/GLM und ein bis zwei
Vergleichsmodelle über OpenRouter fahren.

**Contract**: `providers` × `tests`. Assertions: `is-json` auf die Ausgabe, eine
`javascript`-Assertion, die prüft, dass Kriterium 3 unter 5 liegt, und eine
`llm-rubric` auf die Qualität der Begründung.

### Success Criteria

#### Automated Verification

- `npx promptfoo eval` läuft durch und alle Assertions bestehen

#### Manual Verification

- Der Score-Vergleich zwischen den Modellen ist plausibel
- Champion-Beweise gesammelt: Pipeline-View, Job-Logs, PR-Kommentar

---

## Testing Strategy

### Unit Tests

- `prepareDiff`: Lockfile-Rauschen wird verworfen; Migration überlebt die Kappung,
  auch wenn sie am Ende des Roh-Diffs steht; `truncated` wird korrekt gemeldet
- `decideVerdict`: einzelne 4 bei Schnitt 8 → `failed`; alle exakt 5 → Schnitt 5
  liegt unter 7 → `failed`; alle 7 → `passed`; Grenzfall genau 5 bei Schnitt 7
  → `passed`

### Integration Tests

Keine. Der einzige externe Boundary ist das LLM, und den deckt promptfoo in
Phase 4 ab — ein `*.itest.ts` gegen Supabase hat hier nichts zu suchen.

### Manual Testing Steps

1. Test-Branch mit einer Migration ohne `enable row level security` anlegen
2. `git diff main... | npm run ai-review` — Kriterium 3 muss unter 5 liegen
3. PR öffnen, Label und roten Status prüfen, Merge-Button prüfen
4. Zweiten Commit pushen, Kommentar-Dedup prüfen
5. Migration korrigieren, `ai-cr:review` setzen, grünes Verdict prüfen

## Performance Considerations

Ein LLM-Call pro PR-Push. Kosten sind über den z.ai-Coding-Plan (Flat) gedeckelt,
nicht per Token. `stopWhen: stepCountIs(2)` deckelt die Loop-Schritte; das
Zeichen-Budget in `prepareDiff` deckelt die Input-Größe. Der Reviewer läuft
parallel zu `ci` und verlängert die Pipeline nicht.

## Migration Notes

Keine Datenmigration. Ein neues GitHub-Secret `ZAI_API_KEY` sowie die Variablen
`ZAI_BASE_URL` und `REVIEW_MODEL` sind anzulegen. `ZAI_BASE_URL` muss die volle
URL `https://api.z.ai/api/coding/paas/v4` sein, sonst antwortet der
Coding-Plan-Key mit 429.

## References

- Requirements: `context/changes/ci-review-agent/requirements.md`
- Research: `context/changes/ci-review-agent/research.md`
- LLM-Client-Vorbild: `src/lib/llm/openai-compatible.ts:128,142`
- RLS-Referenzmuster: `supabase/migrations/20260616051425_model_configs.sql:29-48`
- CI-Gate-Lehre: `context/foundation/lessons.md:12-17`
- Action-Blaupause: `.claude/skills/10x-impl-review-ci/references/workflow-template.yml`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Reiner Kern + Unit-Tests

#### Automated

- [x] 1.1 Unit-Tests grün: `npm run test` — fe00683
- [x] 1.2 Linting grün: `npm run lint` — fe00683
- [x] 1.3 Typecheck grün: `npx astro check` — fe00683

#### Manual

- [x] 1.4 `prepareDiff` gegen echten Repo-Diff geprüft: Migrationen und API-Routen stehen oben — fe00683

### Phase 2: Scorer-Entry (Baustufe 1)

#### Automated

- [x] 2.1 Unit-Tests weiterhin grün: `npm run test` — 999c966
- [x] 2.2 Linting grün: `npm run lint` — 999c966
- [x] 2.3 Script meldet fehlende Env-Variable, statt durchzulaufen — 999c966

#### Manual

- [x] 2.4 `git diff main... | npm run ai-review` gibt valides JSON mit sechs Scores — 999c966
- [x] 2.5 RLS-loser Migrations-Diff wird bei Kriterium 3 unter 5 bewertet — 999c966
- [x] 2.6 `thinking:disabled` greift — kein sichtbares Reasoning, vertretbare Latenz — 999c966

### Phase 3: CI + Human-in-the-Loop (Baustufe 2)

#### Automated

- [x] 3.1 Workflow-Syntax valide (`actionlint` bzw. `gh workflow view`) — f23e74c
- [x] 3.2 Bestehende Pipeline unverändert grün: `npm run test && npm run lint && npm run build` — f23e74c

#### Manual

- [x] 3.3 Test-PR bekommt `ai-cr:failed` und roten `ai-review/verdict`-Status — 7cadefe
- [x] 3.4 Zweiter Push ersetzt den Kommentar (Dedup), statt anzuhängen — 7cadefe
- [x] 3.5 Label `ai-cr:review` stößt einen erneuten Lauf an — 7cadefe
- [x] 3.6 Required Status Check gesetzt; Merge-Button bei rotem Verdict gesperrt — 7cadefe
- [x] 3.7 `push` auf `main` löst keinen Reviewer-Lauf aus; `deploy` bleibt entkoppelt — 7cadefe

### Phase 4: promptfoo-Regressions-Gate (Baustufe 3)

#### Automated

- [x] 4.1 `npx promptfoo eval` läuft durch, alle Assertions bestehen — 0a9346e

#### Manual

- [x] 4.2 Score-Vergleich zwischen den Modellen ist plausibel — entfällt bewusst, siehe Hinweis — 0a9346e
- [x] 4.3 Champion-Beweise gesammelt (Pipeline-View, Job-Logs, PR-Kommentar) — 0a9346e

> 4.2 wurde bewusst auf **ein** Modell (z.ai/glm-5.2) beschränkt: der
> Regressionswert liegt darin, Prompt- und Code-Änderungen gegen bekannte Diffs
> zu prüfen, nicht im Modellvergleich. Ein zweiter Provider (OpenRouter/Anthropic)
> lässt sich in `promptfooconfig.yaml` mit zwei Zeilen ergänzen, sobald ein Key
> vorliegt.
