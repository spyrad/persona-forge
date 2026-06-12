# Supabase-Projekt anbinden + RLS-Grundgerüst (F-01) — Implementation Plan

## Overview

Ein Supabase-Cloud-Projekt wird mit der App verbunden — lokal über
`.dev.vars`/`.env`, in Produktion über einen GitHub→Worker-Secrets-Sync im
Deploy-Job — und der Datenzugriffs-Contract „Nutzer sieht nur Eigenes +
Globales" wird als erste Migration etabliert (visibility-Enum, `profiles`,
droppbare `_rls_probe` mit vollem Policy-Satz). F-01 endet mit einem
erfolgreichen Signup auf der Live-URL: erst damit ist die Secrets-Kette
(GitHub → Worker-Runtime) bewiesen.

## Current State Analysis

Aus `research.md` (2026-06-12, Commit `40e27af`):

- **Auth-Verdrahtung komplett, dahinter nichts:** SSR-Client
  (`src/lib/supabase.ts:1-25`), Middleware (`src/middleware.ts:4-25`),
  Auth-Endpoints und Forms sind fertig. Es fehlen: verbundenes Projekt,
  `supabase/migrations/` (existiert nicht), `.dev.vars`, Worker-Secrets.
- **Null-Client-Degradation:** `supabase.ts:6-8` gibt `null` zurück, wenn
  Secrets fehlen → `user = null` → Redirect. Kein Zwischenschritt dieses
  Plans kann den Deploy brechen (`optional: true` in `astro.config.mjs:19-20`).
- **CI-env-Blöcke sind für Runtime wirkungslos:** `access: "secret"` wird nie
  ins Bundle eingebacken; der Worker liest nur sein eigenes Env. Die Blöcke in
  `ci.yml:22-24/38-40` bleiben (zukunftssicher), wirksam wird allein der
  Worker-Secrets-Sync.
- **Status-Banner** (`src/lib/config-status.ts`) zeigt „Supabase nicht
  konfiguriert" — natürlicher lokaler Verifikationspunkt.

## Desired End State

- Lokal: `npm run dev` → Signup/Signin funktioniert, Config-Banner weg.
- Remote-DB: Migration `..._rls_foundation.sql` angewendet; RLS-Contract mit
  zwei Test-Usern bewiesen (A sieht globale, aber keine privaten Zeilen von B).
- Prod: CI-Lauf grün, Worker-Secrets gesetzt (via Deploy-Sync), Signup/Signin
  auf `https://persona-forge.damian-spyra-ai.workers.dev` funktioniert.
- Doku: CLAUDE.md-Gotcha beschreibt den Secrets-Sync-Endzustand + Key-Wahl.

### Key Discoveries:

- Worker-Secrets ≠ GitHub-Secrets (F-02-Übergabe,
  `context/archive/2026-06-11-deploy-skeleton-live/plan.md:66-72`); der
  `secrets:`-Input von `wrangler-action@v3` synct sie bei jedem Deploy.
- Lokaler Dev läuft in workerd → `.dev.vars` ist der maßgebliche Kanal,
  `.env` wird parallel gepflegt (CLAUDE.md-Konvention).
- RLS-Best-Practices: `(select auth.uid())`, eine Policy je Operation,
  `to authenticated`, `with check` gegen Owner-Spoofing, Index auf owner-Spalte,
  alles `security invoker` (research.md §3).

## What We're NOT Doing

- **Kein Domänen-Schema** (personas, model_configs, runs) — kommt mit S-02/S-03,
  die das `_rls_probe`-Muster kopieren.
- **Keine zod-Validierung der Auth-Routes, kein Service-Layer, kein
  `database.types.ts`** — S-01 bzw. erste Domänen-Slices.
- **Kein Auth-Flow-Ausbau** (Passwort-Reset, confirm-email-Feinheiten,
  E-Mail-Templates) — S-01.
- **Kein lokaler Supabase-Stack** (`supabase start`/Docker) — Cloud-Projekt
  direkt; lokaler Stack bei Bedarf später.
- **Kein env-Schema-Hardening** (`optional: true` bleibt, kein
  `validateSecrets`) — bewusster Folgeschritt nach verifiziertem Prod-Login,
  frühestens S-01.
- **Kein `seed.sql`** — `config.toml:65` referenziert es, aber nur der lokale
  Stack konsumiert es.

## Implementation Approach

