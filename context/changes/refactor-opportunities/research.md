---
date: 2026-06-30T18:13:33+02:00
researcher: Damian (via Claude Opus 4.8)
git_commit: 1a3143d845073da00280fe0ebdb26377fcfb4e0c
branch: main
repository: persona-forge
topic: "Refactor opportunities — Ranking der OEJTS-Run-Flow-Schulden (M4L4, Element ④)"
tags: [research, refactor-opportunities, runs, oejts, blast-radius, technical-debt, m4l4, verified]
status: complete
last_updated: 2026-06-30
last_updated_by: Damian (via Claude Opus 4.8)
last_updated_note: "ast-grep-Verifikation der strukturellen Ranking-Claims (M4L4 Schritt 2) — §7 ergänzt, Zahlen präzisiert"
verification_commit: 1a3143d845073da00280fe0ebdb26377fcfb4e0c
prior: context/changes/run-flow-analysis/research.md
---

# Research: Refactor opportunities (Element ④, M4L4)

**Date**: 2026-06-30T18:13:33+02:00
**Researcher**: Damian (via Claude Opus 4.8)
**Git Commit**: 1a3143d
**Branch**: main
**Repository**: persona-forge

## Research Question

Die L3-Analyse (`context/changes/run-flow-analysis/research.md`) hat die Frage bewusst offen
gelassen: **WELCHE** der dokumentierten Schulden/Risiken lohnt es sich zu beheben, in welcher
**Zielform** und in welcher **Reihenfolge**? Diese Exploration listet jedes festgehaltene Problem,
klassifiziert Kandidat vs. Nicht-Kandidat, untersucht jeden Kandidaten mit drei Lupen (Form /
Historie+Intention / Migrierbarkeit) und schließt mit einem **Ranking** — **keine Entscheidung**
(die fällt in `/10x-plan`).

> **Methode (M4L4):** Drei Perspektiven je Kandidat — _adäquate Zielform_, _Historie als
> Intentions-Test_ (persona-forge hat keine ADRs → Git-Archäologie), _umkehrbare Migration_.
> Harte Grenze: keine Code-Änderung, Beweise vor Interpretation, Geschäftskonzept-Probleme
> werden benannt und an M4L5 (DDD) abgegeben statt hier „gefixt".

---

## 0. Problem-Inventar + Klassifikation (zum Auditieren)

Jedes Problem aus der L3-`research.md`, unabhängig vom Label:

| Quelle (L3) | Problem                                                                                        | Klasse                    | Begründung                                                                     |
| ----------- | ---------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------ |
| §2.3        | **C-A** `VIEW_COLUMNS`-String + `toView`-Mapper (Entity↔View)                                  | **KANDIDAT**              | Behebung ändert Code-Struktur (Typ-Ableitung statt String-Literal)             |
| §2.3        | **C-B** Ungeprüfte `as`-Casts der Insel über HTTP + Fehler-Form `{error}`                      | **KANDIDAT**              | Behebung führt eine Validator-Naht ein (Struktur)                              |
| §2.3        | **C-C** Constraint-Triplikat (`1..25`/`instrument_id`/Enums in SQL+zod+TS)                     | **KANDIDAT** (Teil)       | Werte-Duplikat = Single-Source (Struktur); Schichtung bleibt                   |
| §2.1        | **D1** „ok"-Schwelle ≠ „verwertbar"                                                            | **NICHT-KANDIDAT → M4L5** | Geschäftskonzept-Redesign, nicht verhaltenserhaltend (s. §4)                   |
| §2.1        | D2 Zwei Mehrheitsbegriffe (modalType vs. Typ-Konsistenz)                                       | Nicht-Kandidat            | Bewusst, dokumentiert (`oejts-aggregate.ts:75-90`)                             |
| §2.1        | D3 Populations-SD (÷n)                                                                         | Nicht-Kandidat            | Bewusst (Reps = Vollerhebung)                                                  |
| §2.2        | Test-Lücken (LLM-Client, `processNextRepetition`, failed-Persistenz, F3/null, API-HTTP, Token) | Nicht-Kandidat (Input)    | Fehlendes Sicherheitsnetz → Guard/Machbarkeits-Eingang, kein Struktur-Refaktor |
| §2.3        | Billige mechanische Kopplung (`requireUser`/`json`-Signaturen)                                 | Nicht-Kandidat            | Compiler/CI fängt sofort — kein echtes Schuldenrisiko                          |

