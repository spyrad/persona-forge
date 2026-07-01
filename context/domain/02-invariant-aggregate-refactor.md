---
title: "Invariant-Aggregat-Refaktor — Belastbarkeit als Domänen-Verdikt"
created: 2026-07-01
type: refactor-plan
---

# Invariant-Aggregat-Refaktor — Der Lauf als Wächter der Belastbarkeits-Invariante

> **Produkt dieser Analyse:** ein PLAN, kein Code. Alle Belege sind real mit Grep/Read
> gegen den Code verifizierte `Datei:Zeile`-Zitate. Sprache: Deutsch, Code-Identifier
> englisch. Prior: `context/domain/01-domain-distillation.md` (Aggregat-Kandidaten A1–A9,
> Refaktor-Ranking). Ich habe jede Struktur-Aussage unabhängig am Code nachgeprüft und die
> Drei-Achsen-Wahl selbst getroffen — Übereinstimmung/Abweichung zur Distillation ist unten
> ausgewiesen.

## Overview

persona-forge existiert für **einen** Satz: „Verteilung statt Punktwert" — LLM-Antworten
schwanken, deshalb ist erst die Verteilung über N Wiederholungen mit Streuung aussagekräftig
(`context/foundation/prd.md:40-42`). Der zugehörige, als **einziger** unverletzlich markierte
Guardrail lautet: _„Der Methodenkern ist unverletzlich: ein Einzeldurchlauf wird nie als
belastbarer Wert dargestellt"_ (`prd.md:80-82`).

Dieser Plan hebt genau diese Invariante — **Belastbarkeit (Reliability)** — aus der UI, wo sie
heute allein lebt, in die **Domäne**, sodass jede Schicht (Service, API-Response, Einzel- und
Vergleichs-Ansicht, künftige Exporte) denselben Wächter erbt und kein Konsument ein
unbelastbares Ergebnis stillschweigend als belastbar behandeln kann.

---

## KROK 0 — Kontext & Schichten (verifiziert)

Der fachliche Kern liegt I/O-frei in `src/lib/runs/*` und ist unit-testbar. Die Belastbarkeits-Regel
müsste dort leben — tut sie aber nicht. Verifizierte Schichten des Run-Flows:

| Schicht           | Ort (verifiziert)                                                                | Trägt Belastbarkeit?                                                               |
| ----------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------ | --------------------------------------- |
| **API / Route**   | `src/pages/api/runs/index.ts`, `[id].ts`, `[id]/step.ts`, `[id]/result.ts`       | **Nein.** `result.ts:23` serialisiert `getRunResult` roh.                          |
| **Service**       | `src/lib/services/runs.ts` (`getRunResult:192-206`, `processNextRepetition:304`) | **Nein.** `state` kennt nur `ready/empty/unfinished` (`runs.ts:205`).              |
| **Domäne** (rein) | `src/lib/runs/oejts-aggregate.ts`, `oejts-score.ts`                              | **Nein.** Grep `belastbar                                                          | reliab | RELIABLE`über`src/lib` → **0 Treffer.** |
| **UI** (Inseln)   | `src/components/runs/RunResult.tsx`, `RunComparison.tsx`, `axis-chart.tsx`       | **Ja — ausschließlich hier.** `RELIABLE_MIN = 2` (`axis-chart.tsx:14`).            |
| **Persistenz**    | `supabase/migrations/20260617190000_runs.sql`                                    | **Nein.** `check (repetition_count between 1 and 25)` (`runs.sql:25`) erlaubt N=1. |

**Kernbefund:** Der einzige Ort im gesamten `src/lib`-Baum, der das Wort/Konzept „belastbar"
kennt, ist — keiner. Die Belastbarkeit ist ein reines Präsentations-Artefakt (`axis-chart.tsx:14`).

---

## KROK 1 — Geschäfts-Invarianten (Discovery)

Aus PRD + Code destilliert; Quelle je Zeile zitiert. Legende Erzwingung: **E** = real erzwungen,
**D** = nur deklariert/Konvention, **U** = nur im Client (UI) bewacht.

