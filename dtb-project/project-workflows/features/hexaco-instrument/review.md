# Review-Snapshot: hexaco-instrument

Scope: ~32 Quelldateien aus Phase 1 (`5cdac4b`) + Phase 2–5 (`42ddb42`) · Geprueft bis: `42ddb42` · Datum: 2026-07-18
Gesamt-Verdikt: NEEDS ATTENTION → triagiert 2026-07-18: 2 FIXED (F1/F2) · 4 SKIPPED (Nits F3–F6)

## Verdikt-Achsen

| Achse               | Verdikt | Findings |
| ------------------- | ------- | -------- |
| Plan Adherence      | PASS    | 0        |
| Scope Discipline    | PASS    | 0        |
| Safety & Quality    | WARNING | 1        |
| Architecture        | WARNING | 2        |
| Pattern Consistency | WARNING | 2        |
| Rules               | PASS    | 1 (nit)  |

## Findings

### F1 — Safety & Quality — [S:Mittel × I:Mittel] — Craft/principled non-blocking

src/lib/services/runs.ts:189 (+ src/pages/api/runs/create-schema.ts:16-22) — `kind` und `instrument_id` sind zwei unabhaengige, client-gelieferte Felder ohne serverseitige Bindung. `createRun` inserted `{ kind: input.kind, instrument_id: input.instrumentId }` woertlich; die zod-Schema akzeptiert jede `instrumentId` unabhaengig vom `kind`. Ein Body `{kind:"hexaco", instrumentId:"oejts-1.2"}` besteht die Validierung → Runner scored OEJTS (via `getInstrument(instrument_id)`), waehrend Profil-Sektion + Listen-Badge ihn als HEXACO behandeln. Das ist genau das Spec-Risiko „falsche Instrument-Zuordnung", eine Schicht nach innen verschoben. Die UI sendet immer ein passendes Paar → braucht einen manuell gebauten Request.
Fix: fuer item-basierte kinds `instrument_id` serverseitig aus einer `kind → id`-Map in `createRun` ableiten und die Client-`instrumentId` ignorieren (die Schema-Default kodiert diese Map bereits — sie zur alleinigen Autoritaet machen).
Decision: FIXED (`runs.ts`/`model-profiles.ts`, verifiziert: unit 278 · itest 81 · e2e 7)

### F2 — Pattern Consistency — [S:Niedrig × I:Mittel] — Craft/principled non-blocking

