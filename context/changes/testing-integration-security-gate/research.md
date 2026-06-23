---
date: 2026-06-23T05:16:53+02:00
researcher: Damian (via Claude)
git_commit: 16e305c95a0a4c5c22892b9a3c348867cc889733
branch: main
repository: persona-forge
topic: "Integration Security Gate (Test-Rollout Phase 1): Cross-Tenant-RLS, Key-Boundary, Auth-Route-Schutz + Zwei-Account-Harness"
tags: [research, codebase, testing, rls, security, supabase, vitest, integration]
status: complete
last_updated: 2026-06-23
last_updated_by: Damian (via Claude)
---

# Research: Integration Security Gate (Test-Rollout Phase 1)

**Date**: 2026-06-23T05:16:53+02:00
**Researcher**: Damian (via Claude)
**Git Commit**: 16e305c95a0a4c5c22892b9a3c348867cc889733
**Branch**: main
**Repository**: persona-forge

## Research Question

Grounding für Test-Rollout Phase 1 aus `context/foundation/test-plan.md`:
Wie beweist man im Integration-Test-Harness **Risk #1** (Cross-Tenant-Leak),
**Risk #2** (entschlüsselter API-Key entkommt über eine Boundary) und
**Risk #5** (unauthentifizierter Request erreicht geschützte Route) — und
welcher Zwei-Account-Harness-Aufbau ist für dieses Projekt am billigsten und
am wenigsten brüchig?

## Summary

**Der Code ist an allen drei Fronten sauber abgesichert** — Phase 1 schreibt
Regressionssicherungen, deckt keine offenen Löcher auf:

- **Risk #1 (RLS):** Mandanten-Trennung hängt **ausschließlich an RLS** (kein
  zweiter Code-Riegel, kein `service_role`-Client, kein manueller
  `owner_id`-Filter). Alle Routes gehen über `requireUser` →
  request-scoped SSR-Client → echte `auth.uid()`. Das macht RLS zur **einzigen**
  Verteidigungslinie → RLS-Regressionstests sind nicht optional. `visibility`
  weitet **nur select**, nie write (die feinste Stelle: B's _globales_ Objekt
  ist von A lesbar, aber PATCH/DELETE müssen trotzdem 404 liefern).
- **Risk #2 (Key):** Dichtheit ist auf **drei unabhängigen Ebenen** erzwungen —
  SQL-Projektion (`VIEW_COLUMNS` selektiert nie key-Spalten), `toView`-Mapper
  (emittiert `hasKey:boolean` statt Key-Material), und der `ModelConfigView`-Typ
  (kein Key-Feld). Der einzige Klartext-Pfad (`getDecryptedTarget`) ist
  server-only und fließt nur in `Authorization`-Header / `chatCompletion`.
- **Risk #5 (Auth):** 4 `PROTECTED_ROUTES` (Prefix-Match) decken alle 6
  daten­tragenden Pages; alle 13 JSON-API-Routes haben `requireUser`-Gate;
  Supabase-Ausfall → **302 Redirect statt 500** (F4-Lesson).

**Harness-Empfehlung (KerNentscheidung der Phase):** Service-Level-Integration
gegen **lokales Supabase** (`npx supabase start`, `enable_confirmations=false`)
mit zwei echten `@supabase/supabase-js`-Sessions. Die Architektur hat die
Business-Logik bereits in client-parametrisierte Services ausgelagert → man
umgeht den einzigen harten Astro-Kopplungspunkt (`astro:env/server`) komplett.
Die teure offene Entscheidung ist nicht das Test-Schreiben, sondern die
**Test-DB-Infrastruktur** (Docker-Supabase im CI ja/nein).

## Detailed Findings

### Harness-Machbarkeit (Bootstrap der Phase)

- **Vitest:** `^4.1.9`, `environment` = Default **node**, `include` =
  `src/**/*.test.ts`, **kein** setupFile, **kein** Astro-Plugin (bewusst,
  `vitest.config.ts:11-12`). Alias `@` → `./src`. Scripts `test`/`test:watch`
  (`package.json:13-14`).
