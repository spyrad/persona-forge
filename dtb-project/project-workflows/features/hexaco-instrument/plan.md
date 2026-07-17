# Implementierungsplan: HEXACO-Instrument

**Erstellt:** 2026-07-16
**Feature-Spec:** `features/hexaco-instrument/spec.md`
**Geschaetzte Dauer:** ~4–5 Arbeitsblöcke
**Status:** Reviewed

> **Plan-Review 2026-07-16:** Verdikt REVISE → 7 Entscheidungen mit Damian eingearbeitet
> (Registry schlank, `midpoint`-Skala, Item-Union-Koexistenz, Scoring-Korrektheitstest,
> früher Smoke-Lauf, kein v1-Rate-Limit, LICENSE als Inbox #10).

---

## Phasen-Uebersicht

| Phase   | Beschreibung                                                     | Dauer         | Status  |
| ------- | ---------------------------------------------------------------- | ------------- | ------- |
| Phase 1 | Datenmodell generalisieren + Instrument-Registry (Enabler)       | ~1,5–2 Blöcke | Geplant |
| Phase 2 | HEXACO-Definition (IPIP) + Scoring-Test + Smoke-Lauf + Migration | ~1,5 Blöcke   | Geplant |
| Phase 3 | Eingabe & Ausführung end-to-end                                  | ~0,5 Block    | Geplant |
| Phase 4 | Ergebnis-/Profil-Darstellung + parametrisierte Attribution       | ~1 Block      | Geplant |
| Phase 5 | Verifikation & Abschluss (PR, Verdict-Gate, Prod-Abnahme)        | ~0,5 Block    | Geplant |

---

## Ist-Analyse

> Quelle: `discovery.md` (11 Module, Pfade verifiziert) + gezielte Code-Verifikation (Lektion #1).

| Pfad                                                   | Ist-Befund (relevant fuer den Plan)                                                                                                                                                                                                                   |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/types.ts`                                         | `Instrument`/`InstrumentAxis`/`InstrumentItem` achsen-agnostisch, ABER: `InstrumentAxis.constant/cutoff/high/low` **Pflicht** (modaltyp-zentriert); `InstrumentItem` **bipolar** (`left`/`right`+`sign`). Kein `hasModalType`. → Interface erweitern. |
| `src/lib/instruments/oejts.ts`                         | Muster: `export const OEJTS satisfies Instrument`, 4 Achsen, 32 bipolare Items, `permute: true`.                                                                                                                                                      |
| `src/lib/runs/oejts-score.ts`                          | `scoreAxes`/`axisScale` **generisch** → HEXACO-tauglich; `axisScale` nutzt `axis.cutoff` als Skalen-Referenz. `deriveType` = Modaltyp-Teil (wird optional).                                                                                           |
| `src/lib/runs/oejts-aggregate.ts`                      | `aggregateRun(reps, instrument)` generisch (Verteilung je Achse).                                                                                                                                                                                     |
| `src/lib/services/runs.ts`                             | **3 hartkodierte `OEJTS`-Referenzen**: `aggregateRun(reps, OEJTS)`, `permuteItems(OEJTS.items)`, `buildOejtsMessages(…)`. `kind` + `instrument_id` liegen bereits in der Run-Zeile; Kind-Dispatch existiert.                                          |
| `src/lib/runs/oejts-run.ts`                            | `permuteItems`, `buildOejtsMessages` (rendert „1=left … 5=right"), `parseOejtsResponse`. Prompt-Bau ist Pol-Paar-spezifisch → für Likert parametrisieren. **Konsumenten von `it.left/right/sign`.**                                                   |
| `src/lib/services/model-profiles.ts`                   | `ModelProfileSection` = Union über `kind`; filtert Baseline je `kind`.                                                                                                                                                                                |
| `src/lib/runs/baseline.ts`                             | `isBaselineRun(persona_id, snapshot)` — Baseline NICHT über `persona_id null` (Lektion #1).                                                                                                                                                           |
| `src/pages/api/runs/create-schema.ts`                  | zod-Discriminated-Union (`kind`); `instrumentId` heute fix.                                                                                                                                                                                           |
| `src/components/runs/RunRunner.tsx`                    | Instrument-Selector (kind); sendet `instrumentId: "oejts-1.2"` hartkodiert.                                                                                                                                                                           |
| `src/components/runs/RunResult.tsx`, `axis-chart.tsx`  | Verzweigt `result.steadfastness` vs. OEJTS-Achsen-Charts; Charts skalieren über Achsen-Liste. **Konsumenten der Achsen-/Item-Struktur.**                                                                                                              |
| `src/components/models/OejtsAttribution.tsx`           | Statischer CC-BY-NC-SA-Block; in `ModelProfile`/`ModelComparison`/`dashboard.astro`.                                                                                                                                                                  |
| `src/components/landing/TestLibrary.astro`             | „Big Five/HEXACO" als `planned`-Karte vorhanden.                                                                                                                                                                                                      |
| `supabase/migrations/20260702120000_steadfastness.sql` | `check (kind in ('oejts','steadfastness'))` — zu erweitern.                                                                                                                                                                                           |

**Instrument-Quelle:** **IPIP-HEXACO-Skalen** (Ashton, Lee & Goldberg 2007, public domain, 24 Facetten / 238 Items auf der Key-Seite) mit **eigener deterministischer 60-Item-Auswahl** (10 je Domäne, 30/30 keying-balanciert). **Befund 2026-07-17:** Ein kanonisches „IPIP-HEXACO-60" existiert nicht (nur das ©-HEXACO-60 von Ashton & Lee 2009 — nicht redistributierbar). Auswahlregel + Items + Keying: `context/foundation/instruments/ipip-hexaco-60.json` (liegt vor).

**`InstrumentItem`-Union-Konsumenten (Review P3):** `buildOejtsMessages`/Prompt-Bau (`oejts-run.ts`), `scoreAxes` (`it.sign`), `axisScale`, `RunResult`/`axis-chart` (Pol-Labels). Diese müssen die Likert-Variante mitbehandeln.

---

## Phase 1: Datenmodell generalisieren + Instrument-Registry (Enabler)

### Ziel

Feste OEJTS-Bindung auflösen: das Datenmodell trägt Instrumente mit/ohne Modaltyp und mit Likert-Aussage-Items; die Ausführung löst je Lauf das Instrument über eine schlanke Registry auf. Kein Verhaltensunterschied für bestehende OEJTS-Läufe.

### Schritte

#### Schritt 1.1: Instrument-Interface generalisieren

- **Zweck:** optionaler Modaltyp + Likert-Aussage-Item + `midpoint`-Skalen-Referenz.
- **Dateien:** `src/types.ts`
- **Output:** `Instrument.hasModalType?: boolean`; Modaltyp-Felder (`high`/`low`) am `InstrumentAxis` optional; **`midpoint`** je Achse (Skalenmitte; OEJTS interpretiert seinen `cutoff` als `midpoint`); `InstrumentItem` als **Union** aus bipolarem Pol-Paar (Bestand) **und** Likert-Aussage (Aussagetext + Keying-Vorzeichen). OEJTS bleibt abwärtskompatibel gültig.

#### Schritt 1.2: Instrument-Registry (schlank)

- **Zweck:** zentrale Auflösung `instrument_id → Instrument` statt Import der `OEJTS`-Konstante.
- **Dateien:** NEU `src/lib/instruments/registry.ts` — bewusst minimal (reine Auflösung, keine Plugin-Architektur).
- **Output:** `getInstrument(id)`; unbekanntes `id` → definierter, geloggter Fehler (kein stiller Fallback). OEJTS registriert.

#### Schritt 1.3: `runs.ts` auf Registry + Prompt-Bau parametrisieren

- **Zweck:** die 3 hartkodierten `OEJTS`-Referenzen über die Registry auflösen; Item-Rendering für die Likert-Union fähig machen.
- **Dateien:** `src/lib/services/runs.ts`, `src/lib/runs/oejts-run.ts` (Prompt-Bau + Konsumenten der Item-Union: `buildMessages`, ggf. `parse`).
- **Output:** `aggregateRun`/`permuteItems`/`buildMessages` beziehen das Instrument aus der Registry; Likert-Items rendern als „1=lehne ab … 5=stimme zu". OEJTS-Pfad im Ergebnis unverändert.

> **3x3-Block:** Nach Schritt 1.3 → Zusammenfassung + Feedback einholen

### Deliverables

- [ ] Generalisiertes Instrument-Datenmodell (abwärtskompatibel, `midpoint` + Likert-Union)
- [ ] Schlanke Instrument-Registry mit Fehlerpfad
- [ ] `runs.ts` frei von hartkodierten `OEJTS`-Referenzen

### Checkpoint-Kriterien

#### Automated

- [ ] `npm run test` grün (bestehende OEJTS-Scoring-/Aggregations-Tests unverändert bestanden)
- [ ] `grep -c "OEJTS" src/lib/services/runs.ts` = 0 hartkodierte Nutzungen
- [ ] `npm run lint` + `tsc` grün

#### Manual

- [ ] Registry + Item-Union tragen ein drittes Instrument (SD3 #8) — Kurzreview

---

## Phase 2: HEXACO-Definition (IPIP) + Scoring-Test + Smoke-Lauf + Migration

### Ziel

HEXACO als datengetriebenes Instrument mit gemeinfreien IPIP-Items; Keying-Korrektheit bewiesen, LLM-Antwortverhalten früh gesehen, `kind` persistierbar.

### Schritte

#### Schritt 2.1: IPIP-HEXACO-60 als Instrument-Definition

- **Zweck:** die 60 gemeinfreien Items mit Faktor-Zuordnung + Keying als typisierte Definition.
- **Dateien:** NEU `src/lib/instruments/hexaco.ts`; Quelle: `context/foundation/instruments/ipip-hexaco-60.json` (Referenz liegt vor, 2026-07-17, inkl. Auswahlregel/Keying/`constant`-Herleitung); in Registry (1.2) eintragen.
- **Output:** `export const HEXACO satisfies Instrument` — 6 Faktoren (H/E/X/A/C/O) mit Low/High-Pol-Labels + `midpoint`, 60 Likert-Items mit Keying, `hasModalType: false`, `permute: true`. Public-Domain-Lizenz-Header + Attributions-Metadaten.

#### Schritt 2.2: Scoring-Korrektheits-Test (Keying)

- **Zweck:** absichern, dass Keying/Reverse-Items korrekt sind — verhindert still invertierte Faktor-Scores (Review-Kernrisiko, Pre-Mortem).
- **Dateien:** NEU `src/lib/instruments/hexaco.test.ts` (o. ä., analog `oejts-score.test.ts`).
- **Output:** Tests mit **bekannten Antwortmustern → erwarteten Faktor-Scores**, inkl. mindestens eines Reverse-keyed Items je Faktor; deckt auch `midpoint`-Zuordnung ab.

#### Schritt 2.3: Früher Smoke-Lauf gegen ein echtes Modell

- **Zweck:** LLM-Antwortverhalten bei 60 Likert-Aussagen früh prüfen (Acquiescence-Bias, JSON-Format), bevor der Vollausbau steht.
- **Dateien:** — (programmatischer/Integration-Lauf über die Service-Ebene, noch ohne UI)
- **Output:** ein Mini-Lauf (ein Modell, ~3 Wiederholungen) liefert parsebare 6-Faktor-Ergebnisse; Dropout-/Format-Auffälligkeiten dokumentiert. Bei systematischem Problem → Prompt-Feintuning vor Phase 3.

> **3x3-Block:** Nach Schritt 2.3 → Zusammenfassung + Feedback einholen

#### Schritt 2.4: Attributions-Metadaten je Instrument

- **Zweck:** Herkunft/Lizenz je Instrument statt statisch für OEJTS.
- **Dateien:** `src/types.ts` (Attributions-Felder am `Instrument`), `src/lib/instruments/{oejts,hexaco}.ts`.
- **Output:** je Instrument Autor/Quelle/Lizenz-Label/Link als Daten. OEJTS = CC-BY-NC-SA, HEXACO = „IPIP, public domain".

#### Schritt 2.5: Migration `kind`-Constraint erweitern

- **Zweck:** HEXACO-Läufe persistierbar; Bestand unberührt.
- **Dateien:** NEU `supabase/migrations/YYYYMMDDHHmmss_hexaco.sql`.
- **Output:** Constraint um `'hexaco'` erweitert; Default `kind='oejts'` bleibt; RLS erbt Runs-Policies. Lokal via `supabase db reset --local` verifiziert. **Deploy-Reihenfolge: Migration MUSS vor dem Code-Deploy laufen** (`migration list --linked` → `db push`), sonst scheitern HEXACO-Läufe am alten Constraint.

### Deliverables

- [ ] `HEXACO`-Instrument (60 IPIP-Items, 6 Faktoren, kein Modaltyp)
- [ ] Scoring-Korrektheits-Test (Keying/Reverse-Items)
- [ ] Smoke-Lauf-Befund dokumentiert
- [ ] Attributions-Metadaten je Instrument + Migration `kind='hexaco'`

### Checkpoint-Kriterien

#### Automated

- [ ] `npm run test` grün inkl. Scoring-Korrektheits-Test (bekannte Antworten → erwartete Faktor-Scores, Reverse-Items)
- [ ] `HEXACO.items.length === 60` und je Faktor 10 Items
- [ ] Migration lokal fehlerfrei angewandt (`supabase db reset --local`)

#### Manual

- [ ] Item-Texte + Keying stichprobenartig gegen die IPIP-Quelle geprüft
- [ ] Smoke-Lauf gesichtet: parsebare Antworten, kein systematischer Dropout/Bias

---

## Phase 3: Eingabe & Ausführung end-to-end

### Ziel

HEXACO ist im Lauf-Formular wählbar und ein Lauf erzeugt gegen ein echtes Modell die 6 Faktor-Verteilungen.

### Schritte

#### Schritt 3.1: Eingabe-Validierung erweitern

- **Dateien:** `src/pages/api/runs/create-schema.ts`, `src/types.ts` (`CreateRunInput`-Union).
- **Output:** zod-Union akzeptiert HEXACO-`kind`/`instrumentId`; OEJTS-Default unverändert.

#### Schritt 3.2: Lauf-Formular

- **Dateien:** `src/components/runs/RunRunner.tsx`.
- **Output:** Selector-Option „HEXACO"; `instrumentId` variabel statt hartkodiert.

#### Schritt 3.3: End-to-end-Lauf über die UI

- **Dateien:** — (manuelle/Integration-Durchführung)
- **Output:** ein über das Formular gestarteter HEXACO-Lauf mit N Wiederholungen liefert 6 Faktor-Verteilungen, kein Typ-Code.

> **3x3-Block:** Nach Schritt 3.3 → Zusammenfassung + Feedback einholen

### Deliverables

- [ ] HEXACO im Lauf-Formular wählbar und durchführbar
- [ ] Nachgewiesener End-to-end-Lauf über die UI

### Checkpoint-Kriterien

#### Automated

- [ ] `npm run test` (Schema-Tests: HEXACO-Eingabe akzeptiert, invalide abgelehnt)
- [ ] Integration-/E2E-Test: HEXACO-Lauf erzeugt Repetitionen mit 6 Achsen-Werten

#### Manual

- [ ] Sichtprüfung Lauf-Formular (Selector, keine OEJTS-Regression)

---

## Phase 4: Ergebnis-/Profil-Darstellung + parametrisierte Attribution

### Ziel

HEXACO-Ergebnisse erscheinen korrekt in Lauf-Ansicht, Modell-Profil, Vergleich und Dashboard; Attribution je Instrument; Landing-Karte live.

### Schritte

#### Schritt 4.1: Lauf-Ergebnis ohne Typ-Code

- **Dateien:** `src/components/runs/RunResult.tsx` (+ `axis-chart.tsx` für 6 Achsen).
- **Output:** HEXACO-Ergebnis rendert 6 Faktoren mit `midpoint`-Referenzlinie, kein Typ-Kürzel, kein leerer Typ-Block.

#### Schritt 4.2: Modell-Profil / Vergleich / Dashboard

- **Dateien:** `src/lib/services/model-profiles.ts`, `src/components/models/ModelProfile.tsx`, `ModelComparison.tsx`, `src/pages/dashboard.astro`.
- **Output:** neue HEXACO-Sektion (analog Steadfastness); Baseline über `isBaselineRun`; OEJTS-Sektion unverschoben.

#### Schritt 4.3: Attribution parametrisieren + Landing live

- **Dateien:** `src/components/models/OejtsAttribution.tsx` → `InstrumentAttribution`; Aufrufer; `src/components/landing/TestLibrary.astro`.
- **Output:** Attribution zeigt je Instrument das korrekte Lizenz-Label (HEXACO = public domain, OEJTS = CC-BY-NC-SA); Landing führt HEXACO als live.

> **3x3-Block:** Nach Schritt 4.3 → Zusammenfassung + Feedback einholen

### Deliverables

- [ ] HEXACO-Ergebnis-, Profil-, Vergleich- und Dashboard-Darstellung
- [ ] Parametrisierte Attribution (OEJTS + HEXACO korrekt)
- [ ] Landing-Karte HEXACO live

### Checkpoint-Kriterien

#### Automated

- [ ] `npm run test` grün (Profil-Sektionierung inkl. HEXACO; Attribution-Metadaten je Instrument)
- [ ] `grep -rl "OejtsAttribution" src` zeigt keine verbliebenen statischen Direkt-Einbindungen

#### Manual

- [ ] Sichtprüfung Light/Dark: HEXACO-Sektion + Attribution in Profil, Vergleich, Dashboard; kein Typ-Block

---

## Phase 5: Verifikation & Abschluss

### Ziel

Vollständige Absicherung, PR über das Verdict-Gate, Prod-Abnahme.

### Schritte

#### Schritt 5.1: Fehlerpfad + volle Suite

- **Dateien:** Tests zum Registry-Fehlerpfad (unbekanntes `instrument_id`, geloggt, kein stiller Fallback).
- **Output:** Test belegt sichtbaren/geloggten Fehler; volle Unit- + Integration-Suite grün.

#### Schritt 5.2: E2E-Kette HEXACO

- **Dateien:** `tests/e2e/…` (via `/10x-e2e`, risk-getrieben).
- **Output:** geseedeter HEXACO-Baseline-Lauf erscheint profiliert; Deliberate-break verifiziert.

#### Schritt 5.3: PR + Verdict-Gate + Prod-Abnahme

- **Dateien:** —
- **Output:** **Migration vor Code-Deploy** (`migration list --linked` → `db push`); PR grün (`ci` + `integration` + Verdict), Squash-Merge, Deploy, Prod-Abnahme durch Damian.

> **3x3-Block:** Nach Schritt 5.3 → Abschluss

### Deliverables

- [ ] Fehlerpfad-Test + volle Suite grün
- [ ] E2E-Kette HEXACO
- [ ] Gemergter PR, Prod-abgenommen

### Checkpoint-Kriterien

#### Automated

- [ ] `npm run test` + `npm run test:integration` + `npm run test:e2e` grün
- [ ] `npm run build` grün
- [ ] PR-Checks `ci` + `integration` + `ai-review/verdict` grün

#### Manual

- [ ] Prod-Sichtprüfung durch Damian (HEXACO-Lauf, Profil, Attribution, Light/Dark)

---

## Betriebsrisiken (v1 bewusst akzeptiert)

- **Kosten-Amplifikation (Review P6):** 60 Items × bis 25 Wiederholungen × teures Modell. **Kein Rate-Limit in v1** — Zugang ist geschlossen/klein, Kosten werden über den eigenen API-Key bewusst getragen. Als Risiko notiert; ein echtes Rate-/Kosten-Limit wäre ein eigenes Feature.
- **Deploy-Reihenfolge:** Push auf `main` deployt Code automatisch, Migration läuft separat → Migration **zuerst** (2.5 / 5.3), sonst scheitern HEXACO-Läufe am alten `kind`-Constraint.
- **LICENSE-Datei (Review P7):** vorbestehendes OEJTS-ShareAlike-Thema, von HEXACO nicht verschärft → **Inbox #10** (nicht v1). Per-Instrument-Attribution ist in v1 gedeckt (4.3).

---

## Technische Entscheidungen

| Thema               | Optionen                                                          | Entscheidung                | Begruendung                                                                                                                                                                                |
| ------------------- | ----------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Instrument-Quelle   | IPIP-HEXACO-Auswahl (PD) / volle 238 / Mini-IPIP6 / © HEXACO-60   | **Kuratierte 60er-Auswahl** | Kanonisches „IPIP-HEXACO-60" existiert nicht (Befund 2026-07-17); deterministische Auswahl aus den offiziellen IPIP-HEXACO-Skalen, public domain (Spec/3d); Regel in `ipip-hexaco-60.json` |
| Instrument-Bindung  | schlanke Registry / minimaler `kind`-Zweig                        | **Registry (P1)**           | Enabler-Success-Kriterium; #8/#9 stehen an; bewusst minimal (kein Plugin-System)                                                                                                           |
| Likert-Item         | Union (bipolar \| Likert), Koexistenz / OEJTS mitmigrieren        | **Koexistenz (P3)**         | Bipolare OEJTS-Pol-Paare nicht verlustfrei in Likert wandelbar → Migration wäre fachlich falsch                                                                                            |
| Skalen-Referenz     | `midpoint` (OEJTS liest ihn als `cutoff`) / eigenes Faktor-Modell | **`midpoint` (P2)**         | Hält `axisScale`/Charts unverändert; minimal-invasiv                                                                                                                                       |
| Modaltyp            | `hasModalType`-Flag, HEXACO ohne / immer ableiten                 | **Flag, HEXACO ohne**       | Fachlich korrekt (Spec/3b); nimmt #8 mit                                                                                                                                                   |
| `kind`-Persistenz   | `kind='hexaco'` / nur `instrument_id`                             | **`kind='hexaco'`**         | Konsistent mit bestehendem Dispatch-Muster                                                                                                                                                 |
| Prompt-Bau          | parametrisieren / eigener HEXACO-Pfad                             | **parametrisieren**         | Ein Ausführungspfad, weniger Duplikat                                                                                                                                                      |
| Rate-Limit Lauf-API | kein v1-Cap / Cap jetzt                                           | **kein v1-Cap (P6)**        | Geschlossener Zugang; als Betriebsrisiko notiert                                                                                                                                           |
| LICENSE-Datei       | jetzt / Folge-Ticket                                              | **Folge-Ticket #10 (P7)**   | Vorbestehendes OEJTS-Thema, von HEXACO nicht verschärft                                                                                                                                    |

---

## Progress

> Single Source of Truth fuer den Umsetzungsstand (Regeln: `project-rules/DERIVED_STATE_RULES.md`).
> Abhaken gemaess Flip-Bedingung §2 (Automated-Kriterien der Phase gruen); SHA-Nachtrag beim
> Phasen-Ende-Commit — geflippte Zeile ohne SHA ist mid-phase gueltig (§2 Regel 4).

- [x] 1.1 Instrument-Interface generalisieren (Modaltyp optional, midpoint, Likert-Union) — `5cdac4b`
- [x] 1.2 Instrument-Registry (schlank) — `5cdac4b`
- [x] 1.3 runs.ts auf Registry + Prompt-Bau parametrisieren — `5cdac4b`
- [x] 2.1 IPIP-HEXACO-60 Instrument-Definition — `0d80ae9`
- [x] 2.2 Scoring-Korrektheits-Test (Keying) — `0d80ae9`
- [x] 2.3 Früher Smoke-Lauf gegen echtes Modell — `0d80ae9`
- [x] 2.4 Attributions-Metadaten je Instrument — `0d80ae9`
- [x] 2.5 Migration kind-Constraint erweitern — `0d80ae9`
- [x] 3.1 Eingabe-Validierung erweitern
- [x] 3.2 Lauf-Formular
- [x] 3.3 End-to-end-Lauf über die UI
- [ ] 4.1 Lauf-Ergebnis ohne Typ-Code
- [ ] 4.2 Modell-Profil / Vergleich / Dashboard
- [ ] 4.3 Attribution parametrisieren + Landing live
- [ ] 5.1 Fehlerpfad + volle Suite
- [ ] 5.2 E2E-Kette HEXACO
- [ ] 5.3 PR + Verdict-Gate + Prod-Abnahme

---

## Umsetzung

Umsetzung mit `/dtb:implement hexaco-instrument` — 3x3-Rhythmus und Phasen-Ende-Ritual
(Verifikations-Gate, SHA-Nachtrag) sind dort beschrieben (die eine Quelle).
Wiedereinstieg bei Kontextverlust: `features/hexaco-instrument/plan.md` laden; der erste nicht
abgehakte Schritt in `## Progress` ist der naechste.
Erkenntnisse/Abweichungen gehoeren in den Session-Log (`/dtb:workflow-checkpoint`).

---

**Erstellt mit:** `/dtb:impl-plan` · **Reviewed mit:** `/dtb:plan-review` (2026-07-16, REVISE → eingearbeitet)
