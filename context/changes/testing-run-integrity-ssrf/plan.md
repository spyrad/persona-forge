# Test-Rollout Phase 2 — Lauf-Integrität (R4) & SSRF-Boundary (R3) Implementation Plan

## Overview

Wir schreiben Integration-Tests, die zwei Sicherheits-/Integritäts-Risiken
regressionsfest einfrieren: **R4 (Lauf-Integrität)** und **R3 (SSRF)**. Die Tests
bauen auf dem in Phase 1 gebauten Zwei-Account-Integration-Harness
(`src/test/integration/`) auf und friEren **korrektes, bereits implementiertes
Verhalten** ein — sie reparieren keinen Produktcode.

## Current State Analysis

Aus `research.md` (alle Stellen direkt verifiziert):

- **R4 ist DB-getragen.** Abort = `runs` Punkt-DELETE (`src/lib/services/runs.ts:145-149`)
  - DB-`on delete cascade` auf `run_repetitions.run_id`
    (`supabase/migrations/20260617190000_runs.sql:57`). Idempotenz =
    Unique `(run_id, rep_index)` (`runs.sql:68`) + bewusster `23505`-Catch
    (`runs.ts:411-438`), der bei Doppelaufruf den aktuellen Fortschritt neu liest
    statt zu duplizieren. Failure-Quote = `failed_count += (ok?0:1)`
    (`runs.ts:444-451`); Endstatus `failed` nur bei `failedCount >= repetitionCount`
    (`runs.ts:331-345`). Kein partielles Aggregat: `getRunResult` (`runs.ts:192-206`)
    liefert nur bei terminalem Status **und** `usableReps >= 1` ein `ready`-Aggregat,
    sonst `unfinished` (pending/running) bzw. `empty`.
- **R3 hat ZWEI separate Guard-Call-Sites** (kein gemeinsamer Wrapper):
  test-connection (Zod-`refine` `src/pages/api/models/test-connection.ts:17` +
  defensiv `:88`) und `chatCompletion` (`src/lib/llm/openai-compatible.ts:107`,
  vor dem fetch `:118`). Beide haben zusätzlich `redirect: "manual"` + 3xx-Block
  (`test-connection.ts:41`; `openai-compatible.ts:131,145-147`). Der Guard
  `isPublicHttpsUrl` (`src/lib/url-guard.ts:13-62`) ist isoliert unit-getestet.
- **Harness ~100 % wiederverwendbar:** `createTestAccount`/`cleanupTestAccount`
  (`accounts.ts`), `makePersona`/`makeModelConfig`/`makeCompletedRun`/`rowExists`
  (`fixtures.ts`), `makeApiContext` (`route-context.ts`), Config + Stub-Alias
  (`vitest.integration.config.ts`). Mock-Grenze (test-plan §6.2): nur die
  ausgehende LLM-HTTP-Kante mocken, nie Supabase/RLS, kein `service_role`.

## Desired End State

`npm run test:integration` führt zwei neue Suites grün aus, die beweisen:

1. Ein abgebrochener Run ist vollständig weg (run + alle Repetitions); kein
   partielles Aggregat wird je als Ergebnis gerendert.
2. Ein doppelter Step-Call (Terminal-Status **und** echte Nebenläufigkeit) fügt
   keine Duplikat-Repetition ein.
3. Ein teilweise fehlgeschlagener Run meldet seine Fehlerquote und ein Aggregat
   über die verwertbaren Reps — nicht eine fake-leere View.
4. SSRF-Adressen (Metadata-IP, localhost, eine numerische Form) werden an
   **beiden** Call-Sites (test-connection + Run-Step) abgewiesen; ein 3xx-Redirect
   wird je Site blockiert.

Verifikation: alle bestehenden 54 itests + 48 units bleiben grün; Lint +
`astro check` sauber.

### Key Discoveries:

- SSRF-Guard sitzt **innerhalb** `chatCompletion` (`openai-compatible.ts:107`) —
  das fetch wird gemockt, der Guard läuft echt. Für den R3-Run-Step-Test, der
  eine SSRF-URL nutzt, wirft der Guard **vor** dem fetch → das fetch wird gar
  nicht erreicht.
- `processNextRepetition` fängt Endpoint-Fehler ab und markiert die Rep `failed`,
  ohne den Lauf abzubrechen (`openai-compatible.ts:101-103` Doku; `runs.ts:406-408`)
  — Basis für den Failure-Quote-Test ohne echtes Netz.
- Der `23505`-Pfad (`runs.ts:423`) wird nur durch **echte Nebenläufigkeit**
  ausgelöst: zwei Calls lesen beide `completedReps=0` und versuchen `rep_index=1`;
  Postgres' Unique-Constraint serialisiert → einer gewinnt, einer bekommt 23505.
- `makeCompletedRun` (`fixtures.ts:49-82`) zeigt das Muster: Run via `createRun`
  anlegen, Repetitions **direkt per Client** in `run_repetitions` einfügen
  (kein LLM-Call), Status per `update` setzen. Die neuen Builder folgen dem.

## What We're NOT Doing

- **Kein Re-Test von `url-guard` in Isolation** — alle numerischen IPv4-Formen
  sind in `url-guard.test.ts` abgedeckt; wir testen nur die **Verdrahtung** an
  den Boundaries (test-plan §2-Anti-Pattern).
- **Kein Re-Test von Scoring/Aggregation** (`oejts-*`) — bereits unit-getestet
  (test-plan §7).
- **Kein Timeout-Pfad-Test** (test-connection 8s) — Fake-Timer-Aufwand/Flake-Risiko
  ohne proportionalen Signalwert.
- **Kein CI-Gate** — das ist Phase 3 (test-plan §3).
- **Kein `service_role`, kein Mock auf Supabase/Services** — nur die fetch-Kante.
- **Kein neuer Produktcode / keine Migration** — reine Tests + Doku.
- **Kein Resume-/Auto-Cleanup-Test** — bewusste v1-Grenze (Archiv
  `2026-06-17-oejts-measurement-run` plan-review F2); kein Integritäts-Defekt.

## Implementation Approach

Phase 1 erweitert das geteilte Harness um (a) drei Run-Builder für nicht-fertige
Runs und (b) einen fetch-Kanten-Mock-Helper, der eine valide OEJTS-konforme
Chat-Completion-Antwort liefert. Phase 2 und 3 schreiben je eine `*.itest.ts`-Suite
(eine Sorge pro Datei, wie Phase 1). Phase 4 schließt Doku + test-plan-Status.

## Critical Implementation Details

- **fetch-Mock muss die OEJTS-Antwort-Shape treffen.** `processNextRepetition`
  parst die Completion als JSON-Objekt und mappt es auf Item-Werte
  (`runs.ts:399-408`). Der Mock muss `vi.stubGlobal("fetch", ...)` setzen und ein
  `Response`-Objekt mit `choices[0].message.content` = valides OEJTS-JSON liefern;
  `afterEach` muss `vi.unstubAllGlobals()` rufen, sonst leckt der Stub in andere
  sequenziell laufende itests (`fileParallelism: false`).
- **Nebenläufigkeits-Test bleibt auf einem `running` Run mit `completedReps=0`.**
  Nur dann berechnen beide Calls `rep_index=1` und kollidieren. Ein vorab
  eingefügter Rep verschiebt `repIndex` und verfehlt den 23505-Pfad.
- **R3-Run-Step braucht KEINEN fetch-Mock**, aber der Guard darf nicht durch eine
  guard-passende Fixture-URL überdeckt werden: die ModelConfig muss eine SSRF-URL
  tragen. Da `createModelConfig` die URL beim Speichern selbst per Guard prüft,
  muss die SSRF-URL **unter Umgehung der Service-Validierung** gesetzt werden
  (direkter Client-`update` auf `model_configs.base_url` nach dem Anlegen) — sonst
  scheitert schon das Fixture-Setup. Das spiegelt den realen Defense-in-depth-Fall
  „gespeicherte URL ist bösartig, Call-Zeit-Guard muss greifen".

