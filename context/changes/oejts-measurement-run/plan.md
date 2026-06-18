# OEJTS-Messlauf (S-04) Implementation Plan

## Overview

Ein angemeldeter Nutzer wählt eine **Persona** + eine **Modellkonfiguration**, setzt eine
Wiederholungszahl **N** (1–25) und startet einen **OEJTS-Lauf**. Jede der N Wiederholungen
ist eine **isolierte Sitzung**: ein einziger Chat-Completion-Call präsentiert alle 32 OEJTS-Items
(pro Wiederholung neu permutiert) und fordert eine **strukturierte JSON-Antwort** (Wert 1–5 je
Item). Die Rohantwort + die geparsten Item-Werte + die Token-Nutzung werden **je Wiederholung**
persistiert. Der Lauf wird **client-orchestriert** ausgeführt (eine Wiederholung pro Request,
Schleife bis fertig) — so bleibt jeder Request innerhalb der Cloudflare-Edge-Grenzen. Fortschritt
ist live sichtbar, der Lauf abbrechbar (= vollständig verworfen), Tokens werden ausgewiesen.

Die **Achsen-Aggregation, Verteilung und Typ-Ableitung sind S-05** (FR-016) und ausdrücklich NICHT
Teil dieses Slices.

## Current State Analysis

- **Wiederverwendbar (aus S-02/S-03, per Research bestätigt):**
  - `getDecryptedTarget(sb, id): {baseUrl, apiKey} | null` (`src/lib/services/model-configs.ts`) — lädt
    Config RLS-gescoped und entschlüsselt den Key **serverseitig**. Der zentrale Einstieg für den Call.
  - Sicheres Upstream-Muster in `src/pages/api/models/test-connection.ts`: `fetch` mit `Authorization: Bearer`,
    `AbortController`-Timeout, `redirect: "manual"`, `isPublicHttpsUrl()` (`src/lib/url-guard.ts`) als
    SSRF-Guard auch auf der gespeicherten URL.
  - `requireUser()` (`src/lib/api-auth.ts`), `json/jsonError/validationError/serviceErrorResponse`
    (`src/lib/api-responses.ts`).
  - RLS-Migrationsmuster (`20260617053000_personas.sql`): `owner_id default auth.uid()`,
    `(select auth.uid())`, eine Policy je Operation, `to authenticated`, btree-Index, `visibility`-Spalte.
  - Persona-`systemPrompt` exponiert via `listPersonas`/View (`src/lib/services/personas.ts`, `src/types.ts`).
  - Frontend-Muster: Re-Fetch nach Mutation + 401-Redirect über Modul-Scope-Helper `redirectToSignin()`
    (React-Compiler-Gotcha), `loadError`-Banner (`PersonaCatalog.tsx`, `ModelConfigManager.tsx`).
- **Neu zu bauen:** der eigentliche Chat-Completion-Call (existiert nicht — nur ein `GET /models`-Probe),
  Tabellen `runs` + `run_repetitions` (+ Child-RLS), die Lauf-Orchestrierung, der OEJTS-Prompt-Builder,
  seedbare Permutation, der Antwort-Parser (JSON + Freitext-Fallback), Fortschritt/Abbruch/Token-Zählung.
- **Instrument-Daten liegen bereit:** `context/foundation/instruments/oejts-1.2.json` (32 Items, 4 Achsen,
  Scoring-Formeln, Cutoff >24). v1 ist hartkodiert (FR-011) — kein `instruments`-Tabellenschema.
- **Cloudflare-Runtime (per Research):** `astro.config.mjs` (cloudflare-Adapter, `output:"server"`),
  `wrangler.jsonc` ohne Queues/DO/Cron. Ein einzelner Request kann keine hunderte Calls überdauern →
  **client-orchestrierte Chunks** (1 Wiederholung/Request, je nur 1 Call) lösen das ohne neue Infra.

## Desired End State