**Drei strukturelle Kandidaten** (C-A, C-B, C-C) gehen in die 3-Lupen-Untersuchung. **D1** wird
benannt und an M4L5 abgegeben. Die Test-Lücken bleiben als Sicherheitsnetz-Eingang (z. B. wird der
LLM-Client-Test im C-B-Pfad relevant, der `toView`-Characterization-Test im C-A-Pfad).

---

## 1. C-A — Handgepflegte Entity↔View-Grenze (`VIEW_COLUMNS` + `toView`)

### Aktuelle Form (evidence)

- `VIEW_COLUMNS` = String-Literal mit **13 Skalar-Spalten + 1 Aggregat-Relation** `run_repetitions(count)`
  (= 14 Select-Items; §7-Präzisierung, Report ursprünglich „14 Spalten + Relation") (`runs.ts:39-40`,
  `RunViewRow`-Pick `:42-57` = 13 Felder), genutzt in **4** `.select(...)` (`listRuns :84`, `getRun :91`,
  `createRun :134`, `updateRunVisibility :167`).
- **Das Muster ist im File dreifach:** zusätzlich `STEP_COLUMNS`/`toStepState` (`runs.ts:211-251`)
  und Mini-Mapper `toRepForScoring` (`:180-182`). L3 nannte nur eines.
- **Repo-weite Hauskonvention:** identisches String+`toView`+`Pick<Entity>` in `model-configs.ts:29,34`
  (dort selektiert der String die Krypto-Spalten **bewusst nicht**) und `personas.ts:27,46`.
- **Compiler ist blind:** `supabase.ts:9` ruft `createServerClient` **ohne `<Database>`-Generic** →
  `.select()` liefert `any`, Services casten (`data as RunViewRow[]`, `:86`). Ein Tippfehler im
  String bricht erst zur Laufzeit (PostgREST). Keine generierte `database.types.ts` im Repo (evidence,
  Glob = 0).
- `toView` mischt drei Aufgaben: snake→camel, Autorisierungs-Ableitung `isOwn`, Aggregat-Entpackung
  `?? 0` — diese Mapper-Komplexität bleibt auch nach einer Typ-Lösung.

### Intentionalitäts-Verdikt: **BEWUSST** (Konvention), Typgen **bewusst vertagt**

