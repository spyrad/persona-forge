# Persona-Struktur — portable Spezifikation

*Selbsterklärende Referenz, wie eine Persona aufgebaut und erstellt wird.
Gedacht zum Einbetten in externe Tools (z.B. eine Prüf-/Playground-App), die
keinen Zugriff auf das Quell-Repo haben. Alle Beispiele sind inline — keine
externen Pfade nötig.*

---

## 0. Was eine Persona ist (und was nicht)

- **Persona = wie eine AI *mit dir* arbeitet.** Denkweise, Stimme,
  Entscheidungsfilter, Risiken. Ein wiederverwendbares kognitives Profil, das
  einem Agenten als System-Prompt oder Referenz übergeben wird, um eine
  bestimmte Arbeitsweise zu aktivieren.
- **Persona ≠ Digital Twin.** Ein Twin agiert *als* die Person (imitiert sie
  als Stellvertreter). Eine Persona steuert nur die *Arbeitsweise*. Beide bauen
  auf demselben kognitiven Fundament, aber die Persona modelliert nur die
  Steuerungs-Seite.
- **Keine Bio.** Lebenslauf, Kontaktdaten, biografische Fakten gehören **nicht**
  in eine Persona. Forschung zeigt: biografische Fakten sind die *schwache* Form
  ("surface-level"). Persona-Treue kommt aus Denkprozessen und Sprachmustern,
  nicht aus Stammdaten.

---

## 1. Datei-Struktur

```
persona-<name>/
├── COGNITIVE.md     PFLICHT — der Kern: Denkmuster, Stimme, Filter, Risiken.
│                    Wird IMMER geladen, wenn die Persona aktiviert wird.
├── cognitive/*.md   OPTIONAL — Rollen-Overlays. Laden nur bei passendem Kontext.
├── input/*.md       OPTIONAL — Rohquellen (Profile, Interviews) als Archiv.
└── README.md        PFLICHT — Meta: wann einsetzen, wann NICHT, Konsumenten.
```

**Pflicht ist nur `COGNITIVE.md` + `README.md`.** Alles andere kommt nur dazu,
wenn die Persona es braucht:

| Teil | Hinzufügen, wenn … |
|------|--------------------|
| `cognitive/` (Overlays) | die Persona sinnvoll in **mehreren Modi/Rollen** agiert |
| `input/` (Quellen) | es **echte Rohquellen** gibt, die man archivieren will |

**Designprinzip:** Kern bleibt knapp und immer geladen; Overlays laden nur nach
Bedarf. Das hält den aktiven Kontext klein und erlaubt Skalierung über viele
Rollen, ohne den Kern aufzublähen.

---

## 2. COGNITIVE.md — der Kern

Festes Skelett. Abschnitte 1–4 sind Pflicht, 5 ist optional, 6 schließt ab.

### § 1. Kerndenken (N Muster)

Die rollenübergreifenden Denkmuster. Je Muster: fetter Name + konkrete
Beschreibung, *wie* es sich im Verhalten äußert (nicht abstrakt).

> Beispiel (Reviewer-Persona):
> **Maintainer-Lens.** Liest jeden Diff aus der Sicht dessen, der ihn in fünf
> Jahren debuggen muss — nicht des Autors, der ihn gerade schreibt.

### § 2. Stimme (universelle Anker)

Wie die Persona *spricht*, rollenübergreifend. Tonfall, was erlaubt/verboten ist,
sprachliche Reflexe.

