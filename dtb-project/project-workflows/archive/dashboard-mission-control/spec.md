# Feature: Dashboard Mission Control

**Erstellt:** 2026-07-15
**Ziel:** Das Dashboard beantwortet auf einen Blick „Was ist der Stand meines Labors?" — mit echten Kennzahlen und einer ruhig animierten Darstellung der profilierten Modelle.
**Prioritaet:** Mittel
**Status:** Abgeschlossen <!-- abgenommen von Damian 2026-07-15 (Prod-Sichtpruefung), archiviert via DTB-Archiv-Flow 2026-07-15 -->

---

## Executive Summary

Das heutige Dashboard besteht aus drei statischen Link-Kacheln ohne Daten. Es wird
zu einem datengetriebenen „Mission Control": ein zentrales, ruhig animiertes
Hero-Element zeigt die profilierten Modelle (Name + Typ), darunter ein „Register"
mit echten Kennzahlen (profilierte Modelle, Personas, letzte Lauf-Aktivitaet) und
Links in die Bereiche. Leitidee aus der Inspirations-Analyse (HELIOS/CHRONARIUM/
GRIDWATCH, siehe Discovery): Lebendigkeit entsteht aus echten, sich bewegenden
Daten — nicht aus 3D-Effekten.

---

## Scope / Abgrenzung

### Enthalten

- Umbau der Dashboard-Sicht zu „Mission Control": Hero-Element + Register
- **Hero:** die profilierten Modelle als lebende, ruhig animierte Darstellung
  (Modellname + Typ); konfigurierte, aber unprofilierte Modelle erscheinen
  gedimmt ohne Typ
- **Register:** die bisherigen drei Kacheln (Models/Personas/Runs) werden
  Zeilen/Karten mit echten Kennzahlen (X Modelle profiliert, Y Personas,
  letzter Lauf vor N Stunden, Typ + Stabilitaet je Modell) und Links in die
  Bereiche
- **Zustaende definiert:** Leerzustand als Einladung (angedeutete, unbelegte
  Struktur + Handlungsaufforderung), Teilbefuellung (gedimmt), Fehlerfall je
  Kennzahl-Quelle als ERR-Anzeige im Register statt Seiten-Ausfall
- Einheitlich in Hell- und Dunkel-Modus, bestehende editoriale Design-Sprache
  (Teal/Amber-Akzente, Mono-Kennwerte)
- Bewegungsreduktion: bei entsprechender System-Einstellung steht alles still,
  Inhalte identisch
- OEJTS-Attribution auch im Dashboard, sobald Typen gezeigt werden

### Nicht enthalten

- Keine 3D-Darstellung oder -Rotation (bewusste Abkehr von der urspruenglichen
  Idee #4-Formulierung)
- Keine laufende Datenaktualisierung nach dem Laden — die Momentaufnahme beim
  Oeffnen genuegt
- Keine Live-Ansicht laufender Tests (bleibt Idee #5)
- Kein Umbau anderer Seiten
- Keine neuen externen Abhaengigkeiten, Schnittstellen oder Datenmodell-
  Aenderungen — reine Lese-Sicht auf Bestehendes

---

## Risiken & Mitigationen

| Risiko                                                                   | Wahrscheinlichkeit | Impact | Mitigation                                                                                                                    |
| ------------------------------------------------------------------------ | ------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Animation wirkt unruhig/ueberladen statt „ruhig lebendig"                | Mittel             | Mittel | Prinzip „dezente, konstante Bewegung" (CHRONARIUM-Stil); Bewegungsreduktion respektieren; Sichtpruefung als Abnahme-Kriterium |
| Viele profilierte Modelle sprengen das Hero (> 8)                        | Niedrig            | Mittel | Grenzverhalten im Implementierungsplan festlegen (skalieren vs. zuletzt aktive); kein Scrollen im Hero                        |
| Ausfall einer Kennzahl-Quelle macht das Dashboard unbrauchbar            | Niedrig            | Hoch   | Teilausfall-Prinzip: Rest rendert normal, betroffener Bereich zeigt ERR-Zustand                                               |
| Attributionspflicht (OEJTS, CC BY-NC-SA) im Dashboard uebersehen         | Niedrig            | Hoch   | Als Success Criterion verankert; gleicher Hinweis wie auf Profil-/Vergleichs-Seiten                                           |
| Zu viele Einzelabfragen belasten das knappe Laufzeit-Budget der Umgebung | Mittel             | Mittel | Kennzahlen aus wenigen gebuendelten Abfragen beziehen; kein Abruf je Modell einzeln                                           |

---

## Dependencies

### Erforderlich vor Start

- [ ] Keine — alle Datenquellen (Modell-Profile, Laeufe, Personas,
      Modell-Konfigurationen) existieren bereits und werden nur lesend genutzt

### Referenz-Dokumente

- `features/dashboard-mission-control/discovery.md` — Discovery: betroffene Module, Inspirations-Analyse, Randfaelle, Einschraenkungen
- `dtb-project/project-workflows/archive/model-compare/` — Wiederverwendungs-Muster (Profil-Verlinkung, Baseline-Badge, Serien-Farben)
- `docs/instruments/oejts-attribution.md` — Attributionspflicht bei Typ-Anzeige

---

## Success Criteria

**Das Feature gilt als erfolgreich wenn:**

- [ ] Das Dashboard beantwortet beim Oeffnen ohne weitere Klicks „Was ist der
      Stand meines Labors?": profilierte Modelle mit Typ + Stabilitaet, Anzahl
      Personas, letzte Lauf-Aktivitaet
- [ ] Alle Werte stehen beim ersten Anzeigen fest — nichts springt nach dem
      Laden nach
- [ ] Das Hero animiert ruhig und konstant; bei Bewegungsreduktions-Einstellung
      steht alles still, Inhalte identisch
- [ ] Frischer Account: einladender Leerzustand mit Handlungsaufforderung
      („erstes Modell profilieren"); Register zeigt 0-Werte statt zu
      verschwinden
- [ ] Konfigurierte, aber unprofilierte Modelle erscheinen gedimmt ohne Typ
- [ ] Faellt eine Kennzahl-Quelle aus, funktioniert der Rest der Seite;
      der betroffene Bereich zeigt einen ERR-Zustand
- [ ] Verlinkung: Hero-Modelle fuehren zum Modell-Profil, Register-Zeilen zu
      Models/Personas/Runs; ab 2 profilierten Modellen Schnellzugriff auf den
      Modell-Vergleich
- [ ] Hell- und Dunkel-Modus geprueft; ausschliesslich bestehende
      Design-Sprache (Teal/Amber-Akzente), keine neuen Farbwerte
- [ ] OEJTS-Attribution ist sichtbar, sobald Typen angezeigt werden
- [ ] Baseline-Erkennung strikt ueber die Baseline-Kennzeichnung des Laufs,
      nie ueber fehlende Persona-Zuordnung (Lektion L1)

---

## Offene Punkte

- **Konkrete Hero-Metapher** (Orbits? Feld? Konstellation?) — Discovery legt nur
  „ruhig, datengetrieben" fest; Entscheidung im Implementierungsplan/Design
- **Grenzverhalten bei > 8 profilierten Modellen** (skalieren vs. „zuletzt
  aktive zeigen") — im Implementierungsplan festlegen
- **Wiederverwendbarkeit fuer Idee #5** (Live-Run-Visualisierung): Zuschnitt der
  Hero-Bausteine so, dass die Muster spaeter uebernehmbar sind — Detail im
  Implementierungsplan

---

**Erstellt mit:** `/dtb:feature-plan`
