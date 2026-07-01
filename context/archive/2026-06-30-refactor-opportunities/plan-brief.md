# C-B: zod-Validator an der RunRunner-Naht — Plan Brief

> Full plan: `context/changes/refactor-opportunities/plan.md`
> Research: `context/changes/refactor-opportunities/research.md`

## What & Why

Der Run-Flow validiert nur **eine** Richtung: Der Server härtet eingehende Requests mit zod, der Client
schreibt die Response-Bodies aber ungeprüft (`as`-Cast) in den State. Ein Server-Drift bleibt damit
compilerstumm und bricht erst fern vom Verursacher im Browser. Wir machen die Naht symmetrisch — Client
validiert Output mit `safeParse`.

## Starting Point

Drei `as`-Casts in `RunRunner.tsx` (`:180/:211/:258`) schreiben `res.json()` direkt in State. Der
Fehler-Pfad (`messageFromPayload`) ist bereits laufzeitsicher — nur der Erfolgs-Pfad wurde vergessen.
`RunView`/`RunProgress` sind reine TS-Interfaces; zod ist bereits Projekt-Dependency; Test-Infra ist
Node-Vitest ohne jsdom.

## Desired End State

Jede Erfolgs-Response wird per `safeParse` gegen ein `z.infer`-Schema geprüft; bei Mismatch erscheint der
bestehende `serverError`-Banner statt eines stillen Render-Fehlers. `RunView`/`RunProgress` sind die aus
den Schemas abgeleiteten Typen (Single Source).

## Key Decisions Made

| Decision           | Choice                             | Why                                                             | Source          |
| ------------------ | ---------------------------------- | --------------------------------------------------------------- | --------------- |
| Welcher Kandidat   | C-B (zod-Naht)                     | Zufällige Komplexität, billig, asymmetrischer Wert (Ranking #1) | Research → Plan |
| Mismatch-Verhalten | `safeParse` → `serverError`-Banner | Kein Crash, nutzt vorhandene Fehler-UX                          | Plan            |
| Typ-Quelle         | `z.infer` aus Schema               | Kein Schema↔Interface-Drift, echte Single Source                | Research → Plan |
| `{error}`-Form     | Unangetastet                       | Fehler-Pfad ist nicht die Schuld (schon defensiv)               | Plan            |
| Guard/Test         | Schema-Unit-Tests (Node)           | Kein jsdom nötig, guard-first möglich                           | Plan            |

## Scope

**In scope:** 3 Response-Schemas + `z.infer`-Typen + Unit-Tests; Umstellung der 3 Casts auf `safeParse` mit Banner.

**Out of scope:** C-C (Constraint-Single-Source — die `z.enum`-Literale bleiben lokale Kopie), C-A (Typgen),
D1 (→ M4L5), `{error}`-Schema, jsdom/Komponenten-Tests, `RunResult`/`RunComparison`, Server-Response-Formen.

## Architecture / Approach

Guard-first: **Phase 1** bringt Schemas, abgeleitete Typen und Unit-Tests grün ein — **ohne** einen Cast
anzufassen (rein additiv, umkehrbar). **Phase 2** ersetzt die 3 Casts einzeln (je eigener Commit) durch
`safeParse`, Reihenfolge `start` → `refetch` → `runStep` (heißeste Naht zuletzt).

## Phases at a Glance

| Phase                      | What it delivers                                  | Key risk                                                |
| -------------------------- | ------------------------------------------------- | ------------------------------------------------------- |
| 1. Schemas + Typen + Tests | Validierungs-Mechanismus grün, Casts unangetastet | `z.infer`-Typ driftet von `RunStatus` (→ Compile-Guard) |
| 2. Casts → safeParse       | Symmetrische Naht, Drift → Banner                 | Step-Loop-Verhalten bei Mismatch (→ `stopLoop`)         |

**Prerequisites:** keine (zod schon Dependency, Research + Verifikation abgeschlossen).
**Estimated effort:** ~1 Session, 2 Phasen.

## Open Risks & Assumptions

- Die `z.enum`-Literale für `status`/`visibility` sind eine bewusste lokale Kopie (Unifizierung = C-C, out of scope) — per Compile-Guard gegen `RunStatus`-Drift gesichert.
- Annahme: inferierte Typen sind strukturell identisch zu den alten Interfaces → keine Importeur-Brüche (per Typecheck verifiziert).

## Success Criteria (Summary)

- Schema-Unit-Tests grün; Typecheck/Lint grün; 0 `as RunView`/`as RunProgress`-Casts mehr in `RunRunner.tsx`.
- Echter Messlauf läuft unverändert; simulierter Drift zeigt Banner statt Crash.
