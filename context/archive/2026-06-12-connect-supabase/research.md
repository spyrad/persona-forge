---
date: 2026-06-12T17:55:58+02:00
researcher: Claude (Sonnet 4.6)
git_commit: 40e27af49a410c8686d5f780457fe97475056dd3
branch: main
repository: spyrad/persona-forge
topic: "F-01 connect-supabase: Supabase-Projekt anbinden + RLS-Grundgerüst — Ist-Stand, Secrets-Pfad, Contract-Optionen"
tags: [research, codebase, supabase, rls, secrets, cloudflare-workers, auth]
status: complete
last_updated: 2026-06-12
last_updated_by: Claude (Sonnet 4.6)
---

# Research: F-01 connect-supabase

**Date**: 2026-06-12T17:55:58+02:00
**Researcher**: Claude (Sonnet 4.6)
**Git Commit**: `40e27af49a410c8686d5f780457fe97475056dd3`
**Branch**: `main`
**Repository**: spyrad/persona-forge

## Research Question

Was muss F-01 (connect-supabase) konkret liefern, damit (1) ein Supabase-Projekt
zuverlässig mit der App verbunden ist — lokal, im CI-Build und im deployten
Cloudflare Worker — und (2) das Datenzugriffs-Grundgerüst „Nutzer sieht nur
Eigenes + Globales" als verifizierbarer RLS-Contract etabliert ist, ohne das
Domänen-Schema vorwegzunehmen?

## Summary

**Das Scaffold liefert die komplette Auth-Verdrahtung, aber nichts dahinter:**
SSR-Client, Middleware, Auth-Endpoints und -Forms sind fertig; es fehlen das
verbundene Supabase-Projekt, jegliche Migrationen (`supabase/migrations/`
existiert nicht), `.dev.vars`, Worker-Runtime-Secrets und generierte DB-Typen.

**Wichtigster Mechanik-Befund (Secrets):** Die env-Felder sind als
`access: "secret"` deklariert und werden **nie in den Build eingebacken** — der
deployte Worker liest sie ausschließlich zur Laufzeit aus dem Worker-Env. Die
`env:`-Blöcke im CI (`ci.yml`) sind für das deployte Verhalten wirkungslos;
GitHub-Secrets allein genügen nicht. F-01 muss die Werte zusätzlich als
Worker-Secrets setzen — robusteste Variante: `secrets:`-Input der
`wrangler-action@v3`, der die GitHub-Secrets bei jedem Deploy in den Worker
synct (Single Source of Truth, keine Drift). Dank `optional: true` +
Null-Client-Degradation bricht F-01 den bestehenden grünen Deploy zu keinem
Zeitpunkt.