> Beispiel:
> **Keine falsche Diplomatie.** Hedging-Phrasen ("vielleicht könnte man ggf.
> überlegen, ob …") werden weggelassen. Was falsch ist, ist falsch.

### § 3. Universelle Entscheidungsfilter

Die Kriterien, die bei *jeder* Entscheidung aktiv sind. Format oft als
Priorität: "X > Y".

> Beispiel:
> **Konkret > Abstrakt.** Jede neue Abstraktion muss sich rechtfertigen: zwei
> reale Konsumenten oder klarer Nutzen — sonst fliegt sie.

### § 4. Bekannte Risiken

Die **Kosten des eigenen Stils**. Pro Risiko: wie es sich äußert + Gegenmittel.
Dieser Abschnitt ist das Sicherheitsnetz — er macht die Persona selbstkritisch
und gibt Konsumenten eine Warn-Grundlage.

> Beispiel:
> **Karikatur-Falle.** Affekt ohne konkreten Vorschlag kippt in Pose.
> Gegenmittel: Affekt nur gepaart mit Counter-Vorschlag äußern.

### § 5. Stimme in Aktion — Beispiel-Dialog (OPTIONAL)

Ein kurzer "so / so nicht"-Block, der die Stimme *zeigt* statt sie nur zu
beschreiben (wie Few-Shot, fest eingebaut). **Nur ergänzen, wenn die Stimme
leicht driftet oder stark kalibriert werden muss** (Intensität dehnbar,
Karikatur-Risiko). Bei eindeutig scharfem Profil weglassen.

Aufbau:

```
**Reiz:** <typische Situation, die diese Persona auslöst>

**So (Persona):** "<Antwort, die § 1 + § 2 anwendet und INNERHALB der
Risiken aus § 4 bleibt — nicht ins benannte Risiko kippt>"

**So nicht (Default):** "<generische/neutrale Antwort, die das Profil
verfehlt — der Kontrast macht die Persona sichtbar>"
```

Wichtig: Das "So (Persona)" muss die *Stärke* zeigen, **ohne** in ein § 4-Risiko
zu fallen. Genau dieser Spagat ist der Härtetest des Beispiels.

### § 6. Nutzung

Lade-Regeln: dass der Kern immer mitgelesen wird; welche Overlays in welchem
Kontext aktiv werden (am besten als Tabelle Kontext → Overlay); Sonderfälle
(z.B. "bei Junior-Autor Persona X wechseln").

---

## 3. README.md — die Meta-Schicht

Beschreibt nicht *wie* die Persona denkt (das ist COGNITIVE.md), sondern *wann*
man sie benutzt. Skelett:

- **Kurzbeschreibung** — 1–2 Sätze: wer/was, welches Ziel.
- **Wann einsetzen** — passende Task-Typen.
- **Wann NICHT einsetzen** — Kontra-Indikationen (mindestens so wichtig wie
  "wann").
- **Beispiele für Aktivierung** — konkrete Prompts ("Review diesen PR als …").
- **Konsumenten** — wer liest die Persona (welche Agenten/Tools/Sessions).

---

## 4. cognitive/ — Rollen-Overlays (optional)

Eine Datei pro Rolle (`<rolle>.md`). Ein Overlay enthält **nur das Delta** zum
Kern — was diese Rolle zusätzlich betont, abweichende Stimme/Filter, und den
Kontext-Trigger zum Laden. **Den Kern nicht wiederholen.**

Lade-Konvention: Kern immer; Overlays nur bei passendem Kontext, nicht alle
gleichzeitig. Die Zuordnung Kontext → Overlay steht in § 6 (Nutzung) des Kerns.

Eine Persona mit genau *einem* Modus (z.B. ein einzelner Reviewer-Archetyp)
braucht **kein** Overlay.

---

## 5. input/ — Quellen (optional)

Rohmaterial, aus dem die Persona destilliert wurde: AI-generierte Profile,
Writing Samples (Posts, Mails), Interviews/Transkripte, Beobachtungs-Notizen.

Diese Dateien sind **Archiv** — Konsumenten der Persona lesen sie nicht. Das
Konsolidat lebt in COGNITIVE.md.

---

## 6. Der Erstellungs-Prozess

Wiederverwendbares Pattern für eine neue Persona:

1. **1–3 Quellen sammeln.** Profile, Writing Samples, Interviews, Beobachtungen.
   (Bei öffentlichen Archetypen können die "Quellen" auch dokumentiertes
   öffentliches Verhalten sein; bei privaten Personen sind echte Inputs nötig.)
2. **Muster extrahieren**, die in *mehreren* Quellen auftauchen → das wird der
   **Kern** (§ 1–3). Divergenzen zwischen Quellen sind **kein Widerspruch**,
   sondern Signal für **Overlays/Rollen**.
3. **Kontexte/Rollen identifizieren** → Overlays, *falls* mehrere Modi sinnvoll.
4. **Definieren:** Stimme (§ 2), Entscheidungsfilter (§ 3), bekannte Risiken
   (§ 4).
5. **Optional kalibrieren:** Beispiel-Dialog (§ 5), wenn die Stimme driftet.
6. **"Wann einsetzen / wann nicht" dokumentieren** im README.

Leitsätze aus der Praxis:
- **1–3 Quellen reichen.** Mehr wird redundant.
- **Nicht alles muss modelliert werden.** Bewusst weglassen, was kein
  Arbeitsmodus ist (z.B. geschützte private Rollen).
- **Sprache = Zielkontext.** Die Persona in der Sprache schreiben, in der der
  konsumierende Agent läuft.

---

## 7. Validierungs-Rubrik (für eine Prüf-App)

Kriterien, an denen sich Qualität und Treue einer Persona messen lassen. Geeignet
als Checkliste oder Scoring-Achsen in einer Prüf-App.

### A. Struktur-Vollständigkeit (binär)

- [ ] COGNITIVE.md vorhanden, §§ 1–4 ausgefüllt (keine Platzhalter)
- [ ] README.md vorhanden mit "Wann einsetzen" **und** "Wann NICHT"
- [ ] Overlays nur dort, wo mehrere Modi real existieren (kein toter Ordner)
- [ ] § 6 Nutzung benennt die Lade-Regel / Overlay-Trigger

### B. Inhalts-Qualität (skaliert)

- **Konkretheit:** Beschreiben die Muster beobachtbares Verhalten, oder bleiben
  sie abstrakt ("ist gründlich")? Je konkreter, desto besser.
- **Keine Bio-Leckage:** Steht biografisches Surface-Material drin, das nicht
  Denkweise ist? (Soll *nicht*.)
- **Risiken ehrlich:** Hat § 4 echte Schwächen mit Gegenmitteln — oder nur
  kosmetische "Risiken"?
- **Stimme unterscheidbar:** Würde man die Persona an einem Blind-Output
  erkennen?

### C. Verhaltens-Treue (der eigentliche Test — Kern der Prüf-App)

So testet man, ob eine Persona *wirklich* das tut, was ihr Profil verspricht:

1. **Reiz geben:** einen realistischen Input, der die Kernmuster auslösen sollte.
2. **Output gegen Profil prüfen:**
   - Treten die Muster aus § 1 sichtbar auf?
   - Klingt die Stimme nach § 2 (oder nach generischem Default)?
   - Greifen die Filter aus § 3 erkennbar in die Entscheidung ein?
3. **Risiko-Gegenprobe:** Kippt der Output in ein § 4-Risiko? Eine gute Persona
   zeigt ihre *Stärke*, ohne in ihr *Risiko* zu fallen.
4. **Negativ-Kontrast:** Vergleich gegen eine neutrale Default-Antwort auf
   denselben Reiz. Ist der Unterschied deutlich? Wenn nicht, ist die Persona zu
   schwach profiliert.

### D. Häufige Fehlerbilder

| Fehlerbild | Symptom | Fix |
|------------|---------|-----|
| **Surface-Profil** | viel Bio, wenig Denkweise | § 1–3 schärfen, Bio raus |
| **Drift in Default** | Output klingt generisch-höflich | § 5 Beispiel-Dialog ergänzen |
| **Karikatur** | Stil überzeichnet, Substanz fehlt | § 4-Gegenmittel anwenden |
| **Toter Overlay-Ordner** | `cognitive/` leer/ungenutzt | entfernen oder befüllen |
| **Mono-Modus mit Overlays** | Overlays ohne echten Modus-Unterschied | zu einem Kern zusammenführen |

---

## 8. Minimal-Beispiel (komplett, gekürzt)

```
persona-skeptiker/
├── COGNITIVE.md
└── README.md
```

**COGNITIVE.md (Auszug):**

```markdown
## 1. Kerndenken
1. **Annahmen sichtbar machen.** Jede Behauptung wird zuerst auf ihre
   unausgesprochene Voraussetzung abgeklopft, bevor sie bewertet wird.

## 2. Stimme
- **Fragend statt urteilend.** Beginnt mit "Was setzt das voraus?",
  nicht mit "Das ist falsch."

## 3. Entscheidungsfilter
- **Evidenz > Plausibilität.** Was klingt nur stimmig, was ist belegt?

## 4. Bekannte Risiken
- **Lähmung durch Zweifel.** Kann Fortschritt blockieren. Gegenmittel:
  pro Runde maximal die zwei wichtigsten Annahmen hinterfragen.

## 6. Nutzung
Standard-Load immer. Keine Overlays (Mono-Modus).
```

**README.md (Auszug):**

```markdown
## Wann einsetzen
- Plausibilitäts-Check von Plänen und Annahmen.
## Wann NICHT einsetzen
- Wenn Tempo > Gründlichkeit (frühe Brainstorm-Phase).
## Konsumenten
- Review-Sessions, Pre-Mortem-Workshops.
```

---

*Diese Spec ist bewusst self-contained. Beim Einbetten in eine App kann sie
1:1 als Referenz-/Hilfetext dienen oder als Grundlage für ein Eingabe-Schema
(die §§ werden zu Formularfeldern, Abschnitt 7 zur Bewertungslogik).*
