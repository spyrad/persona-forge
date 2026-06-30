---
change_id: refactor-opportunities
title: Refactor-Opportunities-Ranking für den OEJTS-Run-Flow
status: plan_reviewed
created: 2026-06-30
updated: 2026-06-30
archived_at: null
---

## Notes

Intention: Wir haben eine Analyse dieses Repositories, die technische Schulden und strukturelle Risiken des OEJTS-Mess-/Run-Flows dokumentiert: context/changes/run-flow-analysis/research.md. Diese Change beantwortet die Frage, die jene Analyse bewusst offen gelassen hat: WELCHE dieser Probleme lohnt es sich zu beheben, in welcher Zielform und in welcher Reihenfolge. Wir explorieren jedes festgehaltene Problem in Code und Historie und ordnen sie dann als Refactor opportunities.

Die Change verläuft in Etappen: Exploration -> Entscheidung und Plan -> Implementierung. In der Explorations-Etappe geschieht KEIN Refaktor und faellt KEINE Entscheidung.

Ergebnis der Exploration: research.md dieser Change, abgeschlossen mit einem Ranking der Optionen samt Trade-offs. Zuerst lese ich den Report; die Entscheidung, was umgesetzt wird, faellt in der Planungs-Etappe, und der Refaktor startet erst nach dem angenommenen Plan.
