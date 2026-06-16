# Model Config Management (S-02) Implementation Plan

## Overview

Wir bauen die erste **Domänen-Tabelle** des Produkts: `model_configs`. Ein angemeldeter
Nutzer kann ein OpenAI-kompatibles Modell anhängen (Base-URL, Modellname, frei wählbares
Label, API-Key) und als wiederverwendbare Konfiguration speichern. Der API-Key wird
**app-seitig mit AES-256-GCM (Web Crypto)** verschlüsselt at rest abgelegt, verlässt den
Server nie Richtung Client und wird nach dem Speichern nie wieder im Klartext ausgegeben.
Konfigs sind **owner-only** (kein Sharing), **editierbar** (klassisches CRUD), und das
Feature bringt die erste echt unit-testbare Logik mit — daher wird in derselben Arbeit
**Vitest** eingerichtet und der Krypto-Helper getestet.

Deckt FR-005, FR-006 und NFR Key-/Daten-Dichtheit ab. Unlocks S-04 (OEJTS-Messlauf
konsumiert die Konfig + entschlüsselt den Key serverseitig).

## Current State Analysis

- **Auth + RLS-Grundgerüst stehen** (F-01, S-01 archiviert). Das RLS-Muster ist sauber
  dokumentiert in `supabase/migrations/20260612164633_rls_foundation.sql`: `owner_id`,
  eine Policy je Operation `to authenticated`, `(select auth.uid())` (initplan-Caching),
  btree-Index auf der owner-Spalte, security invoker. Die `_rls_probe`-Tabelle ist das
  Referenz-Muster (owner + optional visibility).
- **Keine Verschlüsselungs-Infrastruktur:** kein pgsodium/pgcrypto, `db.vault` in
  `supabase/config.toml` ist auskommentiert. Muss neu aufgebaut werden.
- **Keine Service-Schicht und keine zentrale Types-Datei:** `src/lib/services/` und
  `src/types.ts` existieren noch nicht — dieser Slice legt beide als erste an.
- **API-Route-Muster etabliert** (`src/pages/api/auth/signin.ts`, `signup.ts`,
  `callback.ts`): `export const prerender = false`, zod `safeParse` + `z.flattenError()`,
  `createClient(context.request.headers, context.cookies)` aus `src/lib/supabase.ts`
  (null → Config fehlt), Fehler über `src/lib/auth-errors.ts::safeAuthError()` gemappt,
  Rohtext nur serverseitig geloggt.
- **Geschützte Seiten** laufen über `PROTECTED_ROUTES` in `src/middleware.ts` (aktuell nur
  `["/dashboard"]`); `getUser()` ist in try/catch (Supabase-Ausfall → Redirect statt 500).
  `context.locals.user` steht in der Page bereit.
- **UI-Bausteine wiederverwendbar:** `src/components/auth/{FormField,SubmitButton,
  ServerError,PasswordToggle}.tsx`, shadcn `src/components/ui/button.tsx` (CVA). Forms sind
  React-Islands (`client:load`) mit `useState` + `useFormStatus()`.
- **Env-Schema** in `astro.config.mjs` (`env.schema`, `astro:env/server`): aktuell nur
  `SUPABASE_URL`/`SUPABASE_KEY` (beide `optional: true`). `src/lib/config-status.ts`
  rendert fehlende Configs als Hinweis.
- **Runtime:** Astro 6 SSR auf Cloudflare Workers (`@astrojs/cloudflare`). Web Crypto
  (`globalThis.crypto.subtle`) ist sowohl im Worker als auch in Node 22 (Vitest) verfügbar.
- **Kein Test-Runner** installiert; `test_command` in `workflow.config.yaml` ist `null`.
  Vitest ist ein offener Backlog-Punkt (Modul-3-Voraussetzung).

## Desired End State

