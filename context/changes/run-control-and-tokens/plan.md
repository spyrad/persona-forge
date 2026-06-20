# Lauf-Kontrolle — Live-Token-Zähler (S-06) Implementation Plan

## Overview

S-06 verlangt zwei Dinge: einen laufenden Test abbrechen (FR-014) und je Lauf die
verbrauchten Tokens ausweisen (FR-015). Die Code-Recherche (2026-06-20) zeigt, dass
**beide Anforderungen bereits durch S-04 erfüllt sind**. Dieser Plan schließt die
einzige verbleibende Lücke — einen **mitlaufenden Token-Zähler im Live-Fortschritts-Panel**
während ein Lauf aktiv ist — und verifiziert anschließend die bestehende
Abbruch- und Token-Funktion end-to-end, um den Slice formal zu schließen.

## Current State Analysis

**Was bereits existiert (live deployed, committed):**

- **FR-014 (Abbruch):** `cancelActive()` in `src/components/runs/RunRunner.tsx:264–271` —
  Bestätigungsdialog → `stopLoop()` → `DELETE /api/runs/{id}` → Cascade-Delete der
  `run_repetitions`. Vollständiges Verwerfen, keine Teilauswertung. Der Code-Kommentar
  zitiert FR-014. Stale `running`-Läufe (Page-Reload) lassen sich über den
  „Löschen"-Button der Liste ebenfalls verwerfen.
- **FR-015 (Token-Ausweis):** Token-Akkumulatoren `runs.prompt_tokens` /
  `runs.completion_tokens` (`supabase/migrations/20260617190000_runs.sql:27–28`),
  per-rep-Spalten, `chatCompletion`-`usage`-Extraktion (`src/lib/llm/openai-compatible.ts`),
  Akkumulation in `processNextRepetition` (`src/lib/services/runs.ts:394–400`). Anzeige
  `Tokens: X ein / Y aus` in der **Lauf-Liste** (`RunRunner.tsx:461–462`) und der
  **Ergebnis-Detailseite** (`RunResult.tsx:210–211`). Keine Kostenrechnung — entspricht
  dem Non-Goal.

**Die Lücke:** `RunProgress` (`src/types.ts:278–283`) — die Antwort jedes
Orchestrierungs-Schritts — trägt nur `status`, `completedReps`, `totalReps`,
`failedCount`, **keine Tokens**. Folglich zeigt das Live-Fortschritts-Panel
(`RunRunner.tsx:404–437`) während eines laufenden Tests Wiederholungen und Fehler,
aber keinen mitlaufenden Token-Verbrauch. Tokens erscheinen erst nach Abschluss
(via `refetch()` → Liste). Der Service hat die akkumulierten Werte zum Zeitpunkt
jedes Returns bereits zur Hand (`run.promptTokens` aus `toStepState`, bzw.
`newPromptTokens` am Haupt-Return), gibt sie aber nicht zurück.

### Key Discoveries:

- `toStepState` (`src/lib/services/runs.ts:204–221`) mappt `prompt_tokens`/`completion_tokens`
  bereits zu `promptTokens`/`completionTokens`; `STEP_COLUMNS` selektiert sie. Damit sind
  die Werte an **allen** Return-Sites von `processNextRepetition` verfügbar (terminal,
  finalize, F3-no-model, unique-violation-reread, Haupt-Return).
- `processNextRepetition` hat **fünf** `return { … }`-Stellen, die ein `RunProgress`
  liefern (`runs.ts:290`, `309`, `315`, `320`, `379`, `402` — F3 zweimal). Jede muss um
  die zwei Felder ergänzt werden.
- Der Step-Endpoint `src/pages/api/runs/[id]/step.ts:24–26` reicht `progress` unverändert
  durch — **keine API-Änderung** nötig.
- Der Client setzt beim Start ein Initial-`RunProgress`-Literal (`RunRunner.tsx:232`),
  das ebenfalls die zwei Felder braucht (sonst Typfehler / `0`-Anzeige beim ersten Render).
- Kein `cancelled`-Status — by design: FR-014 = harter Delete, kein Zustand. Keine
  Migration in diesem Slice.

## Desired End State