src/lib/services/model-profiles.ts:127,133 vs src/lib/services/runs.ts:306 — dieselbe Frage („welches Instrument scored diese Reps?") wird zweimal verschieden beantwortet. `getRunResult` loest dynamisch via `getInstrument(run.instrumentId)` (Registry) auf; `buildModelProfiles` hardcodet `aggregateRun(pooled, OEJTS)` / `aggregateRun(pooled, HEXACO)` per `run.kind`. Sie stimmen nur ueberein, solange `kind`/`instrument_id` nie divergieren (siehe F1), und divergieren im Wartungsaufwand: ein drittes Item-Instrument funktioniert in `getRunResult` automatisch, braucht hier aber einen neuen handgeschriebenen `.filter(kind===…)`-Block.
Fix: den Instrument-Pfad im Profil ebenfalls ueber die Registry aufloesen (nach `instrument_id` gruppieren, mit `getInstrument` aggregieren), damit beide Pfade eine Aufloesungsregel teilen.
Decision: FIXED (`runs.ts`/`model-profiles.ts`, verifiziert: unit 278 · itest 81 · e2e 7)

### F3 — Architecture — [S:Niedrig × I:Niedrig] — Craft/torvalds nit

src/lib/runs/oejts-run.ts, oejts-score.ts, oejts-aggregate.ts, `parseOejtsResponse` — diese Module sind jetzt vollstaendig instrument-agnostisch (durch `Instrument` getrieben) und sind der HEXACO-Code-Pfad, behalten aber OEJTS-spezifische Namen. Kommentare halten das fest (bewusste Schuld), aber der Maintainer in 5 Jahren, der `parseOejtsResponse(...)` auf einem HEXACO-Lauf sieht, verliert Zeit mit der Bestaetigung, dass das kein Bug ist.
Fix (Folge-Commit, rein mechanisch): umbenennen zu `item-run.ts`/`item-score.ts`/`item-aggregate.ts` + `parseItemResponse` — keine Verhaltensaenderung.
Decision: SKIPPED (nit; bewusst offen gelassen in der Triage 2026-07-18)

### F4 — Pattern Consistency — [S:Niedrig × I:Niedrig] — Craft/principled nit

Instrument-Id-Literal dreifach dupliziert: `hexaco.ts:30` (die id), `create-schema.ts:20` (Schema-Default), `RunRunner.tsx:44` (`INSTRUMENT_ID_BY_KIND`); analog `"oejts-1.2"`. Die Client-Kopie ist bewusst (haelt Instrument-_Daten_ aus dem Bundle), aber das _Id-Literal_ koennte eine geteilte Konstante ohne Item-Payload sein. Ein Rename von `HEXACO.id` desynct still drei Dateien.
Fix: Id-Literale in ein winziges `instrument-ids.ts` (ohne Item-Payload) extrahieren, das alle drei importieren.
Decision: SKIPPED (nit; bewusst offen gelassen in der Triage 2026-07-18)

### F5 — Architecture — [S:Niedrig × I:Niedrig] — Craft/torvalds nit

src/pages/dashboard.astro:29,168 — `DashboardModelEntry.usableReps` poolt Reps ueber ALLE Instrumente (inkl. HEXACO), aber das Register zeigt nur den OEJTS-Modaltyp und rendert nur `ATTRIBUTION_BY_KIND.oejts`. Ein Modell mit ausschliesslich HEXACO-Baseline-Laeufen zeigt `profiled:true`, Typ „—" und eine Rep-Zahl ohne HEXACO-Hinweis. Keine HEXACO-Ergebnisse/-Typen werden angezeigt → kein Attributions-Verstoss, aber die Rep-Zahl mischt still Instrumente hinter einer OEJTS-etikettierten Zeile.
Fix (optional, wenn HEXACO je First-Class-Dashboard-Flaeche bekommt): Rep-Zahl je Instrument ausweisen oder HEXACO-only-Modelle kennzeichnen.
Decision: SKIPPED (nit; bewusst offen gelassen in der Triage 2026-07-18)

### F6 — Rules — [S:Niedrig × I:Niedrig] — Rules nit (Grenzwert)

src/components/runs/axis-chart.tsx:110,121 + src/components/models/ModelComparison.tsx:50,184,227 — Tailwind-Klassen per Template-Literal konkateniert (`` `rounded-full ${s.dotClass}` ``) statt via `cn()`; CLAUDE.md: „Tailwind-Klassen via `cn()` … nie manuell konkatenieren". Reine Append-Faelle ohne Klassenkonflikt (kein tailwind-merge-Bedarf), Muster ist etablierte Bestands-Konvention (identisch in `RunComparison`) → NICHT signifikant.
Fix (nur bei strikter Regeltreue): die Concatenations auf `cn()` umstellen.
Decision: SKIPPED (nit; bewusst offen gelassen in der Triage 2026-07-18)

## Info

3 Workflow-Artefakte im Diff, bekannt — nicht bewertet (plan.md, WORKFLOW_STATUS.md, project-changelog/2026-07-17.md)

## Positiv-Verifikation (Kernrisiken gedeckt)

- Keying/constants korrekt: `constant = 6 × n(sign=-1)` je Achse (H=36, E=24, X/A/C/O=30), Range 10–50, neutral→30; von `hexaco.test.ts` gepinnt.
- Kein stiller Instrument-Fallback: `getInstrument` wirft+loggt; beide Scoring-Eintrittspunkte routen darueber.
- Dimensional-vs-Modaltyp am Datenlayer erzwungen: `deriveType`/`aggregateRun` gaten auf `hasModalType`; `RunResult` dispatcht auf die Aggregat-Form, nicht auf `run.kind` → HEXACO kann keinen OEJTS-Typ-Code rendern, selbst bei falschem Badge.
- Kein Korrektheits-Bug in Scoring, Aggregation, Chart-Skalierung oder Migration.
