# C-B: zod-Validator an der RunRunner-Insel↔HTTP-Naht — Implementation Plan

## Overview

Wir schließen die einseitige Validierungs-Naht des Run-Flows: Der Server validiert eingehende
Requests mit zod, der Client schreibt die Response-Bodies aber **ungeprüft** (`as`-Cast) in den State.
Drei `as`-Casts in `RunRunner.tsx` (`:180/:211/:258`) werden durch `safeParse` gegen `z.infer`-Schemas
ersetzt; bei Mismatch greift der bereits vorhandene `serverError`-Banner. Guard-first: erst landen
Schemas + Tests grün (Casts unangetastet), dann werden die Casts einzeln umgestellt.

Gewählter Kandidat C-B aus dem Ranking in `context/changes/refactor-opportunities/research.md` §5
(Platz 1) — Entscheidung in der Planungs-Session, nicht aus dem Ranking übernommen.

## Current State Analysis

- **Asymmetrische Validierung (research.md §2):** Server härtet Input mit zod
  (`src/pages/api/runs/index.ts:9-14`, `step.ts:9`), Client validiert Output **nicht** — kein zod im
  gesamten `src/components`-Baum (verifiziert §7).
- **Genau 3 Casts, 1 Datei** (verifiziert §7): `RunRunner.tsx:180` `as RunView[]` (GET /api/runs refetch),
  `:211` `as RunProgress` (POST step), `:258` `as RunView` (POST runs). Direkt in State (`setRuns`,
  `setProgress`).
- **Fehler-Pfad ist bereits defensiv:** `messageFromPayload` (`RunRunner.tsx:55-71`) parst die
  `{error}`-Form laufzeitsicher; nur der **Erfolgs-Pfad** wurde vergessen → Inkonsistenz im selben File.
- **Banner-Muster existiert:** `setServerError(...)` ist an allen 3 Call-Sites verfügbar; `refetch`/`runStep`/
  `start` haben bereits try/catch + `serverError`-Pfade (`:185,196,206,254`).
- **Typen:** `RunView` (`types.ts:251-267`, 14 Felder), `RunProgress` (`types.ts:278-286`, 6 Felder) —
  heute reine Interfaces, kein zod-Schema.
- **Test-Infra:** Node-Vitest ohne jsdom (`vitest.config.ts:10-14`, `include: src/**/*.test.ts`);
  reine Logik-Tests. Schemas sind pure Logik → in dieser Infra testbar, **ohne** jsdom einzuführen.
- **zod ist bereits Projekt-Dependency** (serverseitig in Gebrauch) — kein neuer Dependency.

## Desired End State

`RunRunner` parst jede Erfolgs-Response mit `safeParse`. Ein Server-Drift (umbenanntes/entferntes Feld,
`{error}`→`{message}` bliebe außen vor, s. NOT-Doing) erzeugt einen **kontrollierten** `serverError`-Banner
statt eines stillen, fern vom Verursacher auftretenden Render-Fehlers. `RunView`/`RunProgress` sind
`z.infer`-Typen ihrer Schemas (Single Source). Verifizierbar:

- `npm run test` enthält neue Schema-Unit-Tests (Accept-Fixture + Reject-Drift), grün.
- `npm run build` / `astro check` (Typecheck) grün — `z.infer`-Typen strukturell identisch zu den alten Interfaces.
- Manuell: ein echter Messlauf läuft unverändert durch; ein simulierter Drift zeigt den Banner statt eines Crashs.

### Key Discoveries:

- 3 Casts / 1 Datei, alle mit `setServerError` in Reichweite (`RunRunner.tsx:180,211,258`) — minimaler Blast-Radius.
- `messageFromPayload` (`:55-71`) ist der Beweis, dass das defensive Parse-Muster im File schon etabliert ist.
- `start()` baut `RunProgress` nach dem Cast lokal zusammen (`:262-269`) — der `:258`-Cast betrifft nur `RunView`.
- `RunView.status`/`visibility` sind Enum-Felder → Schema braucht `z.enum`-Literale (s. NOT-Doing zu C-C).

