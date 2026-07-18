# Feature: HEXACO-Instrument

**Erstellt:** 2026-07-16
**Ziel:** Ein zweites gemeinfreies Persönlichkeitsinstrument (HEXACO, inkl. des alignment-relevanten Honesty-Humility-Faktors) für das Modell-Profiling verfügbar machen und dabei die feste Bindung an ein einzelnes Instrument aufheben.
**Prioritaet:** Mittel
**Status:** Abgeschlossen <!-- abgeleitete Anzeige, wird von dtb:workflow-checkpoint synchronisiert (project-rules/DERIVED_STATE_RULES.md) -->

---

## Executive Summary

Das Tool profiliert Sprachmodelle heute mit einem Persönlichkeitstest (OEJTS) und
einem Robustheits-Test (Steadfastness). Dieses Feature ergänzt **HEXACO** als
weiteres Instrument — sechs Persönlichkeitsfaktoren, darunter der bei den bisherigen
Instrumenten fehlende **Honesty-Humility**-Faktor, der für Alignment-Fragen
(Ehrlichkeit, Bescheidenheit, Anti-Manipulation) besonders aussagekräftig ist. Weil
HEXACO das am wenigsten mit dem bestehenden Persönlichkeitstest überlappende
Instrument ist, verbreitert es die psychometrische „Mappe" je Modell substanziell.
Voraussetzung und Teil des Features ist, die heute fest an ein einzelnes Instrument
gebundene Testausführung so zu verallgemeinern, dass künftige Instrumente additiv
hinzukommen.

---

## Scope / Abgrenzung

### Enthalten

- **HEXACO als wählbares Instrument** im Testlauf, durchführbar gegen Modell + Persona
  mit N Wiederholungen — im selben Bedienfluss wie die bestehenden Tests.
- **Gemeinfreie Fragebogen-Formulierungen (IPIP)**, die die sechs HEXACO-Faktoren inkl.
  Honesty-Humility abbilden — **nicht** die urheberrechtlich geschützte Original-Fassung.
- **Ergebnis als Verteilung je Faktor** (Mittel, Streuung, Verteilung über die
  Wiederholungen), **ohne** zusammenfassenden Typ-Code (für dieses Instrument fachlich
  unüblich); Faktoren mit niedrig/hoch-Beschriftung aus der HEXACO-Standardliteratur.
- **Einbindung als eigene Instrument-Sektion** in Modell-Profil, Modellvergleich und
  Dashboard, inkl. korrekter Zuordnung des Baseline-Laufs.
- **Herkunfts-/Lizenzangabe je Instrument** geführt (statt fest für ein einzelnes
  Instrument), damit HEXACO seine eigene, gemeinfreie Quelle korrekt ausweist.
- **Aufhebung der festen Instrument-Bindung**: die Testausführung wählt je Lauf das
  passende Instrument — der Enabler, der weitere Instrumente billig macht.

### Nicht enthalten

- Das Dunkle-Triade-Instrument (SD3) → **Idee #8** (direktes Folge-Feature).
- Facetten-Tiefe / die längere 100-Fragen-Fassung → **Idee #9**.
- Die übrigen Kandidaten aus Idee #3 (soziale/politische Haltungen, Wertefragebogen,
  Motivations-Orientierung, Selbstwert, Denkfreude, Facetten-Inventare).
- Keine neue Instrument-Gattung (kein mehrstufiger Dialog wie beim Robustheits-Test).
- Kein Umbau der Antwortskala (die gemeinfreie HEXACO-Fassung nutzt die bestehende
  fünfstufige Skala).

---

## Risiken & Mitigationen

