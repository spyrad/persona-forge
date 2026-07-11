# Feature: Model Compare

**Erstellt:** 2026-07-11
**Ziel:** Test-Ergebnisse pro Modell aggregieren und als Modell-Profil sowie im direkten Modell-Vergleich (2–4 Modelle) darstellen — statt nur Lauf für Lauf.
**Prioritaet:** Hoch
**Status:** Geplant <!-- abgeleitete Anzeige, wird von dtb:workflow-checkpoint synchronisiert (project-rules/DERIVED_STATE_RULES.md) -->

---

## Executive Summary

Läufe beziehen sich heute je auf ein bestimmtes Modell, die Ergebnisse werden aber
nur lauf-zentriert angezeigt. Das Feature führt eine modell-zentrierte Sicht ein:
pro Modell werden alle verwertbaren Ergebnisse je Test-Instrument zu einem Profil
(der psychometrischen „Mappe") aggregiert, und 2–4 Modelle lassen sich nebeneinander
vergleichen — nach dem Vorbild der OpenRouter-Vergleichsansicht,

<!-- Lint-Override: OpenRouter ist UX-/Design-Vorbild (Anforderung an das Erscheinungsbild), keine Implementierungs-Technologie -->

jedoch mit unseren Test-Ergebnissen statt technischer Kennzahlen. Die Anlage ist
instrument-agnostisch, damit künftige Tests (vgl. Inbox #3 Test-Palette) ohne Umbau
als weitere Profil-Achsen andocken.

---

## Scope / Abgrenzung

### Enthalten

- **Modell-Profil:** je Modell alle verwertbaren Wiederholungen aus allen
  abgeschlossenen Läufen, aggregiert pro Test-Instrument zu einer Verteilung je Achse.
  Aggregations-Schlüssel: (kanonischer Modellname, Instrument).
- **Gruppierung nach Modellname:** mehrere Nutzer-Konfigurationen mit demselben
  Modellnamen zählen als EIN Modell — auch über verschiedene Anbieter/Endpunkte
  hinweg (Anbieter-Streuung wird in den Meta-Infos ausgewiesen).
- **Basis-Profil = nur Läufe ohne Persona.** Läufe mit Persona würden das
  Basis-Profil verfälschen; sie werden ausgeschlossen und der Ausschluss in den
  Meta-Infos ausgewiesen (z.B. „12 runs aggregated, 4 persona runs excluded").
- **Baseline-Läufe ermöglichen:** Läufe können künftig bewusst OHNE Persona
  gestartet werden (Baseline — das Modell antwortet ohne aufgesetzten Charakter).
  Heute verlangt jeder Lauf-Start eine Persona; erst Baseline-Läufe liefern die
  Daten, aus denen das Basis-Profil entsteht. (Entscheidung 2026-07-11, nach
  Befund: „Läufe ohne Persona" existierten im Bestand nicht.)
- **Modell-Vergleich:** 2–4 Modelle nebeneinander, je Spalte das Profil mit
  Verteilungen je Instrument-Achse.
- **Meta-Infos je Modell:** Anzahl Läufe/Wiederholungen, Zeitraum, verwendete
  Konfigurationen, Anbieter-Streuung.
- **Einstieg über die Modell-Liste;** Auswahl-Muster analog zur bestehenden
  Lauf-Liste. Aus der Lauf-Liste nur eine Querverlinkung zum Modell-Profil.
- **Bestehende Design-Sprache und Darstellungsmuster** der Ergebnis-Ansichten
  werden übernommen (editoriale Anzeige-Flächen, Verteilungs-Darstellung je Achse).

### Nicht enthalten

- **Kein Persona-Vergleich** und keine Persona-Dimension im Profil (v1);
  Persona×Modell-Analyse ist ein späteres, eigenes Vorhaben.
- **Dashboard bleibt unangetastet** — modell-zentrierte Kacheln wandern in
  Inbox #4 (Dashboard-Visualisierung).
- **Bestehender Lauf-gegen-Lauf-Vergleich bleibt unverändert** (kein Abriss,
  keine Änderung); seine Zukunft wird erst nach Live-Gang neu bewertet.
- **Keine öffentliche/geteilte Ansicht** — nur eingeloggt, eigene Daten.
- **Keine externen Datenquellen** (keine Modell-Metadaten von Drittanbietern,
  keine neuen Schnittstellen, keine Modell-Aufrufe).

---

## Risiken & Mitigationen

| Risiko                                                                                                                       | Wahrscheinlichkeit                 | Impact  | Mitigation                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| Modellnamen-Streuung: dasselbe Modell unter abweichenden Bezeichnungen (z.B. mit/ohne Anbieter-Präfix) → Profil zersplittert | Mittel                             | Mittel  | v1: exakter Namens-Match; Normalisierung als offener Punkt beobachten                                         |
| Dünne Datenlage erzeugt scheinbar aussagekräftige Profile                                                                    | Hoch                               | Mittel  | Weiche Variante: immer anzeigen + deutlicher Hinweis unter 5 verwertbaren Wiederholungen je Modell+Instrument |
| Aggregation wird bei wachsender Datenmenge träge                                                                             | Niedrig (heute kleine Datenmengen) | Mittel  | Aggregation hinter stabiler Schnittstelle kapseln, sodass eine spätere Optimierung die Ansicht nicht ändert   |
| Attributions-Pflicht (OEJTS, CC BY-NC-SA) fällt beim neuen Layout heraus                                                     | Niedrig                            | Hoch    | Attribution als explizites Abnahme-Kriterium (s. Success Criteria)                                            |
| Läufe mit gelöschter Modell-Konfiguration verfälschen die Gruppierung                                                        | Niedrig                            | Niedrig | Läufe ohne auflösbaren Modellnamen werden ausgeschlossen                                                      |

---

## Dependencies

### Erforderlich vor Start

- [ ] Keine — alle benötigten Daten (Läufe, Wiederholungen, Modell-Konfigurationen) existieren bereits

### Referenz-Dokumente

- `features/model-compare/discovery.md` — Discovery mit allen Entscheidungen, betroffenen Modulen und Randfällen
- `context/foundation/prd.md` — PRD (Einordnung Testläufe/Verteilungen je Achse)

---

## Success Criteria

**Das Feature gilt als erfolgreich wenn:**

- [ ] Ein Lauf lässt sich ohne Persona starten (Baseline) und durchläuft den normalen Lauf-Lebenszyklus.
- [ ] Von der Modell-Liste aus ist je Modell ein Profil erreichbar, das alle verwertbaren Baseline-Ergebnisse je Instrument aggregiert zeigt (Verteilung je Achse + Meta-Infos).
- [ ] 2–4 Modelle lassen sich auswählen und nebeneinander vergleichen; bei nur einem Modell mit Daten gibt es einen erklärenden Hinweis statt eines leeren Vergleichs.
- [ ] Läufe mit Persona fließen nicht ins Profil ein und der Ausschluss ist in den Meta-Infos sichtbar.
- [ ] Mehrere Konfigurationen mit demselben Modellnamen (auch über Anbieter hinweg) erscheinen als ein Modell; die Anbieter-Streuung ist ausgewiesen.
- [ ] Alle Randfälle enden in erklärenden Zuständen statt Fehlern: Modell ohne abgeschlossene Läufe nicht wählbar, Instrument ohne Daten mit Leer-Zustand, Ladefehler mit erklärender Meldung.
- [ ] Unter 5 verwertbaren Wiederholungen je Modell+Instrument erscheint ein Dünn-Daten-Hinweis.
- [ ] Die OEJTS-Attribution ist auf der neuen Ansicht sichtbar (CC BY-NC-SA).
- [ ] Ein künftiges Instrument kann als weitere Profil-Sektion ergänzt werden, ohne die Ansicht umzubauen (instrument-agnostische Anlage).
- [ ] Dashboard und Lauf-gegen-Lauf-Vergleich sind unverändert.

---

## Offene Punkte

- Ist eine Normalisierung von Modellnamen nötig (z.B. `gpt-5.5` vs. `openai/gpt-5.5`), oder reicht der exakte String-Match in der Praxis? → Beobachten, Entscheidung im Implementierungsplan oder nach ersten echten Daten.
- Zukunft des Lauf-gegen-Lauf-Vergleichs (behalten/abreißen) — bewusst vertagt, bis Model Compare live ist.

---

**Erstellt mit:** `/dtb:feature-plan`