- **6 bestehende Tests** sind reine Pure-Function-Unit-Tests (crypto, url-guard,
  persona-compile, oejts-run/score/aggregate) — kein Supabase, kein Astro, kein
  Mock, kein I/O. Integration-Tests wären **Neuland**.
- **API-Routes** exportieren benannte uppercase Handler (`export const GET/POST:
APIRoute`) mit `prerender = false`. Sie nutzen **nicht** `context.locals.user`,
  sondern `requireUser(context)` (`src/lib/api-auth.ts:22`), das den Client via
  `createClient(context.request.headers, context.cookies)` baut und
  `auth.getUser()` validiert. Handler sind **dünn**; die Logik steckt in Services
  (`src/lib/services/*`), die einen reinen `SupabaseClient` als Parameter nehmen.
- **Supabase-Client testbar ohne Astro:** `@supabase/supabase-js` ist bereits
  Dependency (`package.json:25`). Tests bauen `createClient(url, key)` × 2 direkt
  und rufen `signInWithPassword` — zwei unabhängige In-Memory-Auth-States. Der
  Typ ist strukturell identisch zu dem, was die Services erwarten
  (`model-configs.ts:24`).
- **Lokales Supabase voll konfiguriert:** `supabase/config.toml` (API 54321, DB
  54322, Inbucket 54324), **`[auth.email] enable_confirmations = false`**
  (`config.toml:209`) → programmatischer Signup ohne Mail-Bestätigung (Gegensatz
  zur Remote-Instanz mit aktivem Confirm-Email). 8 Migrationen, **kein
  `seed.sql`** → Test-User per `signUp` on-the-fly anlegen.
- **`astro:env/server`** ist der einzige harte Kopplungspunkt: nur relevant, wenn
  man die Route-Schale (statt Services) testet → dann `getViteConfig` oder
  `vi.mock`/alias nötig.

### Risk #1 — Cross-Tenant-Leak (RLS)

- **API-Routes-Inventar (ID-basiert):** personas `[id]` PATCH/DELETE +
  `[id]/duplicate` POST; runs `[id]` GET/PATCH/DELETE + `[id]/step` POST +
  `[id]/result` GET; models `[id]` PUT/DELETE + `test-connection` POST
  (configId im Body). Alle validieren die ID mit `z.uuid()` vor DB-Zugriff.
- **RLS-Policies (`supabase/migrations/`):**
  - `personas`: select own-or-global, insert/update/delete strikt
    `owner_id = (select auth.uid())`. `owner_id` NULLABLE (Seed mit NULL).
    DB-Default `visibility='private'` (Defense-in-depth), App setzt explizit
    `'global'` (`personas.ts:105`). UPDATE-Policy erst in S-07 nachgereicht
    (`...personas_update_own_policy.sql:10`).
  - `runs`: analog own-or-global select, writes owner-only. `run_repetitions`
    (Child, kein eigenes `owner_id`): select erbt own-or-global per
    exists-Subquery; insert/update/delete-Subquery **nur** `owner_id` (kein
    global) → korrekte Asymmetrie.
  - `model_configs`: **keine `visibility`-Spalte** (bewusst — ein geteilter Key
    wäre ein Leck); alle 4 Policies reine `owner_id`-Checks → strengste Tabelle.
  - `profiles` bewusst **ohne** DELETE-Policy (deny-by-default + auth.users-Cascade).
- **Service-Schicht:** verlässt sich **bewusst allein auf RLS**, kein
  zusätzlicher `owner_id`-Filter im Code (`personas.ts:9-13`, `runs.ts:8-13`,
  `model-configs.ts:11-13`). Mutations nutzen `.select(...).maybeSingle()` →
  `null`→404/`false` (S-02-Lesson korrekt umgesetzt).
- **Subtilitäten:** (1) global ≠ Schreibrecht → PATCH/DELETE auf B's _globales_
  Objekt muss 404; (2) `getRunResult` liest Parent (`getRun`) **und** danach
  separat `run_repetitions` → beide RLS-Ebenen testen; (3) `step` würde bei
  RLS-Bruch B's Modell-Config entschlüsseln und **Kosten** verursachen; (4)
  Seed-Persona `owner_id=NULL` global → PATCH/DELETE darauf muss 404.