| #      | Invariante (muss IMMER wahr sein)                                                                                                             | Quelle                                           | Erzwingung heute                                                                                                                    |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| **I1** | **Ein Ergebnis wird nie als _belastbar_ dargestellt, wenn es aus < N_min verwertbaren Wiederholungen stammt** (Einzeldurchlauf ≠ Disposition) | `prd.md:80-82`, `prd.md:40-42`, `prd.md:100-102` | **U** — nur `RELIABLE_MIN=2` in `axis-chart.tsx:14`, konsumiert in `RunResult.tsx:17,103`, `RunComparison.tsx:97`                   |
| I2     | **Kein erfundener Wert bei Lücke** (achsen-weiser Dropout → `null`, nicht 0/geraten)                                                          | `prd.md:81-82`                                   | **E** — `scoreAxes` bricht auf `null` (`oejts-score.ts:37-43`); `mean/sd=null` (`oejts-aggregate.ts:52-53`)                         |
| I3     | **Lauf ist selbst-enthalten** (Persona-Prompt als Snapshot, reproduzierbar trotz späterem Löschen)                                            | `prd.md:199-200`                                 | **E** — `persona_prompt_snapshot text not null` (`runs.sql:23`), Insert `runs.ts:126`, FKs `on delete set null` (`runs.sql:21-22`)  |
| I4     | **Abbruch verwirft den Lauf vollständig** (keine Teilverteilung)                                                                              | `prd.md:178`, `prd.md:103`                       | **E** — DELETE + `on delete cascade` (`runs.sql:57`), `deleteRun` (`runs.ts:145-149`), `RunRunner.tsx:319-325`                      |
| I5     | **Status-Monotonie** `pending→running→completed/failed`; terminal idempotent; `failed` nur bei 0 verwertbar                                   | `prd.md:196-198`                                 | **E (App)** — `processNextRepetition:314-345`; DB prüft nur Enum-Werte (`runs.sql:26`), nicht die Reihenfolge                       |
| I6     | **Deterministisches Scoring** — dieselben Rohantworten → identische Aggregate                                                                 | `prd.md:199-200`                                 | **E (stärker als gefordert)** — On-the-fly, nie persistiert (`runs.ts:200-205`); reine Funktionen `oejts-aggregate.ts`              |
| I7     | **Jedes Item gehört zu genau einer Achse; Scoring-Schlüssel vollständig/konsistent**                                                          | `prd.md:281-286`, FR-011                         | **D** — nur `satisfies Instrument` (`oejts.ts:96`), keine Laufzeit-/Test-Invariante über Achsen-Vollzähligkeit                      |
| I8     | **API-Key nie Klartext at rest, verlässt nie den Server**                                                                                     | `prd.md:79,140`, `prd.md:203-204`                | **E** — `VIEW_COLUMNS` selektiert Key nie (`model-configs.ts:28-29`); AES-GCM (`crypto.ts`)                                         |
| I9     | **Persona-Inhalt unveränderlich** (Änderung = Kopie)                                                                                          | `prd.md:149` (FR-008)                            | **D** — Service ohne Inhalts-Update; DB-Policy `personas_update_own` öffnet seit S-07 aber jede Spalte (`20260620092033_...:10-13`) |
| I10    | **Token-Verbrauch zählt ALLE real verbrauchten Tokens** (auch fehlgeschlagene Reps)                                                           | `prd.md:181` (FR-015)                            | **E** — `runs.ts:444-451`                                                                                                           |
| I11    | **Eindeutigkeit je (Lauf, rep_index)** — Doppelaufruf schreibt nicht doppelt                                                                  | FR-012 (Isolation)                               | **E** — `unique (run_id, rep_index)` (`runs.sql:68`), 23505-Toleranz (`runs.ts:422-437`)                                            |

---

## KROK 2 — Klassifikation (3 Achsen) und Wahl von #1

Jede Invariante auf drei Achsen bewertet: **(a) Kern-Nähe** (Bezug auf Vision/Success Criteria),
**(b) Schicht-Verschmierung** (in wie vielen Dateien/Schichten die Regel lebt bzw. leben müsste,
aber nicht wird erzwungen), **(c) Erzwingungs-Härte** (E > D > U).

