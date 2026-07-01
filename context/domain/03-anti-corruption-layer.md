---
title: "Anti-Corruption-Layer — persona-forge"
created: 2026-07-01
type: refactor-plan
---

# Anti-Corruption-Layer — durchsickernde Abhängigkeiten in persona-forge

> **Produkt dieser Analyse:** ein PLAN eines Refaktors, KEIN Code. Alle Belege sind real
> mit Grep/Read verifizierte `Datei:Zeile`-Zitate. Sprache: Deutsch, Code-Identifier
> englisch. Prior gelesen: `context/domain/01-domain-distillation.md`, unabhängig
> verifiziert.

> **Ehrlichkeits-Vorab (wichtig):** persona-forge ist ~20 Tage jung, Solo. Die Isolation
> ist **überdurchschnittlich sauber** — die als „schlimmster Leak" gewählte Achse
> (Supabase) ist **mild**: sie erreicht **weder die UI noch die reine Domäne**. Der Wert
> dieses Dokuments liegt daher nicht in einem Rettungs-Refaktor, sondern in einem
> **sprawdzalnym (verifizierbaren) Kriterium für die Zukunft** plus einem kleinen,
> guard-first dimensionierten Plan. Wo Isolation schon gut ist (LLM), sage ich es
> ausdrücklich und feiere es als Vorbild — kein erfundenes Drama.

---

## Krok 0 — Kontext, Stack, Schichten

**Stack** (verifiziert `package.json:21-68`): Astro 6 (`astro ^6.3.1`) SSR + React 19 +
TypeScript + Tailwind 4; Persistenz/Auth `@supabase/ssr ^0.10.3` + `@supabase/supabase-js
^2.99.1`; Validierung `zod ^4.4.3`; Monitoring `@sentry/cloudflare ^10.61.0`; Deploy
`@astrojs/cloudflare`. **Kein** OpenAI-/LLM-SDK — der LLM-Zugriff ist ein handgeschriebener
`fetch`-Client (siehe unten).

**Externe Abhängigkeiten, die durch Schichten sickern könnten** (Aufgabe nennt sie):
Supabase-Client, LLM-Aufrufe, zod, Sentry.

**Schichten** (verifiziert, deckungsgleich mit `01-domain-distillation.md:27-33`):

| Schicht                  | Ort                                                                  | Kennt Supabase?                   | Kennt LLM-Wire?       | Kennt zod?             |
| ------------------------ | -------------------------------------------------------------------- | --------------------------------- | --------------------- | ---------------------- |
| **API / Route**          | `src/pages/api/**`                                                   | **transitiv** (hält rohen Client) | nein                  | **ja** (Input-Schemas) |
| **API-Auth-Helper**      | `src/lib/api-auth.ts`                                                | **ja**                            | nein                  | nein                   |
| **Middleware**           | `src/middleware.ts`                                                  | **ja**                            | nein                  | nein                   |
| **Service / Repository** | `src/lib/services/*.ts`                                              | **ja** (DSL + Fehlercodes)        | 1× Aufruf             | nein                   |
| **Domäne (rein)**        | `src/lib/runs/*`, `instruments/*`, `crypto.ts`, `persona-compile.ts` | **nein**                          | 1 Typ (`ChatMessage`) | 1× (`run-schemas.ts`)  |
| **LLM-Adapter**          | `src/lib/llm/openai-compatible.ts`                                   | nein                              | **ja (einziger Ort)** | nein                   |
| **UI (React-Inseln)**    | `src/components/**`                                                  | **nein**                          | nein                  | nein                   |
| **Ambient-Typen**        | `src/env.d.ts`                                                       | **ja** (`User`-Typ)               | nein                  | nein                   |

**Doku-Aussagen zur Austauschbarkeit** (verifiziert):

- **LLM ist bewusst austauschbar:** „ein **beliebiges** OpenAI-kompatibles Modell anhängen
  (Base-URL, API-Key, Modellname)" (`context/foundation/prd.md:64-65,136`); Non-Goal
  „kein GPU-/Modellbetrieb im Tool selbst" (`prd.md:254`). Also: Modell-Anbieter ist ein
  Laufzeit-Parameter, kein fixierter Vendor.
