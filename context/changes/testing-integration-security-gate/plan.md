# Integration Security Gate (Test-Rollout Phase 1) Implementation Plan

## Overview

Wir bauen das **erste Integration-Test-Harness** dieses Projekts und schreiben
damit Regressionssicherungen für drei Sicherheits-Risiken aus
`context/foundation/test-plan.md`: **Risk #1** (Cross-Tenant-Leak via RLS),
**Risk #2** (entschlüsselter API-Key entkommt über eine Boundary) und **Risk #5**
(unauthentifizierter Request erreicht eine geschützte API-Route). Das Harness
treibt **zwei echte authentifizierte Supabase-Sessions** gegen ein **lokales
Docker-Supabase** und wird von test-plan Phase 2 (Run-Integrität + SSRF)
wiederverwendet.

## Current State Analysis

- **Nur Unit-Tests vorhanden:** 6 Pure-Function-`*.test.ts` unter `src/lib/`
  (crypto, url-guard, persona-compile, oejts-run/score/aggregate) — kein
  Supabase, kein Astro, kein Mock, kein I/O. Integration ist Neuland.
- **Vitest** `^4.1.9`, `vitest.config.ts:11-13` plain (node-env, kein
  Astro-Plugin, kein setupFile), `include: ["src/**/*.test.ts"]`, Alias `@`→`./src`.
- **Code ist an allen drei Fronten sauber** (Research): RLS trägt die
  Mandanten-Trennung **allein** (kein Code-Backstop, kein `service_role`-Client,
  kein manueller `owner_id`-Filter — `src/lib/services/{personas,runs,model-configs}.ts:9-13`).
  Key-Dichtheit ist dreischichtig erzwungen (SQL-Projektion `VIEW_COLUMNS`
  `model-configs.ts:29` + `toView` `:34-44` + Typ `types.ts:28-36`). Auth-Gates
  vollständig (`src/middleware.ts:4`, `src/lib/api-auth.ts:22-40`).
- **Lokales Supabase konfiguriert:** `supabase/config.toml` (API 54321, DB 54322,
  Inbucket 54324), **`enable_confirmations = false`** (`:209`) → programmatischer
  Signup ohne Mail-Bestätigung. 8 Migrationen, **kein `seed.sql`**.
- **Architektur begünstigt das Harness:** Business-Logik in
  client-parametrisierten Services → Service-Level-Tests umgehen den einzigen
  harten Astro-Kopplungspunkt (`astro:env/server` via `src/lib/supabase.ts:3`
  und `src/lib/encryption-key.ts:1`).
- **Fertige Seed-Matrix existiert** als Muster:
  `context/archive/2026-06-20-visibility-controls/plan.md:289-294`.

## Desired End State

`npm run test:integration` startet gegen ein laufendes lokales Supabase und
beweist deterministisch:

1. **Risk #1:** Account A erhält 404 (nicht leeres 200/Array) auf B's IDs über
   GET/PATCH/DELETE/step/result/duplicate für personas, runs, model-configs;
   B's private Objekte sind für A unsichtbar, B's globale lesbar aber nicht
   schreibbar; jede Mutation wird per DB-Gegenprobe als No-Op bestätigt.
2. **Risk #2:** Kein Response-View und kein an den Client gereichtes Objekt
   enthält je Klartext- oder Ciphertext-Key; `hasKey:boolean` ist der einzige
   Key-Indikator; ein Typ-Guard bricht den Build, falls `ModelConfigView` je
   ein Key-Feld bekommt.
3. **Risk #5:** Jede der 13 `/api`-Routes liefert ohne Session **401**; mit
   gültiger Session passiert sie; auth-Routes bleiben public.

`npm run test` (Unit) bleibt schnell und Docker-frei; die Integration-Suite ist
opt-in bis test-plan §3 Phase 3 sie als CI-Gate verdrahtet.

### Key Discoveries:

- RLS ist die **einzige** Mandanten-Grenze (`services/*.ts:9-13`) → 0-Row-Match
  ≠ Erfolg, Mutationen mappen `null`→404 via `.maybeSingle()` (S-02-Lesson,
  `dtb-project/project-changelog/2026-06/2026-06-16.md:112-115`).
