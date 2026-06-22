---
change_id: side-by-side-comparison
title: Zwei abgeschlossene Läufe nebeneinander vergleichen
status: archived
created: 2026-06-21
updated: 2026-06-22
archived_at: 2026-06-22T03:15:06Z
---

## Notes

Roadmap S-08 (letzter geplanter MVP-Slice). Outcome: Nutzer kann genau zwei
abgeschlossene Läufe (zwei Modelle oder zwei Personas) auswählen und sieht beide
Verteilungen je Achse nebeneinander mit ihren Streuungen; Läufe, Ergebnisse und
Personas bleiben persistent und wiederauffindbar. PRD-refs: US-02, FR-017.
Prereq S-05 ✅.

Vorgänger-Hinweis (S-06/S-07-Lesson „erst prüfen, was schon mitgeliefert
wurde"): S-05 liefert bereits `getRunResult` → `RunResultView`/`RunAggregate`
(on-the-fly, RLS-gescoped) und die Achsen-Visualisierung (`AxisChart`/`AxisCard`
in `RunResult.tsx`). S-08 braucht daher **kein** neues Datenmodell, keine
Migration, keine neue API — nur Auswahl-UI, eine SSR-Vergleichsseite und eine
überlagernde Darstellung.