| Risiko                                                               | Wahrscheinlichkeit | Impact  | Mitigation                                                                                                                                                      |
| -------------------------------------------------------------------- | ------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modell lässt bei längerem Fragebogen einzelne Fragen aus             | Mittel             | Mittel  | Bestehende tolerante Antwort-Auswertung + Wiederholungen; falls Modelle systematisch patzen, gezieltes Folge-Tuning (kein v1-Blocker)                           |
| Falsche Instrument-Zuordnung berechnet stillschweigend falsche Werte | Niedrig            | Hoch    | Kann ein Lauf keinem bekannten Instrument zugeordnet werden, schlägt er sichtbar und protokolliert fehl — kein stiller Rückfall auf ein anderes Instrument      |
| Öffentliche Verbreitung urheberrechtlich geschützter Item-Texte      | Niedrig (gemitigt) | Hoch    | Gemeinfreie Quelle (IPIP) statt Original-Fassung; erfüllt die Lizenz-Leitplanke strenger als das bestehende Instrument, da das Projekt öffentlich einsehbar ist |
| Regression bestehender Testläufe durch die Verallgemeinerung         | Niedrig            | Hoch    | Bestehende Läufe bleiben Standard und unverändert gültig; abgesichert durch Tests und eine bewusst „nichts verschiebt"-Zuordnung im Modell-Profil               |
| Overlap/Redundanz mit dem bestehenden Persönlichkeitstest            | Niedrig            | Niedrig | HEXACO bewusst als das am wenigsten redundante Instrument gewählt; Honesty-Humility ist einzigartig und nicht anderweitig abgedeckt                             |

---

## Dependencies

### Erforderlich vor Start

- [x] Gemeinfreie HEXACO-Fragebogen-Fassung (IPIP) mit Umfang und Faktor-Zuordnung identifiziert — kuratierte 60er-Auswahl aus den IPIP-HEXACO-Skalen (Ashton, Lee & Goldberg 2007); `context/foundation/instruments/ipip-hexaco-60.json` (2026-07-17)
- [x] Exaktes Lizenz-/Herkunfts-Label für die gewählte Quelle bestätigt — „IPIP, public domain"; Befund: kein kanonisches „IPIP-HEXACO-60", eigene deterministische Auswahl (dokumentiert in der Referenzdatei)

### Referenz-Dokumente

- `features/hexaco-instrument/discovery.md` — Discovery-Ergebnisse (Scope, betroffene Bereiche, Randfälle)
- `docs/instruments/oejts-attribution.md` — Muster für die Herkunfts-/Lizenzangabe
- `context/foundation/prd.md` — Produktrahmen (psychometrisches Profiling, N Wiederholungen)

---

## Success Criteria

**Das Feature gilt als erfolgreich wenn:**

- [ ] HEXACO ist im Testlauf als Instrument wählbar und läuft gegen Modell + Persona mit N Wiederholungen durch.
- [ ] Das Ergebnis zeigt die sechs Faktor-Verteilungen inkl. Honesty-Humility, ohne Typ-Code.
- [ ] HEXACO erscheint als eigene Sektion in Modell-Profil, Modellvergleich und Dashboard; der Baseline-Lauf ist korrekt zugeordnet.
- [ ] Die Herkunfts-/Lizenzangabe wird je Instrument korrekt angezeigt und weist für HEXACO die gemeinfreie Quelle aus.
- [ ] Bestehende Persönlichkeitstest-Läufe bleiben unverändert gültig und werden korrekt dargestellt.
- [ ] Ein weiteres künftiges Instrument lässt sich additiv ergänzen — die feste Bindung an ein einzelnes Instrument ist aufgehoben.
- [ ] Eine nicht auflösbare Instrument-Zuordnung schlägt sichtbar und protokolliert fehl statt still falsche Werte zu berechnen.

---

## Offene Punkte

- ~~Welche konkrete gemeinfreie HEXACO-Fragebogen-Fassung (Umfang, Faktor-Zuordnung) und welches exakte Lizenz-/Herkunfts-Label nehmen wir?~~ **Geklärt 2026-07-17:** kuratierte 60er-Auswahl aus den IPIP-HEXACO-Skalen, public domain — `context/foundation/instruments/ipip-hexaco-60.json`.
- Wie weit soll die Verallgemeinerung der Instrument-Bindung in v1 reichen (minimal für HEXACO vs. vollständige, künftig rein additive Lösung)? — in der Planung zu schärfen.

---

**Erstellt mit:** `/dtb:feature-plan`
