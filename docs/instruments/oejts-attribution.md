# OEJTS — Herkunft & Lizenz (Attribution)

Diese Datei dokumentiert die Provenienz und die Lizenzpflichten des in
persona-forge verwendeten Instruments **OEJTS 1.2**. Sie ist die verbindliche
Attributions-Quelle für das Repository.

> **Wichtig:** OEJTS ist **nicht gemeinfrei / nicht public domain.** Es steht
> unter **CC BY-NC-SA 4.0**. Frühere Projektdokumente (PRD, CLAUDE.md,
> WORKFLOW_STATUS) bezeichneten es fälschlich als „gemeinfrei"; das wurde am
> 2026-07-03 korrigiert. Zu Unterscheiden: **IPIP/Mini-IPIP** (späterer Cycle)
> ist tatsächlich gemeinfrei — die Korrektur betrifft nur OEJTS.

## Instrument

| Feld            | Wert                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------- |
| **Name**        | Open Extended Jungian Type Scales 1.2 (OEJTS)                                             |
| **Autor**       | Eric Jorgenson                                                                            |
| **Herausgeber** | Open Psychometrics Project (openpsychometrics.org)                                        |
| **Quelle**      | https://openpsychometrics.org/tests/OJTS/development/OEJTS1.2.pdf                         |
| **Test-Seite**  | https://openpsychometrics.org/tests/OJTS/                                                 |
| **Lizenz**      | Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) |
| **Lizenztext**  | https://creativecommons.org/licenses/by-nc-sa/4.0/                                        |

**Lizenzaussage der Quelle (wörtlich):**

> „The items of the OEJTS and all other content on this page is licensed under a
> Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
> License."

## Was im Repository redistribuiert wird

Der vollständige Itemsatz (32 Items), die Achsen-Zuordnung (E/I, S/N, T/F, J/P),
Polung/Reverse-Signs und der Scoring-Schlüssel liegen an zwei Stellen:

- `context/foundation/instruments/oejts-1.2.json` — menschenlesbare Source of Truth
  (inkl. `license`- und `license_note`-Feld)
- `src/lib/instruments/oejts.ts` — typisierte Laufzeit-Kopie für die App
  (Lizenzhinweis im Datei-Header)

Die App zeigt die Items ggf. permutiert/umgestellt an — das gilt als abgeleitetes
Werk und fällt unter dieselbe Lizenz (siehe ShareAlike unten).

## Lizenzpflichten für dieses Repository

Da persona-forge ein **öffentliches** Repository ist und die OEJTS-Items
weiterverteilt, gelten alle drei Pflichten von CC BY-NC-SA 4.0:

- **BY (Attribution):** Autor (Eric Jorgenson), Quelle (openpsychometrics.org),
  Lizenz und Lizenz-Link müssen genannt werden — erfüllt durch diese Datei plus
  die Hinweise in den beiden Instrument-Dateien.
- **NC (NonCommercial):** Das Projekt darf **nicht kommerziell** genutzt werden,
  solange die OEJTS-Items enthalten sind. Eine spätere Monetarisierung ist damit
  ausgeschlossen bzw. erfordert vorher deren Entfernung/Lizenzklärung.
- **SA (ShareAlike):** Der aus OEJTS abgeleitete Item-Satz muss ebenfalls unter
  CC BY-NC-SA 4.0 (oder kompatibel) stehen. **Konsequenz:** Würde das Repo je eine
  permissive Gesamt-Lizenz (z. B. MIT/Apache) erhalten, kollidiert das mit der
  SA-Pflicht auf dem OEJTS-abgeleiteten Teil. Aktuell hat das Repo **keine**
  LICENSE-Datei; eine solche muss diese SA-Pflicht berücksichtigen.

## Abgrenzung

- Der **offizielle MBTI** (Myers-Briggs) ist ein geschütztes, kostenpflichtiges
  Instrument und bleibt dauerhaft ausgeschlossen. OEJTS ist ein eigenständiges,
  offen lizenziertes Instrument mit MBTI-**artiger** 4-Buchstaben-Typenausgabe —
  nicht der MBTI selbst.
- Scoring-Formeln und Cutoffs stammen aus derselben openpsychometrics-Quelle
  (siehe `oejts-1.2.json` → `scoring_formulas`).
