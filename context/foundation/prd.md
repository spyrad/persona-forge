---
project: "persona-forge"
version: 1
status: draft
created: 2026-06-10
context_type: greenfield
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 7
  hard_deadline: null
  after_hours_only: true
---

# PRD: persona-forge

> Begriffshinweis: **„Persona"** bezeichnet in diesem Produkt ein **Domänenobjekt** —
> einen KI-Charakter als strukturiertes kognitives Profil gemäß
> `docs/persona-authoring-spec.md` (COGNITIVE.md §§1–6 + README, plus Validierungs-
> Rubrik Abschnitt 7). Es ist ein _Testobjekt_, kein Nutzer. Die _Nutzer-Persona_
> im PRD-Sinn (der Mensch vor dem Tool) wird in `## User & Persona` beschrieben.

## Vision & Problem Statement

Sprachmodelle verhalten sich nicht neutral: Disposition — wie zustimmend, vorsichtig,
kreativ oder direkt ein Modell antwortet — variiert je nach Modell, System-Prompt und
Konfiguration und ist heute eine Blackbox. Wer ein Modell für einen Einsatzzweck
auswählt oder per System-Prompt eine Persona definiert, hat kein Werkzeug, um diese
Disposition systematisch sichtbar, vergleichbar und nachvollziehbar zu machen. Der
Schmerz hat drei Gesichter: **fehlende Messbarkeit** (Disposition ist nicht
systematisch erfassbar), **Nachweis-/Compliance-Druck** (in regulierten Kontexten muss
Angemessenheit belegt, nicht nur behauptet werden) und **Entscheidungslähmung**
(Modell-/Prompt-Auswahl ohne objektive Vergleichsbasis).

Der Insight, der den Status quo schlägt: etablierte, offen lizenzierte psychometrische
Instrumente (IPIP [gemeinfrei], OEJTS [CC BY-NC-SA 4.0]) liefern eine strukturierte, bekannte Skala statt
selbsterfundener Prompts; LLM-Antworten schwanken, deshalb macht erst **Verteilung
statt Punktwert** (mehrfach laufen lassen + Streuung zeigen) die Messung aussagekräftig;
und der System-Prompt wird als **Erstklasse-Objekt** behandelt — wiederverwendbar,
versioniert, vergleichbar — statt als Wegwerf-Text.

## User & Persona

**Primär — Modell-Evaluierer (AI/ML-Engineer / Prompt-Designer).** Wählt für einen
Einsatzzweck ein Modell oder eine Modell-/Prompt-Kombination aus und braucht eine
objektive, belegbare Vergleichsbasis statt Bauchgefühl. Greift zum Tool im Moment der
Auswahlentscheidung und wenn die Angemessenheit gegenüber Dritten (z.B. Compliance)
belegt werden muss.

### Secondary persona

**Persona-Autor.** Baut Personas nach `docs/persona-authoring-spec.md` und will deren
Verhaltens-Treue prüfen — ob eine Persona ihre Stärke zeigt, ohne in ihr benanntes
Risiko zu kippen (Spec Abschnitt 7C). Beide Rollen teilen sich das Tool; in v1 wird die
Persona-Autor-Rolle über die psychometrische Vermessung von Personas bedient, die volle
Treue-Validierung folgt in einem späteren Cycle.

## Success Criteria

### Primary

- Ein angemeldeter Nutzer kann ein beliebiges OpenAI-kompatibles Modell anhängen
  (Base-URL, API-Key, Modellname), eine Persona wählen/anlegen, das Instrument
  **OEJTS** (offen lizenziert [CC BY-NC-SA 4.0], MBTI-artige Typenausgabe) auswählen und einen Lauf mit N
  Wiederholungen starten; das Ergebnis erscheint je Achse als **Verteilung mit Streuung**
  über die Wiederholungen plus den abgeleiteten 4-Buchstaben-Typ, nicht als
  Einzel-Punktwert.
- Zwei Konfigurationen (zwei Modelle oder zwei Personas) lassen sich direkt
  nebeneinander vergleichen.

### Secondary

- Eine einmal angelegte Persona ist gespeichert und in beliebig vielen weiteren Läufen
  wiederverwendbar.