- Typgen-Verzicht ist dokumentiert: `context/archive/2026-06-12-connect-supabase/research.md:94` +
  `plan.md:55-56` listen `database.types.ts` explizit als **Out-of-Scope** („erste Domänen-Slices").
- Der getypte Mapper-Parameter ist eine kodifizierte Lesson („das `any` des untypisierten Clients
  läutern", `runs.ts:178,228`; `distribution-results/plan.md:203-204`).
- **Kein Spalten-Mismatch-Bug in der Historie** (6 Commits auf `runs.ts`, einziger Fix `c07761b` =
  Nebenläufigkeit, nicht Spalten).

### Migrierbarkeit

- Zwei Optionen: **(A) Supabase-Typgen** (`createServerClient<Database>` → String+Mapper end-to-end
  schema-geprüft, kanonisch, 2026-06-12 vorgesehen) oder **(B) leichtgewichtig** String aus
  `(keyof Run)[]` ableiten (schließt String↔Pick-Drift, nicht Drift gegen die echte DB).
- **Vorhandener Guard:** `run-integrity.itest.ts` fährt `createRun`/`getRun` gegen echtes Supabase →
  ein falscher Spaltenname **bricht den `integration`-CI-Job** (`ci.yml`, `deploy` braucht `ci`+`integration`).
  Der schnelle `ci`-Job prüft den String **nicht**.
- **Erster Prerequisite:** `toView`-Characterization-Test (Export + Unit) — friert snake→camel, `isOwn`,
  `completedReps ?? 0` ein, bevor die Struktur angefasst wird.
- **Blast-Radius:** Pfad B = 1 File (`runs.ts`); Pfad A = `supabase.ts` einmalig + alle drei Services.

### Zielform (ein Satz)

Getypter Supabase-Client mit generierter `database.types.ts`, sodass `.select(VIEW_COLUMNS)` und die
Mapper-Row compiler-geprüft sind — lokaler Zwischenschritt: String aus `keyof Run`-Array.

### Schuld vs. Änderung

Akzidentielle Komplexität aus **bewusst vertagtem Tooling**; Schmerz **niedrig** (stabil, nie ein Bug,
durch Integration-Gate abgesichert), Frequenz gering. Änderung umkehrbar; Pfad A lohnt erst bei
größerem Supabase-Touch.

---

## 2. C-B — Ungeprüfte Insel↔HTTP-Naht (`as`-Casts + Fehler-Form)

### Aktuelle Form (evidence)

- **Genau 3 `as`-Casts** auf Erfolgs-Response-Bodies, alle in `RunRunner.tsx`:
  `:180` `as RunView[]` (GET /api/runs refetch), `:211` `as RunProgress` (POST step),
  `:258` `as RunView` (POST runs). Direkt in State geschrieben, **kein Runtime-Check**.
- **Einseitige Symmetrie:** Server **validiert Input** mit zod (`runs/index.ts:9-14`,
  `step.ts:9`), Client **validiert Output nicht** (kein zod im gesamten `src/components`-Baum,
  evidence: Grep = 0). `RunView`/`RunProgress` existieren nur als TS-Interfaces (`types.ts:251,278`).
- **Fehler-Pfad ist bereits defensiv:** `messageFromPayload` (`RunRunner.tsx:55-71`) parst die
  `{error}`-Form (`api-responses.ts:15-22`) laufzeitsicher mit `typeof`/`in`-Guards. Nur der
  **Erfolgs-Pfad** wurde vergessen → Inkonsistenz im selben File.

### Intentionalitäts-Verdikt: **ZUFÄLLIG** (Pfad des geringsten Widerstands)

- Blame: `:211`/`:258` aus `2f3ba29` (S-04-Bau), `:180` aus `b88b229` (S-07, Cast kopiert).
- Pläne nennen zod **nur** als API-_Input_-Muster; Client-Response-Validierung **nirgends** Thema
  (`oejts-measurement-run/plan.md:301,304`; `distribution-results/plan.md:45`). Kein Artefakt
  dokumentiert das Weglassen als Entscheidung → kein bewusster „wir-kontrollieren-beide-Seiten"-Entscheid.

### Migrierbarkeit

- **Abstraktion:** je Response-Typ ein zod-Schema (`runViewSchema`/`runProgressSchema`), TS-Typ via
  `z.infer` daraus (Single Source). zod ist **bereits Projekt-Dependency** (serverseitig in Gebrauch).
- **Test-Infra:** kein jsdom/Komponenten-Test (`vitest.config.ts:10-14` = Node-Env, `*.test.ts`) —
  **aber irrelevant**: die Schemas sind pure Logik und in der **bestehenden** Node-Vitest-Infra testbar.
- **L3-These bestätigt:** „zod an 3 Stellen einer Datei schließt die ganze dynamische Naht" — es sind
  buchstäblich 3 Casts in 1 Datei.
- **Erster Prerequisite:** Schemas neben den Interfaces definieren + `z.infer`-Typ ableiten (rein
  additiv, umkehrbar), **bevor** ein `as` angefasst wird.
- **Blast-Radius:** sehr klein (1 Datei Call-Sites + 1 Datei Schemas). Andere Inseln nicht betroffen
  (`RunResult`/`RunComparison` bekommen SSR-Props, casten nicht).

### Zielform (ein Satz)

zod-`safeParse` der 3 Erfolgs-Response-Bodies an der `RunRunner`-fetch-Naht, gespeist aus
`z.infer`-Schemas — macht die Naht symmetrisch (Server validiert Input, Client validiert Output).

### Schuld vs. Änderung

**Schuld latent, aber asymmetrisch teuer in der Diagnose:** Server-Drift/`{error}`→`{message}` bleibt
compilerstumm (der `as` unterdrückt genau die Prüfung) und bricht fern vom Verursacher im Browser;
`RunProgress` ist im heißen Step-Loop besonders exponiert. **Änderung niedrig:** 3 Call-Sites/1 Datei,
kein neuer Dependency, voll inkrementell. Hebt den Erfolgs-Pfad nur auf das Niveau des bereits
defensiven Fehler-Pfads.

---

## 3. C-C — Constraint-Triplikat (SQL + zod + TS)

### Aktuelle Form (evidence) — „dreifach" untertreibt: bis zu 5 Orte, repo-weit

| Constraint                   | SQL                               | zod                | TS                                             | weitere                                                  |
| ---------------------------- | --------------------------------- | ------------------ | ---------------------------------------------- | -------------------------------------------------------- |
| `repetition_count` 1..25     | `runs.sql:25`                     | `runs/index.ts:13` | `types.ts:256,274` (Report: 221; nur `number`) | `RunRunner.tsx:30-31,239,430-431` (HTML min/max)         |
| `runs.status` (4 Werte)      | `runs.sql:26`                     | — (Server-intern)  | `types.ts:194` `RunStatus`                     | `RunRunner.tsx:74-89` (Status-Map)                       |
| `run_repetitions.status` (3) | `runs.sql:62`                     | —                  | `types.ts:197`                                 | `fixtures.ts:74,98,106`                                  |
| `instrument_id` default      | `runs.sql:24`                     | `index.ts:12`      | `types.ts:255,273` (Report: 222; nur `string`) | `oejts.ts:24`, `RunRunner.tsx:248`, `fixtures.ts:58,122` |
| `visibility` (2)             | `rls_foundation.sql:10` (PG-Enum) | `runs/[id].ts:11`  | `types.ts:58`                                  | —                                                        |

Repo-weites **Foundation-Muster** (visibility/personas.source_kind ebenso), nicht runs-spezifisch.

### Intentionalitäts-Verdikt: **Schichtung bewusst (Feature), Werte-Duplikat zufällig (Schuld)**

- **Nicht kollabieren:** jede Ebene hat distinkten Zweck — SQL-CHECK = DB-Verteidigung (greift auch
  bei Fixture-/Service-Writes, die zod umgehen), zod = frühes 400, TS = Compile-DX. Team denkt
  nachweislich in Defense-in-Depth (`plan.md:102` SSRF-Re-Check).
- **Werte-Duplikat zufällig:** derselbe Plan transkribiert dieselben Zahlen von Hand in jede Ebene
  (`plan.md:139-140` SQL, `:304-306` zod), **keine geteilte Konstante**. Nie divergiert (1 Migrations-Commit).

### Migrierbarkeit

- **zod↔TS↔UI voll ableitbar** aus `as const`-Quelle (`z.enum(RUN_STATUSES)` + `typeof[number]`;
  `REP_MIN/REP_MAX` für zod `.min/.max` und UI). `'oejts-1.2'` hat in `OEJTS.id` schon sein Zuhause.
- **SQL bleibt notwendig getrennt** (immutables Migrations-SQL, kein TS-Import) → Guard ist **kein
  Codegen, sondern ein Konsistenz-`itest`** (insert `repetition_count:26` → erwarte PG `23514` + zod
  lehnt 26 ab).
- **Kein Test** prüft heute Grenzen/Konsistenz (evidence: Grep). **Erster Prerequisite:** Literale in
  geteilte `as const`-Quelle ziehen, zod+TS+UI daran hängen.
- **Blast-Radius:** ~4 Dateien, additiv, **kein DB-Eingriff**, reversibel.

### Zielform (ein Satz)

Skalare/Enum-Literale (1/25, Status-/Visibility-Member, `'oejts-1.2'`) in eine geteilte `as const`-Quelle,
aus der zod/TS/UI abgeleitet werden — SQL-CHECKs bleiben als bewusste DB-Linie und werden per
Konsistenz-Test gepinnt.

### Schuld vs. Änderung

Schuld **niedrig** (DB fängt jede Divergenz → schlimmstenfalls 500 statt 400, **kein** Datenleck),
Eintritt selten. Änderung **niedrig**, rein additiv. → **Guard/Single-Source-Fall, kein Umbau**;
lohnt sich, niedrige Dringlichkeit.

---

## 4. D1 — „ok"-Schwelle ≠ „verwertbar": **Geschäftskonzept → STOPP (M4L5)**

**Verdikt: KEIN Struktur-Refaktor.** Eine Behebung verändert **nutzersichtbare Zahlen** (die
angezeigte Fehlquote) und berührt psychometrische Reliabilitäts-Semantik — also **nicht
verhaltenserhaltend**, per Definition kein Refaktor.

- **Trace (evidence):** Rep mit `okCount` 1–7 macht keine 8-Item-Achse voll → trägt zu 0 Achsen bei
  (`oejts-score.ts:35-43`, `oejts-aggregate.ts:95`), zählt aber als `ok` (`runs.ts:401`), senkt also
  `failed_count` nicht (`:444`). **Belegter UI-Widerspruch:** konsistent 4/32-Items → „Keine
  verwertbaren Antworten … Fehlquote: 0 %" (`RunResult.tsx:92-93`). Die Verteilungs-Ansicht selbst
  ist **nicht** korrumpiert (`usableReps` schließt Teil-Reps sauber aus).
- **Intention (evidence):** unbeabsichtigte Naht zwischen S-04 (Schwelle A) und S-05 (Schwelle B) —
  das Wort „verwertbar" hat in den zwei Plänen zwei Bedeutungen, nie rekonziliert. PRD-NFR
  „Lauf-Resilienz" (`prd.md:196-198`) nutzt „verwertbar"/„Fehlquote" als komplementär — genau die
  Annahme, die der Code verletzt.
- **Fehlendes, unbenanntes Konzept:** eine **Scoring-Yield-/„verwertbare Quote"** als eigene
  Lauf-Metrik, distinkt von der **Antwort-Fehlquote**. Das Label „Fehlquote" gibt vor (b) zu sein,
  berechnet aber (a).
- **Holding-Action (optional, löst D1 NICHT):** Characterization-Test + Doc-Kommentar an `runs.ts:444`,
  der die Naht markiert — Blast null. **Bewusst kein Teil des Refaktor-Plans**, nur Marker für die DDD-Analyse.

---

## 5. Refactor opportunities (ranked)

> Vorschlag für die Planungs-Session — **keine Entscheidung**. Die Reihung folgt
> _Schuld-Kosten vs. Änderungs-Kosten_ mit Intentionalität als Tiebreaker: zufällige Komplexität mit
> kleinem, umkehrbarem Pfad rankt über bewusste/abgesicherte Komplexität.

### 🥇 1. C-B — zod-Validator an der RunRunner-Insel↔HTTP-Naht

- **Aktuell → Ziel:** 3 ungeprüfte `as`-Casts → `z.infer`-Schemas + `safeParse` an `:180/:211/:258`.
- **Warum Platz 1:** Einziger Kandidat mit **zufälliger** Komplexität (kein bewusster Entscheid),
  **kleinstem** Pfad (3 Casts/1 Datei, zod schon da, in bestehender Infra testbar) und **asymmetrischem**
  Wert (schließt eine latente, schwer-diagnostizierbare Runtime-Klasse; bringt Erfolgs-Pfad auf das
  Niveau des bereits defensiven Fehler-Pfads). „Guard, nicht Umbau" im reinsten Sinn.
- **Blast-Radius:** 1 Datei Call-Sites + 1 Datei Schemas; andere Inseln unberührt.
- **Inkrementeller Pfad:** Schema je Typ definieren (additiv) → `z.infer`-Typ adoptieren → Cast für Cast
  durch `safeParse` ersetzen (je Cast eigener Commit) → Entscheidung `parse` vs. `safeParse` in der Planung.
- **Erster Prerequisite:** `runViewSchema`/`runProgressSchema` neben `types.ts:251,278` + `z.infer`-Ableitung.

### 🥈 2. C-C — Constraint-Single-Source (nur Werte, Schichten bleiben)

- **Aktuell → Ziel:** dieselben Literale 1/25/Enums/`'oejts-1.2'` an 3–5 Orten → eine `as const`-Quelle;
  SQL-CHECK per Konsistenz-Test gepinnt.
- **Warum Platz 2:** billig + rein additiv, aber **niedrige Dringlichkeit** (DB fängt jede Divergenz →
  500 statt 400, kein Datenleck). Guard-/Single-Source-Fall. Eignet sich als **schneller Zusatz-Gewinn**
  neben C-B (ähnliches „add-test/derive-from-one-source"-Muster). Gefahr: NICHT die Schichten kollabieren.
- **Blast-Radius:** ~4 Dateien, kein DB-Eingriff.
- **Erster Prerequisite:** `src/lib/runs/constants.ts` (oder `as const` in `types.ts`) mit den Literalen.

### 🥉 3. C-A — getypter Supabase-Client / `keyof`-abgeleiteter Spalten-String

- **Aktuell → Ziel:** Hand-String + Pick → Typgen (`<Database>`) oder lokal String-aus-`keyof Run`.
- **Warum Platz 3:** **bewusste** Konvention mit dokumentiert vertagtem Tooling, Schmerz niedrig,
  bereits durch das Integration-CI-Gate abgesichert. Die kanonische Lösung (Typgen) ist ein breiter
  Supabase-Touch über alle Services — am günstigsten **mitgenommen**, wenn ohnehin Supabase-Arbeit ansteht.
- **Blast-Radius:** Pfad B 1 Datei, Pfad A alle Services.
- **Erster Prerequisite:** `toView`-Characterization-Test (Export + Unit).

---

## 6. Betrachtet und abgelehnt

| Kandidat                            | Warum abgelehnt                                                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** „ok"-Schwelle                | **Geschäftskonzept-Redesign**, nicht verhaltenserhaltend → M4L5 (DDD). Holding-Action als Marker möglich (§4).                                    |
| D2 / D3 (Mehrheitsbegriffe, Pop-SD) | Bewusste, dokumentierte fachliche Entscheidungen — kein Schuldenrisiko.                                                                           |
| Test-Lücken §2.2 (LLM-Client etc.)  | Kein Struktur-Refaktor; fehlendes Sicherheitsnetz. Werden als Guard im jeweiligen Kandidaten-Pfad relevant (LLM-Client-Test ggf. eigener Change). |
| `requireUser`/`json`-Signaturen     | Compiler/CI fängt sofort — explizit kein echtes Schuldenrisiko (L3 §2.3).                                                                         |

---

## 7. Verifikation der Behauptungen (ast-grep)

> M4L4 Schritt 2: die **strukturellen** Claims, auf denen das Ranking steht, mit ast-grep (0.44.0)
> geprüft; jede ast-grep-Null per klassischem grep gegengeprüft (Lektionsregel: Null ≠ Fehlen).
> **Kein Verdikt kippt eine Ranking-Position** — die Reihung und die Intentionalitäts-Verdikte bleiben
> unverändert; korrigiert wurden nur Zahlen/Zeilen (in-place, Format „neu (Report: alt)").

| Behauptung (Ranking-tragend)                                                  | Verdikt                                    | Beleg (file:line)                                                                                  | Methode                                                                                              |
| ----------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **C-B:** genau 3 `as Run*`-Casts auf Response-Bodies, alle in `RunRunner.tsx` | **bestätigt**                              | `:180` (`as RunView[]`), `:211` (`as RunProgress`), `:258` (`as RunView`)                          | grep `as Run\w*`; spezifische ast-grep-Patterns `$X as RunView`/`$X as RunProgress` trafen :258/:211 |
| **C-B:** ast-grep `($A) as $T` lieferte 0                                     | **Pattern-Artefakt** (nicht echtes Fehlen) | s. o. 3 reale Casts                                                                                | await-Klammerung bricht das Pattern → per grep widerlegt                                             |
| **C-B:** kein zod im `src/components`-Baum (einseitige Validierung)           | **bestätigt**                              | `src/components` Grep `from "zod"`/`z.object`/`z.infer` = 0                                        | grep (Methode selbst; Null = echtes Fehlen)                                                          |
| **C-A:** `VIEW_COLUMNS`-Spaltenzahl                                           | **präzisiert**                             | 13 Skalar + 1 Aggregat-Relation = **14 Select-Items** (Report: „14 Spalten + Relation")            | Lesen + Zählen (`runs.ts:39-40,42-57`)                                                               |
| **C-A:** Muster dreifach in `runs.ts`                                         | **bestätigt**                              | `VIEW_COLUMNS`/`toView` :39/:59, `STEP_COLUMNS`/`toStepState` :211/:230, `toRepForScoring` :180    | grep                                                                                                 |
| **C-A:** 4× `.select(VIEW_COLUMNS)`                                           | **bestätigt**                              | `runs.ts:84,91,134,167`                                                                            | grep                                                                                                 |
| **C-A:** `createServerClient` ohne `<Database>`-Generic                       | **bestätigt**                              | `supabase.ts:9` (`<Database>`-Grep = 0)                                                            | grep                                                                                                 |
| **C-A:** keine generierte `database.types.ts`                                 | **bestätigt**                              | Glob `**/database.types.ts` = 0                                                                    | Glob                                                                                                 |
| **C-A:** repo-weite Konvention über 3 Services                                | **bestätigt**                              | `personas.ts:27,46`; `model-configs.ts:29,34` (Krypto-Spalten bewusst weggelassen)                 | grep                                                                                                 |
| **C-C:** `repetition_count 1..25` erzwungen an SQL+zod+UI (TS nur `number`)   | **bestätigt** (4 Erzwingungs-Orte)         | `runs.sql:25`, `index.ts:13`, `RunRunner.tsx:30-31,239,430-431`; `types.ts:256,274`                | grep                                                                                                 |
| **C-C:** Status-Enums SQL↔TS deckungsgleich                                   | **bestätigt**                              | `runs.sql:26`(4)/`types.ts:194`; `runs.sql:62`(pending/ok/failed)/`types.ts:197`                   | grep                                                                                                 |
| **C-C:** `instrument_id 'oejts-1.2'` an mehreren Orten                        | **bestätigt** (5 Orte)                     | `runs.sql:24`, `index.ts:12`, `oejts.ts:24`, `RunRunner.tsx:248` (hardcoded), `fixtures.ts:58,122` | grep                                                                                                 |
| **D1:** `okCount===0→failed`, sonst `ok`; `failed_count` zählt gegen `ok`     | **bestätigt**                              | `runs.ts:401`, `:444`                                                                              | grep                                                                                                 |
| **D1:** `usableReps` = Reps mit ≥1 nicht-null Achse                           | **bestätigt**                              | `oejts-aggregate.ts:95` `.some(v => v != null)`                                                    | grep                                                                                                 |
| **D1:** 8 Items/Achse, 32 total                                               | **bestätigt** (bereits L3 §2.4)            | `oejts.ts` (IE/SN/FT/JP je 8)                                                                      | aus L3 übernommen                                                                                    |

**Fazit:** Die Verifikation hat nichts umgeworfen, aber den Report geschärft: die „14 Spalten" sind
13+1, zwei `types.ts`-Zeilen korrigiert, und die ast-grep-Null bei den Casts als Pattern-Artefakt
entlarvt (3 reale Casts). Mit diesen geprüften Zahlen geht das Ranking ohne Vertrauensvorschuss in die
Planung. **D1 bleibt Nicht-Kandidat** (die bestätigte Logik ändert das Domänen-Verdikt nicht — die Naht
ist real, aber ihre Behebung bleibt verhaltens-ändernd → M4L5).

## Code References

- `src/lib/services/runs.ts:39-76` `VIEW_COLUMNS`/`toView` · `:211-251` `STEP_COLUMNS`/`toStepState` · `:399-451` ok/failed + failed_count
- `src/components/runs/RunRunner.tsx:180,211,258` `as`-Casts · `:55-71` `messageFromPayload` · `:30-31,430-431` REP-Grenzen
- `src/lib/api-responses.ts:15-22` `{error}`-Form
- `src/lib/supabase.ts:9` ungetypter `createServerClient`
- `src/pages/api/runs/index.ts:9-14` zod createSchema · `[id].ts:11` visibility-zod
- `supabase/migrations/20260617190000_runs.sql:24-26,62` CHECK/DEFAULT · `*_rls_foundation.sql:10` visibility-Enum
- `src/types.ts:58,194-197,221-222,251,274,278` Unions/Interfaces
- `src/lib/runs/oejts-score.ts:35-43` Achsen-Dropout · `oejts-aggregate.ts:95` `usableReps`
- `.github/workflows/ci.yml` Integration-Gate (`deploy` ← `ci`+`integration`)

## Architecture Insights

- Die handgepflegte Entity↔View-Grenze ist eine **bewusste repo-weite Konvention** mit einem
  dokumentiert vertagten Tilgungs-Tool (Supabase-Typgen), nicht organisch gewachsener Wildwuchs.
- Die Validierungs-Asymmetrie ist die eigentliche Naht: **Server härtet Input (zod), Client vertraut
  Output (`as`)** — das ist der billigste, wertvollste Eingriff.
- Constraint-Duplikation trennt sauber in **bewusste Schichtung** (behalten) vs. **zufälliges
  Werte-Duplikat** (Single-Source) — Defense-in-Depth darf nicht als Schuld missverstanden werden.
- Das tiefste Problem (D1) ist **nicht strukturell, sondern domänen-sprachlich** — exakt der Übergang
  zu M4L5.

## Historical Context (from prior changes)

- `context/changes/run-flow-analysis/research.md` — L3-Prior (Feature overview + Technical debt).
- `context/archive/2026-06-12-connect-supabase/{research,plan}.md` — Typgen-Verzicht als Out-of-Scope.
- `context/archive/2026-06-17-oejts-measurement-run/plan.md` — Schwelle A (ok/failed), Constraint-Transkription.
- `context/archive/2026-06-18-distribution-results/plan.md` — Schwelle B (usableReps), `any`-Mapper-Lesson.
- `context/archive/2026-06-21-side-by-side-comparison/` — `:180`-Cast (refetch).

## Open Questions (unknowns)

- C-A Pfad A: ob ein größerer Supabase-Touch ansteht, der Typgen „gratis" mitnimmt — sonst Pfad B.
- C-B: `parse` (wirft, Error-Boundary) vs. `safeParse` (Banner) — Entscheidung gehört in die Planung.
- D1: welche Metrik das PRD-NFR „Fehlquote" eigentlich meint — Domänen-Entscheidung für M4L5.

## Verifikations-Status

3-Lupen-Exploration je Kandidat abgeschlossen (4 parallele Sub-Agenten). **M4L4-Schritt 2
(ast-grep-Verifikation) abgeschlossen** — siehe §7: 14 Struktur-Claims geprüft, alle bestätigt bzw.
präzisiert, keine widerlegt, keine Ranking-Position gekippt. **Status:** Exploration + Verifikation
abgeschlossen, **kein Refaktor, keine Entscheidung** — Ranking ist Vorschlag für `/10x-plan`
(M4L4-Schritt 3).