- **Supabase:** keine explizite Austauschbarkeits-Deklaration gefunden (`grep` über
  `context/foundation/*.md` → nur `tech-stack.md`-Nennung, kein „swap/entkoppeln").
  Supabase ist als Plattform gesetzt.

---

## Krok 1 — Durchsickernde Abhängigkeiten identifiziert

### Achse A — Supabase-Client (`@supabase/ssr`, `@supabase/supabase-js`)

**Wer kennt es heute** (verifiziert):

| Datei:Zeile                                                          | Was durchsickert                                                                                                                                                                                                                    |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/supabase.ts:1,9`                                            | einzige Client-Fabrik (`createServerClient` aus `@supabase/ssr`) — legitim                                                                                                                                                          |
| `src/env.d.ts:3`                                                     | `App.Locals.user: import("@supabase/supabase-js").User \| null` — **Bibliothekstyp im Ambient-Vertrag**                                                                                                                             |
| `src/lib/api-auth.ts:13`                                             | `type SupabaseClient = NonNullable<ReturnType<typeof createClient>>` (**Kopie 1/4**)                                                                                                                                                |
| `src/lib/api-auth.ts:15,34`                                          | `requireUser()` **gibt den rohen Client** an die Route zurück (`{ supabase, userId }`)                                                                                                                                              |
| `src/lib/api-auth.ts:30`                                             | `supabase.auth.getUser()`                                                                                                                                                                                                           |
| `src/middleware.ts:16,24`                                            | `createClient(...)` + `supabase.auth.getUser()`                                                                                                                                                                                     |
| `src/lib/services/runs.ts:34`                                        | `type SupabaseClient = ...` (**Kopie 2/4**)                                                                                                                                                                                         |
| `src/lib/services/personas.ts:22`                                    | `type SupabaseClient = ...` (**Kopie 3/4**)                                                                                                                                                                                         |
| `src/lib/services/model-configs.ts:24`                               | `type SupabaseClient = ...` (**Kopie 4/4**)                                                                                                                                                                                         |
| `runs.ts`, `personas.ts`, `model-configs.ts` (je ~5 Funktionen)      | `sb: SupabaseClient` als **Parameter jeder Service-Signatur**; PostgREST-DSL (`.from().select().eq().maybeSingle()`, `.insert()`, `.update()`, `.delete()`, `{ count:"exact", head:true }`, eingebettetes `run_repetitions(count)`) |
| `src/lib/services/runs.ts:423`                                       | `if (insErr.code === "23505")` — **roher Postgres-Fehlercode in der Orchestrierungs-Businesslogik**                                                                                                                                 |
| `src/pages/api/runs/index.ts:21,44` (+ alle übrigen `api/**`-Routes) | halten `auth.supabase` (rohes Bibliotheks-Objekt) und reichen es in die Services                                                                                                                                                    |
| `src/lib/auth-errors.ts:4-10`                                        | **Gegenbeispiel/Vorbild:** typisiert die Supabase-`AuthError` **strukturell nach**, „**statt Import aus @supabase/supabase-js, damit kein transitiver Type-Dependency-Pfad entsteht**" — bewusster Mini-ACL                         |

### Achse B — LLM-Aufrufe (handgeschriebener OpenAI-kompatibler `fetch`-Client)

**Wer kennt es heute** (verifiziert):

| Datei:Zeile                                | Was                                                                                                                                                                                                                                                            |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/llm/openai-compatible.ts:105-189` | **einziger** Ort, der das OpenAI-Wire-Format kennt: `POST …/chat/completions` (`:110`), `Bearer`-Header (`:121`), `response_format:{type:"json_object"}` (`:128`), `choices[0].message.content` (`:47-52`), `usage.prompt_tokens/completion_tokens` (`:54-59`) |
| `src/lib/services/runs.ts:16,389-398`      | **einziger** Aufrufer; ruft die **schmale** Funktion `chatCompletion(args): ChatCompletionResult` — kennt **kein** Wire-Detail                                                                                                                                 |
| `src/lib/runs/oejts-run.ts:12-16`          | Domänentyp `ChatMessage { role; content }`, Kommentar „(OpenAI-kompatibel)"                                                                                                                                                                                    |

### Achse C — zod

**Wer kennt es heute** (14 Dateien, verifiziert): alle `src/pages/api/**`-Routes
(Input-Schemas), `src/lib/api-responses.ts` (Fehler-Flattening), `src/lib/runs/run-schemas.ts`
(geteilte Schemas). **Nicht** in `src/components/**` und **nicht** in der reinen Scoring-Domäne
(`oejts-score.ts`/`oejts-aggregate.ts` importieren zod nicht).

### Achse D — Sentry

`grep @sentry src/**` → **0 Treffer**. Sentry lebt ausschließlich im Worker-Entry
`sentry.server.config.ts` (Repo-Root) + Build-Config. **Kein Schicht-Leak** — sofort
ausgeschieden.

---

## Krok 2 — Klassifikation & Wahl der #1

| Achse          | (a) Schichten/Dateien                                                                                           | (b) Tausch-Risiko heute                                                                                                  | (c) Doku deklariert Austauschbarkeit? | Rozjazd Intention↔Code                 |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- | -------------------------------------- |
| **A Supabase** | **6 Dateien / 5 Schichten**: Fabrik, Ambient-Typ, API-Auth, Middleware, 3 Services, alle API-Routes (transitiv) | **hoch** — Client-Typ in ~15 Signaturen, 4× dupliziert, roher `23505` in Businesslogik, rohes Objekt über die API-Grenze | nein (Plattform gesetzt)              | —                                      |
| **B LLM**      | 1 Adapter + 1 Aufrufer                                                                                          | **minimal** — Tausch berührt nur den Adapter                                                                             | **JA** (`prd.md:64,136,254`)          | **NEIN** — Code hält die Intention ein |
| **C zod**      | 14 Dateien (nur Boundary)                                                                                       | **niedrig** — Querschnitts-Validierung, kein Vendor-Lock, Tausch wertlos                                                 | nein                                  | —                                      |
| **D Sentry**   | 0 in `src/`                                                                                                     | —                                                                                                                        | nein                                  | —                                      |

**Wahl: Achse A — Supabase-Client als schlimmster Leak.** Begründung:

1. **Die einzige Achse mit realer Tausch-Fläche.** Der konkrete Bibliothekstyp
   `SupabaseClient` ist **4× dupliziert** (`api-auth.ts:13`, `runs.ts:34`, `personas.ts:22`,
   `model-configs.ts:24`) und **Parameter jeder** Service-Funktion — genau das Signal
   „duplizierte Rekonstruktion von Bibliotheks-Typen an mehreren Stellen" + „Bibliothekstyp
   in Domänen-Signaturen".
2. **Grenzdurchbruch nach oben.** Das **rohe** Client-Objekt verlässt die Persistenzschicht:
   `requireUser()` (`api-auth.ts:34`) gibt es an die **API-Route** zurück, die es an die
   Services weiterreicht (`runs/index.ts:21,44`). Die API-Schicht **hält** damit ein
   Persistenz-Bibliotheks-Objekt — sie sollte nur eine Domänen-Fassade kennen.
3. **Fehlercode-Leak in Businesslogik.** `insErr.code === "23505"` (`runs.ts:423`) kodiert
   ein **PostgreSQL-Detail** (Unique-Violation) mitten in der Lauf-Orchestrierung. Ein
   Backend-Wechsel (oder auch nur ein Wechsel des PostgREST-Fehlerformats) bräche diese
   Nebenläufigkeits-Invariante still.

**Warum NICHT B (LLM), obwohl die Doku dort Austauschbarkeit fordert:** weil der Code sie
**bereits einhält**. `openai-compatible.ts` ist ein lehrbuchreiner ACL: der einzige Ort des
Wire-Wissens, dahinter die schmale Funktion `chatCompletion()`; der einzige Aufrufer
(`runs.ts`) kennt kein Wire-Detail. **Kein Rozjazd** → kein Refaktor-Bedarf. Das ist das
**Vorbild**, an dem sich Achse A ausrichten soll.

---

## Krok 3 — Diagnose (Duplikation & Grenz-Durchbrüche)

### 3.1 Vierfache Typ-Duplikation (verifiziert per `grep`)

```
src/lib/api-auth.ts:13            type SupabaseClient = NonNullable<ReturnType<typeof createClient>>;
src/lib/services/model-configs.ts:24   type SupabaseClient = NonNullable<ReturnType<typeof createClient>>;
src/lib/services/personas.ts:22        type SupabaseClient = NonNullable<ReturnType<typeof createClient>>;
src/lib/services/runs.ts:34            type SupabaseClient = NonNullable<ReturnType<typeof createClient>>;
```

Vier Dateien rekonstruieren denselben Bibliothekstyp Zeichen für Zeichen. Jede Service-Datei
macht den Typ zum **Signatur-Parameter** (z. B. `listRuns(sb: SupabaseClient, …)`
`runs.ts:83`; `listModelConfigs(sb: SupabaseClient)` `model-configs.ts:52`;
`listPersonas(sb: SupabaseClient, …)` `personas.ts:70`).

### 3.2 Rohes Bibliotheks-Objekt über die API-Grenze

`api-auth.ts:15,34`:

```ts
type RequireUserResult = { supabase: SupabaseClient; userId: string } | { response: Response };
// …
return { supabase, userId: user.id };
```

`api/runs/index.ts:18-21,44`:

```ts
const auth = await requireUser(context);
if ("response" in auth) return auth.response;
const runs = await listRuns(auth.supabase, auth.userId); // rohes Client-Objekt in der Route
```

Die API-Route ist **nicht** die Persistenzschicht, hält aber die Persistenz-Bibliothek in der
Hand und reicht sie durch. Ein zweiter Client dieses Musters (künftige Route, Cron, Export)
müsste denselben rohen Client instanziieren und dieselben `.from()`-Details kennen.

### 3.3 Persistenz-Detail in der Orchestrierungs-Invariante

`runs.ts:410-437` (F4 aus dem Plan-Review, `01-domain-distillation.md:119` A5):

```ts
const { error: insErr } = await sb.from("run_repetitions").insert({ … });
if (insErr) {
  if (insErr.code === "23505") {           // ← PostgreSQL-Fehlercode als Businessregel
    // Parallel bereits geschrieben → Fortschritt neu lesen (Idempotenz je rep_index)
  }
  fail("step:insert", insErr.message);
}
```

Die **Domänen**-Regel „Doppelaufruf darf nicht doppelt schreiben" (Aggregat-Invariante A5)
hängt an der Zeichenfolge `"23505"`. Der Test kennt sie ebenfalls
(`src/test/integration/run-integrity.itest.ts:94,108`) — d. h. der Bibliotheks-Fehlercode ist
bereits Teil des beobachtbaren Vertrags.

### 3.4 Ambient-Typ-Leak

`env.d.ts:3` bindet `App.Locals.user` an `import("@supabase/supabase-js").User`. Jeder
Konsument von `context.locals.user` (Middleware, jede geschützte Page) erbt transitiv den
Bibliothekstyp.

### 3.5 Der Code kennt das Muster bereits — nur unvollständig

`auth-errors.ts:4-10` typisiert die `AuthError` **strukturell** nach, ausdrücklich „damit kein
transitiver Type-Dependency-Pfad entsteht". Das **ist** ein Mini-ACL — aber nur für die
Fehler-Form, nicht für den Client. Der Refaktor verallgemeinert diese schon getroffene
Design-Entscheidung.

### 3.6 Was NICHT leakt (ehrliche Entlastung)

- **UI:** `grep @supabase src/components` → 0. Kein Client/Server-Grenz-Doppelaufruf (kein
  Browser-Client) — der in der Aufgabe genannte „gefährlichste" Fall (serverseitige
  Bibliothek im Client-Bundle) **liegt hier nicht vor**.
- **Reine Domäne:** `oejts-score.ts`/`oejts-aggregate.ts`/`oejts-run.ts`/`crypto.ts` kennen
  Supabase nicht (verifiziert per Glob/Grep). Scoring ist bereits persistenz-frei.
- Deshalb ist die Refaktor-Dimension **klein** (siehe Krok 6).

---

## Krok 4 — Design des ACL

Kernidee: **ein einziger Ort des Wissens** über Supabase — ein Adapter-Verzeichnis, das die
Bibliothek importiert. Der Rest kennt nur **Domänen-Ports** (schmale Interfaces) und
**Domänen-Fehler**. Vorbild ist der bereits vorhandene LLM-Adapter (`openai-compatible.ts`).

Neues Verzeichnis: `src/lib/persistence/`

```
src/lib/persistence/
  ports.ts                 ← Domänen-Interfaces (NULL Bibliotheks-Import)
  errors.ts                ← Domänen-Fehler (UniqueViolation …)
  supabase/
    client.ts              ← einzige Client-Fabrik + einziger `SupabaseClient`-Typ
    run-repository.ts       ← implements RunRepository
    persona-repository.ts   ← implements PersonaRepository
    model-config-repository.ts ← implements ModelConfigRepository
    map-error.ts           ← PostgREST/Postgres-Fehler → Domänen-Fehler (kennt "23505")
```

### 4.1 Domänen-Ports (`ports.ts`) — schmal, bibliotheksfrei

Signaturen benutzen **ausschließlich** bestehende Domänen-Typen aus `src/types.ts`
(`RunView`, `RunProgress`, `PersonaView`, `ModelConfigView`, `CreateRunInput`, …). Kein
`SupabaseClient` mehr in irgendeiner Signatur.

```ts
// src/lib/persistence/ports.ts  — kennt @supabase NICHT
export interface RunRepository {
  list(userId: string): Promise<RunView[]>;
  get(userId: string, id: string): Promise<RunView | null>;
  create(userId: string, input: CreateRunInput): Promise<RunView | null>;
  delete(id: string): Promise<boolean>;
  updateVisibility(userId: string, id: string, v: Visibility): Promise<RunView | null>;
  getResult(userId: string, id: string): Promise<RunResultView | null>;
  // Orchestrierungs-Primitiven, die processNextRepetition heute inline macht:
  readStepState(id: string): Promise<RunStepState | null>;
  countReps(id: string): Promise<number>;
  patch(id: string, patch: RunPatch): Promise<void>;
  /** wirft UniqueRepetitionError statt "23505" nach oben durchzureichen */
  insertRepetition(rep: NewRepetition): Promise<void>;
}