## What We're NOT Doing

- **Kein C-C** (Constraint-Single-Source): Die `z.enum`-Literale für `status`/`visibility` im Schema sind
  bewusst eine weitere lokale Kopie der Werte; sie in eine geteilte Quelle zu ziehen ist C-C (research.md §5,
  Platz 2) — **expliziter Non-Goal** dieses Plans, um Scope-Creep zu vermeiden.
- **Kein C-A** (Supabase-Typgen) und **kein D1** (Domänen-Konzept → M4L5).
- **`{error}`-Form unangetastet** — `messageFromPayload` bleibt; der Fehler-Pfad ist nicht die Schuld.
- **Kein jsdom / kein Komponenten-Test-Infra** — Guard nur über Schema-Unit-Tests.
- **`RunResult`/`RunComparison` unberührt** — sie bekommen SSR-Props, casten nicht.
- **Keine Änderung der Server-Response-Formen** — der Client zieht nur nach, was der Server schon liefert.

## Implementation Approach

Guard-first in zwei Phasen: Phase 1 führt die Schemas, die `z.infer`-Typen und ihre Unit-Tests ein —
der Mechanismus landet **grün, ohne** dass ein Cast angefasst wird (rein additiv, voll umkehrbar).
Phase 2 ersetzt die 3 Casts **einzeln** (je eigener, separat umkehrbarer Commit) durch `safeParse` mit
`serverError`-Banner bei Mismatch. Reihenfolge in Phase 2 von der einfachsten/eigenständigsten zur
heißesten: `start` (`:258`) → `refetch` (`:180`) → `runStep` (`:211`, im Step-Loop).

## Phase 1: Schemas + z.infer-Typen + Unit-Tests (grün, Casts unangetastet)

### Overview

Die Validierungs-Schemas und ihre Tests landen, ohne Verhalten zu ändern — die 3 Casts bleiben in Phase 1
unangetastet. Danach ist der Mechanismus bewiesen (Tests grün), bevor die Naht umgestellt wird.

### Changes Required:

#### 1. Response-Schemas

**File**: `src/lib/runs/run-schemas.ts` (neu)
**Intent**: zod-Schemas für die drei Run-Response-Bodies definieren, aus denen die TS-Typen abgeleitet werden.
**Contract**: Exportiert `runViewSchema` (14 Felder analog `RunView`, `status: z.enum([...])`,
`visibility: z.enum([...])`, nullable `personaId`/`modelConfigId`), `runProgressSchema` (6 Felder analog
`RunProgress`) und `runViewArraySchema = z.array(runViewSchema)`. Exportiert die abgeleiteten Typen
`RunView = z.infer<typeof runViewSchema>` und `RunProgress = z.infer<typeof runProgressSchema>`.
Importiert nichts aus `types.ts` (kein Zyklus).
**Strictness:** Default-`z.object` (NICHT `.strict()`) — unbekannte Keys werden gestrippt, sodass
**additive** Server-Felder rückwärtskompatibel bleiben (kein Banner). Nur Rename/Remove/falscher Typ
eines bekannten Feldes → Reject. Diese Drift-Semantik ist gewollt; `.strict()` würde sie umkehren.

#### 2. types.ts auf Single Source umstellen

**File**: `src/types.ts`
**Intent**: Die handgepflegten Interfaces `RunView`/`RunProgress` durch die abgeleiteten Schema-Typen
ersetzen, sodass Schema und Typ nicht driften können.
**Contract**: `RunView` (`:251-267`) und `RunProgress` (`:278-286`) werden zu
`export type { RunView, RunProgress } from "@/lib/runs/run-schemas"` (oder Re-Export). Alle bestehenden
Importeure (`services/runs.ts`, `RunRunner.tsx`, Inseln) bleiben quell-kompatibel, weil die inferierten
Typen strukturell identisch sind. Ein Compile-Guard stellt sicher, dass `RunView.status` zu `RunStatus`
assignbar bleibt (z. B. `satisfies`-Assertion oder Typ-Gleichheits-Check), damit die `z.enum`-Kopie nicht
still von `RunStatus` driftet.