## Phase 1: Harness-Erweiterung

### Overview

Geteilte Test-Infrastruktur, die beide Suites brauchen: Builder für
pending/running/failed Runs und ein fetch-Kanten-Mock-Helper.

### Changes Required:

#### 1. Run-Builder für nicht-fertige Runs

**File**: `src/test/integration/fixtures.ts`

**Intent**: Drei Builder ergänzen, die einen Run in einem nicht-terminalen bzw.
fehlgeschlagenen Zustand erzeugen, damit Abort-, Idempotenz- und Failure-Quote-Tests
realistische Ausgangslagen haben. Folgen exakt dem `makeCompletedRun`-Muster
(Run via `createRun`, Repetitions direkt per Client einfügen, Status per `update`).

**Contract**:

- `makePendingRun(account, personaId, modelConfigId, repetitionCount=3): Promise<RunView>`
  — Run mit `status='pending'`, 0 Repetitions.
- `makeRunningRun(account, personaId, modelConfigId, writtenReps=1, totalReps=3): Promise<RunView>`
  — Run `status='running'`, `writtenReps` Repetitions (`status='ok'`) direkt
  eingefügt (rep_index 1..writtenReps, gap-frei).
- `makeFailedRun(account, personaId, modelConfigId, okReps, failedReps): Promise<RunView>`
  — Run mit `okReps` `ok`- + `failedReps` `failed`-Repetitions, `failed_count`
  passend gesetzt, Status `completed` (mind. 1 ok) bzw. `failed` (0 ok), analog
  zur Service-Logik. Item-Werte nur für `ok`-Reps befüllt.

#### 2. fetch-Kanten-Mock-Helper

**File**: `src/test/integration/llm-mock.ts` (neu)

**Intent**: Einen Helper bereitstellen, der `globalThis.fetch` so stubbt, dass ein
ausgehender Chat-Completion-Call eine valide, deterministische OEJTS-Antwort
zurückgibt — damit `processNextRepetition` einen `ok`-Rep produziert, ohne echtes
Netz, während der reale SSRF-Guard in `chatCompletion` mitläuft.

**Contract**:

- `mockLlmContent(content?, usage?): void` — setzt
  `vi.stubGlobal("fetch", ...)`, liefert `200` + JSON-Body mit
  `choices[0].message.content` = OEJTS-konformes JSON (alle Instrument-Items) und
  einer `usage`-Sektion (prompt/completion tokens) für die Token-Akkumulation.
- `mockLlmRedirect(status=302): void` — liefert eine 3xx-`Response` (bzw.
  `type:"opaqueredirect"`), um den Redirect-Block zu triggern.
- `restoreLlm(): void` — Wrapper um `vi.unstubAllGlobals()`, in `afterEach` zu rufen.

### Success Criteria:

#### Automated Verification:

- Typecheck passt: `npx astro check`
- Linting passt: `npm run lint`
- Bestehende Suites bleiben grün: `npm run test:integration` (54 itests + Smoke)
- Neue Helper sind importierbar (ein Smoke-Assert je Builder in einer der Suites)

#### Manual Verification:

- `makeRunningRun` erzeugt sichtbar genau `writtenReps` Zeilen in `run_repetitions`
  (per `npx supabase` SQL-Gegenprobe oder Test-Assert).
- fetch-Mock leckt nicht in Folge-Tests (Smoke nach einem Mock-Test bleibt grün).

---

## Phase 2: R4 — Lauf-Integrität

### Overview

Suite `run-integrity.itest.ts`: friert Abort-Vollständigkeit, Step-Idempotenz und
Failure-Quote/kein-partielles-Aggregat ein.

### Changes Required:

#### 1. Abort verwirft vollständig