| #      | (a) Kern-Nähe                                                               | (b) Verschmierung                                                                                                          | (c) Härte                | Score (Wert × Schwäche)              |
| ------ | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------ |
| **I1** | **Höchst** — _ist_ der Produkt-Insight + einziger „unverletzlich"-Guardrail | **Hoch** — Konzept oben deklariert, nur am UI-Blatt realisiert; dort dreifach dupliziert (2 Granularitäten, 3 Komponenten) | **U** — schwächste Stufe | **★ höchst × schwächst**             |
| I2     | Hoch                                                                        | Konzentriert (Domäne)                                                                                                      | E                        | niedrig (bereits erzwungen)          |
| I3     | Hoch                                                                        | Konzentriert (DB+Service)                                                                                                  | E                        | niedrig                              |
| I5     | Mittel (Resilienz-NFR)                                                      | Mittel (App-Funktion)                                                                                                      | E(App)                   | mittel                               |
| I7     | Hoch (falsches Scoring korrumpiert alles)                                   | Niedrig (1 Datei, statisch)                                                                                                | D                        | mittel (aber Daten statisch/geprüft) |
| I9     | Mittel-hoch (Supporting-Subdomäne)                                          | Mittel (App vs. DB)                                                                                                        | D                        | mittel                               |

### Wahl: **I1 — Belastbarkeit** ist #1

I1 maximiert **beide** geforderten Achsen gleichzeitig: **am kern-nächsten** (kein anderer
Guardrail ist als „unverletzlich" markiert, `prd.md:80`; kein anderer Satz _ist_ der Daseinsgrund
des Produkts, `prd.md:40-42`) **und am schwächsten erzwungen** (Stufe **U** — eine Konstante in
einer Chart-Komponente, `axis-chart.tsx:14`). Alle stark erzwungenen Invarianten (I2/I3/I4/I6/I8/
I10/I11) sind keine sinnvollen Refaktor-Ziele. I7 und I9 sind schwach erzwungen, aber kern-ferner
(I7 statische Daten, I9 Supporting-Subdomäne) — sie bleiben #2/#3 (siehe Distillation-Ranking).

### Übereinstimmung mit der Distillation — mit einer Design-Korrektur

Ich **stimme** der Distillation zu, dass A2/I1 das #1-Ziel ist. Ich **widerspreche** ihrem
Design-Vorschlag in einem Punkt: die Distillation skizziert `RunResultView.state` bekommt einen
neuen Wert `unreliable` (`01-domain-distillation.md:189`). Das ist falsch: `state`
(`ready/empty/unfinished`, `types.ts:334-338`) ist ein **Render-Diskriminator**, der entscheidet,
_welche_ Ansicht rendert. Belastbarkeit ist dazu **orthogonal** — ein unbelastbarer Lauf hat sehr
wohl eine (kaveatierte) Verteilung zu zeigen; er ist kein eigener Render-Zweig. Ein vierter
`state`-Wert würde die Verteilung fälschlich unterdrücken. Deshalb modelliere ich Belastbarkeit als
eigenständiges, domänen-berechnetes **Verdikt** am Aggregat (`RunAggregate.reliability`), nicht als
`state`. Das ist die eigene Design-Entscheidung dieses Plans.

---

## KROK 3 — Diagnose der gewählten Invariante

### Wo die Regel heute lebt (alle Schichten)

**Nur UI, und dort dreifach:**

1. **Die Schwelle selbst** — eine Magic-Konstante in einer _Chart_-Komponente:
   `export const RELIABLE_MIN = 2;` (`axis-chart.tsx:14`).
2. **Run-weit** — `const lowReliability = aggregate.usableReps < RELIABLE_MIN;`
   (`RunResult.tsx:103`), rendert das prominente Banner „_Nicht belastbar: ein Einzeldurchlauf …
   ist kein aussagekräftiges Dispositionsprofil_" (`RunResult.tsx:144-152`).
3. **Achsen-weit** — `const reliable = axis.usableCount >= RELIABLE_MIN;` (`RunResult.tsx:17`),
   rendert je Achse „_Nicht belastbar — zu wenige verwertbare Läufe_" (`RunResult.tsx:52-57`);
   dieselbe Schwelle nochmals in `RunComparison.tsx:97-99`.

### Welche Schichten die Regel NICHT erzwingen (Belege)

- **Domäne:** `aggregateRun` liefert für N=1 ein voll gültiges Aggregat — `mean` gesetzt, `sd=0`,
  `usableReps=1` (`oejts-aggregate.ts:52-53,95`). Der bestehende Test hält das sogar fest:
  _„N=1 → usableReps 1, sd 0 (Belastbarkeits-Warnung ist UI-Sache)"_ (`oejts-aggregate.test.ts:73`).
  Das Aggregat hat **kein** Feld, das Belastbarkeit ausdrückt (`RunAggregate`, `types.ts:318-326`).
