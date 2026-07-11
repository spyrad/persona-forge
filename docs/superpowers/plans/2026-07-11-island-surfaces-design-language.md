# Insel-Flächen Design-Sprache (Stufe B+C) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die sechs React-Inseln tragen die Landing-Design-Sprache (dosiert:
Anzeige editorial, Arbeit ruhig) und ausschließlich englische Copy; danach ist
die App durchgehend einsprachig.

**Architecture:** Reine Markup-/Klassen-/String-Edits in sechs bestehenden
Inseln plus zwei kleine Umbauten: `run-timing.ts`-Formatierer auf `en-GB`
(einzige logikberührende Änderung, per TDD) und `AuthCardHeader.astro` als
Extraktion von 3× dupliziertem Markup. Zwei PRs: PR 1 „Display"
(axis-chart, RunResult, RunComparison), PR 2 „Work" (ModelConfigManager,
PersonaCatalog, RunRunner, AuthCardHeader).

**Tech Stack:** Astro 6 + React 19 + Tailwind 4; Vitest; Playwright (E2E);
CI-Review-Agent als Merge-Gate.

**Spec:** `docs/superpowers/specs/2026-07-11-island-surfaces-design-language-design.md`

## Global Constraints

- **Copy-only in Logik-Dateien:** In den sechs Inseln ändern sich NUR sichtbare
  Strings und `className`-Werte. Kein Umbau von State, Fetch-Logik, Schemas,
  Bedingungen. Einzige Ausnahmen: `run-timing.ts` (Task 1, TDD) und die
  `AuthCardHeader`-Extraktion (Task 9).