### Risk #2 — Key-Boundary (Dichtheit)

- **Crypto:** AES-256-GCM, Web Crypto. `encryptApiKey` (`crypto.ts:66`),
  `decryptApiKey` (`crypto.ts:79`), key-parametrisiert. `ENCRYPTION_KEY` nur in
  `encryption-key.ts:11` aus `astro:env/server`.
- **Einziger Klartext-Pfad:** `getDecryptedTarget()` (`model-configs.ts:122-139`)
  → `{baseUrl, apiKey, modelName}`. Zwei Aufrufer, beide server-only:
  `test-connection.ts:85` (→ `probeModels`) und `runs.ts:359` (→
  `chatCompletion`, `runs.ts:391`). `target.apiKey` taucht in **keinem**
  Run-Status/Result-DTO auf.
- **Boundary via SQL-Projektion (stärkste Garantie):**
  `VIEW_COLUMNS = "id, label, base_url, model_name, created_at, updated_at"`
  (`model-configs.ts:29`) — key-Spalten werden auf Read/List/Create/Update-Pfaden
  **nie selektiert**. `toView()` (`model-configs.ts:34-44`) emittiert
  `hasKey:true`. `ModelConfigView` (`types.ts:28-36`) hat **kein** Key-Feld.
- **Routes:** `GET /api/models` → `ModelConfigView[]`; `POST`/`PUT` → `toView`;
  **kein** `GET /api/models/[id]` Detail-Route (`[id].ts` exportiert nur
  PUT/DELETE). `test-connection` → nur `{ok:true,modelCount?} | {ok:false,reason}`,
  kein Key, kein Upstream-Echo.
- **Client-Bundle:** Alle Astro-Pages laden `ModelConfigView[]`
  (`models.astro:20,50`, `runs.astro`, `compare.astro`). `ModelConfigManager.tsx`
  prop ist `ModelConfigView[]`; jede `apiKey`-Referenz dort ist der **Write-Path**
  (User tippt neuen Key → POST/PUT), nie ein Read zurück vom Server.

### Risk #5 — Auth-Route-Schutz

- **Middleware** (`src/middleware.ts`): `PROTECTED_ROUTES =
["/dashboard","/models","/personas","/runs"]` (`:4`), **Prefix**-Match
  (`startsWith`, `:7`) → `/runs/[id]`, `/runs/compare` mitgeschützt.
  Unauth → `context.redirect("/auth/signin")` (**HTTP 302**, `:35-37`). Nur bei
  geschützter Route wird Supabase aufgerufen (sonst `user=null` + `next()`).
  Supabase-Ausfall in try/catch → `user=null` → Redirect statt 500 (F4, `:21-30`).
- **`/api/*` NICHT von Middleware geschützt** (bewusst) — alle **13** JSON-Routes
  schützen sich via `requireUser` (`api-auth.ts:22-40`): kein Client → **503**,
  kein User → **401**, Exception → 503 + Audit-Log. `test-connection` ruft
  `requireUser` **vor** Body-Parse/Outbound-Fetch (`:69-70`).
- **Pages-Deckung:** alle 6 datentragenden Pages liegen unter einem
  PROTECTED_ROUTE-Prefix — **keine Lücke**. Zusätzlich RLS-gescopte Page-Loads
  (Defense-in-depth). Auth-Routes (signin/signup/signout) korrekt public.
- **Edge-Case:** Prefix-Match ist theoretisch breiter als Segment-Match (ein
  hypothetisches `/modelsfoo` würde matchen) — aktuell kein kollidierender Pfad.

## Code References

