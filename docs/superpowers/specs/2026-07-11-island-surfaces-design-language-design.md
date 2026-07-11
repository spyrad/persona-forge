# Insel-Flächen an die Landing-Design-Sprache angleichen — Stufe B+C: Anzeige & Arbeit

**Datum:** 2026-07-11
**Status:** Entwurf zur Review
**Kontext:** Stufe A (PR #4, `9b17272`) hat Fundament & Chrome angeglichen —
`AppLayout`, Serif/Eyebrow/Ruler, Seiten-Copy englisch. Die sechs React-Inseln
tragen noch deutsche Copy und keinen typografischen Rhythmus; der in Stufe A
bewusst eingegangene zweisprachige Übergangszustand endet mit dieser Stufe.
Vorgänger-Spec: `2026-07-10-app-pages-design-language-design.md`.

## Ziel

Nach Abschluss trägt jede Fläche der App die Landing-Handschrift **dosiert nach
Flächentyp** — Anzeige-Flächen editorial (Instrument-Charakter), Arbeitsflächen
ruhig-funktional — und es existiert **keine sichtbare deutsche Copy** mehr
(inkl. `title`-Tooltips, `sr-only`, `aria-label`). Erfolgskriterium wie in
Stufe A: der visuelle Eindruck des Übergangs Landing → App, plus
Einsprachigkeit.

## Zerlegung & Schnitt

Die ursprünglich getrennten Folge-Stufen B und C sind zu **einer Spec und
einem Plan** zusammengezogen (gleiche Doppelaufgabe: Typografie + Sprache),
werden aber in **zwei PRs** gemerged — jeder für den CI-Review-Agenten
überschaubar, jeder einzeln shipbar:

- **PR 1 — „Display" (Anzeige-Flächen, editorial):** `axis-chart.tsx`,
  `RunResult.tsx`, `RunComparison.tsx` (~600 Zeilen Bestand).
- **PR 2 — „Work" (Arbeitsflächen, ruhig):** `ModelConfigManager.tsx`,
  `PersonaCatalog.tsx`, `RunRunner.tsx` (~1900 Zeilen Bestand) +
  `AuthCardHeader`-Extraktion.

## Entscheidungen (mit User validiert)

1. **Design-Tiefe: „Anzeige editorial, Arbeit ruhig".** Anzeige-Flächen
   bekommen die volle Instrument-Behandlung (Mono-Zahlen, Serif-Zwischentitel,
   Eyebrow-Zeilen); Arbeitsflächen bleiben funktional-schlicht — den
   editorialen Rahmen liefert dort bereits `AppLayout`. Keine Serif-Header
   in Formularen.
2. **Ship-Schnitt: eine Spec, zwei PRs** (s. o.).
3. **Datumsformat: `en-GB`** (`10 Jul 2026, 14:32`) einheitlich überall, wo
   die App Zeitstempel zeigt; ersetzt `toLocaleString("de-DE")`.
4. **Kommentare bleiben deutsch.** Nur Nutzersichtbares wird englisch;
   Code-Kommentare/Doku-Blöcke sind durchgängiges Projekt-Idiom und werden
   nicht angefasst (kein Diff-Rauschen).

## Design

### 1. Anzeige-Flächen (PR 1, editorial)

- **`axis-chart.tsx`:** Zahlen (Skalen-Endpunkte, Cutoff-Label, Score-Werte)
  erhalten `font-mono tabular-nums` — die Chart-Beschriftung spricht dieselbe
  Mono-Sprache wie Eyebrows/Ruler der Landing. `title`-Tooltips und `sr-only`
  → EN („Mean 24.0", „Score 24: 3×", „Highest frequency of a single
  value: N"). **Keine strukturellen Änderungen** — Chart-Geometrie und
  Stapel-Normierung bleiben byte-identisch.
- **`RunResult.tsx`:** Sektions-Überschriften (Achsen-Titel, abgeleiteter Typ,
  Standhaftigkeit) → kleine Mono-Eyebrow-Zeile + ruhige Serif-Zwischen-
  überschrift (`font-display`), analog Landing-Sektionen. Kennzahlen
  (Mittelwerte, Counts, Typ-Code) in `tabular-nums`. Copy → EN („Back to
  runs", „Executed:", „Not reliable — too few usable repetitions for a
  distribution.").
- **`RunComparison.tsx`:** gleiche Behandlung; Datum auf `en-GB` (Entsch. 3).
- **Serien-Legende** (Teal/Amber via `--chart-1`/`--chart-2`) bleibt
  unverändert.

### 2. Arbeitsflächen (PR 2, ruhig)

- **Grundsatz:** keine Serif-Header, keine Eyebrows innerhalb der Formulare.
  Nur: konsistenter Karten-Rhythmus (einheitliche `Card`-Abstände,
  Trennlinien via `border-border`), `tabular-nums` auf allen Zahlen
  (Temperatur, N-Wiederholungen, Zähler, Fortschritt „3/25"), EN-Copy.
- **`ModelConfigManager.tsx`:** Formular-Labels, Buttons („Save" / „Cancel" /
  „Delete"), Bestätigungsdialoge, Empty State → EN. Struktur unangetastet.
- **`PersonaCatalog.tsx`:** Listen-/Filter-/Detail-Copy, „Zurücksetzen" →
  „Reset", Empty States → EN.
- **`RunRunner.tsx`:** Formular, Validierungsmeldungen („Bitte … wählen" →
  „Please select …"), Live-Progress („Läuft"/„Läufe") → EN. Einzige Stelle
  mit leichtem Editorial-Anspruch: Fortschritts-Zähler in Mono/`tabular-nums`,
  sonst ruhig. **Copy-only-Edits, Live-Logik byte-identisch** (analog zur
  Frontmatter-Regel aus Stufe A).
- **`AuthCardHeader.astro` (neu, `src/components/`):** extrahiert das 3×
  duplizierte Eyebrow(`account`)+Serif-`h1`-Markup aus
  `auth/{signin,signup,confirm-email}.astro` (Backlog-Aufräumer aus
  WORKFLOW_STATUS, Stufe C zugeordnet). Props: `heading` plus eine
  Varianten-Prop, die beide Bestandsformen abdeckt — zentriert mit `mb-6`
  (signin/signup) und linksbündig mit `mb-3` (confirm-email). Gerendertes
  Markup bleibt je Seite identisch zum Bestand.

### 3. Sprachregeln (beide PRs)

- **EN wird:** alles Nutzersichtbare — JSX-Text, `placeholder`, `title`,
  `aria-label`, `sr-only`, Validierungs-/Fehlertexte, Empty States,
  Datum (`en-GB`).
- **Deutsch bleibt:** Code-Kommentare, Doku-Blöcke, Commit-Messages.
- **Ton:** nüchtern-instrumentig wie Landing und Stufe-A-Leads. Verbindliches
  Vokabular (der Implementierungsplan führt es als Glossar-Tabelle aus und
  erweitert es bei Bedarf konsistent):

  | Deutsch (Bestand)    | Englisch (verbindlich) |
  | -------------------- | ---------------------- |
  | Lauf / Läufe         | run / runs             |
  | Wiederholung         | repetition             |
  | verwertbar           | usable                 |
  | Achse                | axis                   |
  | Standhaftigkeit      | steadfastness          |
  | Abgeleiteter Typ     | Derived type           |
  | Mittelwert           | mean                   |
  | nicht belastbar      | not reliable           |
  | Zurücksetzen         | Reset                  |
  | Läuft …              | Running …              |
  | Ausgeführt:          | Executed:              |
  | Zurück zu den Läufen | Back to runs           |

## Nicht-Ziele

- **Keine Farb-Token-Migration** — bereits erledigt (0 Farb-Literale in allen
  sechs Inseln, Erbe des gemergten `ui-redesign`).
- **Keine Änderungen an Datenschicht oder Logik** — `oejts.ts`-Achsen sind
  bereits englisch; Frontmatter-, Aggregations- und Live-Run-Logik bleiben
  byte-identisch. API-Meldungen sind bereits englisch.
- **Keine Kommentar-Übersetzung**, keine neuen shadcn-Komponenten, keine
  Token-Änderungen in `global.css`.
- **Keine Landing-Änderungen.**

## Fehlerbehandlung

Keine neue Laufzeitlogik: alle Änderungen sind Markup-, Klassen- und
String-Edits plus eine reine Markup-Extraktion (`AuthCardHeader`). Bestehende
Fehlerpfade (Empty States, `loadError`, Validierung) ändern nur ihren
Wortlaut, nicht ihr Verhalten.

## Verifikation (je PR)

1. `npm run test` — 198 Unit-Tests; keine referenziert deutsche UI-Strings
   der Inseln (geprüft), müssen grün bleiben.
2. `npm run build` — Production-Build.
3. CI-äquivalentes Lint: `npx eslint . --rule '{"prettier/prettier":"off"}'`
   (CRLF-Gotcha; nie Teilmengen linten).
4. `npm run test:e2e` — 4 Tests, asserten keine deutschen Insel-Strings,
   müssen grün bleiben.
5. Sichtprüfung im Dev-Server, Light **und** Dark, inkl. Empty States und
   Fehlerpfaden (Dev-SSR-Gotcha: bei Erstrequest-Abbruch main-Baseline
   prüfen, bevor der Diff verdächtigt wird).
6. Restprüfung Einsprachigkeit nach PR 2:
   `grep -rniE "ä|ö|ü|ß" src/components --include="*.tsx"` darf nur noch
   Kommentar-Treffer liefern.
7. PR durch den CI-Review-Agenten (`ai-review/verdict`, Required Check).

## Risiken

- **Übersetzungs-Drift:** dieselben Begriffe in sechs Dateien → verbindliches
  Glossar (s. o.) + Review-Check dagegen.
- **RunRunner-Umfang:** 804 Zeilen mit Live-Logik → strikt Copy-only; jede
  Abweichung davon ist ein Plan-Verstoß.
- **Zwischenzustand nach PR 1:** Anzeige englisch, Arbeitsflächen noch
  deutsch — bewusst kurz gehalten (PR 2 folgt unmittelbar).
