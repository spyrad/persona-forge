---
change-id: distribution-results
title: Ergebnis als Verteilung je Achse plus Typ-Stabilität (S-05, Leitstern)
status: implementing
created: 2026-06-18
updated: 2026-06-18
roadmap-ref: S-05
prd-refs: [US-01, FR-016, NFR-Reproduzierbare-Auswertung, Guardrail-Methodenkern]
prerequisites: [S-04 oejts-measurement-run]
---

# distribution-results (S-05)

Nutzer sieht nach Abschluss eines OEJTS-Laufs je Achse (E/I, S/N, T/F, J/P) Lage,
Streuung und Roh-Verteilung über die N Wiederholungen, plus den abgeleiteten
4-Buchstaben-Typ und dessen Stabilität. Ein Einzeldurchlauf wird nie als belastbarer
Wert dargestellt; Fehlquote ist ausgewiesen; ein leerer/fehlgeschlagener Lauf zeigt
einen erklärenden Zustand.

Baut auf S-04 auf (Rohantworten je Item/Wiederholung liegen bereits in
`run_repetitions`). Keine neue Migration, keine externe I/O — reine Auswertung.