- **Service:** `getRunResult` gibt für **eine einzige** verwertbare Wiederholung
  `state: 'ready'` zurück — `state: aggregate.usableReps === 0 ? "empty" : "ready"`
  (`runs.ts:205`). Kein Belastbarkeits-Signal im `RunResultView` (`types.ts:334-338`).
- **API:** `GET /api/runs/[id]/result` serialisiert dieses `RunResultView` roh an **jeden**
  Client (`result.ts:23-24`) — ein zweiter Konsument (Skript, künftiger Export) erhielte ein
  `ready`-Ergebnis ganz ohne Belastbarkeits-Hinweis.
- **Eingang/DB:** `repetitionCount` wird ab **1** akzeptiert — zod `.int().min(1).max(25)`
  (`api/runs/index.ts:13`), DB `check (repetition_count between 1 and 25)` (`runs.sql:25`).

### Wo der Client der EINZIGE Wächter ist — und inkonsistent

- **Inkonsistenz zwischen den zwei UI-Oberflächen:** Die Einzelansicht `RunResult` zeigt das
  **run-weite** Banner (`RunResult.tsx:144-152`). Die Vergleichsansicht `RunComparison` zeigt
  **nur** den achsen-weiten Kleintext „nicht belastbar (n<2)" (`RunComparison.tsx:97-99`) — das
  run-weite Banner fehlt dort. Der `TypeBanner` (`RunComparison.tsx:47-80`) behauptet sogar
  „**Gleicher Typ**" / „**Unterschiedliche Typen**" **ohne** jede Belastbarkeits-Prüfung — er kann
  eine Typ-Gleichheits-Aussage auf zwei Einzeldurchlauf-Zufällen aufbauen. Damit zeigt die
  Vergleichs-Oberfläche **weniger** Guardrail als die Einzelansicht.
- **Die Liste kann es gar nicht:** `RunView` trägt kein `usableReps` (Kommentar bestätigt:
  `RunRunner.tsx:135-136`), deshalb hängt der Vergleichs-Haken allein an `status === "completed"`
  (`RunRunner.tsx:556`). Zwei Läufe mit je 1 verwertbaren Rep sind ohne jedes Signal
  vergleichbar auswählbar.

### Wo ein Fehler „verschluckt" statt gestoppt wird

Kein „log-and-continue" im klassischen Sinn — schlimmer: die illegale **Darstellung** eines
Einzelwerts als belastbar wird gar nicht erst als Fehler behandelt. Der Guardrail ist Kosmetik;
ein Konsument, der `state==='ready'` sieht, hat **keinen** typisierten Weg zu erfahren, dass das
Ergebnis unbelastbar ist. Die „illegale Operation" ist hier: _ein unbelastbares Aggregat als
belastbares Dispositionsprofil konsumieren_ — und die fehlt jede Absicherung.

---

## KROK 4 — Design des Aggregat-Wächters

### Aggregat-Root und Grenze

