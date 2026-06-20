---
change-id: run-control-and-tokens
title: Lauf-Kontrolle — Abbruch und Token-Ausweis (S-06)
status: implementing
created: 2026-06-20
updated: 2026-06-20
roadmap-ref: S-06
prd-refs: [FR-014, FR-015]
prerequisites: [S-04 oejts-measurement-run]
---

# run-control-and-tokens (S-06)

Nutzer kann einen laufenden Test abbrechen (Abbruch verwirft den Lauf vollständig,
keine Teilauswertung) und sieht je Lauf die verbrauchten Tokens (Eingabe/Ausgabe);
keine Kostenrechnung.

**Scope-Realität (2026-06-20):** Die Code-Recherche zeigt, dass S-04 die
S-06-Kernfunktionalität bereits vorgebaut hat — Abbruch (`cancelActive` →
DELETE → Cascade) erfüllt FR-014; Token-Akkumulation (DB-Spalten + Service)
plus Anzeige in Lauf-Liste **und** Ergebnis-Detail erfüllen FR-015. Die einzige
echte Lücke ist ein **mitlaufender Token-Zähler während des aktiven Laufs**:
`RunProgress` (Step-Antwort) trägt keine Tokens, sie erscheinen erst nach
Abschluss. Dieser Slice schließt diese Lücke (Typ + Service-Return + Live-Panel)
und verifiziert anschließend die bestehende Abbruch-/Token-Funktion end-to-end.

Keine neue Migration (Token-Spalten existieren), keine API-Änderung
(`/api/runs/[id]/step` reicht `RunProgress` unverändert durch).
