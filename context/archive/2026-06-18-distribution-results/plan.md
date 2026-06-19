# Ergebnis als Verteilung je Achse plus Typ-Stabilität (S-05) Implementation Plan

## Overview

Ein abgeschlossener OEJTS-Lauf wird ausgewertet und dem Nutzer als **Verteilung je
Achse plus Typ-Stabilität** präsentiert. Aus den in S-04 persistierten Rohantworten
(`run_repetitions.item_values`, Werte 1–5 je Item) wird **pro Wiederholung** je Achse
(IE, SN, FT, JP) ein Score berechnet (`score = constant + Σ(sign · value)`, `> cutoff
24` → High-Pol) und daraus der 4-Buchstaben-Typ abgeleitet. Über die N Wiederholungen
wird je Achse **Lage (Mittelwert), Streuung (Standardabweichung) und die Roh-Verteilung**
gebildet, plus die **Buchstaben-Häufigkeit je Achse**, der **Modaltyp** und dessen
**Konsistenz** (Anteil der Läufe, die exakt dem Modaltyp entsprechen). Die Auswertung
geschieht **on-the-fly** beim Laden (deterministisch, keine persistierten Aggregate).
Die Darstellung lebt auf einer eigenen Route **`/runs/[id]`** mit einer leichtgewichtigen
CSS/SVG-Verteilungsvisualisierung (Score-Skala mit Cutoff-Linie), ohne neue Dependency.

Der Methodenkern-Guardrail ist zentral: ein Einzeldurchlauf (bzw. <2 verwertbare Läufe
je Achse) wird **nie als belastbarer Wert** dargestellt, sondern mit einem expliziten
Warnbanner versehen; ein Lauf ohne verwertbare Daten zeigt einen erklärenden Leerzustand
statt einer 0-Ansicht.

## Current State Analysis

Stand nach S-04 (`context/archive/2026-06-17-oejts-measurement-run/`):

- **Rohdaten vollständig persistiert** — keine Migration nötig:
  - `run_repetitions.item_values jsonb` → `ItemValue[]` mit `{id, value: number|null, status: 'ok'|'unparsed'}`
    (`src/types.ts:199-205`, Entity `src/types.ts:234-248`).
  - `run_repetitions.status` `'pending'|'ok'|'failed'`, `raw_response`, `item_order int[]`, Tokens je Wiederholung.
  - `runs` trägt `status`, `repetition_count`, `failed_count`, `prompt_tokens`, `completion_tokens`,
    `instrument_id` (`supabase/migrations/20260617190000_runs.sql`).
- **OEJTS-Instrument typisiert vorhanden** (`src/lib/instruments/oejts.ts`): 32 Items mit `axis`+`sign`,
  4 Achsen mit `constant`/`cutoff:24`/`high`/`low`/`label`. Scoring-Formel im Header dokumentiert,
  **aber noch nicht implementiert** (`src/lib/instruments/oejts.ts:14-19, 23-96`).
- **Reine Funktionen** (`src/lib/runs/oejts-run.ts`): `permuteItems`, `buildOejtsMessages`,
  `parseOejtsResponse` — alle unit-getestet (`oejts-run.test.ts`). **Kein Scoring, keine Aggregation.**
- **runs-Service** (`src/lib/services/runs.ts`): `listRuns`/`getRun`/`createRun`/`deleteRun`/
  `processNextRepetition` + Helper `toView`/`toStepState`/`countReps`/`patchRun`. `getRun` liefert nur
  Lauf-Metadaten (`RunView`), **lädt die Wiederholungen nicht und aggregiert nichts**.
- **UI** (`src/components/runs/RunRunner.tsx` + `src/pages/runs.astro`): Start-Formular, client-getriebener
  Step-Loop, Lauf-Liste mit Status/Fehlquote/Tokens. **Keine Ergebnis-/Detailansicht** — die Lauf-Zeile ist
  die Andockstelle für den Link auf `/runs/[id]`.
