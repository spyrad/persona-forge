# Implementierungsplan: Model Compare

**Erstellt:** 2026-07-11
**Feature-Spec:** `features/model-compare/spec.md`
**Geschaetzte Dauer:** 4–5 Sessions (+ Baseline-Lauf-Zeit in 1.4)
**Status:** Reviewed <!-- plan-review 2026-07-11: REVISE → Befunde eingearbeitet, 6 Entscheidungen von Damian -->
**Entscheidungspunkt:** Nach Phase 3 wird mit echten Baseline-Daten bewertet, ob Phase 4 (Compare) wie geplant gebaut wird — kein Durchmarsch.

---

## Phasen-Uebersicht

| Phase   | Beschreibung                                                  | Dauer                    | Status  |
| ------- | ------------------------------------------------------------- | ------------------------ | ------- |
| Phase 1 | Baseline-Läufe ermöglichen + Baseline-Daten fahren            | ~1 Session (+ Lauf-Zeit) | Geplant |
| Phase 2 | Modell-Aggregation: Typen + Service + Unit-/Integration-Tests | ~1 Session               | Geplant |
| Phase 3 | Profil-Seite + Einstieg + Fallbacks → ENTSCHEIDUNGSPUNKT      | ~1 Session               | Geplant |
| Phase 4 | Compare-Seite (2–4 Modelle; erst nach Entscheidungspunkt)     | ~1 Session               | Geplant |
| Phase 5 | Querverlinkung, E2E, Sichtprüfung                             | ~0.5 Session             | Geplant |

---

## Phase 1: Baseline-Läufe ohne Persona

### Ziel

Ein Lauf kann bewusst ohne Persona gestartet werden (leerer System-Prompt-Snapshot).
Erst diese Baseline-Läufe liefern die Daten fürs Modell-Profil. DB ist bereit
(`runs.persona_id` nullable, `persona_prompt_snapshot` kann `""` sein) — keine Migration.

### Schritte

#### Schritt 1.1: Typen + Validierung

- **Zweck:** `personaId` beim Lauf-Start optional machen, Baseline von „Persona gelöscht" unterscheidbar halten.
- **Dateien:** `src/types.ts` (`CreateOejtsRunInput`/`CreateSteadfastnessRunInput`: `personaId: string | null`), `src/pages/api/runs/create-schema.ts` (zod: exakt `string | null` — NICHT optional/undefined), `src/lib/runs/run-schemas.ts` (falls Input-Schema dort liegt). Zusätzlich zentraler Helper `isBaselineRun` (personaId null UND Snapshot `""`) als **einzige** Quelle der Baseline-Erkennung — Profil-Filter und spätere Anzeige nutzen denselben.
- **Input:** Bestehende Create-Pfade.
- **Output:** Lauf-Start akzeptiert `personaId: null`; Typecheck grün.

#### Schritt 1.2: Lauf-Erstellung + Prompt-Pfad

- **Zweck:** Bei `personaId: null` entfällt die Persona-Auflösung; Snapshot = `""`, LLM-Call ohne System-Prompt.
- **ERSTER Handgriff — Provider-Spike:** Verhalten der Provider bei leerer/fehlender System-Message prüfen (insb. z.ai — Memory `persona-forge-zai-provider`): leere System-Message weglassen statt `""` senden, falls APIs sie ablehnen. Erst dann den Rest bauen.
- **Dateien:** `src/lib/services/runs.ts` (`createRun`), `src/lib/runs/oejts-run.ts`, `src/lib/runs/steadfastness-run.ts` (Snapshot-Verwendung prüfen), ggf. `src/lib/llm/openai-compatible.ts`.
- **Input:** 1.1.
- **Output:** Baseline-Lauf durchläuft `pending → running → completed` wie ein normaler Lauf.

#### Schritt 1.3: RunRunner-UI + Unit-Tests