#### 3. Schema-Unit-Tests

**File**: `src/lib/runs/run-schemas.test.ts` (neu)
**Intent**: Den Guard beweisen — die Schemas akzeptieren echte Server-Shapes und weisen Drift ab.
**Contract**: Pro Schema mind. drei Fälle: (a) **Accept** eines bekannt-guten Objekts (inline; die
`fixtures.ts`-Factories sind async Supabase-Helfer und liefern nur die Form-Referenz), (b) **Reject** eines
Drift-Falls (umbenanntes/fehlendes Feld, z. B. `failedCount`→`failures`) via `safeParse(...).success === false`,
(c) **Accept-additiv**: ein bekannt-gutes Objekt **mit einem zusätzlichen unbekannten Feld** parst weiterhin
(`safeParse(...).success === true`) — pinnt die non-strict-Semantik fest, damit kein späteres `.strict()`
additive Server-Felder bricht. Node-Vitest, kein jsdom.

### Success Criteria:

#### Automated Verification:

- Unit-Tests grün: `npm run test`
- Typecheck grün: `npm run build` (bzw. `astro check`)
- Lint grün: `npm run lint`

#### Manual Verification:

- `git grep "as RunView\|as RunProgress" src/components` zeigt weiterhin die 3 Casts (Phase 1 ändert sie NICHT).
- Sichtprüfung: `run-schemas.ts` importiert nichts aus `types.ts` (kein Zyklus).

**Implementation Note**: Nach Phase 1 + grüner Automated-Verification hier für manuelle Bestätigung pausieren,
bevor Phase 2 startet.

---

## Phase 2: 3 Casts → safeParse mit serverError-Banner (je Cast eigener Commit)

### Overview

Die drei `as`-Casts werden einzeln durch `safeParse` ersetzt. Bei Erfolg wie bisher in den State; bei
Mismatch `setServerError(...)` (statt stillem Cast) und — wo zutreffend — den Loop stoppen. Jede Umstellung
ist ein eigener, separat umkehrbarer Commit.

### Changes Required:

#### 1. `start()` — POST /api/runs → RunView (`:258`)

**File**: `src/components/runs/RunRunner.tsx`
**Intent**: Den neuen Lauf vor dem Prepend validieren.
**Contract**: `(await res.json()) as RunView` → `runViewSchema.safeParse(await res.json())`. Bei
`!success` → `setServerError("Unerwartete Server-Antwort.")` + return (kein State-Update). Bei `success`
unverändert weiter (`setRuns`, `setActiveRunId`, lokales `setProgress`).

#### 2. `refetch()` — GET /api/runs → RunView[] (`:180`)

**File**: `src/components/runs/RunRunner.tsx`
**Intent**: Die Lauf-Liste vor dem Setzen validieren.
**Contract**: `(await res.json()) as RunView[]` → `runViewArraySchema.safeParse(...)`. Bei `!success` →
bestehender `setServerError("Couldn't load runs. Please reload.")`-Pfad. Bei `success` unverändert
(`setRuns` + `setCompareIds`-Filter).

#### 3. `runStep()` — POST /api/runs/[id]/step → RunProgress (`:211`)

**File**: `src/components/runs/RunRunner.tsx`
**Intent**: Den Fortschritt jeder Iteration im Step-Loop validieren (heißeste Naht).
**Contract**: `(await res.json()) as RunProgress` → `runProgressSchema.safeParse(...)`. Bei `!success` →
`setServerError(...)` + `stopLoop()` + `await refetch()` + `return` (kein `setProgress` mit unvalidierten
Daten) — analog zum bestehenden `!res.ok`-Pfad (`:206-208`), damit die Lauf-Liste nach dem Drift-Abbruch den
realen DB-Stand spiegelt. Bei `success` unverändert (`setProgress`, Terminal-Check, Verkettung).