- **Routing/Auth:** `src/middleware.ts:4,7` schützt via `pathname.startsWith("/runs")` — `/runs/[id]` ist
  **bereits geschützt**, keine Middleware-Änderung nötig.
- **API-Muster** (`src/pages/api/runs/[id].ts`, `[id]/step.ts`): `requireUser`, `prerender=false`, zod,
  einheitliche Fehler-Helfer (`src/lib/api-auth.ts`, `src/lib/api-responses.ts`).

### Key Discoveries:

- **Scoring ist die testbarste Stelle** (Roadmap-Risk S-05): gleiche Rohantworten → identische Werte.
  Prädestiniert für Unit-Tests, analog `oejts-run.test.ts`.
- **Achsen-weiser Dropout** (Entscheidung): Eine Wiederholung trägt zu einer Achse nur bei, wenn **alle 8
  Items dieser Achse** geparst sind (`value !== null`). Sonst fällt nur diese Achse für diese Wiederholung
  aus der Aggregation — die anderen Achsen derselben Wiederholung bleiben verwertbar. Die Zahl beitragender
  Läufe wird **je Achse** ausgewiesen (kann zwischen Achsen variieren).
- **Score-Skala je Achse unterschiedlich:** die Endpunkte ergeben sich aus `constant` ± (Summe der 8
  signierten Item-Maxima/-Minima); die Skalengrenzen müssen **je Achse aus den Items berechnet**, nicht global
  angenommen werden. Cutoff ist je Achse `24`.
- **On-the-fly-Auswertung** erfüllt die NFR „Reproduzierbare Auswertung" per Konstruktion: Rohdaten sind die
  Single Source, keine veralteten Aggregate, keine Migration.
- **Privacy/RLS** schon korrekt: `getRunResult` muss die Wiederholungen RLS-gescoped laden (own-or-global,
  Child erbt via Parent) — gleiches Muster wie `getRun`.

## Desired End State

Mit vorhandenem `/runs` (S-04) kann der Nutzer:
- aus der Lauf-Liste auf einen **abgeschlossenen** Lauf klicken → `/runs/[id]`;
- je Achse die **Verteilung** sehen: Mittelwert + Standardabweichung des Achsen-Scores, eine
  Roh-Verteilung (CSS/SVG) auf der Score-Skala mit eingezeichneter **Cutoff-Linie** und Pol-Beschriftung
  (z.B. `I ← 24 → E`), plus die **Buchstaben-Häufigkeit** (z.B. E 4× / I 1×) und die Zahl beitragender Läufe;
- den **Modaltyp** (4 Buchstaben) als Headline plus die **Konsistenz** (Anteil Läufe = Modaltyp) sehen;
- die **Fehlquote** (failed/total) des Laufs sehen;
- bei **<2 verwertbaren Läufen** (je Achse) ein prominentes „nicht belastbar"-Banner sehen;
- bei einem **failed/leeren Lauf** (0 verwertbare Wiederholungen) einen erklärenden Zustand statt 0-Ansicht;
- einen noch `pending`/`running`-Lauf → Hinweis „Lauf noch nicht abgeschlossen" (kein Ergebnis).