- **Zweck:** Auswahl „No persona (baseline)" im Lauf-Start. (Anzeige-Fallbacks in Listen/Detail sind bewusst NICHT hier — verschoben nach 3.4, Review-Entscheidung: Phase 1 in einer Session halten. Übergangsweise zeigen Baseline-Läufe dort „(deleted)" — kosmetisch.)
- **Dateien:** `src/components/runs/RunRunner.tsx`, Tests neben den geänderten Modulen (`*.test.ts`).
- **Input:** 1.1, 1.2.
- **Output:** Baseline-Lauf per UI startbar; Tests für Create-Pfad + `isBaselineRun` grün.

> **3x3-Block:** Nach Schritt 1.3 → Zusammenfassung + Feedback einholen

#### Schritt 1.4: Baseline-Daten fahren

- **Zweck:** Ohne Baseline-Läufe ist das Profil nach Go-Live leer (Pre-Mortem-Hauptrisiko). Liefert echte Daten für Sichtprüfung (Phase 3) und E2E-Seeds (Phase 5).
- **Dateien:** keine (Nutzung der App); ggf. `tests/e2e/seed.spec.ts`-Erweiterung vorbereiten.
- **Input:** Phase 1 deployt.
- **Output:** Je bestehendem Modell mind. 1 Baseline-Lauf mit ≥ 5 Reps, Status `completed`.

### Deliverables

- [ ] Baseline-Lauf per UI startbar, kompletter Lebenszyklus grün
- [ ] Baseline-Daten für alle bestehenden Modelle vorhanden (≥ 5 Reps je Modell)

### Checkpoint-Kriterien

- [ ] `npm run test` + `npm run lint` grün; ein manueller Baseline-Lauf lokal verifiziert
- [ ] Provider-Spike dokumentiert (leerer System-Prompt: weglassen vs. `""`)

---

## Phase 2: Modell-Aggregation (Typen + Service)

### Ziel

Service-Funktion liefert je `modelName` das aggregierte Profil: gepoolte verwertbare
Wiederholungen aller ready Baseline-Läufe, je Instrument aggregiert. Kapselung so,
dass eine spätere DB-seitige Optimierung die Aufrufer nicht ändert (Spec-Risiko).

### Schritte

#### Schritt 2.1: View-Typen

- **Zweck:** Datenvertrag der neuen Sicht festlegen.
- **Dateien:** `src/types.ts` — z.B. `ModelProfileView` (modelName, Meta: runCount/usableReps/Zeitraum/Configs/Provider-Streuung/excludedPersonaRuns, Sektionen je Instrument mit `RunAggregate` bzw. `SteadfastnessAggregate`), `ModelProfileListItem` (für Auswahl-Liste), `ModelCompareView` (2–4 Profile).
- **Input:** Spec + bestehende `RunAggregate`-Typen.
- **Output:** Typen kompilieren; instrument-agnostische Sektion-Struktur (diskriminiert über `kind`).

#### Schritt 2.2: Service `model-profiles`

- **Zweck:** Gruppierung + Aggregation implementieren.
- **Dateien:** NEU `src/lib/services/model-profiles.ts`; Wiederverwendung `aggregateRun` (`oejts-aggregate.ts`) und Steadfastness-Aggregation über **gepoolte** Reps mehrerer Läufe; Baseline-Filter über den `isBaselineRun`-Helper aus 1.1 (einzige Quelle).
- **Input:** ready Baseline-Läufe (`status completed`, via `isBaselineRun`), deren Reps, `model_configs` (RLS-gescoped) für `modelName`-Auflösung.
- **Output:** `listModelProfiles(sb, userId)` (Modelle mit Daten) + `getModelProfiles(sb, userId, modelNames[])`. Regeln: Läufe ohne auflösbaren `modelName` ausgeschlossen; ALLE Nicht-Baseline-Läufe (inkl. gelöschte-Persona-Läufe = Snapshot gefüllt) zählen als „persona runs excluded" (eine Zahl, Review-Entscheidung); Provider-Streuung aus `baseUrl`-Varianten. **Reps batch-laden:** eine Query mit `in`-Klausel über alle Run-IDs — KEINE Per-Lauf-Ladeschleife (N+1, Review-Befund).

