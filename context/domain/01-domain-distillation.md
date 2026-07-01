---
title: "Domain Distillation — persona-forge"
created: 2026-07-01
type: domain-distillation
---

# Domain Distillation — persona-forge

> **Produkt dieser Analyse:** eine MAP der Geschäftsdomäne, kein Code. Alle Belege sind
> real gegen den Code verifizierte `Datei:Zeile`-Zitate; wo ein PRD-Begriff keine
> Code-Entsprechung hat, steht ausdrücklich „FEHLT im Code". Sprache: Deutsch,
> Code-Identifier englisch.

---

## Krok 0 — Projekt-Kontext & Schichten

persona-forge verwandelt eine **Modell-/Persona-Kombination** in ein messbares
Dispositionsprofil, indem es ein psychometrisches Instrument (v1: OEJTS) N-mal unter
isolierten, permutierten Bedingungen gegen ein LLM vorlegt und die Antworten je Achse zu
einer **Verteilung mit Streuung** aggregiert — statt zu einem Punktwert
(`context/foundation/prd.md:208-213`, „Business Logic").

Der fachliche Kern liegt vollständig in `src/lib/` und ist bewusst I/O-frei und
unit-testbar aufgeschichtet:

| Schicht                                      | Ort (verifiziert)                                                                                                                                                        | Rolle                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| **API / Route**                              | `src/pages/api/runs/index.ts`, `src/pages/api/runs/[id].ts`, `src/pages/api/runs/[id]/step.ts`, `src/pages/api/runs/[id]/result.ts`                                      | Auth-Gate + zod-Validierung + HTTP-Mapping         |
| **Service** (Supabase-CRUD + Orchestrierung) | `src/lib/services/runs.ts`, `personas.ts`, `model-configs.ts`                                                                                                            | Persistenz-Kapselung, RLS-vertrauend               |
| **Domäne** (rein, deterministisch)           | `src/lib/runs/oejts-score.ts`, `oejts-aggregate.ts`, `oejts-run.ts`, `run-schemas.ts`; `src/lib/instruments/oejts.ts`; `src/lib/crypto.ts`; `src/lib/persona-compile.ts` | Scoring, Aggregation, Permutation, Parsing, Krypto |
| **UI** (React-Inseln)                        | `src/components/runs/RunRunner.tsx`, `RunResult.tsx`, `RunComparison.tsx`, `axis-chart.tsx`                                                                              | Start-Loop, Ergebnis-, Vergleichsansicht           |
| **Persistenz**                               | `supabase/migrations/*.sql`; Entity-Typen in `src/types.ts`                                                                                                              | Tabellen, RLS-Policies, Enums                      |

Zwei Schichten außerhalb der Run-Domäne mit hohem Risiko: **Auth** (`src/middleware.ts`,
`src/lib/api-auth.ts`) und **verschlüsselte LLM-Keys** (`model-configs.ts` +
`crypto.ts`).

---

## Krok 1 — Ubiquitous Language

Legende Code-Sitz: **E** = Entity/Typ, **F** = Funktion/Logik, **DB** = Migration/Spalte.

| Begriff (Domäne)                              | Definition                                                                               | PRD-Quelle                                     | Code-Sitz                                                                                         |
| --------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Persona** (Domänenobjekt)                   | Wiederverwendbares kognitives Profil = System-Prompt; **Testobjekt, kein Nutzer**        | `prd.md:20-24`, `prd.md:146` (FR-007)          | E `types.ts:74-86`; DB `20260617053000_personas.sql:22-34`                                        |
| **Persona-Quelle** (freeform / structured)    | Zwei Eingabewege: frei getippter oder aus Spec-Feldern kompilierter Prompt               | `prd.md:146` (FR-007)                          | E `types.ts:66`, `137-153`; F `persona-compile.ts` (`compilePersonaPrompt`, via `personas.ts:89`) |
| **Modellkonfiguration** (ModelConfig)         | Angehängter OpenAI-kompatibler Endpunkt (Base-URL, Modellname, verschlüsselter Key)      | `prd.md:136` (FR-005)                          | E `types.ts:15-26`; DB `20260616051425_model_configs.sql`                                         |
| **Instrument**                                | Ein psychometrisches Test-Set; v1 hartkodiert                                            | `prd.md:158` (FR-010), `prd.md:164` (FR-011)   | E `types.ts:188-194`; Daten `instruments/oejts.ts:23-96`                                          |
| **Achse / Skala** (E/I, S/N, T/F, J/P)        | Dichotomie mit `constant`, `cutoff`, `high`/`low`-Pol                                    | `prd.md:186` (FR-016), `prd.md:221`            | E `types.ts:158-171`; Daten `oejts.ts:26-31`                                                      |
| **Item** (bipolar)                            | Einzelfrage, trägt zu **einer** Achse bei, mit Vorzeichen `sign ±1`                      | `prd.md:174` (FR-013)                          | E `types.ts:174-185`; Daten `oejts.ts:32-95`                                                      |
| **Antwortskala 1–5**                          | 1 = voll links, 3 = ausgewogen, 5 = voll rechts                                          | `prd.md:174`, `prd.md:218-219`                 | F `oejts-run.ts:50-70` (`buildOejtsMessages`)                                                     |
| **Lauf** (Run)                                | Selbst-enthaltene N-fache Ausführung eines Instruments gegen Modell+Persona              | `prd.md:169-183` (FR-012/014)                  | E `types.ts:218-233`; DB `20260617190000_runs.sql:17-32`                                          |
| **Wiederholung** (RunRepetition, „rep")       | Eine isolierte Sitzung innerhalb eines Laufs; Roh-Response + geparste Werte              | `prd.md:95-96` (US-01 AC), FR-012              | E `types.ts:239-253`; DB `runs.sql:55-69`                                                         |
| **ItemValue** (geparster Wert)                | Wert 1–5 **oder** `null` mit Status `ok`/`unparsed`                                      | `prd.md:98-99`, `prd.md:174` (FR-013)          | E `types.ts:205-210`; F `oejts-run.ts:132-152`                                                    |
| **Achsen-Score**                              | `constant + Σ(sign · value)` über die Items einer Achse                                  | `prd.md:16-19` (Header), FR-016                | F `oejts-score.ts:26-46` (`scoreAxes`)                                                            |
| **Achsen-weiser Dropout**                     | Fehlt EIN Item einer Achse → Achse liefert `null` (kein erfundener Wert)                 | Guardrail `prd.md:81-82`, NFR `prd.md:196-198` | F `oejts-score.ts:37-40`                                                                          |
| **4-Buchstaben-Typ**                          | Aus den Achsen-Scores abgeleitet (`> cutoff → high`)                                     | `prd.md:158` (FR-010), FR-016                  | F `oejts-score.ts:53-61` (`deriveType`)                                                           |
| **Verteilung je Achse** (AxisDistribution)    | Lage (`mean`), Streuung (`sd`), Roh-Verteilung (`scores`), `letterCounts`, `usableCount` | `prd.md:100-102` (US-01 AC), FR-016            | E `types.ts:297-315`; F `oejts-aggregate.ts:41-66`                                                |
| **Typ-Stabilität** (Modaltyp + Konsistenz)    | Modaltyp = Mehrheits-Buchstabe je Achse; Konsistenz = Anteil voller Typen == Modaltyp    | `prd.md:186-189` (FR-016)                      | E `types.ts:318-326`; F `oejts-aggregate.ts:68-92`                                                |
| **Permutation**                               | Item-Reihenfolge je Wiederholung deterministisch mischen                                 | `prd.md:170` (FR-012)                          | Flag E `types.ts:192` (`Instrument.permute`); F `oejts-run.ts:34-42` (`permuteItems`)             |
| **Seed**                                      | Deterministischer Wert je (Lauf, rep) → reproduzierbare Permutation                      | NFR Reproduzierbarkeit `prd.md:199-200`        | F `runs.ts:257-265` (`seedFrom`)                                                                  |
| **Prompt-Snapshot**                           | Eingefrorener Persona-System-Prompt am Lauf, überlebt Löschen der Persona                | `prd.md:199-200`; implizit US-01               | DB `runs.sql:23`; F `runs.ts:126`                                                                 |
| **Freitext-Fallback-Parser**                  | Greift, wenn strukturiertes JSON fehlschlägt                                             | `prd.md:174-177` (FR-013)                      | F `oejts-run.ts:132-152`                                                                          |
| **Orchestrierungs-Schritt** (Step)            | Verarbeitet GENAU EINE offene Wiederholung, client-getrieben verkettet                   | `prd.md:170` (FR-012), Cloudflare-Gotcha       | F `runs.ts:304-461` (`processNextRepetition`); UI `RunRunner.tsx:196-237`                         |
| **Token-Verbrauch**                           | Eingabe/Ausgabe-Tokens je Lauf, zählt auch fehlgeschlagene reps                          | `prd.md:181` (FR-015)                          | DB `runs.sql:27-28`; F `runs.ts:440-451`                                                          |
| **Fehlquote** (failed_count)                  | Anteil nicht verwertbarer Wiederholungen, im Ergebnis ausgewiesen                        | NFR `prd.md:196-198`                           | DB `runs.sql:29`; UI `RunResult.tsx:9-14`                                                         |
| **Sichtbarkeit** (privat / global)            | Zweistufig; org-weit oder eigen                                                          | `prd.md:127` (FR-003), `prd.md:239-241`        | E `types.ts:63`; DB-Enum `visibility`                                                             |
| **Ergebnis-Zustand** (ready/empty/unfinished) | UI-Verzweigung des Laufergebnisses                                                       | `prd.md:104-105` (US-01 AC)                    | E `types.ts:334-338`; F `runs.ts:192-206`                                                         |
| **Zwei-Läufe-Vergleich**                      | Genau zwei abgeschlossene Läufe nebeneinander                                            | `prd.md:190` (FR-017), US-02                   | E `types.ts:356-359`; UI `RunComparison.tsx`, `RunRunner.tsx:139-146`                             |
| **Verschlüsselter API-Key** (at rest)         | AES-256-GCM, nie Klartext, verlässt nie den Server                                       | `prd.md:140` (FR-006), NFR `prd.md:203-204`    | F `crypto.ts:66-85`; Sitz `model-configs.ts:28-29,122-139`                                        |
| **Belastbarkeits-Schwelle**                   | Ab wann ein Ergebnis als „belastbar" gilt                                                | Guardrail `prd.md:80-82`                       | Konstante `axis-chart.tsx:14` (`RELIABLE_MIN = 2`); nur UI                                        |

### Ein-Begriff-mehrere-Namen

- **„Das Ergebnis / die Verteilung / der Score"**: fachlich EIN Konzept, im Code drei
  Ebenen — `scoreAxes` (Rohwert je rep, `oejts-score.ts:26`) → `AxisDistribution`
  (aggregiert je Achse, `types.ts:297`) → `RunResultView` (client-sichere Sicht +
  Zustand, `types.ts:334`). Das PRD spricht durchgehend nur von „Verteilung je Achse".
- **„Der Typ"**: PRD = „4-Buchstaben-Typ" (`prd.md:158`); Code trennt `deriveType`
  (Typ EINER Wiederholung, `oejts-score.ts:53`) von `modalType` (laufweiter Modaltyp,
  `oejts-aggregate.ts:69`). Zwei verschiedene Dinge unter demselben Alltagswort.
- **„Isolierte Sitzung / Wiederholung / rep / Step"**: FR-012 „isolierte Sitzung"
  (`prd.md:170`) = `RunRepetition` (`types.ts:239`) = ein `processNextRepetition`-Aufruf
  (`runs.ts:304`) = ein `runStep`-Tick im Client (`RunRunner.tsx:196`). Vier Namen, ein
  Lebenszyklus-Schritt.
- **„Persona"** ist das gefährlichste Homonym: Domänen-Testobjekt (`types.ts:74`) vs.
  Nutzer-Persona (Modell-Evaluierer / Persona-Autor, `prd.md:45-59`). Das PRD warnt
  explizit davor (`prd.md:20-24`). Die Nutzer-Personas haben **keine** Code-Entsprechung.

---

## Krok 2 — Subdomänen-Klassifikation

| Bereich                                                                                       | Kategorie                                   | Begründung (Bezug auf Success Criteria / Vision)                                                                                                                                   |
| --------------------------------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Scoring** (`oejts-score.ts`) — Roh-Antworten → Achsen-Score, Dropout, Typableitung          | **CORE**                                    | Der Insight „Verteilung statt Punktwert" ist die Wertschöpfung (`prd.md:40-42`). Der Dropout-Guardrail „kein erfundener Wert" ist Methodenkern (`prd.md:81-82`).                   |
| **Aggregation** (`oejts-aggregate.ts`) — Verteilung, Streuung, Typ-Stabilität je Lauf         | **CORE**                                    | Genau der primäre Success-Criterion-Output: „Verteilung mit Streuung … plus 4-Buchstaben-Typ … nicht Einzel-Punktwert" (`prd.md:64-69`, FR-016).                                   |
| **Instrument-Definition** (`instruments/oejts.ts`, `types.ts` Instrument/Axis/Item)           | **CORE**                                    | Das gemeinfreie, strukturierte Instrument IST der Insight gegenüber selbsterfundenen Prompts (`prd.md:38-39`). Ohne korrekte Achsen/Polung kein valides Scoring.                   |
| **Lauf-Orchestrierung** (`runs.ts` `processNextRepetition`, Step-Route)                       | **CORE**                                    | N Wiederholungen in isolierten, permutierten Sitzungen = der Messvorgang selbst (FR-012/014). Cloudflare-Edge zwingt zur Step-Aufteilung (CLAUDE.md-Gotcha).                       |
| **Antwort-Parsing** (`oejts-run.ts` parse + Fallback)                                         | **CORE**                                    | Ohne robustes Parsen keine verwertbaren reps; FR-013 macht den Fallback zur Pflicht (`prd.md:174-177`).                                                                            |
| **Persona-Verwaltung** (`personas.ts`, `persona-compile.ts`)                                  | **SUPPORTING**                              | Persona ist notwendige Eingabe des Messvorgangs (Secondary Success `prd.md:74-76`), aber nicht selbst die Messung. Immutability + Katalog stützen den Kern.                        |
| **Modellkonfiguration + Krypto** (`model-configs.ts`, `crypto.ts`)                            | **SUPPORTING** (mit generischem Kryptoteil) | Anbindung externer Modelle ist Voraussetzung; kein eigenes Hosting (Non-Goal `prd.md:253`). Der AES-GCM-Teil selbst ist **GENERIC**.                                               |
| **Ergebnis-/Vergleichs-Darstellung** (`RunResult.tsx`, `RunComparison.tsx`, `axis-chart.tsx`) | **SUPPORTING**                              | US-02-Vergleich (`prd.md:106-110`) ist Success-Criterion, aber Darstellungslogik über dem Kern-Aggregat.                                                                           |
| **Auth & RLS-Zugriff** (`middleware.ts`, `api-auth.ts`, RLS-Policies)                         | **GENERIC**                                 | E-Mail/Passwort + Sichtbarkeits-Scoping sind Standard-Plattformmechanik; Guardrail „kein Leck über Nutzergrenzen" (`prd.md:83-84`) ist wichtig, aber nicht produktdifferenzierend. |
| **SSRF-Guard / HTTP-Client** (`url-guard.ts`, `openai-compatible.ts`)                         | **GENERIC**                                 | Retry/Backoff, Timeout, Redirect-Härtung sind Infrastruktur (NFR Last-Verträglichkeit `prd.md:205-206`).                                                                           |

---

## Krok 3 — Aggregat-Kandidaten & Invarianten

| #   | Aggregat-Kandidat                                        | Invariante (Geschäftsregel)                                                                                                                                                 | Quelle                                                   | Erzwingung im Code                                                                                                                                                                                                                                                                                                             |
| --- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1  | **Lauf** (`runs` als Root + `run_repetitions` als Child) | Ein Lauf ist **selbst-enthalten**: der Persona-Prompt wird als Snapshot festgehalten, damit der Lauf reproduzierbar bleibt, auch wenn Persona/Modell später gelöscht werden | `prd.md:199-200`; Kommentar `types.ts:213-217`           | **ERZWUNGEN.** `persona_prompt_snapshot text not null` (`runs.sql:23`), FKs `on delete set null` (`runs.sql:21-22`), Snapshot beim Insert (`runs.ts:126`).                                                                                                                                                                     |
| A2  | **Lauf**                                                 | **Kein Einzelwert als belastbares Ergebnis**: Ergebnisse sind immer Verteilungen über N Wiederholungen mit Streuung                                                         | Guardrail `prd.md:80-82`, FR-016                         | **NUR DEKLARIERT / nur Darstellung.** API erlaubt `repetitionCount` min **1** (`api/runs/index.ts:13`; DB-Check `runs.sql:25` = 1..25). Aggregat rechnet auch für N=1 (SD=0, `oejts-aggregate.ts:22-24`). Einzige Schranke: UI-Warnbanner ab `RELIABLE_MIN=2` (`RunResult.tsx:103,144`, `axis-chart.tsx:14`). Siehe Krok 4 #2. |
| A3  | **Lauf**                                                 | **Abbruch verwirft den Lauf vollständig** (keine Teilverteilung)                                                                                                            | `prd.md:178` (FR-014), `prd.md:103`                      | **ERZWUNGEN.** Abbruch = harter DELETE + Cascade (`RunRunner.tsx:319-326` → `deleteRun` `runs.ts:145-149`; `on delete cascade` `runs.sql:57`).                                                                                                                                                                                 |
| A4  | **Lauf**                                                 | **Status-Monotonie**: `pending → running → completed/failed`; terminal ist idempotent; `failed` nur wenn 0 verwertbar                                                       | NFR Resilienz `prd.md:196-198`, FR-014                   | **ERZWUNGEN (App).** Übergänge in `processNextRepetition` (`runs.ts:314-345`), Finalisierung `failed` bei `failedCount >= repetitionCount` (`runs.ts:335`). DB-Check auf Enum-Werte (`runs.sql:26`), aber DB erzwingt keine Reihenfolge.                                                                                       |
| A5  | **Wiederholung**                                         | **Eindeutigkeit je (Lauf, rep_index)**; Doppelaufruf darf nicht doppelt schreiben                                                                                           | Isolation FR-012; F4-Plan-Review                         | **ERZWUNGEN.** `unique (run_id, rep_index)` (`runs.sql:68`); App toleriert `23505` als „bereits fortgeschritten" (`runs.ts:422-437`).                                                                                                                                                                                          |
| A6  | **Achsen-Verteilung** (Value Object je Achse)            | **Kein erfundener Wert bei Lücke** (achsen-weiser Dropout → `null`, nicht 0/geraten)                                                                                        | Guardrail `prd.md:81-82`                                 | **ERZWUNGEN.** `scoreAxes` bricht bei fehlendem Item auf `null` ab (`oejts-score.ts:37-43`); `mean`/`sd` = `null` bei `usableCount 0` (`oejts-aggregate.ts:52-53`).                                                                                                                                                            |
| A7  | **Instrument**                                           | **Jedes Item gehört zu genau einer Achse**; deterministischer Scoring-Schlüssel                                                                                             | `prd.md:281-286` (Open Q2), FR-011                       | **NUR DEKLARIERT.** Struktur nur per `satisfies Instrument` typgeprüft (`oejts.ts:96`); keine Laufzeit-Validierung, dass jede Achse ihre erwarteten 8 Items hat oder `constant`/`cutoff` konsistent sind.                                                                                                                      |
| A8  | **Modellkonfiguration**                                  | **API-Key nie im Klartext at rest, verlässt nie den Server**                                                                                                                | `prd.md:79`, `prd.md:140` (FR-006), NFR `prd.md:203-204` | **ERZWUNGEN.** `VIEW_COLUMNS` selektiert Key-Spalten nie (`model-configs.ts:28-29`); Klartext nur transient in `getDecryptedTarget` (server-only, `model-configs.ts:122-139`); AES-GCM `crypto.ts`.                                                                                                                            |
| A9  | **Persona**                                              | **Inhalt unveränderlich** (FR-008); Änderung = neue Kopie                                                                                                                   | `prd.md:149` (FR-008)                                    | **APP-ERZWUNGEN, DB-Lücke seit S-07.** Service exponiert nur `updatePersonaVisibility` (`personas.ts:167-181`), keinen Inhalts-Update. Aber die S-07-Policy `personas_update_own` (`20260620092033_..._update_own_policy.sql:10-13`) öffnet DB-seitig **jede** Spalte für den Owner. Siehe Krok 4 #4.                          |

---

## Krok 4 — Rozjazdy: MODEL vs CODE (der wertvollste Teil)

| #     | Dokument sagt X                                                                                                                                  | Code macht Y                                                                                                                                                                                                                    | Beweis                                                                                                                                                                                                                                                                     |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | **Item-Permutation ist eine Eigenschaft des Instruments, an/aus konfigurierbar** (FR-012) — das Datenmodell trägt dafür ein Flag                 | Der Orchestrator liest das Flag **nie** und permutiert **immer** hart; der `permute`-Zweig `false` ist toter Vertrag                                                                                                            | Flag deklariert: `types.ts:192`, `oejts.ts:24` (`permute: true`). Ignoriert: `runs.ts:376-377` permutiert unbedingt, Kommentar gibt es selbst zu („v1: OEJTS permutiert immer … Generalisierung auf permute:false folgt").                                                 |
| **2** | **„Ein Einzeldurchlauf wird nie als belastbarer Wert dargestellt"** — unverletzlicher Methodenkern-Guardrail (`prd.md:80-82`, FR-016)            | API/DB/Aggregat lassen **N=1** voll zu und liefern ein fertiges `ready`-Ergebnis inkl. Mittelwert & SD=0; die Nicht-Belastbarkeit ist **reine UI-Kosmetik** (Warnbanner) und wird nicht am Modell erzwungen                     | Erlaubt: `api/runs/index.ts:13` (`min(1)`), `runs.sql:25` (`between 1 and 25`). Rechnet trotzdem: `oejts-aggregate.ts:52-53`, `runs.ts:205` (`state: 'ready'` bei `usableReps>=1`). Schranke nur in UI: `RunResult.tsx:103,144-152`, `RELIABLE_MIN=2` `axis-chart.tsx:14`. |
| **3** | **Sichtbarkeits-Default = global** (FR-003, „Default ist global")                                                                                | Die **DB**-Spalten-Defaults sind das **Gegenteil** (`private`); „global" existiert nur, weil die App-Services es bei jedem Insert explizit überschreiben — ein roher/direkter Insert wäre privat                                | PRD: `prd.md:127-129`. DB-Default private: `runs.sql:20`, `20260617185800_personas_visibility_default_private.sql:8`. App überschreibt: `personas.ts:101-105`, `runs.ts:129-131`. (Bewusstes „Split-Brain" als Defense-in-Depth, aber Default-Ort ≠ PRD.)                  |
| **4** | **Persona-Inhalt ist immutable** (FR-008), DB hatte darum bewusst **keine** UPDATE-Policy (`personas.sql:11-13`)                                 | Seit S-07 existiert `personas_update_own` **ohne Spalten-Einschränkung** — DB erlaubt dem Owner jetzt jede Inhalts-Spalte zu ändern; die Immutability hängt allein daran, dass der Service keinen Inhalts-Update-Pfad exponiert | Ursprung: `personas.sql:11-13` („KEINE update-Policy"). Aufweichung: `20260620092033_personas_update_own_policy.sql:10-13` (`for update … with check owner_id`, keine Column-Grants). App-only-Schutz: `personas.ts:167-181`.                                              |
| **5** | **`item_order` ist ein Reproduktions-Artefakt** — die verwendete Reihenfolge wird gespeichert, „damit der Lauf reproduzierbar bleibt"            | Beim erneuten Auswerten wird `item_order` **nie gelesen**; Scoring mappt Werte ausschließlich über die **Item-Id**. Reproduzierbarkeit kommt aus gespeicherten `item_values` + deterministischem Seed, nicht aus der Ordnung    | Gespeichert: `runs.sql:59`, `runs.ts:414`, Kommentar `types.ts:243`. Ungenutzt beim Re-Scoring: `oejts-score.ts:27-28` (Map by `id`), `oejts-aggregate.ts:33-39`. Order ist forensisch, nicht funktional.                                                                  |
| **6** | **„Reproduzierbare Auswertung: dieselben Rohantworten ergeben identische aggregierte Werte" — deterministisches Scoring** (NFR `prd.md:199-200`) | **Erfüllt** und stärker als das PRD verlangt: das Aggregat wird **on-the-fly** aus den Rohantworten berechnet, nie persistiert → keine Drift möglich                                                                            | `runs.ts:184-206` (`getRunResult`, „keine persistierten Aggregate"), reine Funktionen `oejts-aggregate.ts`. (Positive Ausrichtung — kein Rozjazd, aber belegt die Invariante.)                                                                                             |
| **7** | Instrument-Header nennt die Scoring-**Konstanten** (IE=30, SN=12, FT=30, JP=18) und `cutoff` je Achse                                            | Konstanten & `cutoff=24` sind hartkodiert; die Achsen-Skala wird je Achse aus den Item-Extrema neu berechnet (nicht global 8..40 angenommen) — konsistent, aber ohne Laufzeit-Check gegen den Header-Kommentar                  | Header: `oejts.ts:16-19`. Werte: `oejts.ts:26-31`. Skala: `oejts-score.ts:69-81` (`axisScale`).                                                                                                                                                                            |

**Begriffe/Anforderungen ohne Code-Entsprechung — „FEHLT im Code":**

- **„Disposition" / „Dispositionsprofil"** — der zentrale Vision-Begriff (`prd.md:28-36`,
  `prd.md:210`) hat **keinen** Code-Identifier; er erscheint nur als deutscher UI-Text in
  `RunResult.tsx:148`. Das Kernkonzept lebt implizit als `RunAggregate` (`types.ts:318`).
- **Nutzer-Personas „Modell-Evaluierer" / „Persona-Autor"** (`prd.md:47-59`) — FEHLT im
  Code (reine PRD-Rollen; v1 ist einrollig).
- **Persona-Treue-Validierung (Spec 7C)** (`prd.md:56-59`, `prd.md:265`) — FEHLT im Code
  (bewusster Non-Goal für v1).
- **Zweites Instrument / Mini-IPIP / Likert / Big-Five** (`prd.md:158-167`, FR-010/011) —
  FEHLT im Code; `Instrument` ist als Typ generisch, aber es existiert nur `OEJTS`.
- **Admin-Rolle / Rollenzuweisung** (FR-002, FR-009) — FEHLT im Code (einrollig; globale
  Objekte per Seed, z. B. `personas.sql:55-77`).
- **Deklarative Test-Engine** (FR-011) — FEHLT im Code (v1 hartkodiert; `runs.ts:376-377`
  ist auf OEJTS zugeschnitten).
- **Kostenschätzung** (`prd.md:274`) — korrekt FEHLT (Non-Goal; nur Token-Zählung).
- **N-Wege-Vergleich** (FR-017) — FEHLT (Cap 2 hart: `RunRunner.tsx:141-145`,
  `RunComparisonView` `types.ts:356-359`).

---

## Krok 5 — Refaktor-Ranking

Sortiert nach **Wert** (Kern-Nähe der Invariante) × **Risiko** (Schwäche der heutigen
Erzwingung).

| Rang   | Aggregat / Invariante                                                 | Wert                                                                                                                              | Risiko heute                                                                                                         | Rozjazd |
| ------ | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------- |
| **#1** | **Lauf — „nie ein Einzelwert als belastbares Ergebnis" (A2)**         | **Höchst** — das ist der Daseinsgrund des Produkts (Insight „Verteilung statt Punktwert", Guardrail „Methodenkern unverletzlich") | **Höchst** — nur ein UI-Banner (`RELIABLE_MIN=2`); API/DB/Aggregat liefern für N=1 ein vollwertiges `ready`-Ergebnis | #2      |
| #2     | **Instrument — Item↔Achse-Vollständigkeit & Scoring-Konsistenz (A7)** | Hoch — falsches Scoring korrumpiert jedes Ergebnis unbemerkt                                                                      | Mittel — nur `satisfies`-Typcheck, keine Laufzeit-/Test-Invariante über Achsen-Vollzähligkeit                        | #7      |
| #3     | **Persona — Inhalts-Immutability (A9)**                               | Mittel-hoch (FR-008 must-have)                                                                                                    | Mittel — DB-Schutz seit S-07 weg, nur noch App-Konvention                                                            | #4      |
| #4     | **Permutation als Instrument-Eigenschaft (Flag `permute`)**           | Mittel (blockt das deklarative-Engine-Ziel FR-011)                                                                                | Niedrig-mittel — toter Vertrag, kein Fehlverhalten heute, aber Falle beim 2. Instrument                              | #1      |

### #1 für den Refaktor — Begründung

**Der Lauf als Aggregat, mit der Methodenkern-Invariante „Ergebnis = Verteilung über
≥ N_min verwertbare Wiederholungen, nie ein Einzelwert" (A2).**

Warum #1: Diese Invariante **ist** das Produkt — der ganze Insight gegenüber dem Status
quo ist „Verteilung statt Punktwert" (`prd.md:40-42`) und der einzige als _unverletzlich_
markierte Guardrail (`prd.md:80-82`). Genau sie ist heute am schwächsten erzwungen: die
Zahl `RELIABLE_MIN = 2` lebt in einer **Chart-Komponente** (`axis-chart.tsx:14`), die
API akzeptiert `repetitionCount = 1` (`api/runs/index.ts:13`), und `getRunResult` gibt für
eine einzige verwertbare Wiederholung `state: 'ready'` zurück (`runs.ts:205`) — die
Nicht-Belastbarkeit ist reine Präsentation, kein Domänen-Konzept. Ein zweiter Client (API
direkt, künftiger Vergleichs-Export) umginge den Guardrail vollständig.

Refaktor-Richtung (Map, kein Code): die Belastbarkeits-Schwelle vom UI in die **Domäne**
heben — als benanntes Konzept am Lauf/Aggregat (z. B. `RunAggregate.reliability` mit
`usableReps`-Schwelle, definiert **neben** dem Scoring in `src/lib/runs/`), sodass
`RunResultView.state` einen expliziten `unreliable`-Zustand kennt und jede Schicht
(API-Response, Vergleich, künftige Exporte) denselben Guardrail erbt. Im selben Zug die
zwei kleinen, kern-nahen Rozjazdy schließen: das `permute`-Flag im Orchestrator tatsächlich
lesen (#4) und die Instrument-Vollständigkeit als Laufzeit-/Test-Invariante absichern (#2).