Zwei Phasen nach dem F-02-Muster: Phase 1 ist lokal abschließbar (Projekt +
Verbindung + Migration + lokale Verifikation), Phase 2 bündelt die manuellen
GitHub-Schritte und den Live-Gang. Owner der manuellen Schritte: Damian
(Supabase-Projekt, GitHub-Secrets).

## Critical Implementation Details

- **Key-Wahl:** `SUPABASE_KEY` = **Publishable Key** (neue Projekte:
  `sb_publishable_...`; Legacy-Name „anon key") — RLS-unterworfen. Niemals
  `service_role`/Secret-Key; der würde RLS komplett aushebeln und in
  `.dev.vars`/GitHub landen.
- **E-Mail-Bestätigung:** Supabase-Cloud-Projekte haben Confirmations
  standardmäßig an; der Signup-Flow endet auf `/auth/confirm-email`, der Login
  geht erst nach Klick auf den Mail-Link. Für die Verifikation eigene
  E-Mail-Adresse(n) verwenden (z. B. `+suffix`-Aliase für den zweiten
  Test-User). Einstellungen nicht umbauen — das ist S-01.
- **Reihenfolge Phase 2:** GitHub-Secrets müssen VOR dem Push des
  ci.yml-Commits gesetzt sein, sonst legt der Deploy leere Worker-Secrets an.
- **Middleware-Umschalter:** Sobald die Secrets gesetzt sind, ruft
  `src/middleware.ts` bei JEDEM Request `supabase.auth.getUser()` auf
  (Netzwerk-Roundtrip zum Auth-Server, auch auf öffentlichen Seiten) und der
  `/dashboard`-Guard wird scharf. Gewolltes Scaffold-Verhalten — kein
  F-01-Umbau; die Latenz-Bewertung (ggf. Route-Filterung) gehört zu S-01.

## Phase 1: Supabase-Projekt + lokale Verbindung + RLS-Migration

### Overview

Cloud-Projekt anlegen, App lokal verbinden, Migrations-Pipeline erstmals
durchstoßen und den RLS-Contract beweisbar machen.

### Changes Required:

#### 1. Supabase-Projekt anlegen (manuell, Damian)

**Intent**: Cloud-Projekt als einzige Dev+Prod-Datenbank für v1. Project-URL
und Publishable Key notieren; DB-Passwort sicher ablegen.

**Contract**: Projekt in der Supabase-Org von Damian, Region EU (z. B.
`eu-central-1`), Free Tier. Liefert `SUPABASE_URL`
(`https://<ref>.supabase.co`) und Publishable Key.

#### 2. Lokale Env-Dateien

**File**: `.dev.vars` (neu, gitignored), `.env` (neu, gitignored),
`.dev.vars.example` (neu, getrackt), `.env.example` (ändern)

**Intent**: `.dev.vars` ist der maßgebliche Kanal für den workerd-Dev-Server,
`.env` wird identisch gepflegt. Die Beispieldateien dokumentieren die Key-Wahl,
damit nie der service_role-Key landet.

**Contract**: Beide Beispieldateien enthalten `SUPABASE_URL` und
`SUPABASE_KEY` mit Kommentar: Publishable Key (`sb_publishable_...`), niemals
service_role. `.gitignore` deckt `.dev.vars` und `.env` bereits ab — prüfen,
dass `.dev.vars.example` NICHT ignoriert wird (ggf. `!.dev.vars.example`).

#### 3. Projekt linken + RLS-Foundation-Migration

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_rls_foundation.sql` (neu)

**Intent**: Erste Migration etabliert den Zugriffs-Contract: visibility-Enum,
`profiles` als Auth-Standardanker (owner-only), `_rls_probe` als droppbare
Referenz-Implementierung des owner+visibility-Musters, das S-02/S-03 kopieren.

**Contract**: `npx supabase login` + `npx supabase link --project-ref <ref>`,
dann `npx supabase migration new rls_foundation`, dann `npx supabase db push`.
Inhalt der Migration (das Policy-Muster ist der Contract, von dem spätere
Slices abhängen — deshalb hier ausnahmsweise konkret):

```sql
create type public.visibility as enum ('private', 'global');

-- Auth-Standardanker; kein Domänenobjekt. Owner-only, keine visibility.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Referenz-Muster owner+visibility. Droppbar, sobald S-02/S-03 echte
-- Tabellen nach diesem Muster tragen.
create table public._rls_probe (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  visibility public.visibility not null default 'global',
  note text,
  created_at timestamptz not null default now()
);
create index _rls_probe_owner_id_idx on public._rls_probe (owner_id);
alter table public._rls_probe enable row level security;
create policy "_rls_probe_select_own_or_global" on public._rls_probe
  for select to authenticated
  using (visibility = 'global' or owner_id = (select auth.uid()));
create policy "_rls_probe_insert_own" on public._rls_probe
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "_rls_probe_update_own" on public._rls_probe
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "_rls_probe_delete_own" on public._rls_probe
  for delete to authenticated using (owner_id = (select auth.uid()));
```

Invarianten des Musters (gelten für alle künftigen Tabellen): `visibility`
weitet nur `select`; alle Writes owner-only; `to authenticated` auf jeder
Policy; `(select auth.uid())` statt nacktem `auth.uid()`; btree-Index auf der
owner-Spalte; alles `security invoker`.

#### 4. RLS-Contract-Beweis (manuell, SQL)

**Intent**: Der Contract „Eigenes + Globales" wird mit zwei echten Usern
bewiesen — das prüfbare Outcome von F-01.

**Contract**: Zwei User per lokalem Signup anlegen (User B via
`+suffix`-Mail-Alias). Im Supabase Studio SQL-Editor je eine globale und eine
private `_rls_probe`-Zeile pro User einfügen — **`owner_id` dabei explizit
setzen**: der Editor läuft als `postgres`, dort ist `auth.uid()` NULL und der
Spalten-Default greift nicht (NOT-NULL-Fehler). Dann per Role-Impersonation
prüfen (nicht offensichtlich, daher konkret):

```sql
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"<user-a-uuid>","role":"authenticated"}';
select owner_id, visibility from public._rls_probe;  -- erwartet: A:beide, B:nur global
insert into public._rls_probe (owner_id, visibility)
  values ('<user-b-uuid>', 'private');               -- erwartet: RLS-Fehler (Spoofing)