#### Schritt 2.3: Unit- + Integration-Tests Aggregation

- **Zweck:** Kernregeln absichern, bevor UI entsteht — inkl. der echten Query gegen RLS.
- **Dateien:** `src/lib/services/model-profiles.test.ts` (Aggregations-Logik mit gemocktem Query-Ergebnis) — Fälle: Pooling über mehrere Läufe, Persona-Ausschluss + Zählung (inkl. gelöschte Persona), gelöschte Config, Provider-Zusammenfassung, Dünn-Daten-Grenze (<5), Instrument ohne Daten, 0 Modelle. PLUS `src/lib/services/model-profiles.itest.ts` gegen lokales Supabase (Review-Entscheidung): Batch-Query, RLS-Scoping (fremder User sieht nichts), Baseline-Filter auf echten Zeilen.
- **Input:** 2.1, 2.2.
- **Output:** `npm run test` + `npm run test:integration` grün.

> **3x3-Block:** Nach Schritt 2.3 → Zusammenfassung + Feedback einholen

### Deliverables

- [ ] `model-profiles`-Service mit Tests, instrument-agnostisch

### Checkpoint-Kriterien

- [ ] Alle Randfall-Regeln aus der Spec durch je einen Test belegt

---

## Phase 3: Modell-Profil-Seite + Einstieg

### Ziel

Je Modell eine Profil-Seite (Verteilung je Achse + Meta-Infos, editorial Design-Sprache);
Einstieg über die Modell-Liste.

### Schritte

#### Schritt 3.1: Profil-Route

- **Zweck:** Seite, die ein Modell-Profil server-seitig lädt und rendert.
- **Dateien:** NEU `src/pages/models/profile.astro` (Query-Param `?m={modelName}` — vermeidet Pfad-Probleme mit `/` in Modellnamen; Muster analog `runs/compare.astro` inkl. PageState-Verzweigung: missing/notFound/loadError/ready). Param-Validierung VOR dem Laden (leer/überlang → erklärender Zustand, kein 500).
- **Input:** Service aus Phase 2.
- **Output:** `/models/profile?m=…` rendert Profil oder erklärenden Zustand; `PROTECTED_ROUTES` deckt `/models` ab (verifiziert: `middleware.ts:4`).

#### Schritt 3.2: Profil-Darstellung

- **Zweck:** Aggregat sichtbar machen — Wiederverwendung statt Neubau.
- **Dateien:** NEU `src/components/models/ModelProfile.tsx` (statisch gerendert, keine Hydration — Muster `RunComparison`): Meta-Panel (Läufe/Reps, Zeitraum, Configs, Provider-Streuung, „N persona runs excluded"), je Instrument eine Sektion mit `axis-chart`-Wiederverwendung, Dünn-Daten-Hinweis (<5 Reps), Empty-State je Instrument, **OEJTS-Attribution** (Abnahme-Kriterium!).
- **Input:** 3.1.
- **Output:** Profil in Light+Dark konsistent, nur semantische Tokens.

#### Schritt 3.3: Einstieg Modell-Liste

- **Zweck:** Distinct-Modelle sichtbar machen und verlinken.
- **Dateien:** `src/pages/models.astro` + `src/components/models/ModelConfigManager.tsx` — je distinct `modelName` ein „View profile"-Link (nur wenn Profil-Daten existieren, sonst Hinweis „no baseline runs yet").
- **Input:** `listModelProfiles`.
- **Output:** Navigierbarer Einstieg von `/models`.

> **3x3-Block:** Nach Schritt 3.3 → Zusammenfassung + Feedback einholen

#### Schritt 3.4: Anzeige-Fallbacks „baseline"

