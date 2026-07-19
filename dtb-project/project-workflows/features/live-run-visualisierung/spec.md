# Feature: Live-Run-Visualisierung

**Erstellt:** 2026-07-18
**Ziel:** Ein laufender Testlauf soll sich lebendig und beobachtbar anfühlen — eine ruhige „Live-Bühne" zeigt jede Wiederholung, statt dass ein statisches Panel nur Zahlen auflistet.
**Prioritaet:** Mittel
**Status:** Abgenommen <!-- abgeleitete Anzeige, wird von dtb:workflow-checkpoint synchronisiert (project-rules/DERIVED_STATE_RULES.md) -->

---

## Executive Summary

Während ein Testlauf läuft, zeigt die Lauf-Ansicht heute nur Textzeilen und einen simplen Fortschrittsbalken — der Lauf wirkt statisch, obwohl im Hintergrund pro Wiederholung Messdaten eintreffen. Das Feature erweitert das bestehende Fortschritts-Panel um eine „Live-Bühne": eine Zelle je Wiederholung, die bei Erfolg oder Fehler sichtbar reagiert, ein ruhiger Herzschlag-Puls solange das Modell antwortet, und Zähler, die jeden Wertwechsel mit einem sanften Puls quittieren. Die Grundstimmung ist bewusst ruhig-konzentriert („Messgerät bei der Arbeit"), nicht energetisch — unaufdringlich genug, den Tab offen zu lassen. Inspiration: der Pulse-/Live-Eindruck von fable-25.netlify.app/pulse/ (übernommen wird die Stimmung, nicht die Technik).

---

## Scope / Abgrenzung

### Enthalten

- **Live-Bühne im bestehenden Fortschritts-Panel** (erweitert es, ersetzt es nicht — alle heutigen Text-Infos bleiben):
  - Eine Zelle je Wiederholung; Zellen leuchten nacheinander auf (Erfolg = Akzentfarben-Puls, Fehler = Fehlerfarben-Blitz, danach gedimmt markiert)
  - Herzschlag-Idle-Puls, solange eine Antwort aussteht (ruhiger Zyklus ~1–2 s)
  - Zähler (Wiederholungen, Token) quittieren jeden Wertwechsel mit einem sanften Puls, gleichbleibende Ziffernbreite — kein numerisches Hochzählen: Werte springen ehrlich so, wie die Daten eintreffen (Angleichung aus dem Plan-Review)
  - Abschluss-Moment am Lauf-Ende: alle Zellen pulsieren einmal in Erfolgs- bzw. Fehlerfarbe, dann blendet das Panel sanft aus