rollback;
```

### Success Criteria:

#### Automated Verification:

- `npx supabase migration list` zeigt die Migration als remote angewendet
- `npm run lint` läuft grün
- `npm run build` läuft grün (Exit 0)

#### Manual Verification:

- Supabase-Projekt angelegt; `.dev.vars` + `.env` befüllt
- `npm run dev`: Config-Banner verschwunden; Signup → confirm-email → Signin →
  `/dashboard` erreichbar
- RLS-Probe: User A sieht eigene private + alle globalen Zeilen, nicht die
  private Zeile von User B; Owner-Spoofing-Insert wird abgelehnt

**Implementation Note**: Nach Phase 1 pausieren und manuelle Verifikation
bestätigen lassen, bevor Phase 2 startet. Phase-1-Ergebnis committen
(Migration, Beispieldateien, `context/changes/connect-supabase/` mitsamt
research.md/plan.md — Ordner ist bisher untracked).

---

## Phase 2: Secrets-Sync in CI + Live-Gang

### Overview

GitHub-Secrets setzen, Deploy-Job synct sie als Worker-Secrets, Live-URL
verifizieren, Doku nachziehen.

### Changes Required:

#### 1. GitHub-Secrets setzen (manuell, Damian — VOR dem Push)

**Intent**: GitHub wird Single Source of Truth für die Supabase-Secrets.

**Contract**: Repo-Secrets `SUPABASE_URL` und `SUPABASE_KEY` (Publishable Key)
in `spyrad/persona-forge` → Settings → Secrets and variables → Actions.

#### 2. Deploy-Job: Worker-Secrets-Sync

**File**: `.github/workflows/ci.yml`

**Intent**: Der `wrangler-action@v3`-Step synct die GitHub-Secrets bei jedem
Deploy in den Worker — eliminiert die Drift-Klasse „Worker veraltet, CI grün".

**Contract**: `secrets:`-Input am bestehenden Step (`ci.yml:41-44`); die Werte
kommen aus dem Step-`env` (nicht offensichtlich, daher konkret):

```yaml
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          secrets: |
            SUPABASE_URL
            SUPABASE_KEY
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
```

#### 3. Doku-Sync

**File**: `CLAUDE.md`

**Intent**: Der Gotcha „Supabase-Secrets folgen mit F-01 — doppelt setzen"
beschreibt nach dem Live-Gang den Endzustand statt des Plans.

**Contract**: Gotcha-Eintrag ersetzen durch: Secrets werden vom Deploy-Job
automatisch als Worker-Secrets gesynct (GitHub = Single Source);
`SUPABASE_KEY` = Publishable Key, nie service_role; lokal ist `.dev.vars`
maßgeblich (workerd), `.env` parallel pflegen. Environment-Sektion nur
anpassen, falls sie dem widerspricht — Kürzungs-Follow-up aus
WORKFLOW_STATUS bleibt separat.

### Success Criteria:

#### Automated Verification:

- CI-Lauf auf `main` grün (Jobs `ci` + `deploy`)
- `npx wrangler secret list` zeigt `SUPABASE_URL` und `SUPABASE_KEY`

#### Manual Verification:

- Signup auf `https://persona-forge.damian-spyra-ai.workers.dev` →
  Bestätigungs-Mail → Signin → `/dashboard` erreichbar