Während ein Lauf aktiv getrieben wird, zeigt das Live-Fortschritts-Panel zusätzlich
zum Fortschrittsbalken den **mitlaufenden Token-Verbrauch** (`X ein / Y aus`), der
sich nach jeder Wiederholung aktualisiert. Nach Abschluss bleibt die Anzeige in
Liste und Detail unverändert korrekt. Abbruch verwirft den Lauf weiterhin vollständig.
Verifiziert end-to-end gegen einen echten OEJTS-Lauf (N≥2).

## What We're NOT Doing

- **Keine** neue Migration, keine neue DB-Spalte (Token-Spalten existieren).
- **Keine** API-Vertragsänderung über das Hinzufügen zweier Felder zum `RunProgress`-DTO
  hinaus (der Endpoint selbst bleibt unberührt).
- **Kein** `cancelled`-Status / Pause / Resume — FR-014 ist harter Delete.
- **Keine** Kostenschätzung / Preisrechnung (PRD Non-Goal).
- **Keine** Änderung an Liste/Detail-Token-Anzeige (bereits korrekt).
- **Keine** neuen Unit-Tests für `processNextRepetition` (netzwerkgebunden; out of scope —
  die Token-Akkumulationslogik selbst ändert sich nicht).

## Implementation Approach

Rein additive Typ-Erweiterung plus Durchreichen der bereits berechneten Werte.
Eine Phase: `RunProgress` um zwei Felder erweitern → an allen Service-Returns füllen →
Initial-Literal im Client ergänzen → Live-Panel um die Token-Zeile erweitern. Der
TypeScript-Compiler (`astro check`) erzwingt Vollständigkeit: fehlt ein Feld an einer
Return-Site oder im Initial-Literal, schlägt der Typecheck fehl — das macht die
„fünf Return-Sites" selbst-verifizierend.

## Phase 1: Live-Token-Zähler + S-06-Verifikation

### Overview

`RunProgress` trägt Tokens; `processNextRepetition` füllt sie an jedem Return; das
Live-Panel zeigt sie. Danach end-to-end-Verifikation der gesamten S-06-Funktion
(Live-Tokens, Abbruch, Token-Anzeige in Liste/Detail).

### Changes Required:

#### 1. RunProgress-DTO um Token-Felder erweitern

**File**: `src/types.ts`

**Intent**: Das Fortschritts-DTO transportiert künftig den bis dahin akkumulierten
Token-Verbrauch zum Client, damit das Live-Panel ihn ohne Voll-Refetch anzeigen kann.

**Contract**: `interface RunProgress` (Zeile 278–283) erhält zwei zusätzliche Pflichtfelder
`promptTokens: number` und `completionTokens: number` (analoge Benennung/Casing zu
`RunView`).

#### 2. processNextRepetition füllt Tokens an allen Return-Sites

**File**: `src/lib/services/runs.ts`

**Intent**: Jeder der fünf `RunProgress`-Returns gibt den zum jeweiligen Zeitpunkt
gültigen akkumulierten Token-Stand mit zurück.

**Contract**: An jedem `return { status, completedReps, totalReps, failedCount }` die
Felder `promptTokens`/`completionTokens` ergänzen. Quelle je Site: terminal (290),
finalize (309), F3-no-model (315/320) → `run.promptTokens`/`run.completionTokens`;
unique-violation-reread (379) → `c.promptTokens`/`c.completionTokens`; Haupt-Return (402)
→ die frisch berechneten `newPromptTokens`/`newCompletionTokens`. Alle Werte sind ohne
zusätzlichen DB-Read verfügbar (`toStepState` mappt sie bereits).

#### 3. Client-Initial-Progress + Live-Panel-Anzeige

**File**: `src/components/runs/RunRunner.tsx`

**Intent**: Das beim Start gesetzte Initial-`RunProgress` erhält Token-Nullwerte; das
Live-Fortschritts-Panel zeigt eine Token-Zeile, die sich pro Schritt aktualisiert.

