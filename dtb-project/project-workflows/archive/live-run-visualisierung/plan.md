# Implementierungsplan: Live-Run-Visualisierung

**Erstellt:** 2026-07-18
**Feature-Spec:** `features/live-run-visualisierung/spec.md`
**Geschaetzte Dauer:** ~2–2.5 Sessions
**Status:** Reviewed <!-- Plan-Review REVISE (2 WARN) eingearbeitet: Spec-Angleichung Zähler-Puls, 2.3 gehärtet, Zustandsmaschine als pure Funktion -->

---

## Phasen-Uebersicht

| Phase   | Beschreibung                                   | Dauer          | Status  |
| ------- | ---------------------------------------------- | -------------- | ------- |
| Phase 1 | Bühnen-Fundament: Keyframes + Stage-Komponente | ~0.5 Session   | Geplant |
| Phase 2 | Integration in den Lauf-Loop (RunRunner)       | ~1 Session     | Geplant |
| Phase 3 | Verifikation, Sichtprüfung, PR + Prod-Abnahme  | ~0.5–1 Session | Geplant |

---

## Ist-Analyse

> Quelle: `discovery.md` (übernommen, Pfade verifiziert) + Code-Verifikation der Zähler-Semantik (Lektion #1).

| Pfad                                | Ist-Befund (relevant fuer den Plan)                                                                                                                                                                                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/runs/RunRunner.tsx` | 865 Zeilen; Live-Panel Z. 634–686 (Textzeilen + simple Bar). Step-Loop `runStep()` verkettet sich via `setTimeout(0)`; `progress: RunProgress` wird je Step ersetzt (keine Historie). `stopLoop()` unmountet das Panel sofort (`activeRunId = null`) — gilt heute auch bei Netzwerkfehler und Lauf-Ende |
| `src/styles/global.css`             | `tw-animate-css` importiert; Vorbild-Muster vorhanden: `page-enter`-Keyframes unter `@media (prefers-reduced-motion: no-preference)` + reduce-Fallback                                                                                                                                                  |
| `src/lib/runs/run-schemas.ts`       | `runProgressSchema`: `status, completedReps, totalReps, failedCount, promptTokens, completionTokens, lastRepDurationMs, lastRepError, phase, currentScenario, totalScenarios, currentRound, lastStrategy` — NICHT ändern (Spec-Grenze)                                                                  |
| `src/lib/services/runs.ts`          | NICHT ändern. Verifiziert: Item-Läufe zählen `failedCount` pro Step hoch (Z. 596) → Rep-Outcome via Delta ableitbar; Steadfastness patcht `failed_count` erst am Lauf-Ende (Z. 788–790) → Fakt-Outcome live NICHT erkennbar                                                                             |
| `src/pages/runs.astro`              | Hostet die RunRunner-Insel — unberührt                                                                                                                                                                                                                                                                  |
| `src/lib/runs/run-timing.ts`        | `formatDuration` — nur Referenz, bleibt Textzeilen-Anzeige                                                                                                                                                                                                                                              |

---

## Phase 1: Bühnen-Fundament

### Ziel

Wiederverwendbare, getestete Bausteine: CSS-Motion-Vokabular (ruhig-konzentriert) und eine
reine Präsentations-Komponente `LiveRunStage`, die aus einfachen Props ein Zellen-Grid rendert —
noch ohne Anbindung an den echten Lauf.

### Schritte

#### Schritt 1.1: Motion-Vokabular in `global.css`

- **Zweck:** Alle Animationen als CSS-Keyframes/Utilities zentral, korrekt hinter `prefers-reduced-motion` gegated (Muster `page-enter`).
- **Dateien:** `src/styles/global.css`
- **Input:** Spec (ruhig-konzentriert, ~1–2 s Herzschlag); bestehendes `page-enter`-Muster.
- **Output:** Keyframes/Klassen: `stage-heartbeat` (Idle-Puls), `stage-cell-pop` (Erfolgs-Aufleuchten), `stage-cell-flash` (Fehler-Blitz), `stage-finale` (Abschluss-Puls), `stage-fade-out` (sanftes Ausblenden), `stage-tick` (Wertwechsel-Puls der Zähler). Unter `prefers-reduced-motion: reduce` sind alle wirkungslos (harte Zustandswechsel bleiben).

#### Schritt 1.2: `LiveRunStage`-Komponente (reine Präsentation)

- **Zweck:** Zellen-Grid als dumme Komponente — testbar, hält RunRunner schlank (ist schon 865 Zeilen).
- **Dateien:** `src/components/runs/LiveRunStage.tsx` (NEU)
- **Input:** Props: `total`, `cells: ("ok" | "failed" | "done" | "pending")[]`, `waiting` (Herzschlag an/aus), `phase` (`generating` → Herzschlag ohne Zellen-Fortschritt), `stageState` (`live` | `finale-success` | `finale-failed` | `interrupted`).
- **Output:** Grid mit fixer Zellgröße + Umbruch (N=1 bis N=25, zentriert); Farben ausschließlich semantische Tokens (`primary` = ok/done, `destructive` = failed, `muted` = pending, grau-gedimmt = interrupted); `aria-hidden` für die rein dekorative Ebene, Textanker bleiben die zugänglichen Infos.

#### Schritt 1.3: Zell-Ableitung + Stage-Zustandsmaschine als pure Funktionen + Unit-Tests

- **Zweck:** Die Übersetzung „Folge von `RunProgress`-Snapshots → Zellzustände" UND die `stageState`-Übergänge sind die einzige echte Logik — beide als pure Funktionen testbar, ohne Komponente (Plan-Review: Race-Schutz testbar machen statt über vier Funktionen verstreuen).
- **Dateien:** `src/lib/runs/stage-cells.ts` (NEU), `src/lib/runs/stage-cells.test.ts` (NEU)
- **Input:** Verifizierte Semantik: Item-Lauf-Outcome je Rep via `failedCount`-Delta; Steadfastness: Zelle „done" ohne ok/failed-Differenzierung (live nicht erkennbar), Finale färbt nach; Übergangstabelle aus 2.3.
- **Output:** `reduceStageCells(prev, progress)` + `nextStageState(current, event)` (gemäß Übergangstabelle in 2.3) + Tests: ok-Folge, Fehler-Delta, gemischte Folge, Steadfastness `generating`→`experimenting`, N=1, N=25; Übergänge `live`→`finale-success`/`finale-failed`, `live`→`interrupted`, Cancel/Dismiss→ausgeblendet, Finale-Timeout, unzulässige Übergänge (z. B. Cancel in `finale-*`) sind No-ops.

> **3x3-Block:** Nach Schritt 1.3 → Zusammenfassung + Feedback einholen

### Deliverables

- [ ] Motion-Vokabular in `global.css` (gegated)
- [ ] `LiveRunStage.tsx` (reine Präsentation)
- [ ] `stage-cells.ts` + Unit-Tests

### Checkpoint-Kriterien

#### Automated

- [ ] `npm run lint` grün
- [ ] `npm run test` grün (inkl. neuer `stage-cells.test.ts`)
- [ ] Grep: `stage-heartbeat` in `global.css` steht innerhalb eines `@media (prefers-reduced-motion: no-preference)`-Blocks
- [ ] Datei-Existenz: `src/components/runs/LiveRunStage.tsx`, `src/lib/runs/stage-cells.ts`

---

## Phase 2: Integration in den Lauf-Loop

### Ziel

Die Bühne lebt im echten Panel: Zellen folgen dem Lauf, Herzschlag während wartender Antworten,
ehrliche Steadfastness-Anzeige, korrekte Endzustände (Finale / Einfrieren / Cancel).

### Schritte

#### Schritt 2.1: Step-Historie in RunRunner mitschreiben

- **Zweck:** RunRunner hält heute nur den letzten `RunProgress` — die Bühne braucht den Verlauf (Zellzustände via `reduceStageCells`).
- **Dateien:** `src/components/runs/RunRunner.tsx`
- **Input:** `runStep()`-Erfolgspfad; `start()` (Reset), `cancelActive()`/`stopLoop()`.
- **Output:** `cells`-State, aktualisiert je Step über die pure Funktion; Reset bei Lauf-Start; `waiting` = Zeitraum zwischen Step-Absenden und -Antwort.

#### Schritt 2.2: Bühne ins Panel einbetten (erweitert, ersetzt nicht)

- **Zweck:** Sichtbarer Kern des Features — oberhalb der bestehenden Textzeilen, alle Textanker unverändert („Run in progress…", Zähler-Texte).
- **Dateien:** `src/components/runs/RunRunner.tsx`
- **Input:** `LiveRunStage`, `cells`, `progress.phase`; Steadfastness-Texte (Fakt X/Y, Runde, Strategie) bleiben.
- **Output:** Bühne im Panel; Steadfastness: 1 Zelle = 1 Fakt, `generating` = Herzschlag ohne Zellen; während Runden ehrliche Zeile („Runde X läuft…") — Token-Zeile bleibt, wird aber nicht animiert hervorgehoben, solange sie 0 klemmt (kaschieren, nicht fixen); Zähler-Wertwechsel mit `stage-tick`-Puls, `tabular-nums`.

#### Schritt 2.3: Endzustände — Finale, Einfrieren (Dismiss), Cancel

- **Zweck:** Kein abrupter Schnitt mehr am Lauf-Ende; erkennbarer „unterbrochen"-Zustand mit Ausweg; Cancel bleibt hart. Alle Übergänge laufen über `nextStageState` aus 1.3 — nichts ad-hoc (Plan-Review: Race-Schutz).
- **Dateien:** `src/components/runs/RunRunner.tsx`
- **Input:** heutige Pfade: terminal (`completed`/`failed` → `stopLoop`), Netzwerk-/Serverfehler (→ `stopLoop`), `cancelActive()`; `nextStageState` (1.3).
- **Output:** `stageState`-Steuerung strikt nach dieser Übergangstabelle:

  | Zustand       | Ereignis                          | Folgezustand                                              |
  | ------------- | --------------------------------- | --------------------------------------------------------- |
  | `live`        | Step-Antwort terminal `completed` | `finale-success` (~1.5 s)                                 |
  | `live`        | Step-Antwort terminal `failed`    | `finale-failed` (~1.5 s)                                  |
  | `live`        | Netzwerk-/Serverfehler            | `interrupted` (Zellen grau eingefroren + Fehlerbanner)    |
  | `live`        | Cancel (bestätigt)                | ausgeblendet (sofort, kein Finale — Lauf wird gelöscht)   |
  | `finale-*`    | Finale-Timeout abgelaufen         | ausgeblendet (`stage-fade-out`, dann Unmount + `refetch`) |
  | `interrupted` | Dismiss-Klick („Schließen")       | ausgeblendet                                              |

  **Härtungen (Plan-Review):** Cancel-Button ist in `finale-*` und `interrupted` entfernt (kein DELETE auf fertige Läufe möglich); `interrupted` zeigt stattdessen den Dismiss-Button; das Finale-`setTimeout` läuft als eigener Timer-Ref und wird bei Cancel/Unmount gecleart; reduced-motion: Terminal → sofort ausgeblendet (kein Finale, harter Übergang).

> **3x3-Block:** Nach Schritt 2.3 → Zusammenfassung + Feedback einholen

### Deliverables

- [ ] Zellen folgen live dem Lauf (Item + Steadfastness)
- [ ] Herzschlag-Idle + ehrliche Steadfastness-Anzeige
- [ ] Finale / Einfrieren (mit Dismiss) / Cancel gemäß Übergangstabelle

### Checkpoint-Kriterien

#### Automated

- [ ] `npx astro check` grün, `npm run lint` grün
- [ ] `npm run test` + `npm run test:integration` grün
- [ ] Grep: Textanker `Run in progress…` unverändert in `RunRunner.tsx` vorhanden
- [ ] E2E lokal grün (`npm run test:e2e`, `--workers=1` gemäß Gotcha)

---

## Phase 3: Verifikation & Abschluss

### Ziel

Das Feature ist per Sichtprüfung als „ruhig-konzentriert" abgenommen, alle Suiten grün,
über das Verdict-Gate gemerged und auf Prod bestätigt.

### Schritte

#### Schritt 3.1: Volle Verifikation + Feinschliff

- **Zweck:** Gesamtbild prüfen, Frequenz/Intensität zähmen (Spec-Risiko „kitschig"), kleine Viewports gegenchecken (Zellen-Umbruch).
- **Dateien:** ggf. Feintuning in `global.css` / `LiveRunStage.tsx`
- **Input:** Dev-Server-Läufe (Item + Steadfastness), Light + Dark, OS-Einstellung „reduzierte Bewegung", schmales Viewport.
- **Output:** feingetunte Werte (Dauer, Intensität); notierte Abweichungen.

#### Schritt 3.2: Sichtprüfung (Abnahme-Vorbereitung)

- **Zweck:** Manual-Kriterien der Spec belegbar machen.
- **Dateien:** — (Prüf-Schritt)
- **Input:** laufender Dev-Server; Checkliste aus Spec-Success-Criteria.
- **Output:** bestätigte Sichtprüfung: Bühne, Herzschlag, Fehler-Zelle, Finale, Einfrieren (Netz kappen), reduced-motion, Light/Dark.

#### Schritt 3.3: PR + Verdict-Gate + Prod-Abnahme

- **Zweck:** Merge-Weg des Projekts (kein Direkt-Push auf `main`; Verdict ist Required Check).
- **Dateien:** — (Git/CI)
- **Input:** grüne Suiten; Branch → PR.
- **Output:** PR gemerged (Squash), Deploy, Prod-Sichtprüfung eines echten Laufs; lokal `git fetch` + `reset --hard origin/main`.

> **3x3-Block:** Nach Schritt 3.3 → Zusammenfassung + Feedback einholen

### Deliverables

- [ ] Sichtprüfung dokumentiert (Light/Dark, reduced-motion)
- [ ] PR gemerged, Prod-Abnahme erteilt

### Checkpoint-Kriterien

#### Automated

- [ ] `npm run build` grün
- [ ] Volle Suite grün: Unit + Integration + E2E (sequenziell)
- [ ] CI auf dem PR grün inkl. Verdict-Check

#### Manual

- [ ] Sichtprüfung: Wirkung „ruhig-konzentriert" (nicht unruhig/kitschig) in Light + Dark
- [ ] reduced-motion: statisch, aber vollständig informativ
- [ ] Prod-Abnahme: ein echter Lauf auf der Workers-URL mit Bühne, Finale inklusive

---

## Technische Entscheidungen

| Thema                          | Optionen                                                                                    | Entscheidung                      | Begruendung                                                                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rep-Outcome-Quelle (Item)      | `lastRepError`-Heuristik / `failedCount`-Delta                                              | `failedCount`-Delta               | im Code verifiziert (`runs.ts:596`): steigt pro fehlgeschlagenem Step — positionsgenau, ohne Schema-Änderung                                                 |
| Steadfastness-Zellen live      | ok/failed live färben / neutral „done", Finale färbt nach                                   | neutral „done"                    | `failed_count` wird erst am Lauf-Ende gepatcht (`runs.ts:788-790`) — live-Färbung wäre geraten, verletzt „ehrliche Darstellung"                              |
| Zähler-Animation               | JS-Count-up (Timer/rAF) / CSS-Puls beim Wertwechsel                                         | CSS-Puls (`stage-tick`)           | kein Dauer-Rechenloop (Spec-Constraint), ehrlich (Werte springen wie Daten kommen), passt zu ruhig-konzentriert; Spec entsprechend angeglichen (Plan-Review) |
| `interrupted`-Exit             | bleibt bis Reload / Auto-Ausblenden / Dismiss-Button                                        | Dismiss-Button                    | Nutzer quittiert bewusst, Fehler-Kontext bleibt lesbar (Plan-Review)                                                                                         |
| Ort der Stage-Zustandsmaschine | inline in RunRunner / pure Funktion `nextStageState` in `stage-cells.ts`                    | pure Funktion                     | unit-testbar; Übergänge an einer Stelle statt über vier Funktionen verstreut (Plan-Review, Pre-Mortem)                                                       |
| Komponentenschnitt             | inline in RunRunner / eigene `LiveRunStage` + pure `stage-cells`                            | eigene Komponente + pure Funktion | RunRunner ist 865 Zeilen; Logik wird unit-testbar ohne DOM                                                                                                   |
| Abschluss-Moment-Mechanik      | sofortiger Unmount (heute) / verzögerter Unmount via `stageState` + einmaliges `setTimeout` | verzögerter Unmount               | Spec verlangt Finale + sanftes Ausblenden; ein einmaliges Timeout ist kein Dauerloop; Cancel & reduced-motion überspringen                                   |
| A11y der Bühne                 | Zellen mit ARIA-Semantik / `aria-hidden` als Deko-Ebene                                     | `aria-hidden`                     | Textanker (vorhanden, unverändert) bleiben die zugängliche Wahrheit; doppelte Semantik würde Screenreader fluten                                             |

---

## Progress

> Single Source of Truth fuer den Umsetzungsstand (Regeln: `project-rules/DERIVED_STATE_RULES.md`).
> Abhaken gemaess Flip-Bedingung §2 (Automated-Kriterien der Phase gruen); SHA-Nachtrag beim
> Phasen-Ende-Commit — geflippte Zeile ohne SHA ist mid-phase gueltig (§2 Regel 4).

- [x] 1.1 Motion-Vokabular `global.css` — `ade9fad`
- [x] 1.2 `LiveRunStage`-Komponente — `ade9fad`
- [x] 1.3 `stage-cells` + Unit-Tests — `ade9fad`
- [x] 2.1 Step-Historie in RunRunner — `e5d7618`
- [x] 2.2 Bühne ins Panel einbetten — `e5d7618`
- [x] 2.3 Endzustände (Finale/Einfrieren/Cancel) — `e5d7618`
- [x] 3.1 Volle Verifikation + Feinschliff — `64b073c`
- [x] 3.2 Sichtprüfung — `64b073c`
- [x] 3.3 PR + Verdict-Gate + Prod-Abnahme — `64b073c`

---

## Umsetzung

Umsetzung mit `/dtb:implement Live-Run-Visualisierung` — 3x3-Rhythmus und Phasen-Ende-Ritual
(Verifikations-Gate, SHA-Nachtrag) sind dort beschrieben (die eine Quelle).
Wiedereinstieg bei Kontextverlust: `features/live-run-visualisierung/plan.md` laden; der erste
nicht abgehakte Schritt in `## Progress` ist der naechste.
Erkenntnisse/Abweichungen gehoeren in den Session-Log (`/dtb:workflow-checkpoint`).

---

**Erstellt mit:** `/dtb:impl-plan`