- **Zweck:** Baseline-Läufe in Listen/Detail korrekt beschriften (aus 1.3 hierher verschoben, Review-Entscheidung) — „baseline" statt „(deleted)"; Unterscheidung über den `isBaselineRun`-Helper.
- **Dateien:** Anzeige-Stellen mit `(deleted)`-Fallback: `runs.astro`, `runs/[id].astro`, `runs/compare.astro` (+ zugehörige Komponenten), Test der Fallback-Logik.
- **Input:** 1.1 (Helper), Phase-3-Seiten.
- **Output:** Baseline-Läufe überall als „baseline" beschriftet.

### Deliverables

- [ ] Profil-Seite live erreichbar über Modell-Liste
- [ ] Anzeige unterscheidet „baseline" von „(deleted)"

### Checkpoint-Kriterien

- [ ] Sichtprüfung mit ECHTEN Baseline-Daten (aus 1.4) in Light+Dark; alle Leer-/Fehlzustände erklärend
- [ ] **ENTSCHEIDUNGSPUNKT (Review):** Mit echten Daten bewerten, ob Phase 4 (Compare) wie geplant gebaut wird — Damian entscheidet, kein Durchmarsch

---

## Phase 4: Compare-Seite (2–4 Modelle)

### Schritte

#### Schritt 4.1: Auswahl-UI

- **Zweck:** 2–4 Modelle für den Vergleich wählen.
- **Dateien:** Modell-Liste/Profil-Einstieg aus 3.3 erweitern (Checkbox-Muster analog Run-Liste); Compare-Button baut `?m=a&m=b…`.
- **Output:** Auswahl mit Min-2/Max-4-Führung (Button disabled + Hinweis).

#### Schritt 4.2: Compare-Route + Rendering

- **Zweck:** N Profile nebeneinander.
- **Dateien:** NEU `src/pages/models/compare.astro` (Multi-Param `?m=`: serverseitig **deduplizieren + hart auf 4 kappen, BEVOR geladen wird** — Workers-CPU-Härtung, Review-Entscheidung; PageState-Muster wie `runs/compare.astro`: missing/tooMany/notFound/ready), NEU `src/components/models/ModelComparison.tsx` — Spalten-Layout aus `RunComparison` verallgemeinert auf 2–4 (responsive: horizontales Scrollen statt Umbruch bei 4 Spalten prüfen).
- **Output:** Vergleich 2–4 Modelle inkl. Meta-Infos je Spalte, Attribution, Empty-States je Instrument. Kein Läufe-Limit in der Aggregation (bewusst akzeptiert bei aktuellen Datenmengen; nachrüsten, wenn Profile träge werden).

#### Schritt 4.3: Randfälle + Tests

- **Zweck:** Spec-Randfälle absichern.
- **Dateien:** Tests zu Param-Parsing/Dedupe/Grenzen (2–4) neben der Route-Logik (auslagern in reine Funktion, z.B. `src/lib/models/compare-params.ts` + Test); Hinweis „nur 1 Modell mit Daten" auf der Einstiegsfläche.
- **Output:** `npm run test` grün; erklärende Zustände für alle Randfälle.

> **3x3-Block:** Nach Schritt 4.3 → Zusammenfassung + Feedback einholen

### Deliverables

- [ ] Compare 2–4 Modelle live

### Checkpoint-Kriterien

- [ ] Spec-Success-Criteria zu Vergleich + Randfällen erfüllt

---

## Phase 5: Verlinkung, E2E, Abschluss

### Schritte

#### Schritt 5.1: Querverlinkung Run-Liste

- **Zweck:** Von Läufen zum Modell-Profil springen.
- **Dateien:** `src/pages/runs.astro` bzw. Lauf-Detail — Link „view model profile" je Lauf mit auflösbarem Modell.
- **Output:** Querverlinkung, sonst keine Änderung an der Run-Liste.

#### Schritt 5.2: E2E-Risiko-Abdeckung

- **Zweck:** Happy Path browser-seitig absichern (`/10x-e2e`-Workflow): Baseline-Lauf starten → Profil öffnen → 2 Modelle vergleichen.
- **Dateien:** `tests/e2e/…` inkl. `seed.spec.ts`-Erweiterung um Baseline-Läufe (Seed via Service-Key wie bei der Design-Sichtprüfung; Hydration-Waits beachten — Memory `persona-forge-dev-ssr-noise`).
- **Output:** `npm run test:e2e` grün.