**File**: `src/test/integration/run-integrity.itest.ts` (neu)

**Intent**: Beweisen, dass `deleteRun` auf einem laufenden Run run + alle
Repetitions entfernt und kein Ergebnis mehr abrufbar ist.

**Contract**: Account A; `makeRunningRun` (writtenReps≥1) → `deleteRun(client, runId)`
→ `rowExists(A, "runs", runId)` === false **und** `rowExists(A, "run_repetitions", repId)`
=== false (Cascade-Gegenprobe) → `getRunResult(client, userId, runId)` === null.
Zweiter `deleteRun` → false (idempotenter No-Op).

#### 2. Step-Idempotenz: Terminal + Nebenläufig

**File**: `src/test/integration/run-integrity.itest.ts`

**Intent**: Beide Idempotenz-Pfade abdecken — den deterministischen Terminal-Pfad
und den echten 23505-Nebenläufigkeitspfad.

**Contract**:

- Terminal: `makeCompletedRun` → `processNextRepetition` → Return spiegelt den
  fertigen Stand, **keine** neue Repetition (Count vor==nach).
- Nebenläufig: `makeRunningRun(writtenReps=0, totalReps=3)` (status `running`,
  0 Reps); `mockLlmOnce`; `Promise.all([processNextRepetition, processNextRepetition])`
  → genau **1** neue Repetition mit `rep_index=1`; beide Returns konsistent
  (kein Throw, `completedReps` korrekt).

#### 3. Failure-Quote & kein partielles Aggregat

**File**: `src/test/integration/run-integrity.itest.ts`

**Intent**: Beweisen, dass fehlgeschlagene Reps die Fehlerquote setzen und ein
nicht-fertiger/leerer Run nie ein `ready`-Aggregat surfacet.

**Contract**:

- `makeFailedRun(okReps=8, failedReps=2)` (total 10) → `getRunResult` →
  `state==='ready'`, Aggregat über `usableReps===8`, `run.failedCount===2`,
  `run.status==='completed'`.
- `makePendingRun` / `makeRunningRun` → `getRunResult` → `aggregate===null`,
  `state==='unfinished'` (kein partielles Aggregat).
- Voll-Fehlschlag (`makeFailedRun(okReps=0, failedReps=3)`) → `run.status==='failed'`,
  `state==='empty'`, **kein** fake-leeres `ready`.

### Success Criteria:

#### Automated Verification:

- Neue Suite grün: `npm run test:integration`
- Linting passt: `npm run lint`
- Typecheck passt: `npx astro check`
- Keine Regression in bestehenden 54 itests

#### Manual Verification:

- Der Nebenläufigkeits-Test ist über mehrere Läufe stabil (5× `test:integration`
  ohne Flake).
- Cleanup hinterlässt keine Test-User-Daten (per `cleanupTestAccount`).

---

## Phase 3: R3 — SSRF-Boundary

### Overview

Suite `ssrf-boundary.itest.ts`: beweist, dass der SSRF-Guard an **beiden**
Call-Sites feuert und Redirects blockiert werden.

### Changes Required:

#### 1. test-connection weist SSRF-URLs ab (frisch + gespeichert)

**File**: `src/test/integration/ssrf-boundary.itest.ts` (neu)

**Intent**: Beweisen, dass `POST /api/models/test-connection` interne/Metadata-URLs
abweist — sowohl bei direkt übergebener als auch bei gespeicherter URL.

**Contract**: Handler `POST` aus `@/pages/api/models/test-connection` direkt via
`makeApiContext({ method:"POST", json:{ baseUrl, apiKey }, cookie })` aufrufen.
Repräsentative Payloads je Site: `https://169.254.169.254`, `https://localhost`,
eine numerische Form (z.B. `https://2852039166` dword oder `https://0x7f000001` hex).
Erwartung: Validierungs-/`ok:false`-Antwort (kein fetch). Für den gespeicherten
Pfad: ModelConfig anlegen, dann `base_url` per direktem Client-`update` auf eine
SSRF-URL setzen (umgeht Service-Guard), `configId` übergeben → Guard `:88` greift.