**Empfehlung RLS-Grundgerüst:** Eine erste Migration mit (1) `visibility`-Enum
(`private`/`global`), (2) `profiles`-Tabelle (Auth-Standardanker, kein
Domänenobjekt) mit vollem RLS-Policy-Satz, (3) dem dokumentierten, kopierbaren
4-Policy-Muster owner+visibility für S-02/S-03. Das ist die einzige Option,
deren Contract end-to-end testbar ist (zwei Test-User, A sieht B's Zeile nicht)
und die zugleich die ungenutzte Kette Supabase-Projekt ↔ CLI ↔ Migrationen ↔
Remote-DB erstmals durchstößt.

## Detailed Findings

### 1. Scaffold-Inventar: was existiert, was fehlt

**Vorhanden und funktionsfähig (wartet nur auf ein verbundenes Projekt):**

- `src/lib/supabase.ts:1-25` — `createServerClient` aus `@supabase/ssr` mit
  Cookie-Handling; Secrets via `astro:env/server`. **Gibt `null` zurück, wenn
  `SUPABASE_URL`/`SUPABASE_KEY` fehlen** (Zeile 6-8) — bewusster
  Degradations-Pfad.
- `src/middleware.ts:4-25` — löst je Request den User auf →
  `context.locals.user`; `PROTECTED_ROUTES = ["/dashboard"]`; Null-Client →
  `user = null` → Redirect nach `/auth/signin`.
- `src/pages/api/auth/{signin,signup,signout}.ts` — FormData →
  `signInWithPassword`/`signUp`/`signOut`, Fehler als Redirect mit
  `?error=`-Query. **Keine zod-Validierung** (nur Client-seitig in
  `SignInForm.tsx:18-29` / `SignUpForm.tsx:22-45`) — Abweichung von der
  CLAUDE.md-Konvention, gehört aber zu S-01, nicht F-01.
- `src/pages/auth/*.astro`, `src/pages/dashboard.astro` — fertige Pages;
  `confirm-email.astro:4` schaltet in Dev auf auto-confirmed.
- `src/lib/config-status.ts` — Status-Banner „Supabase nicht konfiguriert";
  natürlicher Verifikationspunkt für F-01 (Banner muss verschwinden).
- `astro.config.mjs:17-22` — env-Schema: beide Felder
  `envField.string({ context: "server", access: "secret", optional: true })`.
- `package.json` — `@supabase/ssr ^0.10.3`, `@supabase/supabase-js ^2.99.1`,
  CLI `supabase ^2.23.4` (devDependency).
- `supabase/config.toml` — lokale Stack-Konfig (Auth: `enable_signup = true`,
  `minimum_password_length = 6`, E-Mail-Confirmations lokal aus).

**Fehlt (= Arbeitsumfang F-01, soweit in Scope):**

| Lücke | Befund |
|---|---|
| Verbundenes Supabase-Projekt | keines; `.env`/`.dev.vars` existieren lokal nicht |
| `supabase/migrations/` | Verzeichnis existiert nicht; `config.toml:58` `schema_paths = []` |
| `supabase/seed.sql` | in `config.toml:65` referenziert, Datei fehlt |
| Worker-Runtime-Secrets | nichts gesetzt; `wrangler.jsonc` korrekt ohne Secrets-Sektion |
| `.dev.vars` / `.dev.vars.example` | fehlt; `.gitignore:46` ignoriert `.dev.vars` bereits |
| `database.types.ts` | keine generierten Typen (`supabase gen types`) |
| RLS-Policies | keine (folgt aus: keine Migrationen) |

Nicht F-01-Scope (für den Plan abgrenzen): zod-Validierung der Auth-Routes,
Service-Layer `src/lib/services/`, `src/types.ts` — das gehört zu S-01 bzw.
den ersten Domänen-Slices.

### 2. Secrets-Pfad: Build-Zeit vs. Runtime (Cloudflare Workers)

Verifiziert gegen aktuelle Astro-/Adapter-Doku (Astro ^6.3.1,
`@astrojs/cloudflare` ^13.5.0):

1. **`access: "secret"`-Variablen werden nie ins Bundle eingebacken.** Auf
   Cloudflare ist `astro:env/server` nur eine typsichere Fassade über das
   Worker-Env — Quelle ist zur Laufzeit das Worker-Secret (Dashboard /
   `wrangler secret put`), lokal `.dev.vars`.
2. **Die `env:`-Blöcke in `ci.yml:21-24` und `ci.yml:37-40` sind für das
   deployte Verhalten wirkungslos** — der Build validiert Secrets nicht
   (kein `validateSecrets`) und bäckt sie nicht ein. Sie sind harmlos, aber
   irreführend: sie suggerieren, GitHub-Secrets genügten.
3. **F-01 kann den Deploy nicht brechen:** `optional: true` heißt, selbst zur
   Laufzeit wird nicht geworfen; `supabase.ts:6-8` fängt `undefined` ab. Der
   CI-Deploy bleibt grün, bis alle Orte befüllt sind. Härtung
   (`optional: true` entfernen, `env.validateSecrets: true`) ist ein bewusster
   Folgeschritt **nach** verifiziertem Prod-Login — nicht in F-01 erzwingen.
4. **Lokaler Dev läuft in workerd** (Cloudflare-Vite-Plugin), nicht Node —
   maßgeblicher Secrets-Kanal ist **`.dev.vars`**; `.env` parallel pflegen
   (CLAUDE.md-Konvention). Alternative für offline: `npx supabase start`
   (Docker) liefert lokale URL+Key.

**Konkreter Pfad (drei Orte, ein Sync):**

| Ort | Mechanismus | Schritt |
|---|---|---|
| Lokal | `.dev.vars` (+ `.env`) | Projekt anlegen, URL + Publishable/Anon-Key eintragen |
| GitHub | Repo-Secrets `SUPABASE_URL`/`SUPABASE_KEY` | Single Source of Truth |
| Worker-Runtime | `secrets:`-Input an `wrangler-action@v3` im Deploy-Job | synct GitHub-Secrets bei jedem Deploy → keine Drift |

Alternative für den Worker: manuell `npx wrangler secret put` — funktioniert,
ist aber stille Drift-Quelle (manuell gesetzte Secrets vs. GitHub-Stand).

**Risiken:**

- **Falscher Key:** `SUPABASE_KEY` ist als Name ambig. Es muss der
  Publishable/Anon-Key sein (RLS-unterworfen), **niemals `service_role`** —
  im Plan und in `.env.example`/Doku explizit festnageln.
- **Reihenfolge:** Erst Worker-Secrets setzen, dann ggf. Schema härten —
  umgekehrt bricht der Deploy.
- **Prod-Verifikation:** Live-URL → Signup/Signin-Versuch; vorher liefert die
  Middleware deterministisch `user = null`.

### 3. RLS-Grundgerüst: Contract-Anforderungen und Optionen

**Contract aus dem PRD** (`context/foundation/prd.md`):

- Zweistufige Sichtbarkeit privat/global, Default global (FR-003,
  prd.md:127-129); kein Pro-Nutzer-ACL (FR-004 gestrichen, prd.md:130-133)
- Guardrail „kein Leck über Nutzergrenzen" (prd.md:83-84)
- Jedes Objekt trägt Ersteller + Erstellzeitpunkt (Audit-Basis, prd.md:244-245)
- Globale Objekte per Seed/Config, keine Admin-Rolle (FR-009, prd.md:153-155)
- Modellkonfigs (API-Keys): owner-only, nie global (FR-005/FR-006 + NFR
  Key-Dichtheit)
- Roadmap F-01 (roadmap.md:77): „nicht das fertige Schema, nur der minimale
  Anker"

**Bewertete Optionen:**

- **(a) Migration nur mit Bausteinen** (Enum + SQL-Helper-Funktion, keine
  Tabelle): Contract nicht end-to-end testbar; Helper-Funktion ist eine
  Abstraktionswette mit Performance-Feinheits-Risiko (initplan-Inlining) —
  Indirektion ohne Testbarkeits-Gewinn.
- **(b) Migration mit Referenztabelle — EMPFOHLEN:** `visibility`-Enum +
  `profiles`-Tabelle (id = `auth.users.id`, `created_at`) mit vollem
  Policy-Satz + dokumentiertes 4-Policy-Muster owner+visibility (als
  Template-Block oder droppbare Probetabelle). Einzige Option, bei der
  „Contract etabliert" ein prüfbares Outcome ist: zwei Test-User, drei Zeilen
  SQL beweisen „Eigenes + Globales". `profiles` ist Auth-Standardanker, kein
  Domänenobjekt — S-01 braucht es ohnehin; YAGNI gewahrt.
- **(c) Reines Doku-Pattern:** nicht verifizierbar; das Risiko „RLS zu spät"
  (roadmap.md:80,85) bliebe vollständig auf die Slices verschoben — genau der
  Zustand, den F-01 verhindern soll. Migrations-Pipeline bliebe unverprobt.

**Best Practices fürs Policy-Muster** (gegen aktuelle Supabase-Doku
verifiziert):

- `(select auth.uid())` statt nacktem `auth.uid()` (initplan-Caching)
- Eine Policy je Operation, immer `to authenticated` (CLAUDE.md-Konvention:
  granular je Operation+Rolle)
- `update` braucht `using` **und** `with check`; `insert` nur `with check`
  mit `owner_id = (select auth.uid())` (verhindert Owner-Spoofing)
- btree-Index auf der owner-Spalte jeder RLS-Tabelle
- Alles `security invoker`; `security definer` nur bei Policy-Joins über
  andere RLS-Tabellen (hier nicht der Fall)
- `visibility` weitet **nur `select`**, nie write — auch globale Objekte sind
  nur vom Owner mutierbar

**Anschluss für die Slices:** S-02 (`model_configs`): owner-only, ohne
visibility bzw. fix privat. S-03 (`personas`): volles owner+visibility-Muster,
Default `'global'`. Beide kopieren das F-01-Muster mit je eigener Migration.

### 4. Verifikationspfad für F-01 (aus den Befunden abgeleitet)

1. Lokal: `npm run dev` → Signup/Signin funktioniert, Config-Banner weg
2. Migration: `supabase db push` (o. Migration-Apply) läuft gegen Remote-DB
   durch — erster Beweis, dass die Migrations-Pipeline funktioniert
3. RLS-Contract: zwei Test-User; User A liest globale, aber keine privaten
   Zeilen von User B
4. Prod: nach Secrets-Sync Signup/Signin auf der Live-URL
   `https://persona-forge.damian-spyra-ai.workers.dev`

## Code References

- [src/lib/supabase.ts:1-25](https://github.com/spyrad/persona-forge/blob/40e27af49a410c8686d5f780457fe97475056dd3/src/lib/supabase.ts#L1-L25) — SSR-Client, Null-Degradation bei fehlenden Secrets
- [src/middleware.ts:4-25](https://github.com/spyrad/persona-forge/blob/40e27af49a410c8686d5f780457fe97475056dd3/src/middleware.ts#L4-L25) — User-Auflösung, `PROTECTED_ROUTES`, Redirect
- [astro.config.mjs:17-22](https://github.com/spyrad/persona-forge/blob/40e27af49a410c8686d5f780457fe97475056dd3/astro.config.mjs#L17-L22) — env-Schema (`secret`, `optional: true`)
- [.github/workflows/ci.yml:21-44](https://github.com/spyrad/persona-forge/blob/40e27af49a410c8686d5f780457fe97475056dd3/.github/workflows/ci.yml#L21-L44) — Build-env-Blöcke (wirkungslos für Runtime) + Deploy-Job ohne Secrets-Sync
- [wrangler.jsonc](https://github.com/spyrad/persona-forge/blob/40e27af49a410c8686d5f780457fe97475056dd3/wrangler.jsonc) — Worker-Config, korrekt ohne Secrets-Sektion
- [supabase/config.toml](https://github.com/spyrad/persona-forge/blob/40e27af49a410c8686d5f780457fe97475056dd3/supabase/config.toml) — lokaler Stack; `schema_paths = []`, `seed.sql` referenziert aber fehlend
- [src/lib/config-status.ts](https://github.com/spyrad/persona-forge/blob/40e27af49a410c8686d5f780457fe97475056dd3/src/lib/config-status.ts) — „Supabase nicht konfiguriert"-Banner (Verifikationspunkt)
- [src/pages/api/auth/signin.ts](https://github.com/spyrad/persona-forge/blob/40e27af49a410c8686d5f780457fe97475056dd3/src/pages/api/auth/signin.ts) — Auth-Endpoint (Muster für signup/signout)
- [src/env.d.ts](https://github.com/spyrad/persona-forge/blob/40e27af49a410c8686d5f780457fe97475056dd3/src/env.d.ts) — `App.Locals.user`-Typ

## Architecture Insights

- **Degradations-Pfad ist Feature, nicht Bug:** Null-Client → `user = null` →
  Redirect ist die Mechanik, die F-02 ohne Supabase live gehen ließ und F-01
  erlaubt, inkrementell zu verdrahten, ohne je den Deploy zu brechen.
- **Drei Secrets-Orte mit getrennten Mechanismen** (lokal `.dev.vars`, GitHub
  Build-env, Worker-Runtime) — der `secrets:`-Input der wrangler-action macht
  GitHub zur Single Source und eliminiert die Drift-Klasse.
- **Astro 6 Dev = workerd:** `.dev.vars` ist der maßgebliche lokale Kanal,
  nicht `.env` — die CLAUDE.md-Konvention „beide pflegen" stimmt, die
  Priorität liegt aber bei `.dev.vars`.
- **RLS-Muster als kopierbarer Contract:** F-01 etabliert das
  4-Policy-Muster (select via owner-or-global, insert/update/delete
  owner-only, `to authenticated`, `(select auth.uid())`), die Slices kopieren
  es wörtlich je Tabelle.

## Historical Context (from prior changes)

- `context/archive/2026-06-11-deploy-skeleton-live/plan.md:66-72` — Wortlaut
  der Übergabe: „**Worker-Secrets sind nicht GitHub-Secrets.** Die
  GitHub-Secrets `SUPABASE_URL`/`SUPABASE_KEY` (Build-Zeit) werden beim
  Workers-Deploy NICHT automatisch zu Laufzeit-Secrets des Workers. F-01 muss
  sie später zusätzlich als Worker-Secrets setzen (`npx wrangler secret put`
  oder Dashboard)."
- `context/archive/2026-06-11-deploy-skeleton-live/plan.md:253-257` —
  Migration Note: Werte doppelt setzen (GitHub-Secrets Build +
  Worker-Secrets Runtime).
- `context/foundation/roadmap.md:75-86` — F-01-Definition: Contract, nicht
  Schema; Unlocks S-01 + transitiv alle Slices; Risiko „RLS zu spät".
- `CLAUDE.md` (Gotchas) — „Supabase RLS frueh konfigurieren, sonst entstehen
  Auth-Luecken"; Supabase-Secrets „doppelt setzen".
- `dtb-project/project-changelog/2026-06/2026-06-11.md` —
  `NODE_OPTIONS=--use-system-ca` dauerhaft gesetzt (relevant für
  Supabase-CLI-/npm-Downloads hinter TLS-Interception).
- Keine Widersprüche zwischen den Quellen gefunden.

## Related Research

- `context/archive/2026-06-11-deploy-skeleton-live/plan-brief.md` —
  Entscheidungstabelle F-02 (Workers statt Pages, wrangler-action, ohne
  Supabase-Secrets live)
- `context/changes/bootstrap-verification/verification.md` —
  Scaffold-Audit-Trail

## Open Questions

1. **Key-Wahl festnageln:** `SUPABASE_KEY` = Publishable/Anon-Key (neue
   Supabase-Projekte vergeben `sb_publishable_...`-Keys) — im Plan, in
   `.env.example`-Kommentar und ggf. CLAUDE.md explizit machen.
2. **Muster-Materialisierung:** owner+visibility-Pattern als auskommentierter
   Template-Block in der Migration/Doku oder als droppbare
   `_rls_probe`-Tabelle (testbar, aber Wegwerf-Artefakt)? →
   Plan-Entscheidung.
3. **Worker-Secrets-Mechanik:** `secrets:`-Input der wrangler-action
   (empfohlen, Sync bei jedem Deploy) vs. einmalig manuell
   `wrangler secret put`? → Plan-Entscheidung.
4. **Manuelle Schritte (Owner: Damian):** Supabase-Projekt anlegen
   (Org/Region/Pricing-Tier), GitHub-Secrets setzen.
5. **Lokale Verifikation:** Cloud-Projekt direkt oder zusätzlich
   `npx supabase start` (Docker) für Offline-Dev? Docker-Verfügbarkeit auf
   dem Dev-Rechner ungeprüft.