Der **Lauf (Run)** ist die Aggregat-Wurzel; `run_repetitions` sind seine Children (bestätigt:
`runs.sql:55-69`, RLS erbt über Parent-Subquery `runs.sql:76-83`). Die Belastbarkeit ist ein aus
den Children **abgeleitetes Verdikt** — es entsteht genau dort, wo `usableReps`/`usableCount`
entstehen: in der reinen Aggregation. Es wird **nicht** persistiert (bewahrt I6, `runs.ts:200`;
Rozjazd #6 der Distillation). Der Wächter ist also ein **Read-Side-Verdikt am Aggregat plus ein
gehüteter Accessor** für Konsumenten, deren Vertrag Belastbarkeit _verlangt_ — kein
Transaktions-Wächter (Atomarität ist für diese Invariante nicht der Druckpunkt; ehrlich benannt,
im Gegensatz zu I5).

### 4.1 Domänen-Konstante + Verdikt (Single Source, in der Domäne)

**Datei (neu):** `src/lib/runs/reliability.ts` — reine Logik, I/O-frei (wie `oejts-score.ts`).

```ts
/** Mindestzahl verwertbarer Wiederholungen, ab der ein Ergebnis als belastbar gilt
 *  (Methodenkern-Guardrail prd.md:80-82). Single Source — ersetzt RELIABLE_MIN. */
export const MIN_RELIABLE_REPS = 2;

export type ReliabilityLevel = "reliable" | "unreliable";

/** Verdikt am Lauf-Aggregat: run-weit + je Achse, aus einer Schwelle abgeleitet. */
export interface ReliabilityVerdict {
  level: ReliabilityLevel; // run-weit: usableReps >= MIN_RELIABLE_REPS
  usableReps: number;
  threshold: number; // == MIN_RELIABLE_REPS (mitgeliefert, kein Magic-Wert im Client)
  perAxisReliable: Record<string, boolean>; // key → usableCount >= threshold
}

/** Reines Verdikt aus den bereits berechneten Achsen-Verteilungen + usableReps. */
export function classifyReliability(
  usableReps: number,
  axes: { key: string; usableCount: number }[],
): ReliabilityVerdict {
  /* … pure, deterministisch … */
}
```

### 4.2 Verdikt am Aggregat erzwingen (Domäne bleibt einziger Rechen-Ort)

**Datei:** `src/lib/runs/oejts-aggregate.ts` — `aggregateRun` hängt das Verdikt an, sobald
`usableReps`/`usableCount` feststehen (`oejts-aggregate.ts:41-97`). `RunAggregate`
(`types.ts:318-326`) erhält ein Pflichtfeld `reliability: ReliabilityVerdict`; `AxisDistribution`
(`types.ts:297-315`) erhält abgeleitet `reliable: boolean`. Damit ist das Verdikt strukturell
untrennbar vom Aggregat — kein Konsument kann ein Aggregat halten **ohne** das Verdikt.

### 4.3 Benannter Domänen-Fehler + gehüteter Accessor (Fail-fast)

Für Konsumenten, deren Vertrag ein _belastbares_ Profil verlangt (heute konkret: die
Typ-Gleichheits-Aussage im Vergleich, `RunComparison.tsx:47-80`; künftig Export/Attestierung),
gibt es einen **gehüteten Zugriff**, der nicht still einen Wert liefert, sondern wirft:

```ts
export class UnreliableRunError extends Error {
  constructor(readonly verdict: ReliabilityVerdict) {
    super(`run result is not reliable: ${verdict.usableReps} usable reps < ${verdict.threshold}`);
    this.name = "UnreliableRunError";
  }
}

/** Liefert das Aggregat NUR, wenn belastbar; sonst benannter Domänen-Fehler
 *  (statt still ein unbelastbares Profil als belastbar auszugeben). */
export function reliableAggregateOrThrow(agg: RunAggregate): RunAggregate {
  if (agg.reliability.level === "unreliable") throw new UnreliableRunError(agg.reliability);
  return agg;
}
```

Die **Präzedenz** (Precondition) ist explizit: `reliability.level === "reliable"`. Illegale
Operation (belastbares Profil aus unbelastbarem Lauf verlangen) → **stoppt** mit
`UnreliableRunError`, statt still Zustand/Anzeige zu produzieren.

### 4.4 Service/Repository: Verdikt durchreichen, nicht neu erfinden

`getRunResult` (`runs.ts:192-206`) lädt den Lauf bereits über **einen** RLS-gescopten Pfad
(`getRun` + eine `run_repetitions`-Query, `runs.ts:200`). Es rechnet **nichts** über Belastbarkeit —
es reicht `aggregate.reliability` durch. `RunResultView` (`types.ts:334-338`) behält `state`
unverändert (Render-Diskriminator); Belastbarkeit liest der Konsument aus `aggregate.reliability`.
Keine neue Query, keine Transaktion, keine Persistenz — das Aggregat bleibt on-the-fly (I6 gewahrt).

### 4.5 Dünne API/UI: Verdikt konsumieren statt selbst schwellen

- **API:** `result.ts:23` serialisiert `RunResultView` unverändert — das Verdikt reist jetzt als
  Teil von `aggregate.reliability` mit; ein Zweitclient erbt den Guardrail automatisch.
- **UI:** `RunResult.tsx`/`RunComparison.tsx` importieren **nicht mehr** `RELIABLE_MIN` und rechnen
  **keine** Schwelle mehr; sie lesen `aggregate.reliability.level` (run-weit) und
  `axis.reliable` (je Achse). `axis-chart.tsx:14` verliert die Konstante (oder re-exportiert sie aus
  der Domäne als Deprecation-Brücke). Der `TypeBanner` (`RunComparison.tsx:47-80`) ruft den
  gehüteten Pfad bzw. prüft `reliability.level` und zeigt bei `unreliable` eine Kaveat-Variante
  statt einer belastbaren „Gleicher Typ"-Aussage — die Erzwingung wandert vom bloßen Vorhandensein
  eines Banners in eine echte, überall gleiche Verzweigung.

---

## KROK 5 — Before/After, Phasen-Plan, Tests

### Before/After je heutigem Ort der Regel

| Ort heute                       | Before                                                            | After                                                                                                       |
| ------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `axis-chart.tsx:14`             | `export const RELIABLE_MIN = 2` (Magic in Chart-Komponente)       | Konstante lebt in `src/lib/runs/reliability.ts` als `MIN_RELIABLE_REPS`; Chart importiert nichts Fachliches |
| `oejts-aggregate.ts:41-97`      | Aggregat ohne Belastbarkeit                                       | `aggregateRun` hängt `reliability` an; `AxisDistribution.reliable` gesetzt                                  |
| `types.ts:318-326` / `:297-315` | `RunAggregate`/`AxisDistribution` ohne Verdikt                    | Pflichtfelder `reliability` / `reliable`                                                                    |
| `runs.ts:205`                   | `state: usableReps===0 ? 'empty' : 'ready'` (Belastbarkeit fehlt) | unverändert; Verdikt reist in `aggregate.reliability` mit                                                   |
| `RunResult.tsx:17,103`          | lokale Schwelle `>= RELIABLE_MIN` / `< RELIABLE_MIN`              | liest `axis.reliable` / `aggregate.reliability.level`                                                       |
| `RunComparison.tsx:97`          | achsen-weiter Kleintext, run-weites Banner **fehlt**              | run-weites Verdikt konsumiert; `TypeBanner` prüft Belastbarkeit                                             |
| `result.ts:23` (API)            | `ready`-JSON ohne Belastbarkeits-Signal                           | Verdikt im Body (`aggregate.reliability`)                                                                   |
| `oejts-aggregate.test.ts:73`    | Test-Kommentar „Belastbarkeits-Warnung ist UI-Sache"              | Test asserted jetzt `reliability.level === 'unreliable'` bei N=1                                            |

### Phasen-Plan (guard-first; Format analog `context/archive/2026-06-30-refactor-opportunities/plan.md`)

**Phase 1 — Domänen-Verdikt landet grün, ohne Konsumenten zu ändern (test-first).**
`reliability.ts` (`MIN_RELIABLE_REPS`, `ReliabilityVerdict`, `classifyReliability`,
`UnreliableRunError`, `reliableAggregateOrThrow`) + Unit-Tests **zuerst rot, dann grün**.
`RunAggregate`/`AxisDistribution` um die Felder erweitern, `aggregateRun` füllt sie. UI liest die
neuen Felder **noch nicht**; `RELIABLE_MIN` bleibt vorerst als Re-Export. Rein additiv, umkehrbar.
_Automated:_ `npm run test`, `npm run build`, `npm run lint` grün.

**Phase 2 — Konsumenten auf das Verdikt umstellen (je Konsument ein Commit).**
`RunResult.tsx` → `axis.reliable` / `aggregate.reliability.level`; `RunComparison.tsx` → run-weites
Verdikt **ergänzen** + `TypeBanner` gegen Belastbarkeit absichern; `axis-chart.tsx:14` Konstante
entfernen. _Automated:_ Grep `RELIABLE_MIN` in `src/components` → 0; Build/Lint/Test grün.
_Manual:_ N=1-Lauf zeigt Banner in **beiden** Ansichten; belastbarer Lauf unverändert.

**Phase 3 (optional) — Fail-fast am Vertragspfad.** Wo eine belastbare Aussage nötig ist
(Typ-Gleichheit im Vergleich; künftiger Export), `reliableAggregateOrThrow` einziehen und
`UnreliableRunError` auf eine erklärende Antwort/Ansicht mappen. Test-first für den geworfenen Fehler.

### Testfälle für die Invariante (legal ↔ illegal)

Node-Vitest, `src/lib/runs/*.test.ts` (bestehende Infra, `oejts-aggregate.test.ts` als Muster):

- **legal:** N=3 ausgewogen → `reliability.level === "reliable"`, `usableReps === 3`, alle
  `perAxisReliable` true (analog `oejts-aggregate.test.ts:28-36`).
- **illegal (Kern-Fall):** N=1 → `reliability.level === "unreliable"`, `threshold === 2`
  (ersetzt/erweitert den Test bei `:73` samt Kommentar).
- **Grenzfall:** exakt N=2 verwertbar → `reliable` (Schwelle inklusiv).
- **achsen-weiser Dropout:** eine Achse `usableCount < 2`, Rest ≥2 →
  `perAxisReliable[k] === false` nur für k; run-weit `reliable`, wenn `usableReps ≥ 2`.
- **0 verwertbar:** `usableReps === 0` → `unreliable` (und `state:'empty'` upstream unverändert).
- **`reliableAggregateOrThrow`:** belastbares Aggregat → gibt es zurück; unbelastbares → wirft
  `UnreliableRunError`, `err.verdict.usableReps` korrekt.
- **Determinismus:** zweimal `classifyReliability` gleiche Eingabe → gleiches Verdikt.

### Load-bearing Namen (Vertrags-relevant)

Das Projekt pinnt Verträge über Compile-Guards (`types.ts:271-275`, `MutualExtends`/`Expect`) statt
über ein separates Register. Neue/geänderte load-bearing Namen:

- `MIN_RELIABLE_REPS` (Domäne) — **ersetzt** `RELIABLE_MIN` (`axis-chart.tsx:14`); der alte Name
  wird Re-Export oder entfällt (load-bearing Rename, Grep-verifizierbar).
- `ReliabilityVerdict`, `ReliabilityLevel`, `classifyReliability`, `reliableAggregateOrThrow`,
  `UnreliableRunError` (`src/lib/runs/reliability.ts`).
- `RunAggregate.reliability`, `AxisDistribution.reliable` (`src/types.ts`) — neue Pflichtfelder;
  ein Compile-Guard analog `_RunViewStatusGuard` kann sichern, dass `reliability.threshold` an
  `MIN_RELIABLE_REPS` gebunden bleibt.

### What We're NOT Doing (bewusste Nicht-Ziele)

- **Kein Block von N=1 bei der Anlage.** `repetitionCount` bleibt ab 1 erlaubt (`api/runs/index.ts:13`,
  `runs.sql:25`): die Belastbarkeit hängt an **verwertbaren** Reps (nach Dropout/Failure), die zur
  Anlagezeit unbekannt sind (Resilienz-NFR `prd.md:196-198`). Die Invariante ist eine
  **Konsum-/Darstellungs**-Regel, keine Eingangs-Schranke.
- **Kein neuer `state`-Wert `unreliable`** — Belastbarkeit ist orthogonal zu `ready/empty/unfinished`
  (Widerspruch zur Distillation, siehe KROK 2).
- **Keine Persistenz des Verdikts** — Aggregat bleibt on-the-fly (I6, `runs.ts:200`).
- **Kein Anfassen von I2/I7/I9** — I7/I9 sind eigene, kern-fernere Refaktoren (#2/#3 im Ranking).
- **Keine Änderung der Schwelle 2** als Zahl — nur ihr **Ort** wandert (UI → Domäne). Ob 2 der
  richtige Wert ist, ist eine Produktfrage außerhalb dieses Refaktors.
- **Keine neue Test-Infra** (kein jsdom) — das Verdikt ist reine Logik, in Node-Vitest testbar.

## References

- Guardrail/Insight: `context/foundation/prd.md:40-42,80-82,100-102,196-200`
- UI-Sitz heute: `src/components/runs/axis-chart.tsx:14`, `RunResult.tsx:17,103,144-152`,
  `RunComparison.tsx:47-80,97-99`
- Domäne/Service: `src/lib/runs/oejts-aggregate.ts:41-97`, `src/lib/services/runs.ts:192-206`
- Typen: `src/types.ts:297-315,318-326,334-338`; API: `src/pages/api/runs/[id]/result.ts:23`
- Prior: `context/domain/01-domain-distillation.md` (A2 = #1, Design-Skizze `:186-192`)
- Format-Referenz: `context/archive/2026-06-30-refactor-opportunities/plan.md`