#### Schritt 5.3: Abschluss

- **Zweck:** Prod-Sichtprüfung + Artefakt-Pflege.
- **Dateien:** Deploy via `main`-Push; danach Sichtprüfung (Umlaut-Grep reicht nicht — Gotcha); `WORKFLOW_STATUS`/Changelog via `/dtb:workflow-checkpoint`.
- **Output:** Feature live, Status-Artefakte aktuell.

> **3x3-Block:** Nach Schritt 5.3 → Feature-Abschluss

### Deliverables

- [ ] E2E grün, Prod verifiziert

### Checkpoint-Kriterien

- [ ] Alle Success-Criteria der Spec abgehakt

---

## Technische Entscheidungen

| Thema                             | Optionen                                  | Entscheidung                                      | Begruendung                                                                                                                                                    |
| --------------------------------- | ----------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline-Läufe                    | Neuer Lauf-Typ vs. `personaId` optional   | `personaId` optional (null)                       | DB bereits nullable, kein neuer `kind`; Baseline = `personaId null` + Snapshot `""` (unterscheidet von „Persona gelöscht": null + Snapshot gefüllt)            |
| Aggregations-Ort                  | App-Code vs. SQL-View/RPC                 | App-Code (v1)                                     | Spec-Vorgabe; Wiederverwendung getesteter TS-Aggregation; Service-Interface hält Umstieg billig                                                                |
| URL-Schema Profil/Compare         | Pfad-Param vs. Query-Param                | Query-Param (`?m=`)                               | Modellnamen enthalten `/` und `:` (z.B. `openai/gpt-5.5`) — Pfad-Params bräuchten Catch-all + Encoding-Sorgfalt; Query-Muster existiert schon (`runs/compare`) |
| Service-Ort                       | in `runs.ts` vs. neue Datei               | NEU `services/model-profiles.ts`                  | `runs.ts` ist bereits ~950 Zeilen; eigenes Modul hält die Kapselung (Spec-Risiko Performance) sichtbar                                                         |
| Compare-Spaltenzahl               | exakt 2 vs. 2–4                           | 2–4                                               | Spec; Layout-Risiko bei 4 Spalten in 4.2 explizit prüfen (horizontales Scrollen)                                                                               |
| Modellnamen-Normalisierung        | Normalisieren vs. exakter Match           | Exakter Match (v1)                                | Spec-Offener-Punkt; erst mit echten Daten entscheiden                                                                                                          |
| Steadfastness-Baseline            | Baseline nur OEJTS vs. beide Test-Typen   | Beide                                             | Gleicher Create-Pfad; Profil ist instrument-agnostisch — Ausnahme wäre Sonderfall-Code                                                                         |
| Pooling-Gewichtung                | je Rep gleich vs. je Lauf gleich          | Je Rep gleich (Pooling)                           | Einfach + konsistent mit „alle verwertbaren Reps"; Folge bewusst akzeptiert: ein 20-Rep-Lauf wiegt mehr als vier 5-Rep-Läufe (Review-Befund Architekt)         |
| Orphaned-Läufe (Persona gelöscht) | separat ausweisen vs. zu persona-excluded | Zu „persona runs excluded"                        | Fachlich Persona-Läufe (Snapshot gefüllt); eine Zahl, einfache Logik (Review-Entscheidung)                                                                     |
| CPU-Härtung                       | nur `?m=`-Kappung vs. + Läufe-Limit       | Nur `?m=`-Kappung (dedupe + max 4, vor dem Laden) | Datenmengen einstellig; Läufe-Limit nachrüstbar hinter dem Service-Interface (Review-Entscheidung)                                                             |
| Teststrategie Service             | nur Unit vs. Unit + itest                 | Unit + `model-profiles.itest.ts`                  | Batch-Query + RLS-Scoping brauchen echte DB; CI-Gate existiert (Review-Entscheidung)                                                                           |

---

## Progress

> Single Source of Truth fuer den Umsetzungsstand (Regeln: `project-rules/DERIVED_STATE_RULES.md`).
> Nach jedem umgesetzten Schritt sofort abhaken; Commit-SHA als Beleg (optional bei Schritten ohne Commit).

- [x] 1.1 Typen + Validierung (personaId optional, isBaselineRun-Helper) — `53c5a00`
- [x] 1.2 Lauf-Erstellung + Prompt-Pfad (Provider-Spike zuerst) — `53c5a00`
- [x] 1.3 RunRunner-UI + Unit-Tests — `53c5a00`
- [x] 1.4 Baseline-Daten fahren (je Modell ≥ 5 Reps) — durch Damian in Prod bestätigt 2026-07-12 (kein Commit; Daten in Prod-DB)
- [x] 2.1 View-Typen (ModelProfileView, ModelCompareView) — `b65f35e`
- [x] 2.2 Service model-profiles (Batch-Query, Pooling, Ausschluss-Zählung) — `b65f35e`
- [x] 2.3 Unit- + Integration-Tests Aggregation — `b65f35e`
- [x] 3.1 Profil-Route (/models/profile?m=) — `479f7b6`
- [x] 3.2 Profil-Darstellung (ModelProfile, Attribution) — `479f7b6`
- [x] 3.3 Einstieg Modell-Liste (View-profile-Links) — `479f7b6`
- [x] 3.4 Anzeige-Fallbacks „baseline" (Flag/Badge/Compare-Label) — `048dcb5` · ENTSCHEIDUNGSPUNKT Phase 4: Sichtprüfung Prod bestanden (Light+Dark, Badges, Attribution, Fehlzustände), Damian entschied 2026-07-13 „Ja, wie geplant"
- [x] 4.1 Auswahl-UI (Checkboxen, 2–4) — ModelProfilePicker-Insel, Sticky-Leiste — `4e72bd8` (PR #8)
- [x] 4.2 Compare-Route + Rendering (N Spalten) — models/compare.astro + ModelComparison, überlagerte Achsen-Serien — `4e72bd8` (PR #8) + Farb-Fix chart-3/4 `52e8f49` (PR #9)
- [x] 4.3 Randfälle + Tests (Param-Parsing, Grenzen) — compare-params.ts + 7 Tests; 222 Unit-Tests grün — `4e72bd8` (PR #8); Prod-Sichtprüfung 2026-07-13 komplett (2er/3er/4er, Light+Dark, Mobile, Randfälle)
- [x] 5.1 Querverlinkung Run-Liste — Modell-Link je Lauf (Liste + Detail-Fuß), `modelProfileHref`-Helper (DRY mit Picker); Link nur bei aufloesbarer Modellkonfig; 225 Unit-Tests grün
- [ ] 5.2 E2E-Risiko-Abdeckung
- [ ] 5.3 Abschluss (Prod-Sichtprüfung, Checkpoint)

---

## 3x3 Umsetzungsrhythmus

Dieser Plan ist fuer die Umsetzung im **3x3-Rhythmus** ausgelegt:

1. Implementiere max. 3 Schritte aus dem Plan
2. Hake die erledigten Schritte in `## Progress` ab (Commit-SHA als Beleg)
3. Fasse kurz zusammen was erledigt wurde
4. Beschreibe die naechsten 3 Schritte
5. **Stoppe und warte auf Feedback** bevor du weiterarbeitest

Bei Kontextverlust oder nach >6 Schritten: Die `## Progress`-Sektion ist der Wiedereinstiegspunkt —
in neuer Konversation `features/model-compare/plan.md` laden; der erste nicht abgehakte Schritt ist der naechste.
Erkenntnisse/Abweichungen gehoeren in den Session-Log (`/dtb:workflow-checkpoint`).

---

**Erstellt mit:** `/dtb:impl-plan`