#### 2. Run-Step weist SSRF-URL ab (Guard in chatCompletion)

**File**: `src/test/integration/ssrf-boundary.itest.ts`

**Intent**: Beweisen, dass der zweite, unabhängige Guard im Run-Step-Pfad feuert.

**Contract**: Account A; `makeModelConfig`, dann `base_url` per Client-`update` auf
SSRF-URL setzen; `makeRunningRun(writtenReps=0)`; `processNextRepetition` →
die Repetition wird `failed` markiert (Guard wirft in `chatCompletion` vor dem
fetch; `processNextRepetition` fängt und setzt `failed`) bzw. der erwartete
Fehlerpfad greift; **kein** echtes fetch (kein Mock nötig — wäre der Guard
umgangen, käme es zum fetch). Optional Positiv-Kontrolle: guard-passende URL +
`mockLlmOnce` → `ok`-Rep.

#### 3. 3xx-Redirect-Block je Site

**File**: `src/test/integration/ssrf-boundary.itest.ts`

**Intent**: Beweisen, dass ein guard-passender Endpoint, der per 3xx auf ein
internes Ziel umleiten will, an beiden Sites geblockt wird (`redirect:"manual"`).

**Contract**: `mockLlmRedirect(302)`; (a) test-connection mit valider Public-URL →
`ok:false` mit Redirect-Begründung (`test-connection.ts:43-44`); (b) Run-Step mit
valider Public-URL → Rep `failed` / Fehler „endpoint redirected — not allowed"
(`openai-compatible.ts:145-147`). `restoreLlm` in `afterEach`.

### Success Criteria:

#### Automated Verification:

- Neue Suite grün: `npm run test:integration`
- Linting passt: `npm run lint`
- Typecheck passt: `npx astro check`
- Keine Regression in bestehenden itests

#### Manual Verification:

- Bei absichtlich entferntem Guard (lokaler Probe-Edit, danach revertieren) wird
  in **beiden** Site-Tests ein echtes fetch versucht/Test rot — beweist, dass der
  Test die Verdrahtung wirklich prüft (nicht nur den Unit-Guard).

---

## Phase 4: Closeout

### Overview

Doku-Abschluss: test-plan-Status, Cookbook-Eintrag, Phasen-Notiz.

### Changes Required:

#### 1. test-plan-Status & Cookbook

**File**: `context/foundation/test-plan.md`

**Intent**: §3 Phase-2-Zeile auf `complete` setzen; §6.5 (run-engine-Test) von „TBD"
auf die realen Patterns füllen; §6.6 eine 2-3-Zeilen-Phase-2-Notiz anhängen
(fetch-Kanten-Mock, 23505-Nebenläufigkeit, Guard-an-zwei-Sites, SSRF-URL via
direktem Client-update). `Last updated` aktualisieren.

**Contract**: Markdown-Edits; Status-Vokabular aus §3 respektieren.

#### 2. CLAUDE.md (falls nötig)

**File**: `CLAUDE.md`

**Intent**: Nur falls die fetch-Mock-/SSRF-Fixture-Konvention dokumentationswürdig
ist, einen Satz im Test-Abschnitt ergänzen. Andernfalls auslassen.

**Contract**: Höchstens ein Satz; keine Pflicht.

### Success Criteria:

#### Automated Verification:

- Voller Lauf grün: `npm run test:integration` + `npm run test`
- Linting/Format passt: `npm run lint`

#### Manual Verification:

- test-plan §3/§6.5/§6.6 lesen sich konsistent mit dem implementierten Stand.

---

## Testing Strategy

### Unit Tests:

- Keine neuen Unit-Tests — `url-guard`/`oejts-*` sind abgedeckt; Re-Coverage ist
  explizit ausgeschlossen (§7).

### Integration Tests:

- `run-integrity.itest.ts` (R4): Abort/Cascade, Idempotenz (Terminal + Concurrent),
  Failure-Quote/kein-partielles-Aggregat.
- `ssrf-boundary.itest.ts` (R3): test-connection (frisch + gespeichert) + Run-Step
  Guard-Feuern; 3xx-Redirect-Block je Site; repräsentative Payloads.

### Manual Testing Steps:

1. `npx supabase start` + `.env.test` befüllen; `npx supabase db reset` falls nötig.
2. `npm run test:integration` — neue Suites grün, keine Regression.
3. Guard-Entfernungs-Probe (Phase 3 Manual): kurz Guard auskommentieren → SSRF-Tests
   rot → revertieren.
4. 5× wiederholen für Nebenläufigkeits-Stabilität.

## Performance Considerations

Sequenzielle Ausführung (`fileParallelism: false`) bleibt; die neuen Suites fügen
~10-20 itests hinzu. fetch ist gemockt → kein Netz, schnell. Kein Timeout-Test
(bewusst, Flake-Vermeidung).

## Migration Notes

Keine. Reine Test-/Doku-Änderung, kein Produktcode, keine DB-Migration.

## References

- Research: `context/changes/testing-run-integrity-ssrf/research.md`
- Test-Strategie: `context/foundation/test-plan.md` §2 (R3/R4), §6.2, §6.5
- Phase-1-Harness: `src/test/integration/{accounts,fixtures,route-context,setup}.ts`
- Referenz-Suites: `src/test/integration/{rls-cross-tenant,key-boundary,auth-gates}.itest.ts`
- Run-Engine: `src/lib/services/runs.ts:145-149,192-206,304-461`
- SSRF: `src/lib/url-guard.ts`, `src/lib/llm/openai-compatible.ts:105-148`,
  `src/pages/api/models/test-connection.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Harness-Erweiterung

#### Automated

- [x] 1.1 Typecheck passt: `npx astro check` — d23c477
- [x] 1.2 Linting passt: `npm run lint` — d23c477
- [x] 1.3 Bestehende Suites bleiben grün: `npm run test:integration` — d23c477
- [x] 1.4 Neue Helper sind importierbar (Smoke-Assert je Builder) — d23c477

#### Manual

- [x] 1.5 `makeRunningRun` erzeugt genau `writtenReps` Repetition-Zeilen — d23c477
- [x] 1.6 fetch-Mock leckt nicht in Folge-Tests — d23c477

### Phase 2: R4 — Lauf-Integrität

#### Automated

- [x] 2.1 Neue Suite grün: `npm run test:integration` — efbc8c3
- [x] 2.2 Linting passt: `npm run lint` — efbc8c3
- [x] 2.3 Typecheck passt: `npx astro check` — efbc8c3
- [x] 2.4 Keine Regression in bestehenden 54 itests — efbc8c3

#### Manual

- [x] 2.5 Nebenläufigkeits-Test über 5 Läufe stabil (kein Flake) — efbc8c3
- [x] 2.6 Cleanup hinterlässt keine Test-User-Daten — efbc8c3

### Phase 3: R3 — SSRF-Boundary

#### Automated

- [x] 3.1 Neue Suite grün: `npm run test:integration` — 1b02edb
- [x] 3.2 Linting passt: `npm run lint` — 1b02edb
- [x] 3.3 Typecheck passt: `npx astro check` — 1b02edb
- [x] 3.4 Keine Regression in bestehenden itests — 1b02edb

#### Manual

- [x] 3.5 Guard-Entfernungs-Probe: beide Site-Tests werden rot ohne Guard — 1b02edb

### Phase 4: Closeout

#### Automated

- [x] 4.1 Voller Lauf grün: `npm run test:integration` + `npm run test` — cb563e8
- [x] 4.2 Linting/Format passt: `npm run lint` — cb563e8

#### Manual

- [x] 4.3 test-plan §3/§6.5/§6.6 konsistent mit implementiertem Stand — cb563e8
