# Zwei Läufe nebeneinander vergleichen (S-08) — Implementation Plan

## Overview

Nutzer kann genau zwei abgeschlossene OEJTS-Läufe (zwei Modelle oder zwei Personas)
auswählen und sieht beide Verteilungen je Achse **überlagert** in einem Chart, mit
Streuung, abgeleitetem Typ und Mittelwert-Delta. Der Slice setzt vollständig auf der
S-05-Aggregation auf: kein neues Datenmodell, keine Migration, keine neue API.

## Current State Analysis

S-05 (`distribution-results`) hat den gesamten Auswertungs- und Darstellungskern bereits
geliefert. S-08 ist deshalb eine reine Lese-/Darstellungs-Erweiterung:

- **Ergebnis-Service vorhanden:** `getRunResult(sb, userId, id)` (`src/lib/services/runs.ts:192`)
  liefert eine RLS-gescopte, on-the-fly aggregierte `RunResultView` mit `RunAggregate`
  (`axes[]`, `modalType`, `typeConsistency`, `usableReps`) und einem `state`-Diskriminator
  (`ready` | `empty` | `unfinished`). Genau das, was eine Vergleichsseite je Lauf zweimal braucht.
- **Achsen-Visualisierung vorhanden, aber gekapselt:** `AxisChart`/`AxisCard` und der Helper
  `toPct(value, min, max)` leben **intern** in `src/components/runs/RunResult.tsx` (nicht exportiert).
  `AxisChart` rendert genau **eine** Score-Serie (`axis.scores`) als CSS-Histogramm mit
  Cutoff-Linie und einem Mittelwert-Marker.
- **Routing-/SSR-Muster vorhanden:** `/runs/[id].astro` lädt server-seitig via `getRunResult`,
  setzt bei nicht sichtbarem/fehlendem Lauf `Astro.response.status = 404`, fängt Service-Ausfall
  als `loadError`-Banner ab (kein 500) und hydratisiert `<RunResult client:load />`.
- **Lücke — keine Namen in `RunView`:** `RunView` (`src/types.ts:250`) trägt nur `personaId`/
  `modelConfigId`, keine Klartext-Namen; die Lauf-Liste zeigt aktuell weder Persona- noch
  Modellname. Auflösbar über `listPersonas(sb, userId)` (`PersonaView.name`) und
  `listModelConfigs(sb)` (`ModelConfigView.label` + `.modelName`), die `runs.astro` bereits lädt.
- **Lücke — „verwertbar" nicht billig in der Liste:** Ob ein Lauf `state === "ready"` ist
  (`usableReps ≥ 1`), ergibt sich erst aus der Aggregation, nicht aus `RunView`. Die Liste kennt
  nur `status`, `completedReps`, `failedCount`, `repetitionCount`.

## Desired End State

In `/runs` lassen sich genau zwei abgeschlossene Läufe per Haken markieren; eine
„Vergleichen"-Aktion öffnet `/runs/compare?a={id}&b={id}`. Diese Seite lädt beide Läufe
server-seitig (RLS), löst Persona-/Modellnamen auf und zeigt:

1. Einen Kopfbereich mit zwei beschrifteten Seiten (Persona + Modell + Datum + abgeleiteter Typ),
2. ein Typ-Vergleichs-Banner (gleich/unterschiedlich),
3. je OEJTS-Achse einen **überlagerten** Chart mit beiden farbcodierten Score-Serien, beiden
   Mittelwert-Markern und dem Mittelwert-Delta (A − B).

Ungültige/fremde/gleiche/nicht-`ready` Läufe führen zu einem erklärenden Zustand statt zu einem
kaputten Vergleich oder 500. Die bestehende S-05-Detailansicht (`/runs/[id]`) bleibt unverändert.

**Verifikation:** Zwei completed+ready Läufe → Vergleich rendert beide Verteilungen überlagert
mit korrekten Deltas; `?a===b`, fehlende/ungültige/fremde IDs und eine nicht-`ready` Seite zeigen
jeweils ihren erklärenden Zustand; `npm run lint` + `astro check` + `npm run build` grün.