- Eine Persona kann org-weit („global") bereitgestellt werden.

### Guardrails

- API-Keys werden nie im Klartext gespeichert — Verschlüsselung at rest ist Pflicht.
- Der Methodenkern ist unverletzlich: ein Einzeldurchlauf wird nie als belastbarer
  Wert dargestellt; Ergebnisse sind immer Verteilungen über die konfigurierte
  Wiederholungszahl mit Streuung.
- Nutzer sehen ausschließlich eigene oder globale Inhalte — kein Leck über
  Nutzergrenzen hinweg.

## User Stories

### US-01: Nutzer vermisst ein Modell mit einer Persona psychometrisch

- **Given** ein angemeldeter Nutzer mit mindestens einer Modellkonfiguration und einer Persona
- **When** er den Test OEJTS auswählt, eine Wiederholungszahl N setzt und den Lauf startet
- **Then** erhält er nach Abschluss aller N Wiederholungen je Achse eine Verteilung mit Streuung plus den abgeleiteten Typ — kein Einzel-Punktwert

#### Acceptance Criteria

- Jede der N Wiederholungen läuft in isolierter Sitzung; die Item-Reihenfolge wird
  permutiert, sofern das Instrument Permutation aktiviert hat
- Antworten werden strukturiert geparst (OEJTS-Format, bipolare Skala als JSON); schlägt
  das fehl, greift ein Freitext-Fallback-Parser; erst was auch dieser nicht löst, wird als
  ungparsebar markiert
- Das Ergebnis zeigt pro Achse Lage, Streuung und Roh-Verteilung sowie den abgeleiteten
  Typ und dessen Stabilität über die N Läufe; ein einzelner Durchlauf wird nie als
  belastbarer Wert dargestellt
- Während des Laufs ist Fortschritt sichtbar; ein Abbruch verwirft den Lauf vollständig
- Ein fehlgeschlagener/leerer Lauf zeigt einen erklärenden Zustand, keine leere 0-Ansicht

### US-02: Nutzer vergleicht zwei Konfigurationen

- **Given** zwei abgeschlossene Läufe (zwei Modelle oder zwei Personas)
- **When** der Nutzer sie zum Vergleich auswählt
- **Then** sieht er beide Verteilungen je Skala nebeneinander mit ihren Streuungen

## Functional Requirements

> Nach der vollen Socrates-Runde (Phase 4.5). Jede FR trägt das geprüfte Gegenargument
> und die Resolution. Die Runde hat v1 deutlich geschnitten: Einzel-Rollen-Tool, ein
> Likert-Instrument, kein gezieltes Teilen — der Methodenkern bleibt unangetastet.

### Authentifizierung & Zugriff

- FR-001: Nutzer kann sich per E-Mail + Passwort registrieren und anmelden. Priority: must-have
  > Socrates: Gegenargument „Selbst-Registrierung ist unnötige Angriffsfläche für ein
  > internes Tool". Resolution: steht — offene Registrierung bleibt; Passwort-Reset als
  > erwartetes Detail downstream.
- FR-002: Admin kann Rollen zuweisen. Priority: nice-to-have
  > Socrates: Gegenargument „bei festen Nutzern in v1 überflüssig". Resolution: auf
  > Rollenzuweisung reduziert UND in späteren Cycle verschoben — v1 ist einrollig
  > (siehe FR-009), Rollen-Management greift erst, wenn die Admin-Rolle existiert.
- FR-003: Nutzer kann die Sichtbarkeit (privat / global) eigener Personas und Ergebnisse setzen; Default ist global. Priority: must-have
  > Socrates: Gegenargument „in einem Vertrauens-Tool ist privat nur Overhead".
  > Resolution: Sichtbarkeit bleibt, aber Default = global; privat nur auf Wunsch.
- FR-004: ~~Gezieltes Teilen an einzelne Nutzer (Sichtbarkeit „geteilt").~~ **GESTRICHEN (v1).**
  > Socrates: Gegenargument „gezieltes Teilen bringt ACL-Komplexität; global/privat
  > reicht". Resolution: gestrichen — Sichtbarkeit ist zweistufig (privat/global), kein
  > Pro-Nutzer-ACL. N-Nutzer-Teilen ggf. späterer Cycle, nicht im Datenmodell v1.

### Modellkonfiguration

- FR-005: Nutzer kann ein OpenAI-kompatibles Modell anhängen und als wiederverwendbare Konfiguration speichern (Base-URL, API-Key, Modellname). Priority: must-have
  > Socrates: Gegenargument „pro-Nutzer-Endpunkte streuen Key-Speicherung; zentral
  > sicherer". Resolution: steht — Nutzer verwalten eigene Konfigs; Key-Schutz über
  > FR-006.
- FR-006: API-Keys werden verschlüsselt at rest gespeichert und nie im Klartext ausgegeben. Priority: must-have
  > Socrates: Gegenargument „nicht-speichern wäre stärker als Verschlüsselung".
  > Resolution: bewusst bei verschlüsselter Speicherung geblieben (Komfort/Wiederver-
  > wendbarkeit überwiegt; at rest verschlüsselt, nie Klartext-Ausgabe).

### Persona-Verwaltung

- FR-007: Nutzer kann eine Persona anlegen (System-Prompt frei oder strukturiert nach Spec) mit Name, Beschreibung, Tags, im Katalog speichern und für Läufe auswählen. Priority: must-have
  > Socrates: Gegenargument „frei + strukturiert verdoppelt die UI; eins wählen".
  > Resolution: steht — beide Eingabewege ab v1 gewollt.
- FR-008: Personas sind unveränderlich; eine Änderung erzeugt eine neue Kopie (keine Versionshistorie). Priority: must-have
  > Socrates: Gegenargument „Versionierung ist verfrühter Speicher/UX-Aufwand".
  > Resolution: Versionierung gestrichen → immutable + Kopie statt Version. (FR von
  > nice-to-have-Versionierung zu must-have-Immutability umdefiniert.)
- FR-009: Globale Personas und die Test-Bibliothek werden in v1 per Seed/Konfiguration bereitgestellt; eine Admin-Rolle zur UI-Verwaltung folgt in einem späteren Cycle. Priority: nice-to-have
  > Socrates: Gegenargument „bei Allein-Betrieb braucht v1 keine Admin-Rolle".
  > Resolution: keine Admin-Rolle in v1 — globale Objekte per Seed/Config; Admin-UI später.

### Test-Bibliothek

- FR-010: Nutzer kann in v1 das Instrument OEJTS (offen lizenziertes Jung'sches Instrument [CC BY-NC-SA 4.0], MBTI-artige 4-Buchstaben-Typenausgabe) auswählen; ein Likert-/Big-Five-Instrument (Mini-IPIP) folgt in einem späteren Cycle. Priority: must-have
  > Socrates: Gegenargument „zwei Instrumente mit getrennter Scoring-Logik verdoppeln die
  > Auswertungsarbeit". Resolution: weiterhin genau EIN Instrument in v1 — später jedoch
  > von Mini-IPIP auf **OEJTS getauscht** (Nutzer-Entscheidung), weil die MBTI-artige
  > Typenausgabe der gewünschte v1-Output ist. Offizieller MBTI bleibt rechtlicher No-Go;
  > IPIP/Big-Five-Likert folgt späterer Cycle.
- FR-011: Das Test-Modell ist datengetrieben genug, dass ein zweites gleichartiges Instrument ohne Code ergänzt werden kann; eine voll deklarative Engine (beliebige Skalen, auch andersartige Scoring-Logik wie Likert/Big-Five) ist v1 hartkodiert und folgt später. Priority: nice-to-have
  > Socrates: Gegenargument „deklarative Engine vor >2 Tests ist Over-Engineering
  > (YAGNI)". Resolution: Start-Test (OEJTS) hartkodiert; deklarative Engine erst wenn ein
  > dritter/andersartiger Test real ansteht.

### Testläufe (Methodenkern)

- FR-012: Nutzer kann einen Lauf mit konfigurierbarer Wiederholungszahl starten; jede Wiederholung läuft in isolierter Sitzung. Die Item-Permutation ist eine Eigenschaft des Instruments (an/aus konfigurierbar). Priority: must-have
  > Socrates: Gegenargument „Permutation kann bei manchen Instrumenten die Validität
  > durch Kontext-Effekte berühren". Resolution: Wiederholung + Isolation immer Pflicht;
  > Permutation pro Instrument konfigurierbar.
- FR-013: Das Tool fordert je Item eine strukturierte Antwort im Format des Instruments (OEJTS: bipolare Skala als JSON); schlägt das Parsen fehl, greift ein robuster Freitext-Fallback-Parser. Rohantworten werden je Item und Wiederholung gespeichert. Priority: must-have
  > Socrates: Gegenargument „JSON-Zwang scheitert bei schwächeren Modellen".
  > Resolution: Freitext-Fallback-Parser ergänzt; nur was auch der Fallback nicht löst,
  > wird als ungparsebar markiert.
- FR-014: Ein laufender Test zeigt Fortschritt und lässt sich abbrechen; ein Abbruch verwirft den Lauf vollständig (keine partielle Auswertung). Priority: must-have
  > Socrates: Gegenargument „Abbruch hinterlässt irreführende Teildaten". Resolution:
  > Abbruch = Lauf verworfen, keine Teilverteilung.
- FR-015: Ein Lauf weist die verbrauchten Tokens aus (Eingabe/Ausgabe je Lauf). Eine Kostenschätzung ist kein v1-Ziel. Priority: must-have
  > Socrates: Gegenargument „exakte Kosten brauchen variable Preistabellen; self-hosted
  > = 0". Resolution: nur Token-Zählung; Kosten weggelassen.

### Ergebnisse & Vergleich

- FR-016: Das Tool aggregiert die Item-Antworten je OEJTS-Achse (E/I, S/N, T/F, J/P) zu einem Achsen-Score und leitet daraus den 4-Buchstaben-Typ ab; je Achse wird die volle Verteilung über die Wiederholungen dargestellt (Lage, Streuung, Roh-Verteilung) und zusätzlich die Typ-Stabilität über die N Läufe ausgewiesen (wie oft welcher Buchstabe je Achse fällt). Priority: must-have
  > Socrates: Gegenargument „welches Streuungsmaß — reicht eine Zusammenfassung?".
  > Resolution: nicht nur Standardabweichung; auch die Roh-Verteilung je Achse zeigen.
  > (Nach Instrument-Tausch: Achsen statt Big-Five-Skalen, plus kategoriale Typ-Stabilität.)
- FR-017: Nutzer kann genau zwei Konfigurationen (zwei Modelle oder zwei Personas) nebeneinander vergleichen; Läufe, Ergebnisse und Personas bleiben persistent und wiederauffindbar. N-Wege-Vergleich folgt später. Priority: must-have
  > Socrates: Gegenargument „die Grenze auf zwei ist willkürlich". Resolution: bewusst
  > genau zwei in v1 (einfache Darstellung); N-Wege späterer Cycle.

## Non-Functional Requirements

- **Lauf-Resilienz.** Ein Lauf mit N Wiederholungen schließt ab, solange ein Teil der
  Modell-Antworten verwertbar ist; einzelne fehlgeschlagene oder ungparsebare Antworten
  brechen ihn nicht ab, und die Fehlquote ist im Ergebnis ausgewiesen.
- **Reproduzierbare Auswertung.** Dieselben gespeicherten Rohantworten ergeben bei
  erneuter Auswertung identische aggregierte Werte je Skala — deterministisches Scoring.
- **Sichtbares Fortschritts-Feedback.** Jede Operation, die länger als zwei Sekunden
  dauert (insb. ein laufender Test), zeigt durchgehend sichtbaren Fortschritt.
- **Key-/Daten-Dichtheit.** Ein gespeicherter API-Key verlässt nie den Server in Richtung
  Client; die Rohantworten eines Laufs bleiben innerhalb des Systems.
- **Last-Verträglichkeit.** Ein Lauf gegen einen ratenbegrenzten Endpunkt schließt
  erfolgreich ab, ohne den Endpunkt zu überlasten.

## Business Logic

persona-forge verwandelt eine Modell-/Persona-Kombination in ein messbares
Dispositionsprofil, indem es ein psychometrisches Instrument vielfach unter isolierten,
optional permutierten Bedingungen vorlegt und die Antworten je Skala zu einer Verteilung
mit Streuung aggregiert — statt zu einem einzelnen Punktwert.

Die Regel konsumiert als nutzerseitige Eingaben: eine angehängte Modellkonfiguration,
eine Persona (System-Prompt, frei oder strukturiert), ein gewähltes Instrument (in v1
OEJTS) und eine Wiederholungszahl N. Pro Wiederholung wird der vollständige Itemsatz
unter den methodischen Bedingungen (isolierte Sitzung, je nach Instrument permutierte
Reihenfolge) beantwortet; die Roh-Antwort je Item wird festgehalten.

Die Ausgabe ist je Achse des Instruments (bei OEJTS die vier Jung'schen Achsen E/I, S/N,
T/F, J/P) eine Verteilung über die N Wiederholungen — Lage, Streuung und Roh-Verteilung —
plus der daraus abgeleitete 4-Buchstaben-Typ und seine Stabilität über die Läufe. Das
Instrument definiert dabei seine Achsen/Skalen, seine Antwortskala und welche Items invers
gewertet werden; diese Definition steuert, wie Roh-Antworten zu Achsen-Scores verrechnet
werden. Der Nutzer begegnet dem Ergebnis nach Abschluss des Laufs als Verteilungs- und
Typansicht je Achse und kann zwei abgeschlossene Läufe (zwei Modelle oder zwei Personas)
zum Delta-Vergleich nebeneinanderstellen.

## Access Control

Authentifizierung per **E-Mail + Passwort**. **v1 ist einrollig:** jeder angemeldete
Nutzer legt eigene Personas, Modellkonfigurationen und Läufe an und sieht nur eigene
sowie als **global** markierte Inhalte. Eine **Admin-Rolle** (Nutzerverwaltung,
UI-gestützte Verwaltung globaler Personas und der Test-Bibliothek) ist **kein v1-Ziel**
und folgt in einem späteren Cycle (FR-002, FR-009); globale Objekte kommen in v1 per
Seed/Konfiguration.

Personas und Ergebnisse tragen eine **zweistufige Sichtbarkeit**: privat / global
(org-weit), Default **global**. Gezieltes Teilen an einzelne Nutzer (Pro-Nutzer-ACL)
ist in v1 gestrichen (FR-004) und nicht im Datenmodell vorgesehen. Ein
unauthentifizierter Zugriff auf eine geschützte Route führt zur Anmeldung.

**Audit (Basis):** jedes Objekt (Lauf, Persona, Modellkonfig) trägt Ersteller und
Erstellzeitpunkt; ein separates Ereignis-Log ist kein MVP-Ziel.

Sensible Daten (API-Keys) werden **verschlüsselt at rest** gespeichert, nie im Klartext
ausgegeben (FR-006; Umsetzungsdetail downstream).

## Non-Goals

### Funktionale Non-Goals (v1-Scope-Schnitt)

- **Kein eigenes Modell-Hosting / keine eigene Inferenz** — nur Anbindung externer
  OpenAI-kompatibler Endpunkte; kein GPU-/Modellbetrieb im Tool selbst.
- **Kein Likert-/Big-Five-Instrument (Mini-IPIP) in v1** — v1 liefert OEJTS (MBTI-artige
  Typenausgabe, CC BY-NC-SA 4.0); IPIP/Big Five folgt späterer Cycle. Offizieller MBTI bleibt
  dauerhaft ausgeschlossen (siehe No-Gos).
- **Keine voll deklarative Test-Engine in v1** — Start-Test ist hartkodiert; eine
  generische Engine (beliebige Skalen/Scoring) kommt erst mit dem dritten Test.
- **Keine Admin-Rolle / Nutzerverwaltung in v1** — einrolliges Tool; globale Objekte per
  Seed/Konfiguration.
- **Kein gezieltes Teilen / kein Pro-Nutzer-ACL** — Sichtbarkeit nur privat/global.
- **Kein N-Wege-Vergleich** — genau zwei Konfigurationen nebeneinander in v1.
- **Keine Persona-Versionierung** — Personas sind immutable; Änderung = neue Kopie.
- **Keine Persona-Treue-Validierung (Spec Abschnitt 7C)** — späterer Cycle.

### Dauerhafte No-Gos (aus der Pitch, außerhalb des Scope)

- **Keine proprietären / kostenpflichtig lizenzierten Test-Items** — keine offiziellen
  MBTI-/Gallup-/Hogan-Fragen; ausschließlich frei lizenzierte Instrumente (gemeinfrei
  oder offene CC-Lizenz wie CC BY-NC-SA 4.0). OEJTS ist urheberrechtlich geschützt, aber
  offen lizenziert (CC BY-NC-SA 4.0) — der NonCommercial-Teil bindet das Projekt.
- **Keine wissenschaftliche Validierungsstudie** — das Tool ist ein Explorations- und
  Vergleichswerkzeug, kein Forschungsinstrument.

### Nicht-funktionale Non-Goals

- **Keine Kostenschätzung** — nur Token-Zählung; monetäre Preisrechnung ist kein Ziel.

## Open Questions

1. **Schnitt Persona-Treue-Validierung vs. Psychometrie im MVP** — RESOLVED (Phase 3):
   Mittelweg-Schnitt. v1 liefert vollen psychometrischen Methodenkern + Vergleich; die
   Persona-Treue-Validierung (Spec 7C) ist ein späterer Cycle und damit Non-Goal für v1.
2. **Frei lizenzierte Quelle der OEJTS-Items** — RESOLVED (2026-07-03): Quelle fixiert auf
   Open Psychometrics (openpsychometrics.org, Autor Eric Jorgenson), OEJTS 1.2 — vollständiger
   Itemtext, Zuordnung Item → Achse (E/I, S/N, T/F, J/P), Polung/Reverse-Items und
   Scoring-Schlüssel als hartkodierter v1-Kern (`context/foundation/instruments/oejts-1.2.json`,
   `src/lib/instruments/oejts.ts`). **Befund entgegen der ursprünglichen Annahme: OEJTS ist
   NICHT gemeinfrei, sondern CC BY-NC-SA 4.0** — Attribution + NonCommercial + ShareAlike
   binden das (öffentliche) Repo. Details und Pflichten: `docs/instruments/oejts-attribution.md`.