export interface PersonaRepository {
  /* list/create/duplicate/delete/updateVisibility */
}
export interface ModelConfigRepository {
  list(): Promise<ModelConfigView[]>;
  create(input: CreateModelConfigInput): Promise<ModelConfigView>;
  update(id: string, input: UpdateModelConfigInput): Promise<ModelConfigView | null>;
  delete(id: string): Promise<boolean>;
  /** entschlüsselte Zielkonfig (server-only) — Krypto bleibt im Adapter gekapselt */
  getDecryptedTarget(id: string): Promise<DecryptedTarget | null>;
}

export interface RepositoryBundle {
  runs: RunRepository;
  personas: PersonaRepository;
  modelConfigs: ModelConfigRepository;
}
```

### 4.2 Domänen-Fehler (`errors.ts`)

```ts
// src/lib/persistence/errors.ts — kennt @supabase NICHT
export class UniqueRepetitionError extends Error {} // ersetzt "23505"-String-Match
export class PersistenceError extends Error {} // generischer DB-Fehler (Route → 500)
```

### 4.3 Supabase-Adapter (`supabase/*`) — der EINZIGE Bibliotheks-Kenner

```ts
// src/lib/persistence/supabase/client.ts — einziger @supabase-Import + einziger Typ
import { createServerClient, parseCookieHeader } from "@supabase/ssr";
export type SupabaseClient = NonNullable<ReturnType<typeof createSupabaseClient>>;
export function createSupabaseClient(headers: Headers, cookies: AstroCookies) {
  /* wie heute */
}