### Key Discoveries:

- `getRunResult` ist RLS-gescoped und on-the-fly — zweimal aufrufen genügt, deterministisch
  identisch zur Einzelansicht (`src/lib/services/runs.ts:192`).
- `toPct`/`AxisChart` sind in `RunResult.tsx:12-102` gekapselt — für die Überlagerung müssen die
  Chart-Primitive geteilt werden, ohne die Einzelansicht zu brechen.
- SSR-404/loadError-Muster steht in `src/pages/runs/[id].astro:27-33` (Status ohne Top-Level-`return`).
- `RunResultView.state` (`src/types.ts:333`) liefert den Diskriminator, mit dem die Vergleichsseite
  je Seite `ready` erzwingt.
- Label-Quellen: `PersonaView.name` (`src/types.ts:113`), `ModelConfigView.label`/`.modelName`
  (`src/types.ts:30-32`); Lade-Helfer `listPersonas`/`listModelConfigs` wie in `runs.astro:23-27`.

## What We're NOT Doing

- **Kein N-Wege-Vergleich** — genau zwei Läufe (PRD §Non-Goals, FR-017).
- **Keine Persistenz von Vergleichen** — der Vergleich ist eine reine Sicht über die URL-Params,
  kein gespeichertes Objekt, keine Tabelle, keine Migration.
- **Keine neue API-Route** — die Seite lädt server-seitig direkt über den Service (wie `/runs/[id]`).
- **Keine Änderung an Aggregation/Scoring** (`oejts-aggregate.ts`/`oejts-score.ts`) und keine
  Änderung an der S-05-Einzelansicht-Logik.
- **Kein Export / kein Teilen-Button** — die URL ist von Natur aus teilbar (RLS schützt), mehr nicht.
- **Keine volle Delta-Tabelle** (SD-/Buchstaben-/Stabilitäts-Deltas) — nur Typ-Vergleich +
  Mittelwert-Delta je Achse.
- **Keine Auswahl nicht-completed Läufe** — Haken nur bei `status === "completed"`.

## Implementation Approach

Drei Phasen entlang des Datenflusses: (1) Auswahl in der Liste erzeugt die Vergleichs-URL,
(2) eine SSR-Seite lädt/validiert beide Läufe und baut ein Vergleichs-DTO, (3) eine neue
React-Komponente rendert die Überlagerung. Die Chart-Primitive werden aus `RunResult.tsx` in ein
geteiltes Modul gehoben, sodass Einzel- und Vergleichsansicht dieselbe `toPct`/Score-Säulen-Logik
nutzen — die Einzelansicht behält ihr Verhalten, der überlagerte Chart ergänzt nur eine zweite Serie.

## Critical Implementation Details

- **„verwertbar"-Garantie liegt auf der Seite, nicht in der Liste.** Die Liste kann `ready` nicht
  billig bestimmen (kein `usableReps` in `RunView`), also ist der Haken an `status === "completed"`
  gebunden. Die Vergleichsseite prüft je geladenem `RunResultView` `state === "ready"`; ist eine
  Seite `empty`/`unfinished`, zeigt sie den erklärenden Zustand statt einer halb-leeren Überlagerung.
- **Label-Auflösung kann scheitern und braucht Fallback.** Gehört ein globaler Lauf einem anderen
  Nutzer, ist seine Persona evtl. privat/nicht in `listPersonas` (own+global) → Name nicht auflösbar.
  Gelöschte Persona/Modell setzen `personaId`/`modelConfigId` auf `null` (FK `on delete set null`).
  Beide Fälle → Fallback-Label (`„(gelöscht)"` bzw. `„(unbekannt)"`), kein Crash.
- **Achsen-Reihenfolge ist stabil.** Beide Läufe nutzen dasselbe hartkodierte Instrument
  (`oejts-1.2`), `aggregate.axes` kommt in identischer Achsenreihenfolge — die Überlagerung paart je
  Index/`key`, ohne Sortier-Annahmen.

## Phase 1: Vergleichs-Auswahl in der Lauf-Liste