Ein angemeldeter Nutzer öffnet `/models`, legt eine Modellkonfiguration an (Label,
Base-URL, Modellname, API-Key), sieht sie im Katalog mit **maskiertem** Key (`••••` +
„Key hinterlegt"), kann sie editieren (Metadaten ändern, Key optional neu setzen),
optional „Verbindung testen" (GET `{base_url}/models`) und löschen. In der Datenbank liegt
der Key ausschließlich als AES-256-GCM-Ciphertext (+ IV + `key_version`); RLS lässt nur
den Owner lesen/schreiben. Ein Krypto-Roundtrip-Test ist grün; ohne gültigen
`ENCRYPTION_KEY` schlägt jede Speicher-Operation sauber fehl und die fehlende Config wird
wie `SUPABASE_*` angezeigt.

**Verifizierbar durch:** `npm run test` (Krypto-Roundtrip + zod), `npm run build`,
`npm run lint`, Migration appliziert sauber, und der manuelle End-to-End-Flow auf `/models`.

### Key Discoveries:

- RLS-Referenzmuster: `supabase/migrations/20260612164633_rls_foundation.sql:1-60`
  (`_rls_probe` als Vorlage — owner-only Policies + Index).
- profiles-Trigger zeigt die `SECURITY DEFINER SET search_path = ''`-Konvention:
  `supabase/migrations/20260614174810_profiles_trigger.sql`.
- API-Route-Muster: `src/pages/api/auth/signin.ts:1-50` (zod + safeAuthError + createClient).
- SSR-Client: `src/lib/supabase.ts:1-24` (`createServerClient`, Cookie-Sessions).
- Sichere Fehler-Maps: `src/lib/auth-errors.ts:1-25` (`safeAuthError`, Rohtext nur Log).
- Config-Gate: `src/lib/config-status.ts:1-17` (Vorlage für `ENCRYPTION_KEY`-Hinweis).
- Env-Deklaration: `astro.config.mjs:17-22` (`envField.string({context:"server",
  access:"secret"})`).
- Protected Routes: `src/middleware.ts:4` (`PROTECTED_ROUTES`-Array).

## What We're NOT Doing

- **Keine Key-Rotation-Logik** — nur ein `key_version`-Tag als Datenmodell-Vorsorge
  (v1 = `1`), kein Rotations-Endpoint, kein Multi-Key-Decrypt.
- **Kein Supabase Vault / pgsodium / pgcrypto** — bewusst app-seitige Krypto wegen
  Publishable-Key-only-Constraint.
- **Keine Immutability/Kopie-Semantik** (das gilt nur für Personas, FR-008) — Konfigs sind
  editierbar.
- **Keine `visibility`-Spalte / kein Sharing** — Konfigs sind immer privat (owner-only);
  global geteilte Keys wären ein Key-Leck über Nutzergrenzen.
- **Kein `is_default`-Flag, keine Custom-Header/Extra-Params** — YAGNI für v1.
- **Kein Soft-Delete** — Hard-Delete; die FK-/ON-DELETE-Frage zu zukünftigen `runs`
  löst S-04, wenn die Tabelle entsteht.
- **Kein Pflicht-Verbindungstest** — der Test ist ein optionaler Button, blockiert das
  Speichern nicht.
- **Kein Reveal/Entschlüsseln in der UI** — der Key wird nie an den Client zurückgegeben.
- **Kein Worker-Pool für Tests** (`@cloudflare/vitest-pool-workers`) — der Krypto-Helper
  nutzt nur Standard-Web-Crypto, das in Node 22 global verfügbar ist; Default-Vitest-Env
  reicht.

## Implementation Approach

Vertikal von der Krypto-Grundlage nach oben: zuerst der getestete Verschlüsselungs-Helper
(weil alles andere ihn konsumiert und Krypto ohne Test fahrlässig ist), dann die
Datenschicht (Migration + RLS + Service + Types), dann die API, zuletzt die UI. Jede Phase
folgt einem bereits existierenden Muster — der einzige Neuwert ist der Krypto-Helper und
die Service-Schicht.

## Critical Implementation Details

- **Krypto-Format & Key-Quelle.** `ENCRYPTION_KEY` ist ein **base64-kodierter 32-Byte
  (256-bit) Schlüssel** (als Worker-Secret + GitHub-Secret synced, lokal in `.dev.vars`/
  `.env`). Der Krypto-Helper (`crypto.ts`) ist ein **reines Logik-Modul** und liest das Env
  **nicht** selbst — er bekommt den Key als Parameter (`keyBase64`). Er importiert ihn via
  `crypto.subtle.importKey("raw", …, {name:"AES-GCM"}, …)`, erzeugt je Verschlüsselung eine
  frische 12-Byte-IV (`crypto.getRandomValues`) und gibt Ciphertext und IV **getrennt**
  (base64) plus `key_version = 1` zurück. GCM liefert authentifizierte Verschlüsselung
  (Auth-Tag ist Teil des Ciphertexts) — kein separater HMAC nötig.
- **Server-only-Grenze + Env am Rand.** Der `astro:env/server`-Zugriff auf `ENCRYPTION_KEY`
  lebt **ausschließlich** in einer dünnen server-only Schicht (`getEncryptionKey()` im
  Service bzw. in der API-Route) — niemals in `crypto.ts`. Grund: `astro:env/server` ist ein
  Vite-Virtual-Module und in plain Vitest nicht auflösbar; ein reines `crypto.ts` ohne diesen
  Import bleibt trivial unit-testbar (Key wird im Test direkt übergeben). Dieselbe Konvention
  wie beim Supabase-Client (Route reicht den Client in den Service). Der Service gibt
  grundsätzlich **kein** Key-Material zurück; die Entschlüsselungs-Funktion (`decryptApiKey`)
  wird in diesem Slice von niemandem im Response-Pfad aufgerufen — sie existiert für S-04.
- **Fail-closed.** Ist der übergebene Key leer oder nicht 32 Bytes lang, wirft `crypto.ts`
  früh (`EncryptionConfigError`); die `getEncryptionKey()`-Schicht/API mappt das auf eine
  sichere Meldung (Rohtext nur Log) und `config-status.ts` listet das fehlende
  `ENCRYPTION_KEY` — kein Klartext-Fallback.

## Phase 1: Test-Infra + Krypto-Helper

### Overview

Vitest einrichten, `ENCRYPTION_KEY` als Server-Secret deklarieren und in das Config-Gate
aufnehmen, den AES-256-GCM-Helper schreiben und ihn mit Unit-Tests absichern.

### Changes Required:

#### 1. Vitest-Setup

**File**: `package.json`, `vitest.config.ts` (neu)

**Intent**: Test-Runner installieren, damit der Krypto-Helper und zod-Schemas unit-getestet
werden können. Erfüllt zugleich den offenen Backlog-/Modul-3-Punkt.

**Contract**: `vitest` als devDependency; Scripts `"test": "vitest run"` und
`"test:watch": "vitest"`. `vitest.config.ts` mit Default-(Node-)Environment und
`@/*`-Path-Alias passend zu `tsconfig`. Keine Astro-Integration nötig (reine TS-Units).

#### 2. `test_command` in der Workflow-Config

**File**: `workflow.config.yaml`

**Intent**: Single Source of Truth nachziehen, damit Workflow-Skills den Runner kennen.

**Contract**: `test_command: "npm run test"` (ersetzt `null`).

#### 3. `ENCRYPTION_KEY` deklarieren

**File**: `astro.config.mjs`, `.env.example`, `.dev.vars` (lokal), `.env` (lokal)

**Intent**: Den Verschlüsselungs-Schlüssel als Server-Secret verfügbar machen — gleiche
Mechanik wie `SUPABASE_*`.

**Contract**: In `env.schema`: `ENCRYPTION_KEY: envField.string({ context: "server",
access: "secret", optional: true })` (optional, damit Build ohne Key nicht bricht; das
Fail-closed passiert zur Laufzeit). `.env.example` um eine kommentierte Zeile + Hinweis
„32-Byte base64" ergänzen. Lokal einen Dev-Key generieren und in `.dev.vars` + `.env`
eintragen (nicht committen). GitHub-Secret `ENCRYPTION_KEY` muss vor Prod-Nutzung gesetzt
werden (wird vom Deploy-Job als Worker-Secret gesynct — siehe CLAUDE.md Gotcha).

#### 4. Config-Gate erweitern

**File**: `src/lib/config-status.ts`

**Intent**: Fehlendes `ENCRYPTION_KEY` sichtbar machen wie fehlende Supabase-Secrets.

**Contract**: `ENCRYPTION_KEY` aus `astro:env/server` importieren und einen Eintrag in den
`ConfigStatus`-Array aufnehmen (gleiche Form wie die bestehenden Einträge).

#### 5. Krypto-Helper

**File**: `src/lib/crypto.ts` (neu)

**Intent**: AES-256-GCM Ver-/Entschlüsselung des API-Keys als **reines Logik-Modul**
(Key als Parameter, kein `astro:env`-Import → trivial unit-testbar), fail-closed bei
ungültigem Key.

**Contract**: Exporte
`encryptApiKey(plaintext: string, keyBase64: string): Promise<{ ciphertext: string; iv: string; keyVersion: number }>`
und `decryptApiKey(input: { ciphertext: string; iv: string; keyVersion: number }, keyBase64:
string): Promise<string>`. Der Key wird als Parameter (`keyBase64`, base64 → 32 Bytes)
übergeben — `crypto.ts` importiert **nichts** aus `astro:env/server`. Ist `keyBase64` leer
oder nicht 32 Bytes lang, wirft eine benannte Error-Klasse (`EncryptionConfigError`). IV:
12 Byte random, base64-kodiert. `keyVersion` konstant `1`. Nutzt `globalThis.crypto.subtle`.
Eine dünne server-only Schicht `getEncryptionKey()` (im Service `model-configs.ts` oder
einem kleinen `src/lib/encryption-key.ts`) liest `ENCRYPTION_KEY` aus `astro:env/server`,
mappt das Fehlen auf `EncryptionConfigError`/sichere Meldung und reicht den Key in die
crypto-Funktionen.

#### 6. Unit-Tests

**File**: `src/lib/crypto.test.ts` (neu)

**Intent**: Roundtrip- und Fehlerpfade absichern.

**Contract**: Tests rufen die crypto-Funktionen mit einem **direkt übergebenen Test-Key**
auf — kein Astro, kein `astro:env`-Mock, kein `getViteConfig` nötig. Fälle: (a)
`decryptApiKey(encryptApiKey(x, k), k) === x` für mehrere Eingaben; (b) zwei
Verschlüsselungen desselben Klartexts liefern unterschiedliche `ciphertext`/`iv` (frische
IV); (c) leerer/zu-kurzer `keyBase64` wirft `EncryptionConfigError`; (d) manipulierter
Ciphertext schlägt bei der Entschlüsselung fehl (GCM-Auth).

### Success Criteria:

#### Automated Verification:

- Vitest läuft: `npm run test`
- Krypto-Roundtrip- und Fehlerpfad-Tests grün: `npm run test`
- Build grün: `npm run build`
- Lint grün: `npm run lint`

#### Manual Verification:

- `npm run test` ohne `ENCRYPTION_KEY` zeigt den erwarteten Fail-closed-Test grün (kein Klartext-Pfad).
- `/dashboard` (oder Startseite) zeigt bei fehlendem `ENCRYPTION_KEY` den Config-Hinweis aus `config-status.ts`.

**Implementation Note**: Nach dieser Phase und grüner Automated Verification hier pausieren
und manuelle Bestätigung abwarten, bevor Phase 2 beginnt.

---

## Phase 2: Datenschicht — Migration, RLS, Service, Types

### Overview

Tabelle `model_configs` mit owner-only RLS anlegen, die erste zentrale Types-Datei und die
erste Service-Schicht schreiben, die Supabase + Krypto kapselt.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/<ts>_model_configs.sql` (neu)

**Intent**: Domänen-Tabelle für Modellkonfigs nach dem `_rls_probe`-Muster, mit getrennten
Krypto-Spalten.

**Contract**: Tabelle `public.model_configs`:
`id uuid pk default gen_random_uuid()`, `owner_id uuid not null default auth.uid()
references auth.users(id) on delete cascade` (Default wie `_rls_probe`,
`rls_foundation.sql:39` — **nicht** wie `profiles`, das die PK explizit setzt),
`label text not null`, `base_url text not null`, `model_name text not null`,
`key_ciphertext text not null`, `key_iv text not null`, `key_version int not null
default 1`, `created_at timestamptz not null default now()`, `updated_at timestamptz not
null default now()`. `enable row level security`; vier owner-only Policies
(select/insert/update/delete) mit `owner_id = (select auth.uid())` (update zusätzlich
`with check`); btree-Index auf `owner_id`. **Keine** `visibility`-Spalte. Migration nach
`npx supabase db push` (oder lokal apply) sauber idempotent.

#### 2. Zentrale Types

**File**: `src/types.ts` (neu)

**Intent**: Entity- und DTO-Typen für Modellkonfigs zentral bereitstellen (Konvention aus
CLAUDE.md: shared Types → `src/types.ts`).

**Contract**: `ModelConfig` (DB-Entity inkl. Krypto-Spalten, owner_id, Timestamps);
`ModelConfigView` (client-sichere Projektion **ohne** Key-Felder, dafür
`hasKey: boolean`); `CreateModelConfigInput` / `UpdateModelConfigInput` (Update mit
optionalem `apiKey`). Diese Typen sind die Vertragsbasis für Service + API.

#### 3. Service-Schicht

**File**: `src/lib/services/model-configs.ts` (neu)

**Intent**: CRUD über Supabase, kapselt Verschlüsselung beim Schreiben und gibt nie
Key-Material zurück.

**Contract**: Funktionen nehmen einen `SupabaseClient` (aus der Route) + Inputs:
`listModelConfigs(sb): Promise<ModelConfigView[]>` (selektiert nie die Key-Spalten an den
Aufrufer durch — mappt auf `ModelConfigView`, `hasKey` immer true),
`createModelConfig(sb, input)` (`getEncryptionKey()` → `encryptApiKey(apiKey, key)` →
insert), `updateModelConfig(sb, id, input)` (Metadaten immer + `updated_at` bumpen; Key nur
wenn `apiKey` gesetzt → `getEncryptionKey()` + neu verschlüsseln), `deleteModelConfig(sb,
id)`. RLS erzwingt owner-Scope serverseitig; der Service verlässt sich darauf. **`owner_id`
beim Insert weglassen** — die Spalte hat `default auth.uid()` (siehe Migration unten, wie
`_rls_probe`); explizites Setzen wäre fehleranfällig (falscher Wert scheitert an der
insert-Policy).

### Success Criteria:

#### Automated Verification:

- Migration appliziert sauber (lokal: `npx supabase db reset` bzw. `db push`)
- Build grün: `npm run build`
- Lint grün: `npm run lint`
- Bestehende + neue Unit-Tests grün: `npm run test`

#### Manual Verification:

- In Supabase Studio: Tabelle `model_configs` existiert mit RLS aktiv und vier Policies.
- Manueller Insert über zwei verschiedene Test-User belegt: User A sieht User Bs Zeile nicht (RLS owner-only).
- `key_ciphertext` enthält keinen lesbaren Klartext-Key.

**Implementation Note**: Nach dieser Phase und grüner Automated Verification hier pausieren
und manuelle Bestätigung abwarten, bevor Phase 3 beginnt.

---

## Phase 3: API-Routes

### Overview

CRUD-Endpunkte plus optionaler Verbindungstest, nach dem bestehenden Auth-Route-Muster.

### Changes Required:

#### 1. Create / Update / Delete

**File**: `src/pages/api/models/index.ts` (POST create), `src/pages/api/models/[id].ts`
(PUT/PATCH update, DELETE) — Aufteilung nach REST-Ressource.

**Intent**: Die Service-Funktionen über HTTP exponieren, owner-scoped via Supabase-Session.

**Contract**: Jede Route `export const prerender = false`. zod-Schemas:
create = `{ label, baseUrl (url), modelName, apiKey (non-empty) }`;
update = `{ label, baseUrl, modelName, apiKey? }`. `createClient(headers, cookies)` → null →
sichere 500/Redirect. Bei Validierungsfehler `z.flattenError()` als 400-JSON. Krypto-/
Service-Fehler über das `safeAuthError`-Muster (eigener Helper oder Wiederverwendung —
generische Meldung, Rohtext nur Log). Erfolgreiche Antworten geben `ModelConfigView`
(ohne Key) bzw. Status zurück. Kein Endpunkt gibt je Key-Material aus.

#### 2. Verbindungstest

**File**: `src/pages/api/models/test-connection.ts` (neu)

**Intent**: Optionaler, nicht-blockierender Erreichbarkeits-/Auth-Check eines Endpunkts.

**Contract**: `POST` mit zod `{ baseUrl, apiKey }` (bei bestehender Konfig ohne neuen Key:
`{ configId }` → Service entschlüsselt serverseitig). `baseUrl` per zod-Refine auf
**https** + öffentlichen Host beschränken (kein `http`, kein `localhost`/`127.0.0.1`/private
IP-Range) — verhindert, dass der Worker als Proxy gegen interne Ziele genutzt wird. Macht
`GET {baseUrl}/models` mit `Authorization: Bearer …`, kurzem Timeout (`AbortController`,
~8 s). Antwort: `{ ok: true, modelCount? }` oder `{ ok: false, reason }` (gemappte, sichere
Meldung; kein Key im Response, keine rohen Upstream-Header). Verbraucht keine Tokens.
Dieselbe `baseUrl`-Refine-Regel gilt auch für die create/update-Schemas (#1).

### Success Criteria:

#### Automated Verification:

- Build grün: `npm run build`
- Lint grün: `npm run lint`
- Unit-Tests grün: `npm run test`

#### Manual Verification:

- `curl -X POST /api/models` (eingeloggt) legt eine Konfig an; Response enthält **keinen** Key.
- `PUT /api/models/[id]` ohne `apiKey` ändert Metadaten, lässt Key unverändert; mit `apiKey` ersetzt ihn.
- `DELETE /api/models/[id]` entfernt nur die eigene Konfig (fremde id → kein Effekt via RLS).
- `POST /api/models/test-connection` gegen einen echten Endpoint liefert `ok:true`; gegen falschen Key `ok:false`.

**Implementation Note**: Nach dieser Phase und grüner Automated Verification hier pausieren
und manuelle Bestätigung abwarten, bevor Phase 4 beginnt.

---

## Phase 4: UI — geschützte /models-Page + React-Island

### Overview

Geschützte Katalog-Seite mit Anlegen/Editieren/Löschen, maskiertem Key und Verbindungstest.

### Changes Required:

#### 1. Route schützen

**File**: `src/middleware.ts`

**Intent**: `/models` hinter Auth legen.

**Contract**: `PROTECTED_ROUTES` zu `["/dashboard", "/models"]` erweitern.

#### 2. Page

**File**: `src/pages/models.astro` (neu)

**Intent**: Server-gerenderte geschützte Seite, die den Katalog initial lädt und die
Island einbettet.

**Contract**: `const { user } = Astro.locals;`. Lädt initiale `ModelConfigView[]` über die
Service-Funktion (mit dem Request-Supabase-Client) und reicht sie als Prop an die Island
(`client:load`). `Layout`-Stil wie `dashboard.astro` (Cosmic-BG). Ein Link von
`dashboard.astro` → `/models`.

#### 3. CRUD-Island

**File**: `src/components/models/ModelConfigManager.tsx` (neu) + ggf. kleine Unterkomponenten

**Intent**: Liste + Formular für Anlegen/Editieren/Löschen + „Verbindung testen".

**Contract**: Wiederverwendet `FormField`/`SubmitButton`/`ServerError` aus
`src/components/auth/`. Felder: Label, Base-URL, Modellname, API-Key. Liste zeigt je Konfig
Label/Modell/Base-URL + **maskierten** Key (`••••••••` + „Key hinterlegt"); Edit befüllt
Metadaten, Key-Feld bleibt leer mit Placeholder „leer lassen = Key behalten". `fetch` gegen
die API-Routes; „Verbindung testen" ruft `/api/models/test-connection` und zeigt
ok/fehler inline. Optimistische oder Re-Fetch-Aktualisierung der Liste nach Mutationen.
Client-seitige Minimal-Validierung wie in den Auth-Forms; Server bleibt Source of Truth.

### Success Criteria:

#### Automated Verification:

- Build grün: `npm run build`
- Lint grün: `npm run lint`
- Unit-Tests grün: `npm run test`

#### Manual Verification:

- Ausgeloggt → `/models` redirectet auf `/auth/signin`.
- Eingeloggt: Konfig anlegen → erscheint im Katalog mit maskiertem Key.
- Editieren ohne Key-Eingabe behält den Key (Verbindungstest weiterhin ok); Key neu setzen funktioniert.
- Löschen entfernt die Konfig.
- DevTools-Network/HTML zeigt **nie** den Klartext-Key (kein Key in Props, JSON-Responses, Markup).

**Implementation Note**: Nach dieser Phase manuelle Bestätigung abwarten; danach S-02
abschließen (Status, ggf. `/dtb:impl-review` + `/10x-archive`).

---

## Testing Strategy

### Unit Tests:

- `src/lib/crypto.test.ts`: encrypt/decrypt-Roundtrip, frische IV pro Verschlüsselung,
  Fail-closed ohne `ENCRYPTION_KEY`, GCM-Auth schlägt bei manipuliertem Ciphertext fehl.
- Optional: zod-Schemas der API-Routes (gültige/ungültige Inputs) als reine Unit-Tests.

### Integration Tests:

- Manuell in v1 (kein DB-Integrationstest-Harness): RLS-Owner-Trennung über zwei Test-User
  in Supabase Studio; CRUD über curl; Verbindungstest gegen echten Endpoint.

### Manual Testing Steps:

1. Ohne `ENCRYPTION_KEY` starten → Config-Hinweis sichtbar, Speichern schlägt sauber fehl.
2. Dev-Key setzen → Konfig anlegen → Studio: `key_ciphertext` ist nicht lesbar.
3. Zweiter Test-User sieht die Konfig des ersten nicht.
4. Editieren ohne/with Key; Löschen; Verbindungstest ok/fehler.
5. DevTools prüfen: kein Klartext-Key in Props/Responses/Markup.

## Performance Considerations

Vernachlässigbar: kleine Datenmengen (PRD `data_volume: small`), eine Krypto-Operation pro
Schreibzugriff. Der Verbindungstest macht einen externen Call mit kurzem Timeout
(`AbortController`), um hängende Endpunkte nicht zu blockieren.

## Migration Notes

Neue Tabelle, keine Bestandsdaten zu migrieren. `key_version`-Spalte ist Vorsorge für
spätere Rotation (kein Aufwand jetzt). Vor Prod-Nutzung muss das GitHub-Secret
`ENCRYPTION_KEY` gesetzt sein (Deploy-Job synct es als Worker-Secret).

## References

- Roadmap-Slice: `context/foundation/roadmap.md` (S-02)
- PRD: `context/foundation/prd.md` (FR-005, FR-006, NFR Key-/Daten-Dichtheit, §Access Control)
- RLS-Muster: `supabase/migrations/20260612164633_rls_foundation.sql`
- API-Route-Muster: `src/pages/api/auth/signin.ts`
- Sichere Fehler: `src/lib/auth-errors.ts`
- Config-Gate-Vorlage: `src/lib/config-status.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Test-Infra + Krypto-Helper

#### Automated

- [x] 1.1 Vitest läuft: `npm run test` — f4e748d
- [x] 1.2 Krypto-Roundtrip- und Fehlerpfad-Tests grün: `npm run test` — f4e748d
- [x] 1.3 Build grün: `npm run build` — f4e748d
- [x] 1.4 Lint grün: `npm run lint` — f4e748d

#### Manual

- [x] 1.5 `npm run test` ohne `ENCRYPTION_KEY` zeigt den Fail-closed-Test grün — f4e748d
- [x] 1.6 Config-Hinweis erscheint bei fehlendem `ENCRYPTION_KEY` — f4e748d

### Phase 2: Datenschicht — Migration, RLS, Service, Types

#### Automated

- [x] 2.1 Migration appliziert sauber (remote `db push` → Prod, local+remote synced) — 9e7ce22
- [x] 2.2 Build grün: `npm run build` — 9e7ce22
- [x] 2.3 Lint grün: `npm run lint` — 9e7ce22
- [x] 2.4 Bestehende + neue Unit-Tests grün: `npm run test` — 9e7ce22

#### Manual

- [ ] 2.5 Tabelle `model_configs` existiert mit RLS aktiv + vier Policies
- [ ] 2.6 RLS owner-only über zwei Test-User belegt (A sieht B nicht)
- [ ] 2.7 `key_ciphertext` enthält keinen lesbaren Klartext-Key

### Phase 3: API-Routes

#### Automated

- [x] 3.1 Build grün: `npm run build` — 3bb77b6
- [x] 3.2 Lint grün: `npm run lint` — 3bb77b6
- [x] 3.3 Unit-Tests grün: `npm run test` — 3bb77b6

#### Manual

- [ ] 3.4 Create gibt keine Key-Felder zurück
- [ ] 3.5 Update ohne `apiKey` behält Key; mit `apiKey` ersetzt ihn
- [ ] 3.6 Delete entfernt nur eigene Konfig (RLS)
- [ ] 3.7 test-connection: ok bei gültigem Key, fehler bei falschem

### Phase 4: UI — geschützte /models-Page + React-Island

#### Automated

- [x] 4.1 Build grün: `npm run build` — 09ecce5
- [x] 4.2 Lint grün: `npm run lint` — 09ecce5
- [x] 4.3 Unit-Tests grün: `npm run test` — 09ecce5

#### Manual

- [ ] 4.4 Ausgeloggt → `/models` redirectet auf `/auth/signin`
- [ ] 4.5 Anlegen → Katalog zeigt Konfig mit maskiertem Key
- [ ] 4.6 Editieren behält/ersetzt Key korrekt; Löschen funktioniert
- [ ] 4.7 Kein Klartext-Key in Props/Responses/Markup (DevTools)