- **Kommentare bleiben deutsch.** Code-Kommentare/Doku-Blöcke NICHT übersetzen
  (Projekt-Idiom). Nur wo ein Kommentar durch die Änderung inhaltlich falsch
  wird (z. B. „deutsche Anzeige" in `run-timing.ts`), den deutschen Text
  korrigieren.
- **Keine Farb-Literale** (`text-white`, `-blue-*`, Hex, …) — nur semantische
  Tokens. Die Inseln sind bereits Token-rein; das muss so bleiben.
- **Keine neuen Tokens, keine neuen shadcn-Komponenten, keine Landing-Änderungen.**
- **Datumsformat `en-GB`:** `10 Jul 2026, 14:32` — überall, wo die App
  Zeitstempel zeigt (Entscheidung 3 der Spec).
- **Verbindliches Glossar** (bei neuen Begriffen konsistent erweitern, Ton
  nüchtern-instrumentig):

  | Deutsch (Bestand)     | Englisch (verbindlich) |
  | --------------------- | ---------------------- |
  | Lauf / Läufe          | run / runs             |
  | Wiederholung(en)      | repetition(s)          |
  | verwertbar            | usable                 |
  | Achse                 | axis                   |
  | Standhaftigkeit       | steadfastness          |
  | Abgeleiteter Typ      | derived type           |
  | Mittelwert            | mean                   |
  | nicht belastbar       | not reliable           |
  | Fehlquote             | failure rate           |
  | Ausgeführt:           | Executed:              |
  | Zurück zu den Läufen  | Back to runs           |
  | Verteilung je Achse   | Distribution per axis  |
  | Tokens: X ein / Y aus | Tokens: X in / Y out   |
  | Zurücksetzen          | Reset                  |
  | Anlegen               | Create                 |
  | Speichern             | Save                   |
  | Abbrechen             | Cancel                 |
  | Löschen               | Delete                 |
  | Bearbeiten            | Edit                   |
  | Privat / Global       | Private / Global       |
  | Läuft                 | Running                |
  | Wartet                | Pending                |
  | Fertig                | Completed              |
  | Fehlgeschlagen        | Failed                 |
  | Gegenspieler-Modell   | adversary model        |
  | Fakt(en)              | fact(s)                |
  | Runde(n)              | round(s)               |

- **Verifikation (Kommandos):** Unit `npm run test` (198 Tests, Anzahl bleibt);
  Build `npm run build`; Lint CI-äquivalent
  `npx eslint . --rule '{"prettier/prettier":"off"}'` (volles Lint erstickt an
  CRLF — NIE Teilmengen linten); E2E `npm run test:e2e` (lokales Supabase via
  Docker nötig).
- **Git-Flow:** PR 1 von Branch `feat/island-design-display`, PR 2 von
  `feat/island-design-work` — **PR 2 erst nach Merge von PR 1 beginnen.**
  Nach Squash-Merge: `git checkout main && git reset --hard origin/main`
  (KEIN `git pull`). `ai-review/verdict` ist Required Check.
- **Dev-SSR-Gotcha:** „Invalid hook call" im Dev-Log ist pre-existing/harmlos;
  bricht der erste Request nach kaltem `.vite`-Cache ab → reload und
  main-Baseline prüfen, bevor der eigene Diff verdächtigt wird.

---

## PR 1 — Display (Anzeige-Flächen, editorial)

### Task 1: `run-timing.ts` auf en-GB (TDD)

**Files:**

- Modify: `src/lib/runs/run-timing.ts:47-77`
- Test: `src/lib/runs/run-timing.test.ts:36-53`

**Interfaces:**

- Consumes: —
- Produces: `formatDuration(ms: number): string` liefert Dezimal**punkt**
  (`"3.2 s"` statt `"3,2 s"`); `formatDateTime(iso: string): string` liefert
  `"01 Jul 2026, 22:15"` (en-GB, Europe/Berlin). Signaturen unverändert —
  Tasks 3, 4 und 8 rendern diese Ausgaben.

- [ ] **Step 1: Branch anlegen**

```bash
git checkout main && git pull && git checkout -b feat/island-design-display
```

- [ ] **Step 2: Tests auf die neuen Formate umschreiben (Red)**

In `src/lib/runs/run-timing.test.ts` die Erwartungen ändern:

```ts
// ALT (loeschen):
expect(formatDuration(3200)).toBe("3,2 s");
expect(formatDuration(9900)).toBe("9,9 s");
expect(formatDateTime("2026-07-01T20:15:00.000Z")).toBe("01.07.2026 22:15");

// NEU (stattdessen):
expect(formatDuration(3200)).toBe("3.2 s");
expect(formatDuration(9900)).toBe("9.9 s");
expect(formatDateTime("2026-07-01T20:15:00.000Z")).toBe("01 Jul 2026, 22:15");
```

(`"300 ms"`, `"33 s"`, `"3 m 05 s"`, `"—"` bleiben unverändert.)

- [ ] **Step 3: Tests laufen lassen — müssen fehlschlagen**

Run: `npm run test -- run-timing`
Expected: FAIL — 2 Tests (`formatDuration` Dezimal, `formatDateTime` Format)

- [ ] **Step 4: Implementierung umstellen (Green)**

In `src/lib/runs/run-timing.ts`:

```ts
// Zeile 4 (Doku-Kommentar korrigieren, bleibt deutsch):
 *   - formatDuration/formatDateTime: englische Anzeige (en-GB; ms/s/min bzw. Datum+Zeit).

// Zeile 47:
/** Millisekunden → Kurzform: „300 ms" / „3.2 s" / „33 s" / „3 m 05 s". */

// Zeile 55: Dezimalpunkt statt Komma — das .replace entfällt:
      const oneDecimal = (Math.round(ms / 100) / 10).toString();

// Zeilen 65-77: en-GB mit Kurz-Monat; Komma bleibt (gewünschtes Format):
/** ISO-Timestamp → „01 Jul 2026, 22:15" (en-GB, Europe/Berlin). */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
```

- [ ] **Step 5: Tests laufen lassen — müssen bestehen**

Run: `npm run test`
Expected: PASS, 198 Tests

- [ ] **Step 6: Commit**

```bash
git add src/lib/runs/run-timing.ts src/lib/runs/run-timing.test.ts
git commit -m "feat(runs): Zeit-Formatierer auf en-GB umstellen (Datum + Dezimalpunkt)"
```

### Task 2: `axis-chart.tsx` — Mono-Zahlen + EN

**Files:**

- Modify: `src/components/runs/axis-chart.tsx:66,118,127,137`

**Interfaces:**

- Consumes: —
- Produces: unveränderte Props/Exports (`AxisChart`, `RELIABLE_MIN`, `toPct`).
  Chart-Geometrie byte-identisch (Spec: keine strukturellen Änderungen).

- [ ] **Step 1: Vier Edits anwenden**

```tsx
// Zeile 66 — Cutoff-Zahl in Mono/tabular:
<span className="text-muted-foreground absolute -top-px left-1 font-mono text-[10px] tabular-nums">{scale.cutoff}</span>

// Zeile 118 — Tooltip EN:
title={`Mean ${s.mean.toFixed(1)}`}

// Zeile 127 — Fußzeile (Pole + Skala) komplett in Mono/tabular:
<div className="text-muted-foreground mt-1 flex items-center justify-between font-mono text-xs tabular-nums">

// Zeile 137 — Screenreader-Text EN:
<span className="sr-only">Highest frequency of a single value: {overallMaxStack}</span>
```

(Der `title` in Zeile 100 — `Score X: N×` — ist bereits sprachneutral englisch.)

- [ ] **Step 2: Keine deutsche Copy mehr in der Datei (außer Kommentaren)**

Run: `git diff src/components/runs/axis-chart.tsx` sichten +
`grep -nE "Mittelwert|Häufigkeit" src/components/runs/axis-chart.tsx`
Expected: Treffer nur noch in deutschen Kommentaren, nicht in Strings/JSX

- [ ] **Step 3: Tests + Commit**

Run: `npm run test` → Expected: PASS, 198 Tests

```bash
git add src/components/runs/axis-chart.tsx
git commit -m "feat(runs): AxisChart-Beschriftung in Mono/tabular-nums, Tooltips englisch"
```

### Task 3: `RunResult.tsx` — Editorial-Typografie + EN

**Files:**

- Modify: `src/components/runs/RunResult.tsx` (nur Strings + classNames)

**Interfaces:**

- Consumes: `formatDateTime`/`formatDuration` aus Task 1 (neue en-GB-Ausgabe)
- Produces: unveränderte Props (`RunResult({ result })`)

- [ ] **Step 1: Typografie-Edits (exakte Klassen-Änderungen)**

```tsx
// Z.22 — AxisCard-Titel Serif:
<h3 className="font-display text-xl">{axis.label}</h3>

// Z.23 — Zähler tabular + EN:
<span className="text-muted-foreground text-xs tabular-nums">{axis.usableCount} usable</span>

// Z.39/42 — Kennzahl-Werte Mono/tabular (beide value-Spans):
<span className="text-foreground font-mono font-medium tabular-nums">{axis.mean?.toFixed(1)}</span>
<span className="text-foreground font-mono font-medium tabular-nums">{axis.sd?.toFixed(2)}</span>

// Z.46 — Letter-Count-Badges tabular:
<span key={letter} className="border-border bg-muted rounded-full border px-2 py-0.5 font-mono text-xs tabular-nums">

// Z.126 — Steadfastness-Panel-Header wird Mono-Eyebrow (Text s. Step 2):
<h2 className="text-muted-foreground flex items-center gap-2 font-mono text-xs tracking-[0.2em] uppercase">

// Z.130 — Score-Prozent zusätzlich tabular-nums:
<span className="text-primary font-mono text-4xl font-bold tabular-nums">{scorePct} %</span>

// Z.149 — Sektions-h2 Serif:
<h2 className="font-display text-2xl">Capitulations by strategy</h2>

// Z.207 — Typ-Panel-Header wird Mono-Eyebrow (Text s. Step 2):
<h2 className="text-muted-foreground flex items-center gap-2 font-mono text-xs tracking-[0.2em] uppercase">

// Z.269 — Sektions-h2 Serif:
<h2 className="font-display text-2xl">Distribution per axis</h2>

// Meta-Zeilen (Fehlquote/Tokens/Executed/Dauer): jeweils NUR `tabular-nums`
// an die bestehende className anhängen — Z.104, 137, 181, 236, 240:
// z. B. Z.236: className="text-muted-foreground mt-2 text-xs tabular-nums"
```

- [ ] **Step 2: Übersetzungstabelle anwenden (vollständig)**

| Zeile              | Deutsch (Bestand)                                                                                                                                                     | Englisch (neu)                                                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 27                 | `Keine verwertbare Wiederholung für diese Achse.`                                                                                                                     | `No usable repetition for this axis.`                                                                                                  |
| 39                 | `Mittelwert`                                                                                                                                                          | `Mean`                                                                                                                                 |
| 56                 | `Nicht belastbar — zu wenige verwertbare Läufe für eine Verteilung.`                                                                                                  | `Not reliable — too few usable repetitions for a distribution.`                                                                        |
| 72                 | `Fehler bei einzelnen Wiederholungen`                                                                                                                                 | `Errors in individual repetitions`                                                                                                     |
| 97                 | `"Lauf fehlgeschlagen"` / `` `Keine verwertbaren ${itemLabel}` ``                                                                                                     | `"Run failed"` / `` `No usable ${itemLabel}` ``                                                                                        |
| 101                | `Dieser Lauf konnte nicht abgeschlossen werden — es gibt kein verwertbares Ergebnis.`                                                                                 | `This run could not be completed — there is no usable result.`                                                                         |
| 102                | `` `Dieser Lauf lieferte keine verwertbaren ${itemLabel}, daher gibt es kein Ergebnis. Fehlquote: ${…}.` ``                                                           | `` `This run produced no usable ${itemLabel}, so there is no result. Failure rate: ${…}.` ``                                           |
| 104, 181, 241      | `Ausgeführt:`                                                                                                                                                         | `Executed:`                                                                                                                            |
| 112, 162, 183, 278 | `Zurück zu den Läufen`                                                                                                                                                | `Back to runs`                                                                                                                         |
| 127                | `Standhaftigkeit über {s.usableCount} verwertbare Experimente`                                                                                                        | `steadfastness — {s.usableCount} usable experiments` (Eyebrow, lowercase)                                                              |
| 132–134            | `Gehalten` / `Kapituliert` / `` ` · ⌀ Runde bis Einknicken ${…}` ``                                                                                                   | `Held` / `Capitulated` / `` ` · ⌀ round to capitulation ${…}` ``                                                                       |
| 138, 237–238       | `Tokens: {…} ein / {…} aus`                                                                                                                                           | `Tokens: {…} in / {…} out`                                                                                                             |
| 177–178            | `Dieser Lauf ist noch nicht abgeschlossen ({run.status}). Das Ergebnis erscheint, sobald alle Wiederholungen durchgelaufen sind.`                                     | `This run isn't finished yet ({run.status}). The result will appear once all repetitions have completed.`                              |
| 191                | `itemLabel="Experimente"`                                                                                                                                             | `itemLabel="experiments"`                                                                                                              |
| 197                | `itemLabel="Antworten"`                                                                                                                                               | `itemLabel="answers"`                                                                                                                  |
| 208                | `Abgeleiteter Typ über {aggregate.usableReps} verwertbare Läufe`                                                                                                      | `derived type — {aggregate.usableReps} usable runs` (Eyebrow, lowercase)                                                               |
| 218                | `Privat`                                                                                                                                                              | `Private`                                                                                                                              |
| 227                | `Stabilität: {…} % der Läufe ergeben diesen Typ`                                                                                                                      | `Stability: {…} % of runs yield this type`                                                                                             |
| 233                | `Kein durchgängiger Typ — mindestens eine Achse hatte in keiner Wiederholung alle Items parsebar.`                                                                    | `No consistent type — at least one axis had no repetition where all items were parseable.`                                             |
| 237                | `Fehlquote:`                                                                                                                                                          | `Failure rate:`                                                                                                                        |
| 243                | `` ` · Dauer ${…} (Modell-Zeit ${…})` ``                                                                                                                              | `` ` · duration ${…} (model time ${…})` ``                                                                                             |
| 246                | `` ` · ⌀ ${…}/Rep (${…}–${…})` ``                                                                                                                                     | `` ` · ⌀ ${…}/rep (${…}–${…})` ``                                                                                                      |
| 254–255            | `Nicht belastbar: ein Einzeldurchlauf (oder zu wenige verwertbare Läufe) ist kein aussagekräftiges Dispositionsprofil. Mehr Wiederholungen erhöhen die Aussagekraft.` | `Not reliable: a single pass (or too few usable runs) is not a meaningful disposition profile. More repetitions increase reliability.` |
| 269                | `Verteilung je Achse`                                                                                                                                                 | `Distribution per axis`                                                                                                                |

- [ ] **Step 3: Verifizieren**

Run: `grep -nE "ä|ö|ü|ß" src/components/runs/RunResult.tsx`
Expected: Treffer NUR in Kommentar-Zeilen (`//`, `/** … */`)
Run: `npm run test` → Expected: PASS, 198 Tests

- [ ] **Step 4: Commit**

```bash
git add src/components/runs/RunResult.tsx
git commit -m "feat(runs): RunResult editorial — Eyebrow/Serif-Sektionen, tabular-nums, englische Copy"
```

### Task 4: `RunComparison.tsx` — Editorial-Typografie + EN + en-GB-Datum

**Files:**

- Modify: `src/components/runs/RunComparison.tsx` (Strings + classNames + 1 Import)

**Interfaces:**

- Consumes: `formatDateTime` aus `@/lib/runs/run-timing` (Task 1)
- Produces: unveränderte Props (`RunComparison({ view })`)

- [ ] **Step 1: Datum auf den geteilten Formatierer umstellen (DRY)**

```tsx
// Import ergänzen (Zeile 3):
import { formatDateTime } from "@/lib/runs/run-timing";

// Zeile 36 — statt toLocaleString("de-DE"):
<p className="text-muted-foreground text-xs tabular-nums">{formatDateTime(result.run.createdAt)}</p>;
```

- [ ] **Step 2: Typografie-Edits**

```tsx
// Z.28-30 — „Lauf {letter}" wird Mono-Eyebrow:
<div className="text-muted-foreground flex items-center gap-2 font-mono text-xs tracking-[0.2em] uppercase">
  <span className={`size-2.5 rounded-full ${color.dot}`} /> Run {letter}
</div>

// Z.40 — Stabilitäts-Zeile tabular:
<p className="text-muted-foreground text-xs tabular-nums">

// Z.86-87 — SideStats-Label analog Eyebrow-Stil (klein):
<p className="text-muted-foreground flex items-center gap-1.5 font-mono text-xs tracking-[0.2em] uppercase">
  <span className={`size-2 rounded-full ${color.dot}`} /> Run {label}
</p>

// Z.92 — Werte-Zeile tabular:
<p className="text-muted-foreground text-sm tabular-nums">

// Z.108 — Achsen-Titel Serif (wie RunResult):
<h3 className="font-display text-xl">{axisA.label}</h3>

// Z.111 — Delta-Wert Mono/tabular:
<span className="text-foreground font-mono font-medium tabular-nums">{deltaLabel(axisA.mean, axisB.mean)}</span>

// Z.151 — Sektions-h2 Serif:
<h2 className="font-display text-2xl">Distribution per axis</h2>
```

- [ ] **Step 3: Übersetzungstabelle anwenden**

| Zeile | Deutsch (Bestand)                                                                                 | Englisch (neu)                                                                       |
| ----- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 29    | `Lauf {letter}`                                                                                   | `Run {letter}`                                                                       |
| 40    | `Stabilität {…} % über {…} Läufe`                                                                 | `Stability {…} % across {…} runs`                                                    |
| 55    | `Kein durchgängiger Typ in mindestens einem Lauf — ein direkter Typ-Vergleich ist nicht möglich.` | `No consistent type in at least one run — a direct type comparison is not possible.` |
| 65    | `Gleicher Typ:`                                                                                   | `Same type:`                                                                         |
| 71    | `Unterschiedliche Typen —`                                                                        | `Different types —`                                                                  |
| 87    | `Lauf {label}`                                                                                    | `Run {label}`                                                                        |
| 90    | `keine verwertbare Wiederholung`                                                                  | `no usable repetition`                                                               |
| 93–94 | `Mittel {…} · SD {…} · {…} verwertbar`                                                            | `Mean {…} · SD {…} · {…} usable`                                                     |
| 98    | `nicht belastbar (n &lt; {RELIABLE_MIN})`                                                         | `not reliable (n &lt; {RELIABLE_MIN})`                                               |
| 110   | `Δ Mittelwert (A − B):`                                                                           | `Δ mean (A − B):`                                                                    |
| 151   | `Verteilung je Achse`                                                                             | `Distribution per axis`                                                              |

- [ ] **Step 4: Verifizieren + Commit**

Run: `grep -nE "ä|ö|ü|ß|de-DE" src/components/runs/RunComparison.tsx`
Expected: Treffer nur in Kommentaren
Run: `npm run test` → Expected: PASS, 198 Tests

```bash
git add src/components/runs/RunComparison.tsx
git commit -m "feat(runs): RunComparison editorial — Eyebrow/Serif, en-GB-Datum via formatDateTime, englische Copy"
```

### Task 5: PR-1-Verifikation + PR erstellen

**Files:** keine neuen Änderungen (nur Verifikation + PR)

- [ ] **Step 1: Volle lokale Verifikation**

```bash
npm run test                                            # PASS, 198 Tests
npm run build                                           # exit 0
npx eslint . --rule '{"prettier/prettier":"off"}'       # 0 errors
npm run test:e2e                                        # 4/4 (Docker/Supabase lokal)
```

- [ ] **Step 2: Sichtprüfung im Dev-Server**

`npm run dev` → `/runs/<id>` (OEJTS-Ergebnis + Standhaftigkeits-Ergebnis,
falls vorhanden) und `/runs/compare?a=…&b=…` in Light **und** Dark prüfen:
Serif-Sektionstitel, Mono-Eyebrows, tabular-nums-Zahlen, en-GB-Datum,
keine deutsche Copy. (Dev-SSR-Gotcha beachten, s. Global Constraints.)

- [ ] **Step 3: Push + PR**

```bash
git push -u origin feat/island-design-display
gh pr create --title "feat(runs): Anzeige-Flaechen an Landing-Design-Sprache angleichen (Stufe B)" --body "..."
```

PR-Body: Verweis auf Spec, Zusammenfassung (3 Dateien + run-timing),
Verifikationsnachweis. Warten bis `ai-review/verdict` grün, dann
Squash-Merge; danach `git checkout main && git reset --hard origin/main`.

---

## PR 2 — Work (Arbeitsflächen, ruhig) — erst nach Merge von PR 1

### Task 6: `ModelConfigManager.tsx` — EN

**Files:**

- Modify: `src/components/models/ModelConfigManager.tsx` (nur Strings)

**Interfaces:**

- Consumes: —
- Produces: unveränderte Props (`ModelConfigManager({ initialConfigs, loadError })`)

- [ ] **Step 1: Branch anlegen**

```bash
git checkout main && git pull && git checkout -b feat/island-design-work
```

- [ ] **Step 2: Übersetzungstabelle anwenden (KEINE Klassen-Änderungen —
      Arbeitsflächen bleiben ruhig; Sektions-h2 behalten `text-lg font-semibold`.
      Der Karten-Rhythmus aus der Spec ist im Bestand bereits konsistent —
      durchgehend `rounded-2xl border-border`, bewusste p-6/p-5/p-4-Hierarchie —
      hier ist NICHTS umzubauen.)**

| Zeile | Deutsch (Bestand)                                                              | Englisch (neu)                                                          |
| ----- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| 157   | `Diese Konfiguration löschen?`                                                 | `Delete this configuration?`                                            |
| 211   | `` `Verbindung ok${… ` — ${…} Modelle` …}.` ``                                 | `` `Connection ok${… ` — ${…} models` …}.` ``                           |
| 215   | `Verbindung fehlgeschlagen.`                                                   | `Connection failed.`                                                    |
| 230   | `Konfiguration bearbeiten` / `Neue Konfiguration`                              | `Edit configuration` / `New configuration`                              |
| 240   | `z. B. OpenAI GPT-4o`                                                          | `e.g. OpenAI GPT-4o`                                                    |
| 257   | `Modellname`                                                                   | `Model name`                                                            |
| 269   | `{…} Modelle aus dem Verbindungstest — tippen zum Filtern oder frei eingeben.` | `{…} models from the connection test — type to filter or enter freely.` |
| 283   | `API-Key`                                                                      | `API key`                                                               |
| 289   | `leer lassen = Key behalten`                                                   | `leave empty to keep the key`                                           |
| 312   | `Speichern…` / `Speichern` / `Anlegen`                                         | `Saving…` / `Save` / `Create`                                           |
| 324   | `Teste…` / `Verbindung testen`                                                 | `Testing…` / `Test connection`                                          |
| 334   | `Abbrechen`                                                                    | `Cancel`                                                                |
| 342   | `Deine Konfigurationen`                                                        | `Your configurations`                                                   |
| 345   | `Noch keine Konfiguration angelegt.`                                           | `No configurations yet.`                                                |
| 362   | `Key hinterlegt`                                                               | `Key stored`                                                            |
| 376   | `Bearbeiten`                                                                   | `Edit`                                                                  |
| 388   | `Löschen`                                                                      | `Delete`                                                                |

- [ ] **Step 3: Verifizieren + Commit**

Run: `grep -nE "ä|ö|ü|ß" src/components/models/ModelConfigManager.tsx`
Expected: Treffer nur in Kommentaren
Run: `npm run test` → Expected: PASS, 198 Tests

```bash
git add src/components/models/ModelConfigManager.tsx
git commit -m "feat(models): ModelConfigManager-Copy englisch"
```

### Task 7: `PersonaCatalog.tsx` — EN

**Files:**

- Modify: `src/components/personas/PersonaCatalog.tsx` (nur Strings)

**Interfaces:**

- Consumes: —
- Produces: unveränderte Props (`PersonaCatalog({ initialPersonas, loadError })`)

- [ ] **Step 1: Übersetzungstabelle anwenden (keine Klassen-Änderungen)**

| Zeile   | Deutsch (Bestand)                                                                                                       | Englisch (neu)                                                                                                         |
| ------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 141–144 | `Mind. ein Eintrag (§1)` … `(§4)`                                                                                       | `At least one entry (§1)` … `(§4)`                                                                                     |
| 244     | `` `${persona.name} (Kopie)` ``                                                                                         | `` `${persona.name} (copy)` ``                                                                                         |
| 297     | `Diese Persona löschen?`                                                                                                | `Delete this persona?`                                                                                                 |
| 322     | `Neue Persona`                                                                                                          | `New persona`                                                                                                          |
| 338     | `Freitext`                                                                                                              | `Freeform`                                                                                                             |
| 351     | `Strukturiert`                                                                                                          | `Structured`                                                                                                           |
| 362     | `z. B. Skeptiker`                                                                                                       | `e.g. Skeptic`                                                                                                         |
| 369     | `Beschreibung`                                                                                                          | `Description`                                                                                                          |
| 377     | `Wofür ist diese Persona da? (optional)`                                                                                | `What is this persona for? (optional)`                                                                                 |
| 390     | `kommagetrennt, z. B. review, kritisches-denken`                                                                        | `comma-separated, e.g. review, critical-thinking`                                                                      |
| 398     | `System-Prompt`                                                                                                         | `System prompt`                                                                                                        |
| 406     | `Der System-Prompt, der diese Persona aktiviert…`                                                                       | `The system prompt that activates this persona…`                                                                       |
| 421–422 | `Strukturiert nach Spec (§§1–4 Pflicht, §§5–6 optional). Ein Eintrag pro Zeile. Der System-Prompt wird daraus erzeugt.` | `Structured per spec (§§1–4 required, §§5–6 optional). One entry per line. The system prompt is generated from these.` |
| 426     | `§1 Kerndenken`                                                                                                         | `§1 Core thinking`                                                                                                     |
| 436     | `§2 Stimme`                                                                                                             | `§2 Voice`                                                                                                             |
| 444     | `§3 Entscheidungsfilter`                                                                                                | `§3 Decision filters`                                                                                                  |
| 453     | `§4 Bekannte Risiken`                                                                                                   | `§4 Known risks`                                                                                                       |
| 462     | `§5 Stimme in Aktion`                                                                                                   | `§5 Voice in action`                                                                                                   |
| 476     | `§6 Nutzung`                                                                                                            | `§6 Usage`                                                                                                             |
| 496     | `Anlegen…` / `Anlegen`                                                                                                  | `Creating…` / `Create`                                                                                                 |
| 506     | `Zurücksetzen`                                                                                                          | `Reset`                                                                                                                |
| 515     | `Filter:`                                                                                                               | `Filter:` (bleibt)                                                                                                     |
| 528     | `Alle`                                                                                                                  | `All`                                                                                                                  |
| 552     | `Katalog`                                                                                                               | `Catalog`                                                                                                              |
| 555     | `Noch keine Persona angelegt.` / `Keine Persona mit diesem Tag.`                                                        | `No personas yet.` / `No persona with this tag.`                                                                       |
| 575     | `Privat`                                                                                                                | `Private`                                                                                                              |
| 581     | `Strukturiert` (Badge)                                                                                                  | `Structured`                                                                                                           |
| 613     | `Kopieren`                                                                                                              | `Duplicate`                                                                                                            |
| 625     | `Anpassen`                                                                                                              | `Adapt`                                                                                                                |
| 635–636 | `Auf privat schalten (nur du siehst sie)` / `Auf global schalten (org-weit sichtbar)`                                   | `Set to private (only you can see it)` / `Set to global (visible org-wide)`                                            |
| 644     | `Privat` / `Global` (Toggle)                                                                                            | `Private` / `Global`                                                                                                   |
| 658     | `Löschen`                                                                                                               | `Delete`                                                                                                               |
| 684     | `(ein Eintrag pro Zeile)`                                                                                               | `(one entry per line)`                                                                                                 |

- [ ] **Step 2: Verifizieren + Commit**

Run: `grep -nE "ä|ö|ü|ß" src/components/personas/PersonaCatalog.tsx`
Expected: Treffer nur in Kommentaren
Run: `npm run test` → Expected: PASS, 198 Tests

```bash
git add src/components/personas/PersonaCatalog.tsx
git commit -m "feat(personas): PersonaCatalog-Copy englisch"
```

### Task 8: `RunRunner.tsx` — EN + Mono-Fortschritt

**Files:**

- Modify: `src/components/runs/RunRunner.tsx` (Strings + tabular-nums-Klassen)

**Interfaces:**

- Consumes: `formatDateTime`/`formatDuration` (en-GB seit Task 1)
- Produces: unveränderte Props (`RunRunner({ initialRuns, personas, modelConfigs, loadError })`)

- [ ] **Step 1: Übersetzungstabelle anwenden**

| Zeile         | Deutsch (Bestand)                                                                                        | Englisch (neu)                                                                                                     |
| ------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 81            | `Wartet`                                                                                                 | `Pending`                                                                                                          |
| 86            | `Läuft`                                                                                                  | `Running`                                                                                                          |
| 91            | `Fertig`                                                                                                 | `Completed`                                                                                                        |
| 96            | `Fehlgeschlagen`                                                                                         | `Failed`                                                                                                           |
| 142, 202, 210 | `Laufliste konnte nicht geladen werden. Bitte neu laden.`                                                | `Couldn't load the run list. Please reload.`                                                                       |
| 239, 314      | `Unerwartete Server-Antwort.`                                                                            | `Unexpected server response.`                                                                                      |
| 276           | `Persona und Modellkonfiguration wählen.`                                                                | `Select a persona and a model configuration.`                                                                      |
| 280           | `` `Wiederholungen müssen zwischen ${…} und ${…} liegen.` ``                                             | `` `Repetitions must be between ${…} and ${…}.` ``                                                                 |
| 285           | `Gegenspieler-Modell wählen.`                                                                            | `Select an adversary model.`                                                                                       |
| 289           | `` `Runden müssen zwischen ${…} und ${…} liegen.` ``                                                     | `` `Rounds must be between ${…} and ${…}.` ``                                                                      |
| 372           | `Lauf abbrechen? Alle bereits erhobenen Messdaten gehen verloren.`                                       | `Cancel this run? All measurement data collected so far will be lost.`                                             |
| 381           | `Diesen Lauf löschen?`                                                                                   | `Delete this run?`                                                                                                 |
| 423           | `Neuer Lauf`                                                                                             | `New run`                                                                                                          |
| 430–438       | `Ein Lauf braucht mindestens eine {Persona} und eine {Modellkonfiguration}.`                             | `A run needs at least one {persona} and one {model configuration}.` (Link-Texte: `persona`, `model configuration`) |
| 445           | `Test-Typ`                                                                                               | `Test type`                                                                                                        |
| 457           | `Persönlichkeit (OEJTS)`                                                                                 | `Personality (OEJTS)`                                                                                              |
| 460           | `Standhaftigkeit`                                                                                        | `Steadfastness`                                                                                                    |
| 488           | `Modellkonfiguration`                                                                                    | `Model configuration`                                                                                              |
| 511           | `Gegenspieler-Modell (Manipulator + Generator)`                                                          | `Adversary model (manipulator + generator)`                                                                        |
| 531           | `Max. Runden je Fakt`                                                                                    | `Max. rounds per fact`                                                                                             |
| 555           | `Fakten` / `Wiederholungen`                                                                              | `Facts` / `Repetitions`                                                                                            |
| 592           | `Starte…` / `Lauf aktiv…` / `Lauf starten`                                                               | `Starting…` / `Run active…` / `Start run`                                                                          |
| 602           | `Lauf läuft…`                                                                                            | `Run in progress…`                                                                                                 |
| 614           | `Abbrechen`                                                                                              | `Cancel`                                                                                                           |
| 618–619       | `{…} von {…} Wiederholungen` / `` ` · ${…} fehlgeschlagen` ``                                            | `{…} of {…} repetitions` / `` ` · ${…} failed` ``                                                                  |
| 622           | `Generiere Szenarien…`                                                                                   | `Generating scenarios…`                                                                                            |
| 625–627       | `Fakt {…}/{…}` / `` ` · Runde ${…}` `` / `` ` · Strategie: ${…}` ``                                      | `Fact {…}/{…}` / `` ` · round ${…}` `` / `` ` · strategy: ${…}` ``                                                 |
| 631           | `Tokens: {…} ein / {…} aus`                                                                              | `Tokens: {…} in / {…} out`                                                                                         |
| 635           | `Letzte Wiederholung {…} · Modell-Zeit gesamt {…}`                                                       | `Last repetition {…} · total model time {…}`                                                                       |
| 638           | `Letzter Fehler:`                                                                                        | `Last error:`                                                                                                      |
| 652           | `Deine Läufe`                                                                                            | `Your runs`                                                                                                        |
| 655           | `Noch kein Lauf gestartet.`                                                                              | `No runs yet.`                                                                                                     |
| 668           | `Standhaftigkeit` (Badge)                                                                                | `Steadfastness`                                                                                                    |
| 678           | `Privat`                                                                                                 | `Private`                                                                                                          |
| 682           | `{…}/{…} Wiederholungen`                                                                                 | `{…}/{…} repetitions`                                                                                              |
| 686           | `Ausgeführt: {…} · Fehlquote: {…}`                                                                       | `Executed: {…} · Failure rate: {…}`                                                                                |
| 697           | `Für Vergleich auswählen (max. 2)`                                                                       | `Select for comparison (max. 2)`                                                                                   |
| 709           | `Vergleichen`                                                                                            | `Compare`                                                                                                          |
| 720           | `Ergebnis`                                                                                               | `Result`                                                                                                           |
| 732–733       | `Auf privat schalten (nur du siehst ihn)` / `Auf global schalten (org-weit sichtbar)`                    | `Set to private (only you can see it)` / `Set to global (visible org-wide)`                                        |
| 741           | `Privat` / `Global` (Toggle)                                                                             | `Private` / `Global`                                                                                               |
| 756           | `Löschen`                                                                                                | `Delete`                                                                                                           |
| 772–773       | `Zwei Läufe gewählt — bereit zum Vergleich.` / `Ein Lauf gewählt — wähle einen zweiten zum Vergleichen.` | `Two runs selected — ready to compare.` / `One run selected — select a second one to compare.`                     |
| 785           | `Auswahl aufheben`                                                                                       | `Clear selection`                                                                                                  |
| 797           | `Vergleichen`                                                                                            | `Compare`                                                                                                          |

- [ ] **Step 2: tabular-nums auf Zahlen-Zeilen (einziger leichter
      Editorial-Akzent der Arbeitsflächen)**

```tsx
// Z.617 — Fortschritts-Zähler:
<p className="text-muted-foreground text-sm tabular-nums">

// Z.624, 630, 634 — Detail-Zeilen (Fakt/Runde, Tokens, Zeiten):
<p className="text-muted-foreground text-xs tabular-nums">

// Z.681 — Wiederholungs-Zähler in der Liste:
<span className="text-muted-foreground text-sm tabular-nums">

// Z.685 — Meta-Zeile der Liste:
<p className="text-muted-foreground mt-1 text-xs tabular-nums">
```

- [ ] **Step 3: Verifizieren + Commit**

Run: `grep -nE "ä|ö|ü|ß" src/components/runs/RunRunner.tsx`
Expected: Treffer nur in Kommentaren
Run: `npm run test` → Expected: PASS, 198 Tests

```bash
git add src/components/runs/RunRunner.tsx
git commit -m "feat(runs): RunRunner-Copy englisch, Fortschritts-Zahlen tabular-nums"
```

### Task 9: `AuthCardHeader.astro` extrahieren

**Files:**

- Create: `src/components/auth/AuthCardHeader.astro`
- Modify: `src/pages/auth/signin.astro:11-12`, `src/pages/auth/signup.astro:11-12`,
  `src/pages/auth/confirm-email.astro:53-56`

**Interfaces:**

- Consumes: —
- Produces: `AuthCardHeader` mit Props `heading: string`,
  `variant?: "form" | "message"` (Default `"form"`)

- [ ] **Step 1: Komponente anlegen**

```astro
---
/**
 * Auth-Karten-Kopf: Mono-Eyebrow „account" + Serif-Headline (Stufe-A-Sprache),
 * vorher 3x dupliziert in signin/signup/confirm-email.
 * variant "form" (signin/signup): explizit zentriert, mb-6 unter der Headline.
 * variant "message" (confirm-email): erbt die Zentrierung der Karte, mb-3.
 */
interface Props {
  heading: string;
  variant?: "form" | "message";
}
const { heading, variant = "form" } = Astro.props;
const isForm = variant === "form";
---

<p class:list={["text-muted-foreground mb-2 font-mono text-xs tracking-[0.2em] uppercase", isForm && "text-center"]}>
  account
</p>
<h1 class:list={["font-display text-foreground text-3xl", isForm ? "mb-6 text-center" : "mb-3"]}>
  {heading}
</h1>
```

- [ ] **Step 2: Drei Seiten umstellen**

```astro
<!-- signin.astro: Zeilen 11-12 ersetzen durch -->
<AuthCardHeader heading="Sign in" />
<!-- signup.astro: Zeilen 11-12 ersetzen durch -->
<AuthCardHeader heading="Sign up" />
<!-- confirm-email.astro: Zeilen 53-56 ersetzen durch -->
<AuthCardHeader heading={content.heading} variant="message" />
```

Jeweils im Frontmatter importieren:
`import AuthCardHeader from "@/components/auth/AuthCardHeader.astro";`

- [ ] **Step 3: Verifizieren (gleiche Klassenmenge je Seite)**

`npm run dev` → `/auth/signin`, `/auth/signup`, `/auth/confirm-email`
optisch identisch zum Bestand (Light + Dark). E2E-Heading „Sign in" behält
seinen Accessible Name.
Run: `npm run test:e2e` → Expected: 4/4 PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/auth/AuthCardHeader.astro src/pages/auth/signin.astro src/pages/auth/signup.astro src/pages/auth/confirm-email.astro
git commit -m "refactor(auth): AuthCardHeader extrahiert — 3x dupliziertes Eyebrow/Serif-Markup zentralisiert"
```

### Task 10: PR-2-Verifikation + Einsprachigkeits-Check + PR

**Files:** keine neuen Änderungen (nur Verifikation + PR)

- [ ] **Step 1: Einsprachigkeits-Restprüfung (Spec-Verifikation Nr. 6)**

```bash
grep -rniE "ä|ö|ü|ß" src/components --include="*.tsx" --include="*.astro"
```

Expected: Treffer NUR in Kommentar-Zeilen; kein Treffer in JSX-Text,
Strings, `title`, `placeholder`, `aria-*`, `sr-only`.

- [ ] **Step 2: Volle lokale Verifikation**

```bash
npm run test                                            # PASS, 198 Tests
npm run build                                           # exit 0
npx eslint . --rule '{"prettier/prettier":"off"}'       # 0 errors
npm run test:e2e                                        # 4/4
```

- [ ] **Step 3: Sichtprüfung im Dev-Server**

`/models`, `/personas`, `/runs` (Formular, Live-Lauf mit Fortschritt, Liste,
Empty States durch Filterwahl), Auth-Seiten — Light **und** Dark.

- [ ] **Step 4: Push + PR**

```bash
git push -u origin feat/island-design-work
gh pr create --title "feat(app): Arbeitsflaechen englisch + AuthCardHeader (Stufe C)" --body "..."
```

Warten bis `ai-review/verdict` grün, Squash-Merge, danach
`git checkout main && git reset --hard origin/main`. Anschließend
WORKFLOW_STATUS/Checkpoint aktualisieren (Design-Angleich komplett).