- **Alle Lauf-Arten:**
  - Item-Läufe (OEJTS/HEXACO): 1 Zelle = 1 Wiederholung
  - Steadfastness: 1 Zelle = 1 Fakt; die Szenario-Erzeugungs-Phase zeigt den Herzschlag ohne Zellen-Fortschritt; Runde/Strategie erscheinen als Textzeile; während der Runden wird ehrlich der Zustand gezeigt („Runde X läuft…") statt eines prominent toten Null-Zählers
- **Zugänglichkeit:** Bei Systemeinstellung „reduzierte Bewegung" entfallen alle Animationen; die Bühne bleibt als statische Zustandsanzeige mit harten Farbwechseln vollständig informativ

### Nicht enthalten

- Keine Änderungen an Server-Verhalten, Datenmodell, gespeicherten Daten oder dem Schnittstellen-Vertrag des Fortschritts-Datenflusses — reine Darstellungs-Änderung im Browser
- Kein Fix des geparkten Minors „Fortschritt zeigt 0 Token während Steadfastness-Runden" (separates Ticket; die Bühne kaschiert nur die Anzeige)
- Keine eigene Steadfastness-Inszenierung mit Runden-/Strategie-Animation
- Keine Live-Vorschau der Achsen-/Ergebnisverteilung während des Laufs
- Keine Wiederaufnahme eines Laufs nach Seiten-Neuladen (Status quo bleibt)
- Keine neuen externen Bibliotheken

---

## Risiken & Mitigationen

| Risiko                                                                      | Wahrscheinlichkeit | Impact  | Mitigation                                                                                              |
| --------------------------------------------------------------------------- | ------------------ | ------- | ------------------------------------------------------------------------------------------------------- |
| Wirkung kippt von „ruhig-konzentriert" zu unruhig/kitschig                  | Mittel             | Mittel  | Sichtprüfung in Light + Dark vor Abnahme; Frequenz/Intensität iterativ zähmen                           |
| Dauer-Animationen belasten Rechner/Akku bei offenem Tab                     | Niedrig            | Mittel  | bewegungsarme, effiziente Animationsumsetzung als Plan-Vorgabe; ruhiger Puls statt Dauerfeuer           |
| Bestehende automatisierte Tests werden durch Animationen instabil           | Mittel             | Mittel  | sichtbare Textanker des Panels bleiben unverändert; Tests warten auf Zustände, nicht auf Zeiten         |
| Steadfastness wirkt trotz Bühne leblos (Token klemmen bei 0 während Runden) | Mittel             | Niedrig | ehrliche Zustandsanzeige (Herzschlag + „Runde X läuft…") statt toter Zähler; Minor bleibt separat offen |
| Scope-Kriechen Richtung Server (Wunsch nach Live-Zwischenwerten)            | Niedrig            | Hoch    | harte Grenze in „Nicht enthalten" verankert; Ergebnis-Vorschau ist explizit eigenes, künftiges Thema    |

---

## Dependencies

### Erforderlich vor Start

- Keine — das Feature ist eigenständig; alle benötigten Live-Daten treffen bereits heute pro Wiederholung ein (Erkenntnis der Discovery: die frühere Sorge „Machbarkeit unter Edge-Lauf-Aufteilung" ist entschärft, da der Browser den Lauf selbst schrittweise treibt)

### Referenz-Dokumente

- `features/live-run-visualisierung/discovery.md` — Discovery mit betroffenen Modulen, allen Scope-Entscheidungen und Randfällen
- `INBOX.md` #5 — Ursprungsidee (Live-Ansicht grafisch aufwerten, Pulse-Inspiration)

---

## Success Criteria

**Das Feature gilt als erfolgreich wenn:**

- [ ] Während eines Item-Laufs zeigt das Panel die Bühne: eine Zelle je Wiederholung, Erfolg und Fehler sind visuell klar unterscheidbar, zwischen den Schritten pulsiert der Herzschlag, die Zähler pulsieren sanft bei jedem Wertwechsel
- [ ] Bei Steadfastness gilt: 1 Zelle = 1 Fakt; die Erzeugungs-Phase zeigt den Herzschlag ohne Zellen-Fortschritt; Runde/Strategie erscheinen als Text; kein prominent toter Null-Zähler
- [ ] Am Lauf-Ende (Erfolg wie Fehlschlag) gibt es den Abschluss-Moment mit sanftem Ausblenden; bei Nutzer-Abbruch verschwindet das Panel wie bisher sofort
- [ ] Bei Verbindungs-/Serverfehler mitten im Lauf frieren die Zellen grau ein und eine Fehlermeldung erscheint; das eingefrorene Panel lässt sich über einen Schließen-Knopf ausblenden
- [ ] Mit Systemeinstellung „reduzierte Bewegung" ist die Bühne animationsfrei und trotzdem vollständig informativ
- [ ] Light und Dark Mode wirken gleichwertig; es werden ausschließlich semantische Farbtoken des Design-Systems verwendet
- [ ] Alle heutigen Text-Infos des Panels (Wiederholungen, Token, Zeiten, letzter Fehler) und die sichtbaren Textanker der bestehenden Tests sind unverändert vorhanden
- [ ] Die Änderung bleibt vollständig in der Darstellungs-Schicht: Server-Verhalten, Datenmodell und Schnittstellen-Vertrag sind unangetastet

---

## Offene Punkte

- Konkrete visuelle Ausgestaltung (Zellen-Form/-Größe, Herzschlag-Frequenz, Glüh-Intensität): im Implementierungsplan festlegen und per Sichtprüfung iterieren
- Umsetzungstechnik der sanft hochzählenden Werte: im Implementierungsplan entscheiden (Vorgabe aus der Discovery: effizient, kein Dauer-Rechenloop)
- Verhalten auf kleinen Bildschirmen: der Zellen-Umbruch deckt es vermutlich ab — im Plan kurz verifizieren, kein eigener Gestaltungs-Scope

---

**Erstellt mit:** `/dtb:feature-plan`