- `vitest.config.ts:11-13` — plain Vitest, node-env, kein Astro-Plugin/Setup
- `src/lib/api-auth.ts:22-40` — `requireUser`: 401/503-Gate, request-scoped Client
- `src/lib/supabase.ts:1-22` — SSR-Client, `astro:env/server`-Secrets, Cookie-Bridge
- `src/lib/services/model-configs.ts:29` — `VIEW_COLUMNS` (key-Spalten nie selektiert)
- `src/lib/services/model-configs.ts:34-44` — `toView` → `hasKey:true`
- `src/lib/services/model-configs.ts:122-139` — `getDecryptedTarget` (einziger Klartext-Pfad)
- `src/lib/services/runs.ts:359,391` — Key fließt nur in `chatCompletion`
- `src/lib/services/personas.ts:105,141` — visibility-Insert (`global` / duplicate `private`)
- `src/lib/crypto.ts:66,79` — encrypt/decrypt (key-parametrisiert)
- `src/types.ts:28-36` — `ModelConfigView` (kein Key-Feld)
- `src/middleware.ts:4,7,35-37` — `PROTECTED_ROUTES`, Prefix-Match, 302-Redirect
- `supabase/config.toml:209` — `enable_confirmations = false` (lokal)
- `supabase/migrations/*` — RLS-Policies (rls_foundation + per-Tabelle)

## Architecture Insights

- **RLS ist die einzige Mandanten-Grenze** — keine Code-seitige
  owner-Filterung als zweiter Riegel. Vorteil: zentral testbar. Risiko: ein
  einzelner RLS-Regress hat keinen Fang-Backstop → Regressionstests sind die
  Absicherung.
- **Key-Dichtheit ist mehrschichtig** (SQL-Projektion + Mapper + Typ) — Tests
  sollten die **Abwesenheit des Secrets im Output** asserten, nicht die
  Mechanik spiegeln (kein „encrypt() wurde aufgerufen").
- **Business-Logik in client-parametrisierten Services** macht
  Service-Level-Integration billig und umgeht den Astro-Kopplungspunkt.
- **Zwei Fehlerkanäle:** API → JSON-Status (401/400/404/503); Browser-Pages →
  Redirect / `?error=`. Harness muss den jeweils richtigen Kanal asserten.
- **S-02-Lesson durchgängig:** 0-Row-Match ≠ Erfolg → `.maybeSingle()` →
  null → 404. Tests müssen **Status-Code** asserten (404/403/400), nie ein
  leeres 200/Array als „passt schon" akzeptieren — plus DB-Gegenprobe, dass B's
  Zeile unverändert/vorhanden ist.

## Historical Context (from prior changes)

- `context/archive/2026-06-12-connect-supabase/plan.md:138-204` — RLS-Contract
  „Eigenes + Globales": select own-or-global; insert/update/delete owner-only;
  `(select auth.uid())`; `to authenticated`; Index auf owner; `security invoker`;
  Impersonations-Verifikation via `set local role authenticated` + jwt-claims.
- `context/archive/2026-06-13-email-auth-live/reviews/impl-review.md:54-61` —
  **F4**: try/catch um `getUser()` → Ausfall → Redirect statt 500.
- `context/archive/2026-06-15-model-config-management/plan.md:264-285` — Key
  überschreitet nie die Client-Grenze (`hasKey:boolean`). `reviews/impl-review.md:26-34`
  — **F1 SSRF-Bypass**: numerische IPv4-Formen (dword/oktal/hex) → Fix
  `commit ce32b3c` (relevant für **Phase 2**, nicht Phase 1).
- `dtb-project/project-changelog/2026-06/2026-06-16.md:112-115` — **Ursprung
  S-02-Lesson**: DELETE gab bei fremder id fälschlich `200 {ok:true}` → Fix 404
  via `.maybeSingle()`, `commit 23e82c6`.
- `context/archive/2026-06-20-visibility-controls/plan.md:289-294` — **die
  „ad-hoc two-account RLS matrix"** (Seed-Muster für das Harness): A schaltet
  global → B sieht, kein Toggle; A schaltet private → verschwindet bei B; B's
  PATCH auf A's id → 404; A's private nie sichtbar; Cleanup beider Konten.
- `context/archive/2026-06-17-persona-catalog/plan.md:223` — `npx astro check`
  als CI-Gate (untypisierter Supabase-Client versteckt Typfehler vor lint+build).

## Related Research

- `context/foundation/test-plan.md` — Risk-Map (§2), Risk-Response-Guidance
  (§2), Phasen (§3), Stack (§4), Negativ-Raum (§7). Risk #3/#4 sind **Phase 2**.
- `context/foundation/lessons.md` — lucide-Hydration-Regel (für Phase 1 nicht
  einschlägig; relevant nur für Astro-Insel-Tests).

## Konkrete Test-Matrix (Synthese für den Plan)

Setup: 2 echte Accounts A, B (lokal, `signUp` mit Timestamp-Suffix-Mails). B legt
an: private + globale Persona, privater (+≥1 repetition) + globaler Run,
ModelConfig (Key = Sentinel `sk-SENTINEL-…`). Dann A gegen B's IDs.

**Risk #1 (21 Fälle, gekürzt):** GET/PATCH/DELETE/step/result/duplicate je
private B-Objekt → **404**; PATCH/DELETE auf B's **globales** Objekt → **404**
(visibility ≠ write); duplicate auf B's globale Persona → **201**, Kopie
A-owned + `private`; `POST /api/runs` mit B's privater persona/modelConfig →
**400**; List-Endpoints enthalten B-global, **nie** B-private; models-List **nie**
B-Configs. Jeweils + DB-Gegenprobe (B-Zeile unverändert) + Positiv-Kontrolle
(A gegen eigenes Objekt → 200/201).

**Risk #2:** `GET /api/models`, `POST`, `PUT`, `test-connection` (beide
Branches) → `JSON.stringify(body)` enthält **weder** Sentinel-Key **noch**
`key_ciphertext`/`key_iv`/`key_version`/`apiKey`; `hasKey===true`. SSR:
`models.astro`-HTML enthält kein Key-Material im hydration-payload. Optional
Typ-Guard: `ModelConfigView` hat kein Key-Feld (Regression-Lock).