**Contract**: (a) Das `setProgress({ … })`-Literal bei Start (Zeile 232) um
`promptTokens: 0, completionTokens: 0` ergänzen. (b) Im Live-Panel (Zeile 424–427) eine
Anzeige `Tokens: {progress.promptTokens} ein / {progress.completionTokens} aus` ergänzen,
stilistisch konsistent zur bestehenden Fortschrittszeile (gleiche `text-sm
text-blue-100/80`-Optik wie Liste/Detail).

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Type checking passes: `npm run build` (führt `astro check` aus; erzwingt vollständige
  `RunProgress`-Felder an allen Return-Sites + Initial-Literal)
- Bestehende Unit-Tests grün: `npm run test` (bzw. die 48 Vitest-Tests bleiben unberührt)
- Production-Build erfolgreich: `npm run build`

#### Manual Verification:

- Dev-Server (`npm run dev`, eingeloggter Browser): N≥2-Lauf mit gültiger Modellkonfig
  starten → Live-Panel zeigt einen Token-Zähler, der nach jeder Wiederholung **steigt**;
  Endstand stimmt mit der Liste-/Detail-Anzeige überein.
- Abbruch (FR-014): laufenden Lauf via „Abbrechen" verwerfen → Bestätigungsdialog →
  Lauf verschwindet vollständig aus der Liste (kein Teil-Eintrag, kein Ergebnis).
- Token-Ausweis (FR-015): abgeschlossener Lauf zeigt `X ein / Y aus` in Liste **und**
  Ergebnis-Detailseite; ein Lauf ohne `usage` vom Endpoint zeigt `0 / 0` ohne Crash.
- Keine Regression: Fortschrittsbalken, Fehlquote, Ergebnis-Link, Logout-Redirect
  unverändert funktional.

**Implementation Note**: Nach Abschluss der automatisierten Verifikation hier für die
manuelle Bestätigung durch den Menschen pausieren, bevor der Slice geschlossen
(`/10x-impl-review` → Roadmap `done` → `/10x-archive`) wird.

---

## Testing Strategy

### Unit Tests:

- Keine neuen. Die Token-Akkumulationslogik in `processNextRepetition` ändert sich nicht
  (nur das Durchreichen im Return). Der TypeScript-Typecheck deckt die Vollständigkeit ab.

### Manual Testing Steps:

1. N=3-Lauf gegen die echte OpenAI-kompatible Konfig starten; beobachten, dass die
   Token-Zeile im Live-Panel nach jeder Wiederholung um den jeweiligen Verbrauch steigt.
2. Endstand des Live-Panels mit der Liste-Anzeige nach Abschluss vergleichen (müssen
   identisch sein).
3. Zweiten N=3-Lauf starten und nach ~1 Wiederholung „Abbrechen" → Lauf vollständig weg.
4. Detailseite eines abgeschlossenen Laufs öffnen → Token-Zeile vorhanden.

## Performance Considerations

Keine. Zwei `int`-Felder mehr im JSON-Step-Response; kein zusätzlicher DB-Read (Werte
liegen bereits in der `STEP_COLUMNS`-Selektion bzw. werden ohnehin berechnet).

## Migration Notes

Keine. Token-Spalten existieren seit S-04.

## References

- Roadmap-Slice: `context/foundation/roadmap.md` → S-06 (Zeile 166–176)
- PRD: `context/foundation/prd.md` → FR-014 (Zeile 178), FR-015 (Zeile 181)
- Bestehende Token-Akkumulation: `src/lib/services/runs.ts:389–400`
- Bestehender Abbruch: `src/components/runs/RunRunner.tsx:264–271`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.
> Do not rename step titles.

### Phase 1: Live-Token-Zähler + S-06-Verifikation

#### Automated

- [x] 1.1 Linting passes: `npm run lint`
- [x] 1.2 Type checking passes: `npm run build` (astro check, vollständige RunProgress-Felder)
- [x] 1.3 Bestehende Unit-Tests grün: `npm run test`
- [x] 1.4 Production-Build erfolgreich: `npm run build`

#### Manual

- [x] 1.5 Live-Panel zeigt steigenden Token-Zähler; Endstand = Liste/Detail
- [x] 1.6 Abbruch (FR-014) verwirft Lauf vollständig
- [x] 1.7 Token-Ausweis (FR-015) in Liste + Detail; `0/0` ohne usage crasht nicht
- [x] 1.8 Keine Regression (Balken, Fehlquote, Ergebnis-Link, Logout-Redirect)