// src/lib/persistence/supabase/map-error.ts — kennt "23505" als EINZIGER Ort
export function mapWriteError(e: { code?: string; message: string }): Error {
  if (e.code === "23505") return new UniqueRepetitionError(e.message);
  return new PersistenceError(e.message);
}

// src/lib/persistence/supabase/run-repository.ts
export class SupabaseRunRepository implements RunRepository {
  constructor(private sb: SupabaseClient) {} // Client bleibt privat
  async insertRepetition(rep: NewRepetition) {
    const { error } = await this.sb.from("run_repetitions").insert(/* … */);
    if (error) throw mapWriteError(error); // "23505" wird hier zu UniqueRepetitionError
  }
  // list/get/create/… : heutiges runs.ts-CRUD, unverändert, nur als Methoden
}
```

Der bestehende Service-Code (`toView`, `toStepState`, `seedFrom`, das reine
Permutations-/Parse-/Aggregat-Zusammenspiel) wandert **im Wortlaut** in die Repository-Methoden
bzw. — für die reine Orchestrierung `processNextRepetition` — in einen Service, der jetzt
gegen das **Port** programmiert (`RunRepository`, `ModelConfigRepository`,
`chatCompletion`), nicht mehr gegen `sb`. Das String-Match `"23505"` wird durch
`catch (e) { if (e instanceof UniqueRepetitionError) … }` ersetzt.

### 4.4 Grenz-Fassade statt rohem Client

`requireUser()` gibt statt `{ supabase, userId }` künftig `{ repos: RepositoryBundle, userId }`
zurück:

```ts
// api-auth.ts (nachher) — kein SupabaseClient-Typ mehr exportiert
const sb = createSupabaseClient(context.request.headers, context.cookies);
// … getUser …
return { repos: makeSupabaseRepositories(sb), userId: user.id };
```

Die API-Route ruft dann `auth.repos.runs.list(auth.userId)` — sie hält **kein**
Bibliotheks-Objekt mehr. `makeSupabaseRepositories(sb)` ist die einzige Fabrik, die die drei
Adapter zusammensteckt.

### 4.5 Ambient-Typ entkoppeln

`env.d.ts:3` `User` → schmaler Domänen-Typ (analog `auth-errors.ts`-Muster):

```ts
// types.ts:  export interface AuthUser { id: string; email: string | null; }
// env.d.ts:  interface Locals { user: AuthUser | null; }
```

Middleware mappt `supabase.auth.getUser()`-Ergebnis auf `AuthUser` (im Adapter/an der Naht).

---

## Krok 5 — Isolations-Beweis + Before/After

### 5.1 Ein Tausch berührt nur den Adapter

Angenommen, Supabase würde durch ein anderes Postgres-Backend ersetzt. Betroffen wäre
**ausschließlich** `src/lib/persistence/supabase/**` (neue Adapter-Implementierung derselben
Ports). **Nicht** berührt:

| Ebene                                        | Warum unberührt                                                             |
| -------------------------------------------- | --------------------------------------------------------------------------- |
| **Tabellen / Migrationen**                   | Ports beschreiben Domänen-Operationen, keine SQL-Details                    |
| **API-Routes** (`api/**`)                    | reden nur mit `RepositoryBundle` + Domänen-Fehlern                          |
| **Orchestrierung** (`processNextRepetition`) | hängt am `RunRepository`-Port + `UniqueRepetitionError`, nicht an `"23505"` |
| **Reine Domäne** (`oejts-*`, `crypto.ts`)    | kannte Supabase nie                                                         |
| **UI** (`components/**`)                     | kannte Supabase nie                                                         |
| **Ambient-Typ** (`env.d.ts`)                 | nutzt `AuthUser`, nicht `@supabase`-`User`                                  |

### 5.2 Before/After der Duplikation

|                      | Vorher                                                               | Nachher                                                                     |
| -------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `SupabaseClient`-Typ | **4×** (`api-auth:13`, `runs:34`, `personas:22`, `model-configs:24`) | **1×** in `persistence/supabase/client.ts`, nicht exportiert an Konsumenten |
| Client in Signaturen | ~15 Service-Funktionen `(sb: SupabaseClient, …)`                     | 0 — Methoden auf Repository-Instanzen, Client privat                        |
| `"23505"`            | inline in `runs.ts:423` (Businesslogik)                              | 1× in `map-error.ts`; Orchestrierung fängt `UniqueRepetitionError`          |
| API-Route hält       | rohes `auth.supabase`                                                | `auth.repos` (Domänen-Fassade)                                              |

### 5.3 UI bekommt fertige Domänen-Daten (bereits heute erfüllt — bleibt erfüllt)

`api/runs/index.ts:21-22` liefert `RunView[]` (JSON), die Insel `RunRunner.tsx` konsumiert
Domänen-DTOs — **nie** ein Supabase-Objekt. Der Refaktor ändert das nicht; er verhindert nur,
dass ein **künftiger** Server-Pfad das rohe Objekt weiterreicht.

### 5.4 Bibliotheks-Vertrag: Entscheidung im ACL kodiert

Die Frage „welcher Fehlercode bedeutet Doppel-Insert?" ist ein **PostgREST/Postgres-Vertrag**
(`23505` = `unique_violation`, SQLSTATE). Diese Entscheidung wird **einmal** in
`persistence/supabase/map-error.ts` kodiert (nicht in der API-Route, nicht in der
Orchestrierung). Wechselt das Backend/Format, ändert sich nur diese eine Datei.

---

## Krok 6 — Verifikation & Phasen-Plan

### 6.1 Erfolgskriterium (sprawdzalne, für die Zukunft)

```
grep -rE "@supabase/(ssr|supabase-js)" src/    # nachher: NUR src/lib/persistence/supabase/**
grep -rn "SupabaseClient" src/                 # nachher: NUR persistence/supabase/client.ts
grep -rn "23505" src/lib src/pages             # nachher: NUR persistence/supabase/map-error.ts
```

**Kennt es heute** (soll nachher **nicht** mehr): `env.d.ts:3`, `api-auth.ts:13,15,34`,
`middleware.ts:16,24`, `services/runs.ts:34,423`, `services/personas.ts:22`,
`services/model-configs.ts:24`, alle `api/**`-Routes (transitiv über `auth.supabase`).
**Kennt es nachher (erlaubt):** nur `src/lib/persistence/supabase/**`.
**Kannte es nie / bleibt sauber:** `components/**`, `oejts-*`, `crypto.ts`,
`persona-compile.ts`, `openai-compatible.ts`.

### 6.2 Realistische Dimension (ehrlich)

Das ist ein **mittelkleiner, additiver** Refaktor: 3 Services (~460+180+140 Zeilen) werden zu
Repository-Klassen umgehängt, plus Port-/Error-/Fabrik-Dateien. **Kein** Verhalten ändert
sich, **keine** Migration, **keine** UI-Änderung. Der Kern-Gewinn ist nicht „Bugfix", sondern
das **verifizierbare Zukunfts-Kriterium** aus 6.1 plus das Schließen des `23505`-Leaks. Wer
Supabase nie tauschen will, kann den Refaktor auf **Phase A** (Typ-Deduplikation) beschränken
und den Rest parken — auch das ist ein legitimer, kleiner Endzustand.

### 6.3 Guard-first Phasen (Format wie `context/archive/2026-06-30-refactor-opportunities/plan.md`)

**Phase A — Typ-Deduplikation (rein additiv, sofort wertstiftend, umkehrbar)**

- Einen `SupabaseClient`-Typ + Fabrik nach `persistence/supabase/client.ts` ziehen; die 4
  lokalen Aliase darauf umbiegen (`import type`). Verhalten unverändert.
- Guard: `astro check` + `npm run test` grün; `grep -c SupabaseClient src` fällt von 4-Definitionen
  auf 1-Definition + Re-Exports.
- _(Optionaler Stopp-Punkt für „will nie tauschen".)_

**Phase B — Domänen-Fehler + `23505`-Kapselung (schließt den Businesslogik-Leak)**

- `errors.ts` (`UniqueRepetitionError`) + `map-error.ts` einführen; `runs.ts`-Insert über
  `mapWriteError` leiten; String-Match `"23505"` durch `instanceof`-Fang ersetzen.
- Guard: `src/test/integration/run-integrity.itest.ts:94` (Nebenläufigkeits-/23505-Test) bleibt
  **grün** — beweist Verhaltensgleichheit. Dann Test-Assertion vom Code-String auf den
  Domänen-Fehler umstellen.

**Phase C — Ports + Adapter-Klassen (Client aus Signaturen entfernen)**

- `ports.ts` schreiben; `SupabaseRunRepository`/`…Persona…`/`…ModelConfig…` als dünne
  Klassen um den **bestehenden** Funktionsrumpf. Services rufen intern die Methoden.
- Guard: pro Repository ein eigener Commit; nach jedem `npm run test:integration` grün.

**Phase D — Grenz-Fassade + Ambient-Typ**

- `requireUser()`/Middleware auf `RepositoryBundle` + `AuthUser` umstellen; API-Routes von
  `auth.supabase` auf `auth.repos.*` umschreiben; `env.d.ts` `User` → `AuthUser`.
- Guard: E2E (`npm run test:e2e`) + Integration grün; danach das Erfolgskriterium-`grep` aus
  6.1 als **CI-fähiger Check** dokumentieren (optional: eslint `no-restricted-imports` auf
  `@supabase/*` außerhalb `persistence/supabase/**`).

**Was wir NICHT tun** (Scope-Grenzen):

- **Kein** LLM-Refaktor — `openai-compatible.ts` ist bereits der Ziel-ACL (Vorbild), nicht das
  Problem.
- **Kein** zod-Refaktor — Querschnitts-Validierung an der Boundary, kein Vendor-Leak.
- **Keine** Sentry-Arbeit — kein Schicht-Leak (`grep @sentry src` = 0).
- **Keine** Verhaltens-/Schema-/UI-Änderung; reine Struktur-Umschichtung.
  </content>
  </invoke>
