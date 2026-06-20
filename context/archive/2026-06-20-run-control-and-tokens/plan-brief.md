# Lauf-Kontrolle — Live-Token-Zähler (S-06) — Plan Brief

> Full plan: `context/changes/run-control-and-tokens/plan.md`

## What & Why

S-06 verlangt Lauf-Abbruch (FR-014) und Token-Ausweis je Lauf (FR-015). Die
Code-Recherche zeigt: **beide sind durch S-04 bereits erfüllt und live.** Dieser
Slice schließt die einzige verbleibende Lücke — einen mitlaufenden Token-Zähler
im Live-Fortschritts-Panel während ein Lauf aktiv ist — und verifiziert dann die
gesamte S-06-Funktion end-to-end, um den Slice formal zu schließen.

## Starting Point

Abbruch (`cancelActive` → DELETE → Cascade) und Token-Akkumulation +
Anzeige in Lauf-Liste und Ergebnis-Detail existieren bereits. Nur `RunProgress`
(die Step-Antwort) trägt keine Tokens, daher zeigt das Live-Panel während des
Laufs keinen Verbrauch — er erscheint erst nach Abschluss via Refetch.

## Desired End State

Während ein Lauf läuft, zeigt das Live-Panel `Tokens: X ein / Y aus`, das sich
nach jeder Wiederholung aktualisiert. Liste, Detail und Abbruch bleiben
unverändert korrekt. Verifiziert gegen einen echten OEJTS-Lauf (N≥2).

## Key Decisions Made

| Decision                       | Choice                                  | Why (1 sentence)                                                              | Source |
| ------------------------------ | --------------------------------------- | ---------------------------------------------------------------------------- | ------ |
| Scope von S-06                 | Nur Live-Token-Zähler + Verifikation    | Abbruch & Token-Anzeige sind durch S-04 schon ausgeliefert.                  | Plan   |
| Abbruch-Semantik               | Harter Delete beibehalten (kein Status) | FR-014 = Lauf vollständig verwerfen; `cancelled`-Zustand wäre Over-Engineering. | Plan   |
| Token-Transport                | `RunProgress` um 2 Felder erweitern     | Werte liegen im Service schon vor; kein Voll-Refetch pro Schritt nötig.       | Plan   |
| DB                             | Keine Migration                         | Token-Spalten existieren seit S-04.                                          | Plan   |

## Scope

**In scope:** `RunProgress` um `promptTokens`/`completionTokens` erweitern; an allen
5 Service-Returns füllen; Client-Initial-Literal + Live-Panel-Anzeige; E2E-Verifikation.

**Out of scope:** Neue Migration; API-Vertragsänderung jenseits der 2 DTO-Felder;
`cancelled`-Status/Pause/Resume; Kostenrechnung; neue Unit-Tests; Änderung an
Liste/Detail-Anzeige.

## Architecture / Approach

Rein additive Typ-Erweiterung. `processNextRepetition` reicht die bereits
akkumulierten Werte (`run.promptTokens` bzw. `newPromptTokens`) an jedem Return
mit zurück; der Step-Endpoint bleibt unberührt; der Client zeigt sie im Live-Panel.
Der `astro check`-Typecheck erzwingt Vollständigkeit über alle Return-Sites.

## Phases at a Glance

| Phase                                    | What it delivers                          | Key risk                                              |
| ---------------------------------------- | ----------------------------------------- | ----------------------------------------------------- |
| 1. Live-Token-Zähler + S-06-Verifikation | Mitlaufende Tokens + geschlossener Slice  | Eine Return-Site vergessen (vom Typecheck abgefangen) |

**Prerequisites:** S-04 (✅ done & live).
**Estimated effort:** ~1 Session, eine Phase.

## Open Risks & Assumptions

- Annahme: Endpoints liefern `usage`; fehlt sie, zeigt der Zähler `0/0` (kein Crash) —
  konsistent mit der bestehenden `?? 0`-Akkumulation.
- Kein Risiko aus DB/API — additive Typ- und Display-Änderung.

## Success Criteria (Summary)

- Live-Panel zeigt während des Laufs einen steigenden Token-Zähler; Endstand = Liste/Detail.
- Abbruch verwirft den Lauf vollständig (keine Teilauswertung).
- Token-Ausweis (Eingabe/Ausgabe) je Lauf in Liste und Detail, robust gegen fehlende usage.