- `visibility='global'` weitet **nur select**, nie write — B's globales Objekt
  ist von A lesbar, PATCH/DELETE darauf müssen 404 liefern (`supabase/migrations/`
  personas/runs update/delete-Policies ohne visibility-Klausel).
- `run_repetitions` hat keinen eigenen `owner_id`; select erbt own-or-global per
  exists-Subquery, writes sind owner-only — `getRunResult` (`runs.ts:192,200`)
  liest Parent **und** Child separat → beide RLS-Ebenen testen.
- Einziger Key-Klartext-Pfad: `getDecryptedTarget` (`model-configs.ts:122-139`),
  server-only, fließt nur in `Authorization`-Header / `chatCompletion`
  (`runs.ts:359,391`); **kein** `GET /api/models/[id]`-Detail-Route existiert.
- Zwei Test-Clients via plain `@supabase/supabase-js` (`package.json:25`) — Typ
  strukturell identisch zu dem, was Services erwarten (`model-configs.ts:24`).

## What We're NOT Doing

- **Kein CI-Gate jetzt** — `npm run test:integration` läuft lokal; das
  Verdrahten als GitHub-Actions-Pre-Deploy-Gate ist test-plan §3 Phase 3.
- **Kein Re-Test der Units** — crypto/url-guard/scoring/aggregation sind
  abgedeckt (test-plan §7); wir testen Boundaries, nicht die Units erneut.
- **Risk #3 (SSRF) und Risk #4 (Run-Integrität)** sind test-plan §3 Phase 2.
- **Kein Page-302-Redirect-Test** (Middleware/Browser) — geht als light-e2e in
  §3 Phase 3; Phase 1 deckt nur die API-401-Seite von Risk #5.
- **Kein `service_role`-Key** im Test (CLAUDE/`.env.example`-Regel) — Test-User
  per anon-key-`signUp`.
- **Keine Produktcode-Änderung** — der Code ist bewiesen korrekt; dieser Change
  fügt nur Tests + Test-Infra + Doku-Updates hinzu.

## Implementation Approach