- Config-Banner auf der Live-URL verschwunden
- CLAUDE.md-Gotcha beschreibt den Live-Zustand

---

## Testing Strategy

Kein Test-Runner im Projekt (`test_command: null`) — Verifikation läuft über
die Success Criteria (CLI-Checks + manuelle Flows). Das deterministische
RLS-Probe-SQL aus Phase 1 ist der Vorläufer echter Policy-Tests; sobald ein
Test-Runner steht (Modul 3), ist das `_rls_probe`-Muster der erste Kandidat.

### Manual Testing Steps:

1. Lokal: Signup mit frischer Mail → confirm → Signin → Dashboard zeigt E-Mail
2. RLS: Impersonations-SQL aus Phase 1 (beide Richtungen: lesen + spoofen)
3. Prod: identischer Flow auf der Live-URL nach Phase 2

## Migration Notes

- An S-01 (email-auth-live): `profiles` existiert (owner-only), bleibt in
  F-01 aber LEER — die Anlage-Mechanik (DB-Trigger auf `auth.users` vs.
  App-Insert beim Signup) ist eine S-01-Entscheidung. Auth-Flows sind ab
  F-01 live funktionsfähig — S-01 fokussiert Vervollständigung (zod,
  Passwort-Reset-Entscheidung, confirm-email-UX, E2E-Verifikation) und
  bewertet die Middleware-Latenz (`auth.getUser()` je Request, ggf.
  Route-Filterung).
- An S-02/S-03: owner+visibility-Muster aus `_rls_probe` wörtlich kopieren
  (S-02 `model_configs`: owner-only, fix privat, KEINE visibility-Spalte;
  S-03 `personas`: volles Muster, Default `'global'`). `_rls_probe` droppen,
  sobald die erste echte Muster-Tabelle existiert.
- Env-Schema-Hardening (`optional: true` entfernen, `validateSecrets`) ist
  jetzt möglich, sobald gewünscht — bewusst nicht Teil von F-01.

## References

- Research: `context/changes/connect-supabase/research.md`
- Roadmap F-01: `context/foundation/roadmap.md:75-86`
- F-02-Übergabe: `context/archive/2026-06-11-deploy-skeleton-live/plan.md:66-72, 253-257`
- Deploy-Job: `.github/workflows/ci.yml:26-44`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Supabase-Projekt + lokale Verbindung + RLS-Migration

#### Automated

- [x] 1.1 `npx supabase migration list` zeigt Migration als remote angewendet — f96303a
- [x] 1.2 `npm run lint` grün — f96303a
- [x] 1.3 `npm run build` grün — f96303a

#### Manual

- [x] 1.4 Supabase-Projekt angelegt; `.dev.vars` + `.env` befüllt — f96303a
- [x] 1.5 Lokal: Banner weg; Signup → confirm → Signin → `/dashboard` — f96303a
- [x] 1.6 RLS-Probe: Eigenes+Globales sichtbar, Fremd-Privates nicht, Spoofing abgelehnt — f96303a

### Phase 2: Secrets-Sync in CI + Live-Gang

#### Automated

- [ ] 2.1 CI-Lauf auf `main` grün (ci + deploy)
- [ ] 2.2 `npx wrangler secret list` zeigt beide Secrets

#### Manual

- [ ] 2.3 Signup → Confirm → Signin auf Live-URL funktioniert
- [ ] 2.4 Config-Banner auf der Live-URL verschwunden
- [ ] 2.5 CLAUDE.md-Gotcha beschreibt Live-Zustand