Verifizierbar: reine Scoring-/Aggregations-Funktionen unit-getestet (deterministisch, Dropout, Edge-Cases);
`npm run lint`/`build`/`astro check` grün; manuell: ein echter abgeschlossener Lauf zeigt plausible
Verteilungen + Modaltyp; ein Lauf mit unparsed-Items zeigt korrekt reduzierte Beitragszahlen je Achse;
N=1-Lauf zeigt das Warnbanner; Zwei-User-RLS (B kann A's `/runs/[id]` nicht laden → 404).

## What We're NOT Doing

- **Kein 2er-Vergleich** (FR-017) — das ist S-08; `/runs/[id]` ist aber der Baustein dafür.
- **Keine persistierten Aggregate / keine neue Migration** — Auswertung on-the-fly aus Rohdaten.
- **Keine Chart-Library** — leichtgewichtige eigene CSS/SVG-Komponente.
- **Keine Re-Auswertung/Neu-Parsing der Rohantworten** — `item_values` aus S-04 sind die Eingabe; das Parsing
  bleibt S-04-Sache.
- **Keine Sichtbarkeits-Umschaltung** (S-07) und **kein Resume/Neustart** unvollständiger Läufe (S-04-Scope).
- **Keine Kostenschätzung** — nur die bereits vorhandene Token-Anzeige (FR-015).
- **Kein zweites Instrument / keine deklarative Engine** — OEJTS hartkodiert (FR-011).

## Implementation Approach

Zwei Phasen, gespiegelt vom S-04-Muster (reiner getesteter Kern → UI):

1. **Kern + Service + API:** Scoring-/Aggregations-Funktionen als reine, deterministische Funktionen (neben
   den OEJTS-Daten bzw. in `src/lib/runs/`), Result-DTOs in `src/types.ts`, eine Service-Funktion
   `getRunResult` (lädt Wiederholungen RLS-gescoped + rechnet on-the-fly), und eine API-Route
   `GET /api/runs/[id]/result`. Voll über Unit-Tests + Typecheck/Lint/Build verifizierbar.
2. **UI:** geschützte Astro-Seite `/runs/[id]` mit Server-Initial-Load, eine React-Ergebnis-Komponente
   (Achsen-Verteilung + Typ-Stabilität + Edge-States) und ein Link aus der Lauf-Liste.

## Critical Implementation Details

- **Achsen-Score-Skala korrekt herleiten:** Für die Visualisierung (Balken-/Punktposition relativ zur
  Skala) müssen `min`/`max` je Achse aus den Items berechnet werden: für jedes Item der Achse trägt
  `sign·1` bzw. `sign·5` zum Minimum/Maximum bei; `min = constant + Σ min_i`, `max = constant + Σ max_i`.
  Nicht global `8..40` annehmen — die Konstanten (30/12/30/18) verschieben die Skala je Achse.
- **Dropout vor Score:** ein Achsen-Score wird für eine Wiederholung **nur** gebildet, wenn alle 8
  Item-Werte dieser Achse `!== null` sind. Andernfalls trägt diese Wiederholung nichts zu dieser Achse bei
  (zählt aber weiter zu anderen Achsen). `usableCount` wird je Achse geführt.
- **Standardabweichung bei kleinem N:** Populations-SD (durch n) verwenden, nicht Stichproben-SD (n−1) —
  bei n=1 ist SD=0 wohldefiniert; die „nicht belastbar"-Warnung (n<2) trägt die methodische Einordnung,
  nicht die SD-Formelwahl. Konsistent dokumentieren.
- **Modaltyp-Tie-Break:** der Modaltyp wird aus den **achsenweisen Mehrheits-Buchstaben** gebildet (je Achse
  der häufigere Pol über die beitragenden Läufe). Bei exaktem Gleichstand auf einer Achse entscheidet der
  Pol, dessen mittlerer Score **weiter vom Cutoff entfernt** liegt; bei auch dort Gleichstand der `low`-Pol
  (deterministisch, reproduzierbar). Tie-Break im Code dokumentieren.
- **Status-Gate:** Ergebnis nur für `status === 'completed'` (bzw. `failed` → erklärender Zustand). Für
  `pending`/`running` liefert die Auswertung keinen Result-Body, sondern einen Status-Hinweis.

## Phase 1: Scoring-/Aggregations-Kern + Service + API

### Overview

Das testbare Fundament ohne UI: reine Scoring- und Aggregations-Funktionen mit Unit-Tests, die Result-DTOs,
die Service-Funktion `getRunResult` (RLS-gescoped + on-the-fly-Aggregation) und die API-Route. Nach dieser
Phase ist das Ergebnis eines Laufs vollständig per API abrufbar.

### Changes Required:

#### 1. Scoring-Funktionen (rein, getestet)

**File**: `src/lib/runs/oejts-score.ts` (+ `src/lib/runs/oejts-score.test.ts`)

**Intent**: Aus den geparsten Item-Werten einer **einzelnen** Wiederholung je Achse einen Score berechnen und
den 4-Buchstaben-Typ ableiten — die deterministische Kernstelle des Slices. Nutzt die Achsen-/Item-Definition
aus `src/lib/instruments/oejts.ts`.

**Contract**:
- `scoreAxes(values: ItemValue[], instrument: Instrument): Record<string, number | null>` — je Achse
  `constant + Σ(sign · value)` über ihre Items; ist **irgendein** Item der Achse `null` (unparsed/fehlend),
  liefert die Achse `null` (Dropout). Keys = Achsen-`key` (IE/SN/FT/JP).
- `deriveType(axisScores: Record<string, number | null>, instrument: Instrument): string | null` — je Achse
  `score > cutoff ? high : low`; ist eine Achse `null`, ist der Gesamttyp dieser Wiederholung `null` (kein
  vollständiger 4-Buchstaben-Typ). Reihenfolge der Buchstaben = Achsen-Reihenfolge des Instruments.
- `axisScale(axisKey: string, instrument: Instrument): { min: number; max: number; cutoff: number }` —
  berechnet die Skalengrenzen je Achse aus den Item-`sign`-Extrema (für die Visualisierung).

  Tests: Referenzwert (eine bekannte Item-Antwort-Map → erwarteter Score je Achse + Typ, gegen die
  dokumentierte Formel `oejts.ts:16-19`), Dropout (eine Achse mit einem `null` → Achsen-Score `null`, andere
  Achsen unberührt), Cutoff-Grenzfall (Score == 24 → `low`, Score == 25 → `high`), Determinismus, `axisScale`
  je Achse korrekt (z.B. IE: constant 30, 8 Items → erwartete min/max).

#### 2. Aggregations-Funktion (rein, getestet)

**File**: `src/lib/runs/oejts-aggregate.ts` (+ `src/lib/runs/oejts-aggregate.test.ts`)

**Intent**: Über die `ok`-Wiederholungen eines Laufs je Achse die Verteilung bilden (Mittelwert, SD,
Roh-Werte, Buchstaben-Häufigkeit, Beitragszahl) und die laufweite Typ-Stabilität (Modaltyp + Konsistenz)
ableiten. Rein und deterministisch — Eingabe sind die geparsten Wiederholungen, keine DB.

**Contract**:
- `aggregateRun(reps: RunRepetition[], instrument: Instrument): RunAggregate` — berücksichtigt nur
  Wiederholungen mit `item_values` (status `ok`); je Achse über die Wiederholungen mit nicht-`null`
  Achsen-Score: `mean`, `sd` (Populations-SD), `scores: number[]` (Roh-Verteilung), `letterCounts:
  Record<letter, number>` (z.B. `{E:4, I:1}`), `usableCount`. Laufweit: `modalType` (achsenweise
  Mehrheits-Buchstaben + dokumentierter Tie-Break), `typeConsistency` (Anteil vollständiger Wiederholungs-Typen
  == `modalType`, Nenner = Wiederholungen mit vollständigem Typ), `usableReps` (Wiederholungen mit ≥1
  verwertbaren Achse). Liefert auch je Achse `scale` (aus `axisScale`).

  Tests: 3 synthetische Wiederholungen → erwartete mean/sd/letterCounts/modalType/consistency; achsen-weiser
  Dropout senkt nur `usableCount` der betroffenen Achse; 0 verwertbare → leeres Aggregat mit `usableReps=0`;
  N=1 → Aggregat mit `usableReps=1` (Warnung ist UI-Sache); Tie-Break-Fall deterministisch.

#### 3. Result-DTOs

**File**: `src/types.ts`

**Intent**: Die client-seitige Ergebnis-Sicht und die internen Aggregat-Typen ergänzen (View camelCase).

**Contract**: `AxisDistribution` (`{ key; label; mean; sd; scores: number[]; letterCounts: Record<string,
number>; usableCount; scale: { min; max; cutoff }; high; low }`), `RunAggregate` (`{ axes:
AxisDistribution[]; modalType: string | null; typeConsistency: number | null; usableReps: number }`),
`RunResultView` (`{ run: RunView; aggregate: RunAggregate | null; state: 'ready' | 'empty'
| 'unfinished' }` — `state` kodiert die UI-Verzweigung; `aggregate` null bei `unfinished`). Die
„<2 nicht belastbar"-Schwelle ist KEIN eigener State, sondern eine Darstellungs-Schwelle, die die UI je
Achse/laufweit aus `usableCount`/`usableReps` ableitet (siehe §4) — daher drei States, nicht vier.

#### 4. Service: `getRunResult`

**File**: `src/lib/services/runs.ts`

**Intent**: Den Lauf + seine Wiederholungen RLS-gescoped laden und on-the-fly zu `RunResultView` aggregieren.
Spiegelt das Lade-/Mapper-Muster von `getRun`/`toView`; keine persistierten Aggregate.

**Contract**: `getRunResult(sb, userId, id): Promise<RunResultView | null>` — `null` wenn Lauf nicht sichtbar
(→ 404). Lädt `runs` + zugehörige `run_repetitions` (`item_values`, `status`) in einem RLS-gescopten Select;
`status` `pending`/`running` → `state:'unfinished'`, `aggregate:null`. Sonst `aggregateRun(...)`:
`usableReps === 0` → `state:'empty'`; sonst `state:'ready'` (das `<2`-„nicht belastbar" ist eine
**Darstellungs-Schwelle** je Achse und wird in der UI aus `usableCount` abgeleitet — der Service liefert die
Zahlen, nicht das Banner). Roh-`item_values` aus dem `any` des untypisierten Clients über einen typisierten
Mapper-Parameter lautern (Lesson aus S-04: kein Cast + Zugriff).

#### 5. API-Route: Ergebnis abrufen

**File**: `src/pages/api/runs/[id]/result.ts`

**Intent**: `GET` → `getRunResult`, nach dem `[id].ts`-Muster.

**Contract**: `export const prerender = false`; `GET` → `requireUser` → `id` via `z.uuid()` →
`getRunResult` → `json(result)` (200) bzw. 404 wenn `null`. Kein POST/PUT/DELETE.

### Success Criteria:

#### Automated Verification:

- Unit-Tests grün: `npm run test` (Scoring inkl. Referenzwert/Cutoff-Grenzfall/Dropout; Aggregation inkl.
  mean/sd/letterCounts/modalType/consistency/Edge-Cases; `axisScale` je Achse)
- Lint grün: `npm run lint`
- Build grün: `npm run build`
- Typecheck grün: `npx astro check` (0 errors)

#### Manual Verification:

- `GET /api/runs/[id]/result` für einen abgeschlossenen Lauf liefert plausible Achsen-Verteilungen + Modaltyp
- Ein Lauf mit künstlich unparsed-Items (Studio) zeigt korrekt reduzierte `usableCount` der betroffenen Achse
- `pending`/`running`-Lauf → `state:'unfinished'`; failed/0-verwertbar-Lauf → `state:'empty'`
- Zwei-User-RLS: User B → `GET /api/runs/[A-id]/result` → 404

**Implementation Note**: Nach Phase 1 und grüner Automated-Verifikation für die manuelle Bestätigung
pausieren, bevor Phase 2 beginnt. Phase-Blöcke nutzen einfache Bullets; die Checkboxen liegen in `## Progress`.

---

## Phase 2: UI — Ergebnisseite `/runs/[id]` + Verlinkung

### Overview

Die geschützte Ergebnisseite: Server-Initial-Load des `RunResultView`, eine React-Komponente mit
Achsen-Verteilung (CSS/SVG, Score-Skala + Cutoff-Linie), Typ-Stabilitäts-Panel, Warnbanner und erklärenden
Edge-Zuständen, plus ein Link aus der Lauf-Liste.

### Changes Required:

#### 1. React-Komponente: Ergebnisansicht

**File**: `src/components/runs/RunResult.tsx`

**Intent**: Die Verteilung je Achse + Typ-Stabilität rendern, mit den Edge-States. Leichtgewichtige eigene
CSS/SVG-Visualisierung (keine Chart-Library). Spiegelt Styling/`cn()`-Muster der bestehenden runs-/personas-
Komponenten und nutzt shadcn/ui (`card`, `badge`, `alert` falls vorhanden, sonst Tailwind-Banner).

**Contract**: Default-Export `RunResult`, Prop `{ result: RunResultView }`. Verzweigt über `result.state`:
- `unfinished` → Hinweis „Lauf noch nicht abgeschlossen", Link zurück zu `/runs`.
- `empty` → erklärender Zustand (Fehlquote ausgewiesen, „keine verwertbaren Antworten"), keine 0-Verteilung.
- `ready` → pro Achse eine Karte: Pol-Beschriftung `low ← cutoff → high`, eine Score-Skala (`scale.min..max`)
  mit Cutoff-Markierung, die Roh-Werte als Punkte/Balken (Histogramm-artig), Mean (Markierung) + SD (Text),
  `letterCounts` (z.B. E 4× / I 1×), `usableCount`; je Achse mit `usableCount < 2` ein „nicht belastbar —
  zu wenige Läufe"-Hinweis. Oben ein Typ-Panel: `modalType` als Headline + `typeConsistency` (z.B. „4/5
  Läufe = ENTP") + laufweite Fehlquote. Bei `modalType === null` (kein vollständiger Typ über alle Achsen)
  ein erklärender Hinweis statt einer Headline.

#### 2. Geschützte Ergebnisseite

**File**: `src/pages/runs/[id].astro`

**Intent**: Server-seitiger Initial-Load via `getRunResult` (RLS-gescoped), `loadError`-Fallback, Insel via
`client:load`. `/runs/[id]` ist bereits durch die Middleware geschützt (`startsWith("/runs")`).

**Contract**: lädt `Astro.params.id`, ruft `getRunResult(sb, user.id, id)`; `null` → Astro-404 (bzw. Redirect
auf `/runs` mit Hinweis); sonst `<RunResult client:load result={...} />` im `Layout`. Konsistent mit
`runs.astro` (Server-Load + Island).

#### 3. Verlinkung aus der Lauf-Liste

**File**: `src/components/runs/RunRunner.tsx`

**Intent**: Jede Lauf-Zeile auf `/runs/[id]` verlinken (Ergebnis ansehen). Für nicht abgeschlossene Läufe
darf der Link existieren (Seite zeigt dann `unfinished`), primär aber bei `completed`/`failed` hervorgehoben.

**Contract**: In der Lauf-Liste je Zeile ein Anker/Button „Ergebnis →" auf `/runs/${run.id}` (kein
SPA-Router nötig — normales `<a href>`). Bestehende Aktionen (Abbrechen/Löschen) bleiben unberührt.

### Success Criteria:

#### Automated Verification:

- Lint grün: `npm run lint`
- Build grün: `npm run build`
- Typecheck grün: `npx astro check` (0 errors)

#### Manual Verification:

- `/runs/[id]` eines abgeschlossenen Laufs zeigt je Achse Mean/SD + Roh-Verteilung mit Cutoff-Linie + Pol-Beschriftung
- Typ-Panel zeigt Modaltyp + Konsistenz + Fehlquote korrekt; Buchstaben-Häufigkeit je Achse stimmt
- Ein N=1-Lauf (bzw. Achse mit <2 verwertbaren) zeigt das „nicht belastbar"-Banner
- Ein failed/leerer Lauf zeigt den erklärenden Leerzustand statt einer 0-Ansicht
- Ein `running`/`pending`-Lauf zeigt „noch nicht abgeschlossen"
- Link aus der Lauf-Liste führt auf die richtige Seite
- Ausgeloggt → `/runs/[id]` redirectet auf `/auth/signin`
- Zwei-User-RLS: B kann A's `/runs/[id]` nicht sehen (404/leer)

**Implementation Note**: Nach Phase 2 und grüner Automated-Verifikation für die manuelle Bestätigung
pausieren; danach Slice abschließen (`/10x-impl-review` → Roadmap S-05 `done` → `/10x-archive`).

---

## Testing Strategy

### Unit Tests:

- `scoreAxes`: Referenz-Antwortmap → erwartete Achsen-Scores (gegen `oejts.ts`-Formel), Cutoff-Grenzfälle
  (24→low, 25→high), Dropout (eine Achse `null` bei unparsed-Item), Determinismus.
- `deriveType`: vollständiger Typ aus 4 Achsen; `null` wenn eine Achse `null`; Buchstaben-Reihenfolge.
- `axisScale`: korrekte min/max je Achse aus den Item-`sign`-Extrema (alle vier Achsen).
- `aggregateRun`: mean/sd/letterCounts über synthetische Wiederholungen; modalType + Tie-Break;
  typeConsistency-Nenner; achsen-weiser Dropout senkt nur die betroffene `usableCount`; 0/1 verwertbare Läufe.

### Integration Tests:

- Kein eingerichteter Integration-Runner; RLS (`getRunResult` own-or-global, Child-via-Parent, Fremd-id →
  404) und die UI-Edge-States werden manuell verifiziert (Studio + Zwei-User + echter abgeschlossener Lauf),
  wie in S-02/S-03/S-04 etabliert.

### Manual Testing Steps:

1. Abgeschlossenen Lauf (N≥3) aus S-04 öffnen → `/runs/[id]`: je Achse Verteilung + Cutoff-Linie, Typ-Panel.
2. Studio: in einer Wiederholung ein `item_values`-Element auf `value:null,status:'unparsed'` setzen →
   Achsen-`usableCount` der betroffenen Achse sinkt, andere Achsen unverändert.
3. Lauf mit N=1 → „nicht belastbar"-Banner sichtbar.
4. Lauf mit falschem Key (alle Wiederholungen failed) → erklärender Leerzustand, Fehlquote ausgewiesen.
5. `running`-Lauf öffnen → „noch nicht abgeschlossen".
6. Zweiter Account → `/runs/[fremde-id]` → 404/Redirect.

## Performance Considerations

Scale `small`/`low qps` (PRD). On-the-fly-Aggregation über ≤25 Wiederholungen × 32 Items ist vernachlässigbar.
Kein Paging nötig (kleine Mengen), konsistent mit `runs`/`models`/`personas`. Keine neue Dependency, kein
zusätzliches Bundle-Gewicht über die eigene CSS/SVG-Komponente hinaus.

## Migration Notes

Keine Migration. Die Auswertung liest ausschließlich die in S-04 angelegten Tabellen (`runs`,
`run_repetitions`). FKs `on delete set null` + `persona_prompt_snapshot` halten historische Läufe lesbar.

## References

- Roadmap: `context/foundation/roadmap.md` (S-05). PRD: US-01, FR-016, FR-015; NFR Reproduzierbare Auswertung,
  Lauf-Resilienz, Sichtbares Fortschritts-Feedback; Guardrail Methodenkern.
- Vorgänger-Slice (Datenmodell + Rohdaten): `context/archive/2026-06-17-oejts-measurement-run/plan.md`.
- Instrument: `src/lib/instruments/oejts.ts` (32 Items, 4 Achsen, Scoring-Formel im Header; CC BY-NC-SA 4.0).
- Vorlagen: `src/lib/runs/oejts-run.ts` + `oejts-run.test.ts` (reine Funktionen + Tests), `src/lib/services/runs.ts`
  (`getRun`/`toView`-Lade-/Mapper-Muster), `src/pages/api/runs/[id].ts` (API-Muster), `src/pages/runs.astro` +
  `src/components/runs/RunRunner.tsx` (Page + Island).

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Scoring-/Aggregations-Kern + Service + API — `17dfcb3`

#### Automated

- [x] 1.1 Unit-Tests grün: `npm run test` (Scoring + Aggregation + axisScale inkl. Edge-Cases)
- [x] 1.2 Lint grün: `npm run lint`
- [x] 1.3 Build grün: `npm run build`
- [x] 1.4 Typecheck grün: `npx astro check` (0 errors)

#### Manual

- [x] 1.5 `GET /api/runs/[id]/result` liefert plausible Achsen-Verteilungen + Modaltyp (abgeschlossener Lauf) — N=5-Lauf, Mean/SD je Achse rechnerisch gegengeprüft
- [x] 1.6 Lauf mit unparsed-Items → reduzierte `usableCount` der betroffenen Achse, andere unberührt — Studio: Q3 (IE) einer rep → unparsed; IE 5→4 (Mean 16.0/SD 2.35 neu), SN/FT/JP unberührt
- [x] 1.7 `pending`/`running` → `state:'unfinished'`; failed/0-verwertbar → `state:'empty'` — pending-Lauf → unfinished; Bad-Key-Lauf 2/2 failed → empty
- [x] 1.8 Zwei-User-RLS: B → `GET /api/runs/[A-id]/result` → 404 — als B (`damian.spyra@googlemail.com`) verifiziert

### Phase 2: UI — Ergebnisseite `/runs/[id]` + Verlinkung — `b348988`

#### Automated

- [x] 2.1 Lint grün: `npm run lint`
- [x] 2.2 Build grün: `npm run build`
- [x] 2.3 Typecheck grün: `npx astro check` (0 errors)

#### Manual

- [x] 2.4 `/runs/[id]`: je Achse Mean/SD + Roh-Verteilung mit Cutoff-Linie + Pol-Beschriftung — N=5-Histogramm, Cutoff-Linie + Pol-Labels verifiziert
- [x] 2.5 Typ-Panel: Modaltyp + Konsistenz + Fehlquote korrekt; Buchstaben-Häufigkeit je Achse stimmt — INFJ, Stabilität 100 %, Fehlquote/Tokens/Badges korrekt
- [x] 2.6 N=1-Lauf (bzw. Achse <2 verwertbar) → „nicht belastbar"-Banner — N=1-Lauf, laufweit + achsenweise
- [x] 2.7 failed/leerer Lauf → erklärender Leerzustand statt 0-Ansicht — Bad-Key-Lauf → „Keine verwertbaren Antworten" + Fehlquote
- [x] 2.8 `running`/`pending`-Lauf → „noch nicht abgeschlossen" — pending-Lauf → unfinished-Hinweis
- [x] 2.9 Link aus der Lauf-Liste führt auf die richtige Seite — Ergebnis-Link je Zeile verifiziert
- [x] 2.10 Ausgeloggt → `/runs/[id]` redirectet auf `/auth/signin` — unauth-Request → 302 `/auth/signin`
- [x] 2.11 Zwei-User-RLS: B kann A's `/runs/[id]` nicht sehen — als B → Page 404 (kein Leak)