Hybrid-Harness: Die RLS- und Key-Masse (Risk #1/#2) läuft auf **Service-Level**
— zwei `@supabase/supabase-js`-Clients rufen die Service-Funktionen
(`src/lib/services/*`) direkt mit echten Sessions; das umgeht `astro:env/server`
ganz und testet exakt die RLS-tragende Logik. Die HTTP-Status-Codes von Risk #5
brauchen die Route-Schale → dafür kommt in Phase 4 die **Astro Container API**
(`getViteConfig` löst `astro:env` auf, Endpoints laufen in-process in Node)
hinzu. Test-User werden pro Suite programmatisch per `signUp` mit
Timestamp-Suffix-Mails angelegt und am Ende aufgeräumt (Test-Unabhängigkeit).

## Critical Implementation Details

- **Lokale Supabase-Keys statt Prod:** Die Integration-Env muss `SUPABASE_URL`
  auf `http://127.0.0.1:54321` und `SUPABASE_KEY` auf den **lokalen** anon-key
  aus `npx supabase status` zeigen — niemals die Remote-/Prod-Werte. Sonst
  liefen Tests gegen Live-Daten. Eigene `.env.test` (gitignored), nicht `.env`.
- **`ENCRYPTION_KEY` ist Pflicht:** `createModelConfig` verschlüsselt beim
  Insert (`model-configs.ts:60`); ohne gesetzten `ENCRYPTION_KEY` wirft
  `getEncryptionKey()` (`encryption-key.ts:11`). Das setupFile muss ihn laden.
- **DB-Reset-Reihenfolge:** Tests gegen eine gemeinsame lokale DB dürfen nicht
  parallel über dieselben Daten laufen. Integration-Config sequenziell
  (`fileParallelism: false` / single fork) ODER jeder Test legt eigene
  Timestamp-User+Objekte an und räumt sie auf. Letzteres bevorzugt (echte
  Isolation, re-run-fest).
- **S-02-Assertion-Disziplin:** Bei Cross-Tenant-Tests **immer** den Status/Wert
  prüfen (404 / `null` / `false`) UND per zweitem (B-)Client gegenprüfen, dass
  B's Zeile unverändert existiert. Ein leeres Array / `0 rows` ist kein Beweis.

## Phase 1: Integration-Harness-Bootstrap

### Overview

Die wiederverwendbare Test-Infrastruktur: separate Vitest-Integration-Config,
env-Loading, Zwei-Account-Fixture mit Cleanup, npm-Script, und ein Smoke-Test
der beweist, dass zwei authentifizierte Clients gegen die lokale DB arbeiten.

### Changes Required:

#### 1. Vitest-Integration-Config

**File**: `vitest.integration.config.ts`

**Intent**: Eine von der Unit-Config getrennte Vitest-Config, damit `npm run
test` Docker-frei und schnell bleibt und die DB-Integration opt-in ist.

**Contract**: `defineConfig` aus `vitest/config`; `test.include:
["src/**/*.itest.ts"]`; `environment: "node"`; `globals` wie Unit-Config;
`setupFiles: ["./src/test/integration/setup.ts"]`; sequenzielle Ausführung
(`fileParallelism: false` oder `poolOptions.forks.singleFork: true`); Alias
`@`→`./src` (analog `vitest.config.ts:5-8`). Die bestehende `vitest.config.ts`
bleibt unverändert (Unit-only).

#### 2. Integration-Setup (env)

**File**: `src/test/integration/setup.ts`

**Intent**: Lädt vor jedem Integration-Lauf die lokale Test-Env, damit Services
`SUPABASE_URL`/`SUPABASE_KEY`/`ENCRYPTION_KEY` sehen.

**Contract**: `dotenv` (bereits transitiv via Supabase-Stack vorhanden, sonst
devDependency) lädt `.env.test`; setzt `process.env`-Werte für lokale
Supabase-Instanz. Liefert keine Astro-`astro:env`-Auflösung (Service-Level
braucht sie nicht; Phase 4 ergänzt sie via Container).

#### 3. `.env.test`-Vorlage

**File**: `.env.test.example` (+ `.env.test` lokal, gitignored)

**Intent**: Dokumentiert die lokalen Supabase-Test-Werte, ohne Secrets zu
committen.

**Contract**: `SUPABASE_URL=http://127.0.0.1:54321`, `SUPABASE_KEY=<lokaler
anon-key>`, `ENCRYPTION_KEY=<base64 32 byte>`. `.gitignore`-Eintrag für
`.env.test`. `.env.test.example` mit Platzhaltern + Kommentar „aus `npx supabase
status`".

#### 4. Zwei-Account-Fixture

**File**: `src/test/integration/accounts.ts`

**Intent**: Stellt zwei frisch angelegte, authentifizierte `SupabaseClient`-
Instanzen (A, B) bereit und räumt die Test-User/-Daten danach auf.

**Contract**: `createTestAccount(): Promise<{ client: SupabaseClient; userId:
string; email: string }>` baut `createClient(SUPABASE_URL, SUPABASE_KEY)` aus
`@supabase/supabase-js`, ruft `signUp` mit `e2e+<timestamp>-<rand>@…`-Mail
(eindeutig je Lauf, analog CLAUDE-E2E-Regel), dann `signInWithPassword`.
`cleanupTestData(client)` löscht die vom User angelegten personas/runs/
model-configs (owner-scoped, RLS erlaubt eigenes Delete). Helper zum Anlegen von
Fixtures (private/global Persona, private/global Run + ≥1 repetition,
ModelConfig mit Sentinel-Key) für die folgenden Phasen.

#### 5. npm-Script

**File**: `package.json`

**Intent**: Integration-Suite getrennt aufrufbar machen.

**Contract**: `"test:integration": "vitest run --config vitest.integration.config.ts"`
(+ optional `test:integration:watch`). `test`/`test:watch` bleiben unverändert.

#### 6. Smoke-Test

**File**: `src/test/integration/smoke.itest.ts`

**Intent**: Beweist, dass das Harness steht — zwei Accounts, beide
authentifiziert, beide sehen ihre eigene leere Objektliste.

**Contract**: Legt A und B an, asserted für beide `auth.getUser()` liefert eine
User-ID, und `listModelConfigs(client)` gibt `[]` zurück; Cleanup im
`afterAll`/`afterEach`.

### Success Criteria:

#### Automated Verification:

- Lokales Supabase läuft: `npx supabase status` zeigt API auf 54321
- Integration-Config wird erkannt: `npm run test:integration` startet ohne
  Config-Fehler
- Smoke-Test grün: `npm run test:integration` → `smoke.itest.ts` PASS
- Unit-Lauf unverändert/grün und Docker-frei: `npm run test`
- Lint/Typecheck grün: `npm run lint` und `npx astro check`

#### Manual Verification:

- `.env.test` zeigt auf lokale (nicht Remote-) Supabase-Werte — visuell geprüft
- Re-run des Smoke-Tests kollidiert nicht (eindeutige Timestamp-Mails); keine
  Test-User-Reste in der lokalen DB nach Cleanup

**Implementation Note**: Nach dieser Phase und grüner Automatik hier für manuelle
Bestätigung pausieren, bevor Phase 2 startet.

---

## Phase 2: Risk #1 — Cross-Tenant-RLS-Matrix

### Overview

Volle Zwei-Konten-Matrix auf Service-Level inkl. der drei feinen Fälle, je mit
DB-Gegenprobe und Positiv-Kontrolle.

### Changes Required:

#### 1. RLS-Cross-Tenant-Tests

**File**: `src/test/integration/rls-cross-tenant.itest.ts`

**Intent**: Beweist, dass A nicht auf B's Objekte zugreifen kann, dass globale
Sichtbarkeit nur Lesen erlaubt, und dass jede geblockte Mutation ein No-Op ist.

**Contract**: Nutzt die Fixture aus Phase 1. B legt an: private + globale
Persona, privaten (+1 repetition) + globalen Run, eine ModelConfig. Dann A's
Client/Services gegen B's IDs. Erwartungen je Zeile der Matrix:

- GET `getRun`/`getRunResult`/`getPersona` auf B-private → `null`
- `processNextRepetition` (step) auf B-private Run → `null` + B-Run-Status
  unverändert (Gegenprobe via B-Client) + kein Key-Verbrauch
- `update/deletePersona`, `update/deleteRun`, `update/deleteModelConfig` auf
  B-private → `null`/`false` + B-Zeile existiert noch (Gegenprobe)
- **Fein (a) global ≠ write:** `updateRun`/`deleteRun` und
  `updatePersona`/`deletePersona` auf B's **globales** Objekt → `null`/`false`
  trotz Lesbarkeit
- **Fein (b) run_repetitions Doppelpfad:** `getRunResult` auf B-private prüft
  Parent **und** Child-select — beide liefern für A nichts
- **Fein (c) Seed-Persona `owner_id=NULL`:** `updatePersona`/`deletePersona`
  darauf → `null`/`false`
- `duplicatePersona` auf B-private → `null`; auf B-**global** → Erfolg, Kopie ist
  A-owned + `visibility='private'`
- `createRun` mit B's privater `personaId`/`modelConfigId` → Fehler/`null`
  (Vorab-Checks `runs.ts:104,113`)
- List-Endpoints aus A's Sicht: `listPersonas`/`listRuns` enthalten B-global,
  **nicht** B-private; `listModelConfigs` enthält **keine** B-Config
- **Positiv-Kontrolle:** A gegen eigene Objekte für jede Operation → Erfolg, und
  mindestens eine A-Mutation verändert nachweislich die eigene Zeile

### Success Criteria:

#### Automated Verification:

- Alle RLS-Matrix-Fälle grün: `npm run test:integration`
- Lint/Typecheck grün: `npm run lint`, `npx astro check`

#### Manual Verification:

- Stichprobe: ein Matrix-Fall liefert nachweislich **404/null**, nicht ein
  leeres 200/Array (S-02-Lesson) — im Testcode verifiziert
- Positiv-Kontrolle schlägt fehl, wenn man RLS testweise lockern würde
  (Gedanken-/Stichprobe, kein Prod-Eingriff)

**Implementation Note**: Nach grüner Automatik für manuelle Bestätigung
pausieren.

---

## Phase 3: Risk #2 — Key-Dichtheit

### Overview

Beweist, dass weder Klartext- noch Ciphertext-Key je eine Service-/Client-
Boundary überschreitet, plus ein Typ-Guard als Regression-Lock.

### Changes Required:

#### 1. Key-Boundary-Tests

**File**: `src/test/integration/key-boundary.itest.ts`

**Intent**: Asserted die Abwesenheit des Secrets in allen client-gerichteten
Views und beweist, dass der Klartext-Pfad nicht in Run-DTOs leakt.

**Contract**: Account legt ModelConfig mit Sentinel-Key (z.B.
`sk-SENTINEL-<rand>`) an. Für `createModelConfig`-Rückgabe,
`listModelConfigs`-Items und `updateModelConfig`-Rückgabe gilt:
`JSON.stringify(view)` enthält **weder** den Sentinel **noch** die Feldnamen
`key_ciphertext`/`key_iv`/`key_version`/`apiKey`; `hasKey === true`; Feldmenge
exakt `{id,label,baseUrl,modelName,hasKey,createdAt,updatedAt}`. Run-DTOs
(`processNextRepetition`/`getRunResult`-Rückgaben) enthalten den Sentinel nie.
`getDecryptedTarget` (direkt aufgerufen) gibt den Sentinel zwar zurück (Beweis,
dass der server-only Pfad existiert), aber kein in eine Response gemappter Pfad
tut es.

#### 2. Typ-Regression-Lock

**File**: `src/test/integration/key-boundary.itest.ts` (oder ein
`*.test-d.ts`/`expectTypeOf`-Block)

**Intent**: Bricht den Build, falls `ModelConfigView` je ein Key-Feld erhält.

**Contract**: `expectTypeOf<ModelConfigView>()` hat keine
`key_ciphertext`/`key_iv`/`key_version`/`apiKey`-Member (Vitest `expectTypeOf`
oder ein `// @ts-expect-error`-Zugriff). Optional zusätzlich: assert, dass die
`VIEW_COLUMNS`-Konstante (`model-configs.ts:29`) keinen `key_`-Spaltennamen
enthält.

### Success Criteria:

#### Automated Verification:

- Key-Dichtheits-Tests grün: `npm run test:integration`
- Typ-Guard greift: ein testweises Hinzufügen eines Key-Felds zu
  `ModelConfigView` lässt `npx astro check`/den Typ-Test fehlschlagen (verifiziert,
  dann zurückgenommen)
- Lint grün: `npm run lint`

#### Manual Verification:

- **SSR-HTML-Check:** Gegen `npm run dev` die `/models`-Seite laden und im
  view-source / Netzwerk-Payload bestätigen, dass weder Sentinel-Key noch
  `key_ciphertext`/`key_iv` im an `ModelConfigManager` serialisierten
  `initialConfigs`-Prop auftauchen (stärkster End-to-End-Beweis der
  Server→Client-Grenze)
- `test-connection`-Response (manuell mit Sentinel-Config) enthält nur
  `{ok,…}`/`{ok:false,reason}`, kein Key, kein Upstream-Echo

**Implementation Note**: Nach grüner Automatik für manuelle Bestätigung
pausieren.

---

## Phase 4: Risk #5 — API-Auth-Gates (Route-Level) + Doku-Closeout

### Overview

Führt die Route-Level-Fähigkeit (Astro Container) ein und beweist, dass jede
geschützte `/api`-Route ohne Session 401 liefert; schließt die Phase mit den
Doku-Updates ab.

### Changes Required:

#### 1. Route-Level-Harness (Astro Container)

**File**: `src/test/integration/route-context.ts`

**Intent**: Erlaubt das In-Process-Aufrufen echter API-Route-Handler inkl.
`astro:env`-Auflösung, ohne externen Dev-Server.

**Contract**: Nutzt die Astro Container API (`getViteConfig` aus `astro/config`
in einer eigenen `vitest.route.config.ts`, oder
`experimental_AstroContainer.create()` + `renderToResponse(Endpoint, {
routeType: "endpoint", request })`). Hilfsfunktion baut einen `Request` mit/ohne
Auth-Cookie (Cookie aus B's `session.access_token` der Fixture). Falls die
Container-Route-Auflösung von `astro:env/server` in Vitest sich als zu
aufwändig/brüchig erweist, Fallback: `getViteConfig`-basierte Config, die das
virtuelle Modul auflöst — Entscheidung beim Implementieren anhand des
Container-Verhaltens, Ziel bleibt der In-Process-Aufruf (kein Dev-Server).

#### 2. Auth-Gate-Tests

**File**: `src/test/integration/auth-gates.itest.ts`

**Intent**: Beweist das 401-Gate über alle geschützten Routes und die
public-Routes.

**Contract**: Für jede der 13 JSON-Routes (`models` index/[id]/test-connection,
`personas` index/[id]/[id]/duplicate, `runs` index/[id]/[id]/step/[id]/result)
ein Request **ohne** Session → Status **401**. Für eine Stichprobe je Ressource:
Request **mit** gültiger Session (Fixture-Cookie) → kein 401 (200/201/400 je
nach Body). Auth-Routes (`/api/auth/signin`,`signup`,`signout`) ohne Session →
erreichbar (kein 401). Tabellengetrieben (`it.each` über die Route-Liste).

#### 3. Cookbook + Doku-Closeout

**File**: `context/foundation/test-plan.md`, `CLAUDE.md`

**Intent**: Das frisch etablierte Muster dokumentieren und veraltete/Tracking-
Stände nachziehen.

**Contract**: test-plan §6.2 (Integration-Test hinzufügen) und §6.4 (API-Endpoint-
Test) mit dem realen Harness-Muster füllen (statt „TBD"); §3-Statustabelle P1 →
`complete`; §8 Freshness-Datum aktualisieren. In `CLAUDE.md` den Satz „Kein
Test-Runner eingerichtet" durch den realen Stand ersetzen (Vitest da,
`test`/`test:integration` vorhanden; `test_command` in `workflow.config.yaml`
ist bereits `npm run test`).

### Success Criteria:

#### Automated Verification:

- Alle Auth-Gate-Tests grün: `npm run test:integration`
- Jede der 13 Routes liefert unauth 401 (tabellengetrieben, keine Route fehlt)
- Lint/Typecheck grün: `npm run lint`, `npx astro check`

#### Manual Verification:

- Stichprobe: eine geschützte Route mit gültigem Cookie liefert nachweislich
  **nicht** 401 (Positiv-Kontrolle gegen ein triviales „alles 401")
- test-plan §6.2/§6.4 lesen sich als brauchbares Rezept; §3 P1 = `complete`
- CLAUDE.md „kein Test-Runner"-Satz korrigiert

**Implementation Note**: Nach grüner Automatik für manuelle Bestätigung
pausieren; danach ist der Change archivierbar.

---

## Testing Strategy

### Unit Tests:

- Unverändert (6 bestehende `*.test.ts`); dieser Change fügt **keine** Unit-Tests
  hinzu und re-testet die abgedeckten Units nicht (test-plan §7).

### Integration Tests:

- **Smoke** (Phase 1): Zwei Accounts, beide authentifiziert, leere eigene Liste.
- **RLS-Cross-Tenant** (Phase 2): volle Matrix inkl. global≠write,
  run_repetitions-Doppelpfad, Seed-`owner_id=NULL`; je DB-Gegenprobe +
  Positiv-Kontrolle.
- **Key-Boundary** (Phase 3): Sentinel-Abwesenheit in allen Views + Typ-Guard.
- **Auth-Gates** (Phase 4): 13 Routes unauth → 401, public-Routes erreichbar.

### Manual Testing Steps:

1. `npx supabase start`, `npx supabase status` → API auf 54321, anon-key nach
   `.env.test` übernehmen.
2. `npm run test:integration` → alle Suites grün.
3. `npm run dev` → `/models` view-source: kein Key im `initialConfigs`-Prop.
4. `npm run test` (Unit) → unverändert grün, ohne Docker.

## Performance Considerations

- Integration-Suite läuft **sequenziell** (single fork) gegen eine gemeinsame
  lokale DB; Laufzeit ist DB-dominiert, nicht CPU. Für die Phase-1-Größe
  unkritisch. Test-Unabhängigkeit kommt aus eindeutigen Timestamp-Usern +
  Cleanup, nicht aus DB-Reset pro Test (schneller).

## Migration Notes

- Keine Datenmigration. Nur additive Dateien (Test-Configs, `src/test/`,
  npm-Scripts, `.env.test.example`) + Doku-Edits. Kein Produktcode betroffen.

## References

- Research: `context/changes/testing-integration-security-gate/research.md`
- Test-Plan: `context/foundation/test-plan.md` (Risk-Map §2, Phasen §3,
  Cookbook §6, Negativ-Raum §7)
- Seed-Matrix-Muster: `context/archive/2026-06-20-visibility-controls/plan.md:289-294`
- RLS-Contract: `context/archive/2026-06-12-connect-supabase/plan.md:138-204`
- S-02-Lesson Ursprung: `dtb-project/project-changelog/2026-06/2026-06-16.md:112-115`
- Schlüssel-Dichtheit: `context/archive/2026-06-15-model-config-management/plan.md:264-285`
- Key-Service: `src/lib/services/model-configs.ts:29,34-44,122-139`
- Auth-Gates: `src/middleware.ts:4`, `src/lib/api-auth.ts:22-40`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Integration-Harness-Bootstrap

#### Automated

- [x] 1.1 Lokales Supabase läuft (`npx supabase status` API auf 54321)
- [x] 1.2 `npm run test:integration` startet ohne Config-Fehler
- [x] 1.3 Smoke-Test grün (`smoke.itest.ts` PASS)
- [x] 1.4 `npm run test` (Unit) unverändert grün und Docker-frei
- [x] 1.5 Lint/Typecheck grün (`npm run lint`, `npx astro check`)

#### Manual

- [x] 1.6 `.env.test` zeigt auf lokale (nicht Remote-) Supabase-Werte
- [x] 1.7 Re-run kollidiert nicht; keine Test-User-Reste nach Cleanup

### Phase 2: Risk #1 — Cross-Tenant-RLS-Matrix

#### Automated

- [ ] 2.1 Alle RLS-Matrix-Fälle grün (`npm run test:integration`)
- [ ] 2.2 Lint/Typecheck grün (`npm run lint`, `npx astro check`)

#### Manual

- [ ] 2.3 Stichprobe liefert 404/null statt leerem 200/Array (S-02)
- [ ] 2.4 Positiv-Kontrolle würde bei gelockertem RLS fehlschlagen

### Phase 3: Risk #2 — Key-Dichtheit

#### Automated

- [ ] 3.1 Key-Dichtheits-Tests grün (`npm run test:integration`)
- [ ] 3.2 Typ-Guard greift (Key-Feld in `ModelConfigView` bricht Typcheck)
- [ ] 3.3 Lint grün (`npm run lint`)

#### Manual

- [ ] 3.4 SSR-HTML der `/models`-Seite enthält kein Key-Material im Prop
- [ ] 3.5 `test-connection`-Response enthält keinen Key/Upstream-Echo

### Phase 4: Risk #5 — API-Auth-Gates + Doku-Closeout

#### Automated

- [ ] 4.1 Alle Auth-Gate-Tests grün (`npm run test:integration`)
- [ ] 4.2 Jede der 13 Routes liefert unauth 401 (tabellengetrieben)
- [ ] 4.3 Lint/Typecheck grün (`npm run lint`, `npx astro check`)

#### Manual

- [ ] 4.4 Geschützte Route mit gültigem Cookie liefert nicht 401 (Positiv-Kontrolle)
- [ ] 4.5 test-plan §6.2/§6.4 gefüllt, §3 P1 = `complete`, §8 aktualisiert
- [ ] 4.6 CLAUDE.md „kein Test-Runner"-Satz korrigiert