### Success Criteria:

#### Automated Verification:

- Typecheck grün: `npm run build`
- Lint grün: `npm run lint`
- Bestehende Unit-/Integration-Tests grün: `npm run test`
- `git grep "as RunView\|as RunProgress" src/components/runs/RunRunner.tsx` liefert **0** Treffer.

#### Manual Verification:

- Ein echter Messlauf (`/runs`) startet, läuft alle Reps durch und zeigt das Ergebnis — unverändert.
- Simulierter Drift (z. B. in den DevTools eine Response mocken / temporär ein Feld umbenennen) zeigt den
  `serverError`-Banner statt eines Console-Crashs / kaputten Renders.
- Step-Loop bricht bei Mismatch sauber ab (kein Endlos-Retry).

**Implementation Note**: Nach Phase 2 + grüner Automated-Verification für manuelle Bestätigung pausieren.

---

## Testing Strategy

### Unit Tests:

- `runViewSchema`/`runProgressSchema`/`runViewArraySchema`: Accept bekannt-guter Shapes, Reject von
  Feld-Drift (umbenannt/fehlend/falscher Typ).
- Optionaler Grenzfall: leeres Array bei `runViewArraySchema` (valide), `null` bei `personaId` (valide).

### Integration Tests:

- Keine neuen. Bestehende `*.itest.ts` (RLS/Run-Integrity/SSRF) bleiben grün und decken die Server-Seite ab.

### Manual Testing Steps:

1. `/runs` öffnen, Persona + Modellkonfig + Reps wählen, Lauf starten → läuft durch, Ergebnis erscheint.
2. Drift simulieren (Response-Mock oder temporärer Server-Feld-Rename) → `serverError`-Banner statt Crash.
3. Reload während laufendem Lauf → Resume über DB-Count funktioniert weiter (keine Regression).

## Migration Notes

Keine Daten-/Schema-Migration. Reine Code-Änderung, voll umkehrbar (Schemas entfernen + Casts zurück).

## References

- Research (Element ④ + Verifikation): `context/changes/refactor-opportunities/research.md` (§5 Platz 1, §7)
- Deep-Focus-Prior (L3): `context/changes/run-flow-analysis/research.md` (§2.3 `as`-Cast-Naht)
- Call-Sites: `src/components/runs/RunRunner.tsx:180,211,258`; Banner-Muster `:185,196,206,254`
- Typen: `src/types.ts:251-267` (RunView), `:278-286` (RunProgress)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Schemas + z.infer-Typen + Unit-Tests

#### Automated

- [x] 1.1 Unit-Tests grün: `npm run test` — 8f64969
- [x] 1.2 Typecheck grün: `npm run build` — 8f64969
- [x] 1.3 Lint grün: `npm run lint` — 8f64969

#### Manual

- [x] 1.4 Die 3 Casts in `src/components` unverändert vorhanden (Phase 1 ändert sie nicht) — 8f64969
- [x] 1.5 `run-schemas.ts` importiert nichts aus `types.ts` (kein Zyklus) — 8f64969

### Phase 2: 3 Casts → safeParse mit serverError-Banner

#### Automated

- [x] 2.1 Typecheck grün: `npm run build` — d1d28a3
- [x] 2.2 Lint grün: `npm run lint` — d1d28a3
- [x] 2.3 Bestehende Tests grün: `npm run test` — d1d28a3
- [x] 2.4 `git grep "as RunView\|as RunProgress" RunRunner.tsx` = 0 Treffer — d1d28a3

#### Manual

- [x] 2.5 Echter Messlauf läuft unverändert durch (Ergebnis erscheint) — d1d28a3
- [x] 2.6 Simulierter Drift zeigt `serverError`-Banner statt Crash — d1d28a3
- [x] 2.7 Step-Loop bricht bei Mismatch sauber ab — d1d28a3
