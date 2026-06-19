# Ergebnis als Verteilung je Achse plus Typ-Stabilität (S-05) — Plan Brief

> Full plan: `context/changes/distribution-results/plan.md`

## What & Why

Der Nutzer soll nach einem OEJTS-Lauf **sehen, was herauskam** — nicht als Einzel-Punktwert,
sondern je Achse (E/I, S/N, T/F, J/P) als Verteilung über die N Wiederholungen plus den
abgeleiteten 4-Buchstaben-Typ und dessen Stabilität. Das ist der Slice, der die Kern-Produkthypothese
belegt: **Verteilung statt Punktwert macht LLM-Disposition messbar** (Leitstern, US-01/FR-016).

## Starting Point

S-04 hat den Lauf-Mechanismus gebaut: die Rohantworten je Item und Wiederholung liegen bereits
vollständig in `run_repetitions` (`item_values` = Werte 1–5 je Item). Das OEJTS-Instrument ist typisiert
vorhanden (32 Items mit `axis`+`sign`, 4 Achsen mit `cutoff:24`), die Scoring-Formel ist dokumentiert,
aber **noch nicht implementiert**. `/runs` zeigt eine Lauf-Liste, aber **keine Ergebnisansicht**.

## Desired End State

Aus der Lauf-Liste führt ein Link auf `/runs/[id]`: je Achse Mittelwert + Standardabweichung des Scores,
eine Roh-Verteilung auf der Score-Skala mit eingezeichneter Cutoff-Linie und Pol-Beschriftung, die
Buchstaben-Häufigkeit (E 4× / I 1×) und die Zahl beitragender Läufe. Oben der Modaltyp als Headline plus
Konsistenz-Anteil und Fehlquote. Ein Einzeldurchlauf (<2 verwertbare Läufe) trägt ein „nicht belastbar"-Banner;
ein leerer/failed Lauf einen erklärenden Zustand statt 0-Ansicht.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Wo lebt die Ansicht | Eigene Route `/runs/[id]` | Sauberer Baustein für den späteren 2er-Vergleich (S-08); Platz für die Verteilungsdarstellung | Plan |
| Lage/Streuung | Mittelwert + Standardabweichung (+ Roh-Verteilung) | Konventionelles, deterministisch testbares psychometrisches Reporting | Plan |
| Typ-Stabilität | Modaltyp + Achsen-Buchstaben-Split + Konsistenz-% | Deckt FR-016 voll ab, gibt eine griffige Stabilitäts-Kennzahl | Plan |
| Unparsed-Items | Achsen-weiser Dropout | Ehrlich (kein erfundener Wert), maximiert verwertbare Daten je Achse, NFR-Resilienz-konform | Plan |
| Visualisierung | Leichtgewichtig CSS/SVG | Keine neue Dependency, deterministisch, passt zu small-scale | Plan |
| Berechnungsort | On-the-fly beim Laden | Erfüllt NFR „reproduzierbar/deterministisch" per Konstruktion; keine Migration, keine Staleness | Plan |
| Score-Skala | Roh-Score mit Cutoff-Linie | Direkt aus der Formel, zeigt Nähe/Distanz zur Typgrenze ehrlich | Plan |
| Zu wenige Läufe | Immer rechnen + Warnbanner bei <2 | Erfüllt Guardrail + PRD-AC ohne Daten wegzuwerfen | Plan |

## Scope

**In scope:** Scoring je Wiederholung, Aggregation über N (Mean/SD/Roh-Verteilung, Buchstaben-Häufigkeit,
Modaltyp+Konsistenz), Result-DTOs, `getRunResult`-Service (on-the-fly, RLS-gescoped), `GET
/api/runs/[id]/result`, Ergebnisseite `/runs/[id]` + Verlinkung, Edge-States (unfinished/empty/insufficient).

**Out of scope:** 2er-Vergleich (S-08), persistierte Aggregate/Migration, Re-Parsing der Rohantworten,
Sichtbarkeits-Umschaltung (S-07), Resume, Kostenschätzung, zweites Instrument.

## Architecture / Approach

Reiner getesteter Kern → UI, gespiegelt vom S-04-Muster. **Phase 1:** `oejts-score.ts` (`scoreAxes`,
`deriveType`, `axisScale`) + `oejts-aggregate.ts` (`aggregateRun`) als reine, deterministische Funktionen
mit Unit-Tests; `getRunResult` lädt die Wiederholungen RLS-gescoped und aggregiert on-the-fly; API-Route
`GET /api/runs/[id]/result`. **Phase 2:** `/runs/[id].astro` (Server-Load) + `RunResult.tsx` (CSS/SVG-Achsen-Verteilung
+ Typ-Panel + Edge-States) + Link aus `RunRunner.tsx`. Middleware deckt `/runs/[id]` schon ab.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Kern + Service + API | Deterministisches Scoring + Aggregation, Ergebnis per API abrufbar | Score-Skala/Tie-Break je Achse korrekt herleiten (nicht global annehmen) |
| 2. UI `/runs/[id]` | Verteilungs-/Typansicht mit Cutoff-Linie + Edge-States | Verteilungs-Visualisierung lesbar + Guardrail-Banner korrekt je Achse |

**Prerequisites:** S-04 abgeschlossen ✅ (Rohdaten in `run_repetitions` liegen vor).
**Estimated effort:** ~1–2 Sessions über 2 Phasen.

## Open Risks & Assumptions

- Score-Skalengrenzen müssen **je Achse** aus den Item-`sign`-Extrema berechnet werden (Konstanten 30/12/30/18
  verschieben die Skala) — nicht global `8..40` annehmen.
- Modaltyp-Tie-Break (Gleichstand auf einer Achse) braucht eine dokumentierte, deterministische Regel
  (weiterer Score-Abstand zum Cutoff → sonst `low`-Pol).
- Annahme: die S-04-`item_values` sind die verlässliche Eingabe; kein Re-Parsing der Rohantworten in S-05.

## Success Criteria (Summary)

- Nutzer sieht je Achse Verteilung (Mean/SD/Roh-Verteilung mit Cutoff) + Modaltyp + Stabilität + Fehlquote.
- Ein Einzeldurchlauf wird nie als belastbarer Wert dargestellt; leerer/failed Lauf zeigt erklärenden Zustand.
- Gleiche Rohdaten → identische Werte (deterministisch), verifiziert über Unit-Tests; RLS dicht.