**Risk #5:** jede PROTECTED_ROUTE unauth → **302 `/auth/signin`**, auth → pass;
jede /api-Route unauth → **401**; fehlende Config → **503**; Supabase-Ausfall
(gemockt) → **302 nicht 500**; auth-Routes public.

## Open Questions

1. **Test-DB-Target — die Kernentscheidung der Phase (für `/10x-plan`):**
   Lokales Docker-Supabase (`npx supabase start`) ist das saubere Ziel
   (`enable_confirmations=false`, frische DB via `supabase db reset`, keine
   Prod-Verschmutzung). Remote scheidet praktisch aus (Confirm-Email aktiv →
   Signup nicht programmatisch abschließbar; Live-Daten-Risiko).
   **Frage:** Ist Docker in GitHub-Actions-CI verfügbar / gewollt? Wenn ja:
   `supabase start` im CI-Job + lokale Keys. Wenn nein: dedizierter Test-Branch
   oder Tests bleiben „local-only" (nicht im CI-Gate) → betrifft §3 Phase 3.
2. **Test-User-Provisioning:** kein `seed.sql`. `signUp` (lokal ok) vs. Admin-API
   mit `service_role` (widerspricht „nie service_role"-Regel; nur für isolierte
   Test-DB vertretbar, strikt von Prod getrennt).
3. **Harness-Ebene:** Service-Level (umgeht `astro:env/server`, testet die
   RLS-tragende Logik direkt) vs. Route-Schale (braucht `getViteConfig`/`vi.mock`,
   testet HTTP-Status/zod-Validation). Empfehlung: Service-Level als Basis;
   Route-Schale nur falls 401/400/Status-Codes explizit Teil des Proofs sein
   sollen (Risk #5 verlangt Status-Codes → ggf. doch Route-Ebene für #5).
4. **`vitest`-Konfig:** separates `include`-Pattern (`*.itest.ts`) + env-Loading
   (`setupFiles` + dotenv, `ENCRYPTION_KEY` setzen) + Sequenzierung, damit
   DB-Tests nicht mit Unit-Tests über dieselbe DB parallelisieren.
5. **`workflow.config.yaml` / CLAUDE.md:** `test_command` ist gesetzt
   (`npm run test`), aber CLAUDE.md sagt noch „kein Test-Runner" — bei
   Phase-Abschluss angleichen.