### Overview

`RunRunner` bekommt einen Auswahl-Modus: pro abgeschlossener Lauf-Zeile ein Vergleichs-Haken
(max. 2), plus eine sticky Aktionsleiste, die bei genau zwei Auswahlen zu
`/runs/compare?a=&b=` navigiert.

### Changes Required:

#### 1. Selektions-State + Haken je Zeile

**File**: `src/components/runs/RunRunner.tsx`

**Intent**: Eine clientseitige Auswahl von max. zwei Läufen ermöglichen, ohne die bestehende
Lauf-/Step-Orchestrierung zu berühren. Haken nur bei `status === "completed"` und nicht beim
gerade aktiven Lauf.

**Contract**: Neuer State `selectedForCompare` (geordnete Liste/Set von Run-IDs, Cap 2). Checkbox
(via `getByRole("checkbox")`-fähiges `<input type="checkbox">` oder shadcn-Checkbox) in der
Zeilen-Aktionsleiste neben „Ergebnis"; deaktiviert, wenn bereits 2 andere gewählt sind. Toggle
fügt hinzu/entfernt. Nicht-completed Läufe rendern keinen Haken.

#### 2. Sticky Vergleichs-Aktionsleiste

**File**: `src/components/runs/RunRunner.tsx`

**Intent**: Bei genau zwei Auswahlen eine sichtbare Aktion anbieten, die zur Vergleichsseite
navigiert; bei 0/1 Auswahl einen kurzen Hinweis („zwei Läufe wählen") zeigen oder ausblenden.

**Contract**: Leiste rendert bei `selectedForCompare.length === 2` einen „Vergleichen"-Button,
der per `window.location.href`/Link auf `/runs/compare?a={id0}&b={id1}` navigiert (geordnete IDs).
Ein „Auswahl aufheben"-Control leert den State. Kein Datenabruf in dieser Phase.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Type-/Astro-Check passes: `npx astro check`
- Build passes: `npm run build`

#### Manual Verification:

- In `/runs` lassen sich genau zwei abgeschlossene Läufe markieren; ein dritter Haken ist gesperrt.
- Nicht-completed (pending/running/failed) Läufe zeigen keinen Vergleichs-Haken.
- Der „Vergleichen"-Button erscheint nur bei zwei Auswahlen und navigiert zu
  `/runs/compare?a=&b=` mit den korrekten IDs.
- „Auswahl aufheben" leert die Markierung; bestehende Lauf-/Toggle-/Abbruch-Funktionen unverändert.

**Implementation Note**: Nach dieser Phase und grünen automatischen Checks hier für manuelle
Bestätigung pausieren, bevor Phase 2 beginnt.

---

## Phase 2: Vergleichs-Seite (SSR-Load + Guards)

### Overview

Neue Seite `/runs/compare`, die beide Läufe server-seitig RLS-gescoped lädt, alle Edge-Cases
abfängt, Persona-/Modellnamen auflöst und ein Vergleichs-DTO an die (in Phase 3 gebaute)
React-Insel übergibt. In dieser Phase steht das Daten-/Guard-Gerüst; gerendert wird zunächst ein
Platzhalter oder die rohen Labels.

### Changes Required:

#### 1. Vergleichs-DTO

**File**: `src/types.ts`

**Intent**: Eine client-sichere Projektion für die Vergleichsansicht definieren, die beide
Ergebnis-Sichten plus ihre aufgelösten Labels bündelt.

**Contract**: Neuer Typ, z. B.
`RunComparisonSide { result: RunResultView; personaName: string; modelLabel: string; modelName: string | null }`
und `RunComparisonView { a: RunComparisonSide; b: RunComparisonSide }`. Labels tragen bereits die
Fallback-Werte (`„(gelöscht)"`/`„(unbekannt)"`), Datum kommt aus `result.run.createdAt`.

#### 2. Label-Auflösung als Helfer

**File**: `src/lib/services/runs.ts` (oder ein kleiner Helfer in der Seite)

**Intent**: Aus geladenen Personas/Modellkonfigs je Lauf das Anzeige-Label bilden, robust gegen
fehlende/fremde IDs.

**Contract**: Reine Funktion, die `(run: RunView, personas: PersonaView[], models: ModelConfigView[])`
auf `{ personaName, modelLabel, modelName }` mappt; `null`/nicht gefunden → definierte Fallbacks.
Keine DB-Calls (arbeitet auf bereits geladenen Listen).

#### 3. Seite mit Guards

**File**: `src/pages/runs/compare.astro`

**Intent**: Query-Params `a`/`b` parsen und alle Fehlerpfade vor dem Rendern abfangen, analog zum
`[id].astro`-Muster (Status ohne Top-Level-`return`, Service-Ausfall → Banner statt 500).

**Contract**: Liest `a`/`b` aus `Astro.url.searchParams`. Guard-Reihenfolge:
(a) fehlt `a` oder `b` → erklärender „zwei Läufe wählen"-Zustand;
(b) `a === b` → Hinweis „bitte zwei verschiedene Läufe";
(c) beide via `getRunResult` laden — ist eine Seite `null` (nicht sichtbar/vorhanden) →
`Astro.response.status = 404` + „Lauf nicht gefunden";
(d) ist eine Seite `state !== "ready"` → erklärender Zustand (nutzt die vorhandene
`empty`/`unfinished`-Semantik aus `RunResultView`);
(e) Service-Ausfall (throw) → `loadError`-Banner.
Im Erfolgsfall `listPersonas`/`listModelConfigs` laden, `RunComparisonView` bauen und an die Insel
übergeben (Insel-Render erst Phase 3 — hier ggf. Platzhalter/Labels).

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Type-/Astro-Check passes: `npx astro check`
- Build passes: `npm run build`

#### Manual Verification:

- `/runs/compare?a={ready}&b={ready}` lädt ohne Fehler und zeigt beide aufgelösten Labels
  (Persona + Modell + Datum).
- `?a=X&b=X` (gleiche ID) → Hinweis „zwei verschiedene Läufe".
- Fehlender Param / unbekannte / fremde (nicht sichtbare) ID → 404 bzw. erklärender Zustand, kein 500.
- Ein nicht-`ready` Lauf (pending/running/empty) als eine Seite → erklärender Zustand statt
  halb-leerer Vergleich.
- Gelöschte Persona/Modell → Fallback-Label, kein Crash.

**Implementation Note**: Nach dieser Phase und grünen automatischen Checks hier für manuelle
Bestätigung pausieren, bevor Phase 3 beginnt.

---

## Phase 3: Überlagerte Achsen-Darstellung + Delta

### Overview

Neue Komponente `RunComparison.tsx` rendert den eigentlichen Vergleich: zwei beschriftete Köpfe,
ein Typ-Vergleichs-Banner und je Achse einen überlagerten Chart mit beiden Score-Serien, beiden
Mittelwert-Markern und dem Mittelwert-Delta. Die Chart-Primitive werden aus `RunResult.tsx`
geteilt, ohne die Einzelansicht zu verändern.

### Changes Required:

#### 1. Chart-Primitive teilen

**File**: `src/components/runs/RunResult.tsx` → geteiltes Modul, z. B. `src/components/runs/axis-chart.tsx`

**Intent**: `toPct` und die Score-Säulen-/Cutoff-Linien-Logik aus `RunResult.tsx` extrahieren,
sodass beide Ansichten sie nutzen. Die Einzelansicht behält exakt ihr aktuelles Verhalten.

**Contract**: Export von `toPct(value, min, max)` und einer parametrisierbaren Chart-Primitive, die
**eine oder zwei** Score-Serien (je mit Farbe + Label + optionalem Mittelwert) auf derselben
Achsen-Skala (`scale.min/max/cutoff`) rendert. `RunResult.tsx` importiert die Primitive für den
Einzelfall (eine Serie); kein visueller Regress in der Einzelansicht.

#### 2. Vergleichs-Komponente

**File**: `src/components/runs/RunComparison.tsx`

**Intent**: Den `RunComparisonView` in die finale Überlagerungs-Ansicht rendern — Köpfe,
Typ-Banner, Achsen-Überlagerung, Delta.

**Contract**: Props `{ view: RunComparisonView }`. Rendert:
(a) zwei Kopf-Karten (Persona, Modell, Datum, `aggregate.modalType`), farblich der jeweiligen Serie
zugeordnet (Lauf A z. B. purple wie heute, Lauf B eine Kontrastfarbe);
(b) Typ-Vergleichs-Banner: `modalType A === B` → „gleicher Typ" hervorgehoben, sonst „unterschiedlich"
mit beiden Typen;
(c) je Achse (über `aggregate.axes` paarweise per `key`) die überlagerte Chart-Primitive mit beiden
Serien + beiden Mittelwert-Markern, darunter Mittelwert (A), Mittelwert (B) und Delta `A − B`
(Vorzeichen/Betrag), sowie je Seite die Streuung (SD) und die „nicht belastbar"-Warnung bei
`usableCount < 2` (Methodenkern-Guardrail). Eine Legende ordnet Farbe → Lauf zu. Responsive:
Achsen-Karten einspaltig auf Mobile (Überlagerung bleibt lesbar, anders als zwei Spalten).

#### 3. Insel in der Seite hydratisieren

**File**: `src/pages/runs/compare.astro`

**Intent**: Den in Phase 2 gebauten `RunComparisonView` an die echte Komponente übergeben.

**Contract**: `<RunComparison client:load view={view} />` im Erfolgszweig; Platzhalter aus Phase 2
ersetzt. Zurück-Link auf `/runs` analog `RunResult`.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Type-/Astro-Check passes: `npx astro check`
- Build passes: `npm run build`

#### Manual Verification:

- Zwei ready-Läufe rendern je Achse beide Verteilungen überlagert, farblich klar getrennt, mit
  beiden Mittelwert-Markern; eine Legende ordnet Farbe → Lauf zu.
- Das Typ-Banner zeigt korrekt „gleich" (identischer `modalType`) bzw. „unterschiedlich" mit beiden Typen.
- Das Mittelwert-Delta je Achse stimmt mit `mean A − mean B` überein (Vorzeichen korrekt).
- Eine Achse mit `usableCount < 2` zeigt die „nicht belastbar"-Warnung je betroffener Seite.
- Die S-05-Einzelansicht `/runs/[id]` ist visuell unverändert (kein Regress durch die Extraktion).
- Auf schmalem Viewport bleibt die Überlagerung lesbar (einspaltig).

**Implementation Note**: Nach dieser Phase und grünen automatischen Checks für die finale manuelle
Bestätigung pausieren.

---

## Testing Strategy

### Unit Tests:

- Kein Test-Runner eingerichtet (`workflow.config.yaml` `test_command` ist Platzhalter). Die
  Korrektheit der Aggregation ist bereits durch S-05 abgedeckt; S-08 fügt keine Scoring-Logik hinzu.
- Falls die Label-Auflösung (Phase 2 #2) als reine Funktion isoliert wird, ist sie der einzige
  sinnvolle Unit-Test-Kandidat (Fallbacks bei `null`/fehlender ID) — optional, sobald ein Runner steht.

### Integration / Manuelle Schritte:

1. Zwei completed+ready Läufe mit unterschiedlichen Personas oder Modellen erzeugen (falls nicht
   vorhanden: zwei 1–2-Rep-Läufe treiben, wie in den S-05/S-07-Gates).
2. In `/runs` beide markieren → „Vergleichen" → URL prüfen.
3. Überlagerung, Typ-Banner und Deltas gegen die jeweilige Einzelansicht `/runs/[id]` gegenprüfen
   (gleiche Mittelwerte/SD).
4. Edge-Cases durchspielen: `?a===b`, fehlender Param, fremde/unbekannte ID, eine nicht-`ready` Seite.
5. Cross-Visibility (RLS): ein global sichtbarer fremder Lauf ist vergleichbar; ein privater fremder
   Lauf → 404 (Negativtest, analog S-07-Gate). Testdaten danach aufräumen.

## Performance Considerations

Zwei `getRunResult`-Aufrufe je Seitenaufruf (parallel via `Promise.all`), je on-the-fly aggregiert —
identisch zur Einzelansicht, bei v1-Datenvolumen vernachlässigbar. Keine zusätzliche Last gegenüber
zweimal `/runs/[id]`.

## Migration Notes

Keine. Kein Schema-, Policy- oder Seed-Change; reine Lese-/Darstellungs-Erweiterung.

## References

- Roadmap-Slice: `context/foundation/roadmap.md` (S-08), PRD US-02 / FR-017
- Ergebnis-Service & Aggregation: `src/lib/services/runs.ts:192` (`getRunResult`),
  `src/lib/runs/oejts-aggregate.ts`, `src/lib/runs/oejts-score.ts`
- Wiederzuverwendende Darstellung: `src/components/runs/RunResult.tsx:12-145` (`toPct`/`AxisChart`/`AxisCard`)
- SSR-Lade-/404-Muster: `src/pages/runs/[id].astro`
- Auswahl-Insel & Label-Quellen: `src/components/runs/RunRunner.tsx`, `src/pages/runs.astro:23-27`
- Typen: `src/types.ts` (`RunResultView`, `RunAggregate`, `AxisDistribution`, `RunView`, `PersonaView`, `ModelConfigView`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Vergleichs-Auswahl in der Lauf-Liste

#### Automated

- [x] 1.1 Linting passes: `npm run lint`
- [x] 1.2 Type-/Astro-Check passes: `npx astro check`
- [x] 1.3 Build passes: `npm run build`

#### Manual

- [x] 1.4 Genau zwei completed-Läufe markierbar; dritter Haken gesperrt
- [x] 1.5 Nicht-completed Läufe zeigen keinen Vergleichs-Haken
- [x] 1.6 „Vergleichen"-Button erscheint nur bei zwei Auswahlen und navigiert zu `/runs/compare?a=&b=` mit korrekten IDs
- [x] 1.7 „Auswahl aufheben" leert die Markierung; bestehende Funktionen unverändert

### Phase 2: Vergleichs-Seite (SSR-Load + Guards)

#### Automated

- [ ] 2.1 Linting passes: `npm run lint`
- [ ] 2.2 Type-/Astro-Check passes: `npx astro check`
- [ ] 2.3 Build passes: `npm run build`

#### Manual

- [ ] 2.4 Zwei ready-IDs laden ohne Fehler, beide Labels (Persona + Modell + Datum) aufgelöst
- [ ] 2.5 Gleiche ID (`?a=X&b=X`) → Hinweis „zwei verschiedene Läufe"
- [ ] 2.6 Fehlender Param / unbekannte / fremde ID → 404 bzw. erklärender Zustand, kein 500
- [ ] 2.7 Nicht-`ready` Seite → erklärender Zustand statt halb-leerer Vergleich
- [ ] 2.8 Gelöschte Persona/Modell → Fallback-Label, kein Crash

### Phase 3: Überlagerte Achsen-Darstellung + Delta

#### Automated

- [ ] 3.1 Linting passes: `npm run lint`
- [ ] 3.2 Type-/Astro-Check passes: `npx astro check`
- [ ] 3.3 Build passes: `npm run build`

#### Manual

- [ ] 3.4 Beide Verteilungen je Achse überlagert, farblich getrennt, beide Mittelwert-Marker + Legende
- [ ] 3.5 Typ-Banner korrekt „gleich"/„unterschiedlich" mit beiden Typen
- [ ] 3.6 Mittelwert-Delta je Achse stimmt mit `mean A − mean B` (Vorzeichen korrekt)
- [ ] 3.7 Achse mit `usableCount < 2` zeigt „nicht belastbar"-Warnung je betroffener Seite
- [ ] 3.8 S-05-Einzelansicht `/runs/[id]` visuell unverändert (kein Regress)
- [ ] 3.9 Überlagerung auf schmalem Viewport lesbar (einspaltig)