Unter `/personas` und `/models` Vorhandenes vorausgesetzt, kann der Nutzer unter **`/runs`**:
- einen Lauf starten (Persona + Modellkonfig + N) → Status `pending`;
- den Lauf live ablaufen sehen (Fortschritt „k von N Wiederholungen"), client-getrieben;
- den Lauf abbrechen → er wird vollständig gelöscht;
- nach Abschluss in der Lauf-Liste Status (`completed`/`failed`), **Fehlquote** und **Token-Verbrauch**
  (Eingabe/Ausgabe) sehen.
- Die Rohantwort + geparste Item-Werte (1–5) + die verwendete Item-Reihenfolge liegen je Wiederholung
  in der DB (Basis für S-05).

Verifizierbar: Migration appliziert sauber; reine Funktionen (Prompt-Builder, Permutation, Parser)
unit-getestet; `npm run lint`/`build`/`astro check` grün; manuell: Lauf gegen einen echten
OpenAI-kompatiblen Endpunkt läuft N Wiederholungen durch, Rohdaten + Tokens + Fehlquote stimmen;
Abbruch löscht; Zwei-User-RLS (B sieht A's Läufe nicht).

### Key Discoveries:

- **1 Call je Wiederholung** (Entscheidung): alle 32 Items in *einem* Prompt, JSON-Array zurück → N statt
  32N Calls. Das macht das Edge-Limit-Problem für N≤25 unkritisch und passt zu „isolierte Sitzung je
  Wiederholung" (FR-012).
- **Reproduzierbarkeit (NFR):** Permutation ist seedbar; der verwendete `item_order` wird je Wiederholung
  gespeichert; das Parsing mappt die Antwort über die Item-IDs zurück (nicht über die Position).
- **Selbst-enthaltener Lauf:** der aufgelöste Persona-System-Prompt wird als Snapshot auf dem Lauf
  gespeichert, damit ein Lauf reproduzierbar/lesbar bleibt, auch wenn die Persona später gelöscht wird
  (FK `on delete set null`).
- **Privacy-by-default:** `runs.visibility` default `'private'` (nicht `'global'`) — konsistent mit der
  S-03-impl-review-Lesson F1; der Privat/Global-Toggle ist S-07. Select-Policy `own-or-global` jetzt für
  Forward-Compat.

## What We're NOT Doing

- **Keine Achsen-Aggregation / Verteilung / Typ-Ableitung / Ergebnisansicht** — das ist **S-05** (FR-016).
  S-04 endet bei roh + geparsten Item-Werten + Status/Fehlquote/Tokens.
- **Kein Vergleich zweier Läufe** (FR-017) — späterer Slice.
- **Keine deklarative Test-Engine** — OEJTS ist hartkodiert (FR-011); `instrument_id` ist nur ein Feld für
  spätere Erweiterung, kein generisches Schema.
- **Keine Sichtbarkeits-Umschalt-UI** — `visibility`-Spalte + RLS jetzt, Toggle ist S-07.
- **Keine Cloudflare Queues / Durable Objects** — client-orchestrierte Chunks reichen für v1 (small scale,
  after-hours). Das Datenmodell erlaubt einen späteren Umstieg auf Queues ohne Schema-Bruch.
- **Keine Kostenschätzung** — nur Token-Zählung (FR-015).
- **Keine begrenzte Parallelität** — Wiederholungen laufen sequentiell (NFR Last-Verträglichkeit).
- **Kein zweites Instrument (IPIP)** — späterer Cycle.

## Implementation Approach

Drei Phasen: (1) reiner, getesteter Kern (Instrument-Modul, Prompt-Builder, seedbare Permutation,
Antwort-Parser) + Datenmodell + Service-Grundgerüst ohne LLM; (2) der LLM-Call + die
Orchestrierungs-Schritt-API (eine Wiederholung pro Request); (3) die `/runs`-UI mit client-getriebenem
Step-Loop. Der Slice spiegelt das etablierte Muster (Migration → Types → Service → API → Island), ergänzt
um einen neuen `src/lib/llm/`-Client und einen `src/lib/instruments/`-Kern.

**Client-Orchestrierung:** `POST /api/runs` legt den Lauf an (`pending`). Der Client ruft dann wiederholt
`POST /api/runs/[id]/step` — jeder Aufruf verarbeitet **genau eine** Wiederholung (decrypt → permute →
build → call → parse → persist → Aggregat aktualisieren) und liefert den Fortschritt zurück. Der Client
schleift, bis `status` `completed`/`failed` ist. Abbruch = `DELETE /api/runs/[id]`.

## Critical Implementation Details

- **base_url → Endpunkt:** Modellkonfig speichert die API-Wurzel (wie bei `test-connection` für
  `GET {baseUrl}/models`). Der Completion-Call geht an `POST {baseUrl}/chat/completions`. `isPublicHttpsUrl`
  **erneut** auf der entschlüsselten `baseUrl` prüfen (Defense-in-Depth, wie S-02), `redirect:"manual"`.
- **JSON-Mode tolerant:** `response_format: {type:"json_object"}` anfordern; nicht alle Endpunkte
  unterstützen es → der Call darf daran nicht hart scheitern, und der Freitext-Fallback-Parser fängt
  Antworten ohne sauberes JSON (FR-013).
- **Resilienz vs. Abbruch:** eine fehlgeschlagene/ungparsebare Wiederholung wird als `run_repetitions.status='failed'`
  festgehalten und der Lauf läuft weiter (NFR). Erst wenn am Ende **0** Wiederholungen verwertbar sind →
  `runs.status='failed'`. Ein **expliziter** Abbruch dagegen löscht den Lauf komplett (FR-014). Ein per
  Tab-Schließen unterbrochener Lauf bleibt `running`; in v1 gibt es **kein Resume** — ein solcher Lauf kann
  gelöscht und neu gestartet werden (kein Auto-Cleanup, kein „Fortsetzen"-Button). Resume ist späterer Scope.
- **Token-Aggregat:** `usage.prompt_tokens`/`completion_tokens` je Call auf den Lauf aufsummieren; fehlt
  `usage`, bleibt der Beitrag dieser Wiederholung `null`/0 und wird als „unbekannt" behandelt (kein Schätzer).

## Phase 1: Reiner Kern + Datenmodell

### Overview

Das testbare Fundament ohne externe I/O: Instrument-Modul, reine Funktionen (Prompt-Builder, Permutation,
Parser) mit Unit-Tests, die Migration `runs` + `run_repetitions` (+ RLS), Types und ein Service-Grundgerüst
(Anlegen/Liste/Lesen/Löschen — ohne LLM-Ausführung). Unabhängig deploybar: Schema live, Läufe lassen sich
anlegen (`pending`) und löschen.

### Changes Required:

#### 1. Migration: `runs` + `run_repetitions` + RLS

**File**: `supabase/migrations/<ts>_runs.sql`

**Intent**: Parent-Tabelle `runs` (Lauf-Konfig + Status + Token-/Fehler-Aggregat + Persona-Prompt-Snapshot)
und Child-Tabelle `run_repetitions` (Rohantwort + geparste Item-Werte als jsonb + Tokens + Status je
Wiederholung). RLS nach dem `personas`-Muster; die Child-Tabelle erbt die Sichtbarkeit über eine
exists-Subquery auf den Parent.

**Contract**:
- `public.runs`: `id uuid pk default gen_random_uuid()`, `owner_id uuid not null default auth.uid()
  references auth.users(id) on delete cascade`, `visibility public.visibility not null default 'private'`,
  `persona_id uuid references public.personas(id) on delete set null`, `model_config_id uuid references
  public.model_configs(id) on delete set null`, `persona_prompt_snapshot text not null`,
  `instrument_id text not null default 'oejts-1.2'`, `repetition_count int not null check (repetition_count
  between 1 and 25)`, `status text not null default 'pending' check (status in
  ('pending','running','completed','failed'))`, `prompt_tokens int not null default 0`,
  `completion_tokens int not null default 0`, `failed_count int not null default 0`,
  `created_at/updated_at timestamptz not null default now()`. btree-Index auf `owner_id`.
  Policies (KEINE update-Restriktion über owner hinaus): `select` (`to authenticated using visibility =
  'global' or owner_id = (select auth.uid())`), `insert` (`with check owner_id = (select auth.uid())`),
  `update` (`using/with check owner_id = (select auth.uid())`), `delete` (`using owner_id = (select auth.uid())`).
- `public.run_repetitions`: `id uuid pk`, `run_id uuid not null references public.runs(id) on delete cascade`,
  `rep_index int not null`, `item_order int[] not null`, `raw_response text`, `item_values jsonb`,
  `status text not null default 'pending' check (status in ('pending','ok','failed'))`, `error text`,
  `prompt_tokens int`, `completion_tokens int`, `created_at/updated_at`. btree-Index auf `run_id`,
  unique `(run_id, rep_index)`. RLS: alle vier Policies über exists-Subquery auf `runs` (select: own-or-global;
  insert/update/delete: owner-only) — Muster:
  ```sql
  create policy "run_repetitions_insert_via_run" on public.run_repetitions
    for insert to authenticated
    with check (exists (select 1 from public.runs r
      where r.id = run_id and r.owner_id = (select auth.uid())));
  ```

#### 2. Instrument-Modul

**File**: `src/lib/instruments/oejts.ts` (typisiertes TS-Modul, KEIN JSON-Import)

**Intent**: Die OEJTS-1.2-Daten typisiert und zur Laufzeit verfügbar machen (Items, Achsen, Scoring-Konstanten,
Cutoff, Permutations-Flag). Die OEJTS-Werte werden **als TS-Literal in dieses Modul übernommen** (kein
Laufzeit-Import aus `context/`). `context/foundation/instruments/oejts-1.2.json` bleibt die menschenlesbare
Single Source / Referenz; `src/lib/instruments/oejts.ts` ist die App-Laufzeitfassung (mit Kommentar-Header,
der auf die context/-Quelle + Lizenz CC BY-NC-SA verweist). Grund (Plan-Review F1): ein Import aus `context/`
scheitert — `resolveJsonModule` ist nicht gesetzt, es gibt keinen Path-Alias auf `context/`, und ein
App→`context/`-Import wäre eine Schichtverletzung (der eslint-Pre-Commit-Hook fängt das).

**Contract**: Export `OEJTS: Instrument` mit `id`, `items: {id, axis, sign, left, right}[]` (32),
`axes: {key, constant, cutoff, high, low}[]` (4), `permute: true` — als `const`-Literal, `satisfies Instrument`.
Typ `Instrument` in `src/types.ts`. Kein JSON-Import, kein `resolveJsonModule`-Eingriff nötig.

#### 3. Reine Funktionen: Prompt, Permutation, Parser (getestet)

**File**: `src/lib/runs/oejts-run.ts` (+ `src/lib/runs/oejts-run.test.ts`)

**Intent**: Drei reine, deterministische Funktionen — die testbarste Stelle des Slices (analog
`persona-compile`/`crypto`/`url-guard`).

**Contract**:
- `permuteItems(items, seed: number): {ordered: Item[]; order: number[]}` — deterministische, seedbare
  Permutation (gleicher Seed → gleiche Reihenfolge). `order` ist das gespeicherte Reproduktions-Artefakt.
- `buildOejtsMessages(systemPrompt: string, orderedItems: Item[]): {role,content}[]` — System-Message =
  Persona-`systemPrompt`; User-Message = OEJTS-Instruktion + die (permutierten) Items + Aufforderung, ein
  JSON-Objekt `{"answers":[{"id":"Q…","value":1-5}, …]}` zurückzugeben (bipolare Skala erklärt: 1=linker
  Pol … 5=rechter Pol).
- `parseOejtsResponse(raw: string, expectedIds: string[]): {values: {id, value: number|null, status:
  'ok'|'unparsed'}[]; okCount: number}` — zuerst JSON-Parse (Objekt/Array, id→value 1–5, robust gegen
  Markdown-Codefences/Zusatztext); schlägt das fehl, Freitext-Fallback (Heuristik je Item-ID, z. B.
  `Q12: 3` / `12) 3`); jeder Wert wird auf 1–5 validiert, sonst `value:null, status:'unparsed'`.
  Tests: sauberes JSON, JSON in Codefence, fehlende/überzählige Items, Out-of-Range-Werte, reiner
  Freitext-Fallback, vollständig ungparsebar (`okCount=0`), Determinismus.

#### 4. Shared Types

**File**: `src/types.ts`

**Intent**: Entity + Views + Input für Läufe ergänzen (Konvention Entity snake_case, View/Input camelCase),
plus `Instrument`/`Item`-Typen und der `RunRepetition`-Shape inkl. `ItemValue`-jsonb-Form.

**Contract**: `Run` (DB-Entity), `RunView` (`id, personaId, modelConfigId, instrumentId, repetitionCount,
status, promptTokens, completionTokens, failedCount, completedReps, visibility, isOwn, createdAt, updatedAt`
— `completedReps` aus Zählung der `run_repetitions`), `RunRepetition`, `ItemValue` (`{id, value, status}`),
`CreateRunInput` (`personaId, modelConfigId, instrumentId?, repetitionCount`), `RunProgress`
(`{status, completedReps, totalReps, failedCount}`), `Instrument`, `Item`.

#### 5. Service-Grundgerüst (ohne LLM)

**File**: `src/lib/services/runs.ts`

**Intent**: CRUD-Kapselung analog `personas.ts`, RLS-vertraut. `createRun` löst die Persona RLS-gescoped auf,
schreibt deren `systemPrompt` als `persona_prompt_snapshot` und validiert implizit, dass Persona +
Modellkonfig sichtbar/eigen sind (sonst Fehler). Die Ausführung (`processNextRepetition`) kommt in Phase 2.

**Contract**: `listRuns(sb, userId): RunView[]` (neueste zuerst, inkl. `completedReps`), `createRun(sb,
userId, input): RunView` (Persona-Snapshot setzen; `null`/Fehler wenn Persona oder Modellkonfig nicht
sichtbar), `getRun(sb, userId, id): RunView | null`, `deleteRun(sb, id): boolean` (`.select("id").maybeSingle()`
→ false = 404). Kein `update` nach außen außer interner Status-/Aggregat-Fortschreibung (Phase 2).

### Success Criteria:

#### Automated Verification:

- Migration appliziert sauber (`npx supabase db push` bzw. Studio)
- Unit-Tests grün: `npm run test` (Prompt-Builder, Permutation determinisitisch, Parser inkl. Fallback & Edge-Cases)
- Lint grün: `npm run lint`
- Build grün: `npm run build`
- Typecheck grün: `npx astro check` (0 errors)

#### Manual Verification:

- Lauf via API/Studio anlegbar (`pending`), erscheint in `listRuns`, `persona_prompt_snapshot` gesetzt
- Löschen entfernt den Lauf; fremde id → 404
- Zwei-User-RLS: User B sieht User A's Läufe nicht (Studio/zweiter Account)

**Implementation Note**: Nach Phase 1 und grüner Automated-Verifikation für die manuelle Bestätigung
pausieren, bevor Phase 2 beginnt.

---

## Phase 2: LLM-Call + Orchestrierung

### Overview

Der eigentliche externe Call und die Schritt-API. Ein neuer Chat-Completion-Client (sicheres Muster aus
`test-connection`), und `processNextRepetition` als Herzstück: eine Wiederholung end-to-end (decrypt →
permute → build → call+retry → parse → persistiere `run_repetition` → Lauf-Aggregat fortschreiben →
Status-Übergang). Nach diesem Schritt ist der Lauf vollständig per API fahrbar.

### Changes Required:

#### 1. LLM-Chat-Completion-Client

**File**: `src/lib/llm/openai-compatible.ts`

**Intent**: Einen OpenAI-kompatiblen Chat-Completion-Call kapseln, mit den S-02-Sicherheitsmustern und
Retry/Backoff. Server-only.

**Contract**: `chatCompletion(args: {baseUrl, apiKey, model, messages, jsonMode?: boolean, signal?:
AbortSignal}): Promise<{content: string; promptTokens: number|null; completionTokens: number|null}>`.
`POST {baseUrl}/chat/completions`, `Authorization: Bearer`, `redirect:"manual"`, `AbortController`-Timeout
(~60 s), `isPublicHttpsUrl(baseUrl)` vor dem Call. `jsonMode` → `response_format:{type:"json_object"}`
(tolerant: bei Endpunkt-Ablehnung Call ohne `response_format` wiederholen). Retry mit exponentiellem Backoff
bei 429/5xx (z. B. 3 Versuche). Nie Key/Antwort-Header leaken.

#### 2. Orchestrierungs-Schritt im Service

**File**: `src/lib/services/runs.ts`

**Intent**: `processNextRepetition` verarbeitet die nächste offene Wiederholung eines Laufs und schreibt
Fortschritt fort. Idempotent genug, dass paralleler Doppelaufruf keine Wiederholung doppelt schreibt
(unique `(run_id, rep_index)` schützt).

**Contract**: `processNextRepetition(sb, userId, runId): Promise<RunProgress>` —
1. Lauf RLS-gescoped lesen; nicht vorhanden → Fehler/`null`. Status `pending` → auf `running` setzen.
2. `completedReps = count(run_repetitions)`. Ist `completedReps >= repetition_count` → Lauf finalisieren:
   `failed_count == repetition_count` → `status='failed'`, sonst `completed`; `RunProgress` zurück.
3. Sonst `rep_index = completedReps + 1`: `getDecryptedTarget(sb, model_config_id)` → permutiere (Seed aus
   `runId+rep_index` deterministisch) → `buildOejtsMessages(persona_prompt_snapshot, ordered)` →
   `chatCompletion(jsonMode:true)`. Fehler/Abort → `run_repetitions` mit `status='failed'`, `error`,
   `failed_count++`. Erfolg → `parseOejtsResponse`; `okCount==0` → `status='failed'` (+`failed_count++`),
   sonst `status='ok'` mit `item_values`+`raw_response`+`item_order`+Tokens; Lauf-`prompt/completion_tokens`
   aufsummieren. `updated_at` fortschreiben. `RunProgress` zurück.
4. **Fehlende Eingabe (Plan-Review F3):** ist `model_config_id` null (Konfig nach `on delete set null`
   gelöscht) oder liefert `getDecryptedTarget` `null` (nicht mehr sichtbar), kann kein Call erfolgen → den
   **ganzen Lauf** auf `status='failed'` mit erklärendem `error` (z. B. „Modellkonfiguration nicht mehr
   verfügbar") setzen statt einer Exception; `RunProgress` zurück.
5. **Nebenläufigkeit (Plan-Review F4):** den Insert von `run_repetitions` gegen eine Verletzung des
   unique-Constraints `(run_id, rep_index)` absichern — tritt sie auf (paralleler Doppelaufruf), NICHT als
   Fehler propagieren, sondern als „bereits fortgeschritten" behandeln: aktuellen `RunProgress` neu lesen und
   zurückgeben.

#### 3. API-Routen

**File**: `src/pages/api/runs/index.ts`, `src/pages/api/runs/[id].ts`, `src/pages/api/runs/[id]/step.ts`

**Intent**: Start/Liste/Status/Abbruch + der Orchestrierungs-Schritt, nach dem Models/Personas-Muster
(`requireUser`, `prerender=false`, zod, einheitliche Fehler-Helfer).

**Contract**:
- `index.ts`: `GET` → `listRuns` (200); `POST` → `createRun` (201). zod: `personaId` `z.uuid()`,
  `modelConfigId` `z.uuid()`, `instrumentId` `z.string().default('oejts-1.2')`, `repetitionCount`
  `z.number().int().min(1).max(25)`.
- `[id].ts`: `GET` → `getRun` (404 wenn `null`); `DELETE` → `deleteRun` (Abbruch = löschen, 404 wenn false);
  `id` via `z.uuid()`. **Kein PUT.**
- `[id]/step.ts`: `POST` → `processNextRepetition` → `RunProgress` (200). 404 wenn Lauf nicht sichtbar.

### Success Criteria:

#### Automated Verification:

- Lint grün: `npm run lint`
- Build grün: `npm run build`
- Typecheck grün: `npx astro check`
- (Unit-Tests aus Phase 1 weiterhin grün: `npm run test`)

#### Manual Verification:

- Lauf gegen einen echten OpenAI-kompatiblen Endpunkt: wiederholtes `POST /step` fährt N Wiederholungen
  durch; `run_repetitions` enthält Rohantwort + geparste Werte + `item_order` + Tokens
- JSON-Mode-Antwort wird korrekt geparst; ein bewusst „schlechter" Endpunkt/Antwort triggert den
  Freitext-Fallback bzw. `status='failed'` ohne den Lauf abzubrechen (Fehlquote steigt)
- Lauf mit absichtlich falschem Key/URL → Wiederholungen `failed`, am Ende `runs.status='failed'` (0 verwertbar)
- Token-Aggregat (`prompt_tokens`/`completion_tokens`) plausibel; Endpunkt ohne `usage` → unbekannt/0
- `DELETE` während des Laufs entfernt run + run_repetitions vollständig
- SSRF: Modellkonfig mit privater/Nicht-HTTPS-URL wird beim Call abgewiesen

**Implementation Note**: Nach Phase 2 und grüner Automated-Verifikation für die manuelle Bestätigung
pausieren, bevor Phase 3 beginnt.

---

## Phase 3: UI — `/runs` mit client-getriebenem Step-Loop

### Overview

Die geschützte `/runs`-Seite: Lauf starten (Persona + Modellkonfig + N), client-getriebener Step-Loop mit
Live-Fortschritt + Abbruch, und eine Lauf-Liste mit Status/Fehlquote/Tokens. Keine Ergebnis-/Verteilungsansicht
(S-05).

### Changes Required:

#### 1. React-Island: Runner + Liste

**File**: `src/components/runs/RunRunner.tsx`

**Intent**: Start-Formular (Persona-Select aus geladenen Personas, Modellkonfig-Select, N-Eingabe 1–25
Default 5), client-getriebener Loop, Fortschrittsanzeige, Abbruch, Lauf-Liste. Gespiegelt von
`ModelConfigManager`/`PersonaCatalog` (Re-Fetch, 401-Redirect via Modul-Scope-`redirectToSignin()`,
`loadError`-Banner).

**Contract**: Default-Export `RunRunner`, Props `{initialRuns: RunView[]; personas: PersonaView[];
modelConfigs: ModelConfigView[]; loadError?: boolean}`. Start → `POST /api/runs` → dann Schleife
`POST /api/runs/[id]/step`, nach jeder Antwort Fortschritt (`completedReps/totalReps`, `failedCount`)
aktualisieren, bis `status` `completed`/`failed`; Verkettung über `setTimeout` (kein `setInterval`).
Abbruch-Button → `DELETE /api/runs/[id]`, Loop stoppen, Liste re-fetchen. Liste zeigt je Lauf Status,
Fehlquote (`failedCount/repetitionCount`), Tokens (in/out). Disabled-Start wenn keine Persona/Modellkonfig
vorhanden (Hinweis-Link auf `/personas` bzw. `/models`).

#### 2. Geschützte Page + Routing + Dashboard-Link

**File**: `src/pages/runs.astro`, `src/middleware.ts`, `src/pages/dashboard.astro`

**Intent**: Server-seitiger Initial-Load (`listRuns` + `listPersonas` + `listModelConfigs`, RLS-gescoped,
`loadError`-Fallback), Island via `client:load`; `/runs` zu `PROTECTED_ROUTES`; Dashboard-Link „Läufe →".

**Contract**: `runs.astro` rendert `<RunRunner client:load … />` im `Layout`. `PROTECTED_ROUTES =
["/dashboard","/models","/personas","/runs"]`. Dashboard: zusätzlicher Anker auf `/runs`.

### Success Criteria:

#### Automated Verification:

- Lint grün: `npm run lint`
- Build grün: `npm run build`
- Typecheck grün: `npx astro check`

#### Manual Verification:

- `/runs`: Lauf mit echter Persona+Modellkonfig starten → Fortschritt zählt live hoch bis N, dann `completed`
- Lauf-Liste zeigt Status, Fehlquote und Token-Verbrauch korrekt
- Abbruch während des Laufs entfernt den Lauf aus der Liste (gelöscht)
- Start ist deaktiviert/erklärt, wenn keine Persona oder Modellkonfig existiert
- Ausgeloggt → `/runs` redirectet auf `/auth/signin`
- Zwei-User-RLS: B sieht A's Läufe nicht

**Implementation Note**: Nach Phase 3 und grüner Automated-Verifikation für die manuelle Bestätigung
pausieren; danach Slice abschließen (`/10x-impl-review` → Roadmap S-04 `done` → `/10x-archive`).

---

## Testing Strategy

### Unit Tests:

- `permuteItems`: Determinismus (gleicher Seed → gleiche Order), Vollständigkeit (alle 32 IDs genau einmal).
- `parseOejtsResponse`: sauberes JSON, JSON in Codefence/mit Zusatztext, fehlende/überzählige Items,
  Out-of-Range-Werte, reiner Freitext-Fallback, vollständig ungparsebar (`okCount=0`).
- `buildOejtsMessages`: System=Persona-Prompt, alle Items + JSON-Aufforderung enthalten, stabile Form.

### Integration Tests:

- Kein eingerichteter Integration-Runner; RLS (own-or-global, Child-via-Parent, Delete-404) + der echte
  LLM-Call werden manuell verifiziert (Studio + Zwei-User + echter Endpunkt), wie in S-02/S-03 etabliert.

### Manual Testing Steps:

1. Persona + Modellkonfig vorhanden, `/runs` öffnen → Start-Formular, N=3.
2. Starten → Fortschritt zählt 1→3, Status `completed`; Liste zeigt Tokens + Fehlquote 0.
3. Modellkonfig mit falschem Key → Lauf endet `failed` (0 verwertbar), keine Hänger.
4. Lauf mit N=5 starten, mitten abbrechen → Lauf verschwindet (gelöscht).
5. Studio: `run_repetitions` prüfen — Rohantwort, `item_values` (1–5), `item_order`, Tokens je Wiederholung.
6. Zweiter Account → sieht die Läufe aus 1–5 nicht.

## Performance Considerations

Scale `small`/`low qps` (PRD). Sequentielle Wiederholungen + Retry/Backoff schonen ratenbegrenzte Endpunkte
(NFR Last-Verträglichkeit). 1 Call/Wiederholung hält die Gesamt-Call-Zahl klein (≤25). Kein Paging der
Lauf-Liste in v1 (kleine Mengen), konsistent mit `models`/`personas`.

## Migration Notes

- Eine Migration in Phase 1 (`runs` + `run_repetitions` + RLS). Deploy: Push auf `main` + `npx supabase db push`
  (S-02/S-03-Muster: Docker lokal ggf. nicht oben → direkt aufs Prod-Projekt, von Damian autorisiert).
- FKs `on delete set null` (persona/model) + `persona_prompt_snapshot` halten historische Läufe
  reproduzierbar, auch wenn Eingaben gelöscht werden.

## References

- Roadmap: `context/foundation/roadmap.md` (S-04). PRD: FR-010, FR-012, FR-013, FR-014, FR-015 + NFRs
  (Lauf-Resilienz, Reproduzierbarkeit, Fortschritt, Key-/Daten-Dichtheit, Last-Verträglichkeit). US-01.
- Instrument: `context/foundation/instruments/oejts-1.2.json` (Lizenz CC BY-NC-SA 4.0 — privat/MVP OK).
- Vorlagen: `src/lib/services/model-configs.ts` (`getDecryptedTarget`), `src/pages/api/models/test-connection.ts`
  (sicherer Upstream-Call), `src/lib/url-guard.ts`, `supabase/migrations/20260617053000_personas.sql` (RLS),
  `src/components/personas/PersonaCatalog.tsx` / `src/components/models/ModelConfigManager.tsx` (Island).
- Archiv S-03: `context/archive/2026-06-17-persona-catalog/` (Privacy-by-default-Lesson F1).

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Reiner Kern + Datenmodell

#### Automated

- [x] 1.1 Migration appliziert sauber (`runs` + `run_repetitions` + RLS)
- [x] 1.2 Unit-Tests grün: `npm run test` (Prompt, Permutation, Parser inkl. Fallback/Edge-Cases)
- [x] 1.3 Lint grün: `npm run lint`
- [x] 1.4 Build grün: `npm run build`
- [x] 1.5 Typecheck grün: `npx astro check` (0 errors)

#### Manual

- [x] 1.6 Lauf via API/Studio anlegbar (`pending`), in `listRuns`, `persona_prompt_snapshot` gesetzt
- [x] 1.7 Löschen entfernt Lauf; fremde id → 404
- [x] 1.8 Zwei-User-RLS: B sieht A's Läufe nicht

### Phase 2: LLM-Call + Orchestrierung

#### Automated

- [x] 2.1 Lint grün: `npm run lint`
- [x] 2.2 Build grün: `npm run build`
- [x] 2.3 Typecheck grün: `npx astro check`
- [x] 2.4 Unit-Tests weiterhin grün: `npm run test`

#### Manual

- [x] 2.5 Echter Endpunkt: `POST /step` fährt N Wiederholungen durch; `run_repetitions` mit Roh+Werte+Order+Tokens
- [x] 2.6 JSON-Mode geparst; „schlechte" Antwort → Freitext-Fallback bzw. `failed` ohne Lauf-Abbruch (Fehlquote)
- [x] 2.7 Falscher Key/URL → alle Wiederholungen `failed`, Lauf `failed` (0 verwertbar)
- [x] 2.8 Token-Aggregat plausibel; Endpunkt ohne `usage` → unbekannt/0
- [x] 2.9 `DELETE` während Lauf löscht run + run_repetitions vollständig
- [x] 2.10 SSRF: private/Nicht-HTTPS-URL beim Call abgewiesen

### Phase 3: UI — `/runs`

#### Automated

- [x] 3.1 Lint grün: `npm run lint` — 2f3ba29
- [x] 3.2 Build grün: `npm run build` — 2f3ba29
- [x] 3.3 Typecheck grün: `npx astro check` — 2f3ba29

#### Manual

- [x] 3.4 `/runs`: Lauf starten → Fortschritt zählt live bis N, dann `completed` — 2f3ba29
- [x] 3.5 Liste zeigt Status, Fehlquote, Token-Verbrauch korrekt — 2f3ba29
- [x] 3.6 Abbruch während Lauf entfernt ihn aus der Liste (gelöscht) — 2f3ba29
- [x] 3.7 Start deaktiviert/erklärt ohne Persona/Modellkonfig — 2f3ba29
- [x] 3.8 Ausgeloggt → `/runs` redirectet auf `/auth/signin` — 2f3ba29
- [x] 3.9 Zwei-User-RLS: B sieht A's Läufe nicht — 2f3ba29
