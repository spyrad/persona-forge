# E-Mail-Auth end-to-end (S-01) — Implementation Plan

## Overview

Die existierenden Auth-Flows (Signup/Signin/Signout, Middleware, Dashboard-Guard)
werden verdrahtet: Zod-Validierung auf den API-Routes, ein DB-Trigger für automatische
`profiles`-Anlage, und eine Middleware-Optimierung, die den Auth-Server-Roundtrip auf
geschützte Routen beschränkt. S-01 endet mit verifizierten Auth-Flows lokal und auf
der Live-URL.

## Current State Analysis

Aus F-01 (archiviert `context/archive/2026-06-12-connect-supabase/`):

- **Auth-Verdrahtung komplett, aber roh:** SSR-Client (`src/lib/supabase.ts`),
  Middleware (`src/middleware.ts`), API-Endpoints (`/api/auth/{signin,signup,signout}`),
  Pages (`/auth/signin`, `/auth/signup`, `/auth/confirm-email`) und Dashboard sind
  gescaffoldet und funktionsfähig (verifiziert in F-01-Phase 1).
- **Fehlende Zod-Validierung:** API-Routes lesen `formData` ohne Typ- oder Längenprüfung
  (CLAUDE.md-Convention: `Input mit zod validieren`).
- **profiles leer:** Die `profiles`-Tabelle existiert (F-01-Migration), aber kein
  Mechanismus legt bei Signup automatisch einen Eintrag an; F-01-Plan Note: „Anlage-Mechanik
  ist eine S-01-Entscheidung".
- **Middleware läuft für jeden Request:** `auth.getUser()` (Supabase-Netzwerk-Roundtrip)
  wird auf jeder URL inkl. `/auth/*` und statischer Seiten aufgerufen; F-01-Impl-Review
  flaggte dies als S-01-Bewertungsaufgabe.
- **Signin redirectet auf `/`:** Nach erfolgreichem Login landet der User auf der
  öffentlichen Startseite statt im Dashboard.
- **config-status.ts hat polnischen Text:** Fehlermeldung aus dem Scaffold-Original
  noch auf Polnisch — Supabase ist konfiguriert, der Text schadet nicht, ist aber
  inkonsequent.

## Desired End State

- Lokal: Signup → confirm-email → Signin → `/dashboard` mit User-E-Mail → Signout →
  Redirect auf `/` → Versuch `/dashboard` direkt → Redirect auf `/auth/signin`.
- DB: Nach Signup existiert ein `profiles`-Eintrag mit der User-UUID (DB-Trigger).
- Performance: `/auth/signin`, `/auth/signup` und `/` lösen keinen Auth-Server-Roundtrip aus.
- Code: API-Routes validieren Input mit zod; ungültige Requests erhalten 400 statt Redirect.
- Prod: Identischer Flow auf `https://persona-forge.damian-spyra-ai.workers.dev` nach
  Push auf `main`.

### Key Discoveries

- `src/pages/api/auth/signin.ts:14` — derzeit `return context.redirect("/")` bei Erfolg;
  muss auf `"/dashboard"` geändert werden.
- `src/middleware.ts:5` — `PROTECTED_ROUTES = ["/dashboard"]`; die Optimierung hält
  dieses Array, prüft aber VOR `createClient`/`getUser`, ob die Route überhaupt
  geschützt ist.
- `src/lib/config-status.ts:8` — Polnischer Text; Supabase-Docs-URL aus dem Scaffold.
- Supabase-empfohlenes Trigger-Pattern: `security definer set search_path = ''` in der
  Trigger-Funktion (vermeidet search_path-Injection).
- `astro.config.mjs` — SUPABASE_URL/KEY sind `optional: true`; `src/lib/supabase.ts`
  gibt `null` zurück wenn sie fehlen → alle Auth-Checks bleiben null-safe.

## What We're NOT Doing

- **Passwort-Reset-Flow** — S-01 schließt nur Signup/Signin/Signout ab; Reset ist S-01-Follow-up.
- **E-Mail-Template-Customization** — Supabase-Standard-Mails bleiben; Design-Anpassung
  kommt nach dem MVP-Durchstich.
- **confirm-email-Seite überarbeiten** — der `import.meta.env.DEV`-Trick (auto-confirm in Dev)
  ist akzeptables Scaffold-Verhalten für v1.
- **Redirect-after-login mit returnTo-Parameter** — nicht nötig für v1; PROTECTED_ROUTES
  ist /dashboard, direkter Redirect reicht.
- **Rate-Limiting / CAPTCHA** — Supabase Free Tier hat Mail-Limits; kein eigenes Rate-Limit
  in v1.
- **zod-Validierung auf signout.ts** — Signout hat keine Eingaben; kein Handlungsbedarf.
- **env-Schema-Hardening** (`optional: true` entfernen) — bewusst nach vollständiger
  Live-Verifikation; nicht S-01-Scope.

## Implementation Approach

Vier kurze Phasen in Abhängigkeitsreihenfolge: erst die API-Layer-Fixes (Phase 1),
dann die DB-Migration (Phase 2), dann die Middleware-Optimierung (Phase 3), abschließend
die Live-Verifikation (Phase 4). Phasen 1 und 2 sind unabhängig und könnten parallel
laufen — der Plan sequenziert sie trotzdem, da Phase 2 einen manuellen `db push` braucht.

## Critical Implementation Details

- **Zod-Fehler → 400 (bewusst API-Contract, nicht Browser-UX):** Für
  Validierungsfehler kommt ein HTTP-400 mit JSON-Body zurück. Das ist der
  Defense-in-Depth-/API-Contract: per curl/Direktaufruf testbar (die
  Success-Criteria nutzen genau das) und schützt vor umgangener Client-Prüfung.
  **Wichtig:** Die Forms (`SignInForm`/`SignUpForm`) machen KEIN `fetch()` — sie
  posten nativ und zeigen Fehler ausschließlich über den `serverError`-Prop aus
  dem `?error=`-Query-Param. Ein realer Browser-Nutzer trifft den 400-JSON also
  NICHT, solange Client- und Server-Validierung deckungsgleich sind (siehe F1:
  Passwort min 8 auf beiden Seiten). Supabase-Fehler bleiben beim bestehenden
  `?error=`-Redirect-Kanal — die zwei Stile sind bewusst getrennt: 400-JSON =
  API/maschinell, Redirect-Param = Browser-UI.
- **Trigger `security definer set search_path = ''`:** Supabase-Auth-Triggers müssen
  immer mit explizitem `search_path = ''` und Schema-Qualified Namen arbeiten
  (`public.profiles`, `public.handle_new_user`), sonst besteht search_path-Injection-Risiko.
- **Middleware-Optimierung: user bleibt `null` auf öffentlichen Routen.** Das ist für
  v1 akzeptabel (keine Nav-Bar mit eingeloggtem User auf öffentlichen Seiten). Falls
  künftig eine personalisierte Startseite benötigt wird, muss `PROTECTED_ROUTES` erweitert
  oder die Logik umgebaut werden.

---

## Phase 1: API-Routes validieren + kleine Fixes

### Overview

Zod-Validierung auf `signup.ts` und `signin.ts`; Signin-Erfolgs-Redirect auf `/dashboard`;
`config-status.ts` Text auf Englisch korrigieren.

### Changes Required:

#### 0. `npm install zod` — direkte Dependency deklarieren

**Intent**: `zod` liegt derzeit nur transitiv in `node_modules` (zod@4.4.3,
von einem anderen Paket gezogen). Der Build löst den Import heute auf, aber ein
künftiges `npm update` kann zod entfernen → Build bricht. Vor dem ersten
Import als direkte Dependency festschreiben.

**Contract**: `npm install zod` (landet unter `dependencies` in package.json);
Major 4.x bleibt. Lockfile-Diff prüfen, dass `"zod"` jetzt als direkter Eintrag
erscheint.

#### 1. `src/pages/api/auth/signup.ts` — Zod-Validierung

**File**: `src/pages/api/auth/signup.ts`

**Intent**: Input validieren, bevor er an Supabase geht. Ungültige Requests (fehlende
E-Mail, zu kurzes Passwort) sollen mit 400 beantwortet werden, nicht mit einem
Supabase-Fehler-Redirect.

**Contract**: Zod-Schema `z.object({ email: z.string().email(), password: z.string().min(8) })`.
Fehler → `new Response(JSON.stringify({ error: z.flattenError(result.error) }), { status: 400 })`
(Zod-4-Form — `result.error.flatten()` ist in v4 deprecated; alternativ
`result.error.issues`). Gültige Daten → bestehende Supabase-Logik + Redirect auf
`/auth/confirm-email`.

#### 2. `src/pages/api/auth/signin.ts` — Zod-Validierung + Redirect-Fix

**File**: `src/pages/api/auth/signin.ts`

**Intent**: Input validieren; bei Erfolg auf `/dashboard` statt `/` redirecten.

**Contract**: Schema `z.object({ email: z.string().email(), password: z.string().min(1) })`.
Validierungsfehler → 400. Supabase-Fehler → bestehender Redirect mit Error-Query-Param.
Erfolg → `context.redirect("/dashboard")`.

#### 3. `src/lib/config-status.ts` — Englischer Text

**File**: `src/lib/config-status.ts`

**Intent**: Polnische Fehlermeldung aus dem Scaffold-Original durch englischen Text
ersetzen; Scaffold-Docs-URL entfernen (nicht mehr relevant).

**Contract**: `message`-Feld → `"Supabase is not configured — authentication is
disabled."`, `docsUrl` und `docsLabel` Felder entfernen.

#### 4. `src/components/auth/SignUpForm.tsx` — Client-Mindestlänge auf 8 angleichen

**File**: `src/components/auth/SignUpForm.tsx`

**Intent**: Client- und Server-Mindestlänge konsistent halten. Das Formular
postet nativ (`<form method="POST">`); bei min 6 client / min 8 server bestände
ein 6–7-Zeichen-Passwort die Client-Prüfung, würde nativ abgeschickt und vom
Server mit 400-JSON beantwortet — der Browser zeigt dann rohes JSON. Die
dokumentierte S-01-Entscheidung lautet „Passwort min 8".

**Contract**: `MIN_PASSWORD_LENGTH = 8` (Zeile 8); Placeholder-Text
`"Min. 6 characters"` → `"Min. 8 characters"` (Zeile 90). Der `passwordHint`
nutzt `MIN_PASSWORD_LENGTH` bereits dynamisch — keine weitere Änderung.

### Success Criteria:

#### Automated Verification:

- `package.json` listet `zod` unter `dependencies`
- `npm run lint` grün
- `npm run build` grün (Exit 0)

#### Manual Verification:

- POST auf `/api/auth/signup` mit leerem Body → HTTP 400, JSON-Body mit Zod-Fehlern
- POST auf `/api/auth/signup` mit gültiger E-Mail + `"passwort1"` (8 Zeichen) → Redirect
  auf `/auth/confirm-email`
- POST auf `/api/auth/signin` mit gültigen Credentials → Redirect auf `/dashboard`
- Browser: Signup-Formular mit 7-Zeichen-Passwort → Client blockt (kein nativer
  Submit, keine 400-JSON-Seite); ab 8 Zeichen geht es durch

**Implementation Note**: Kurze manuelle Verifikation per curl oder Browser-DevTools vor
Phase 2 — Phase 2 braucht `db push`, der die Prod-DB berührt.

---

## Phase 2: profiles-Trigger-Migration

### Overview

DB-Trigger anlegen, der bei jedem neuen `auth.users`-Eintrag automatisch eine
`profiles`-Zeile erstellt. Danach Migration remote anwenden.

### Changes Required:

#### 1. Migration: profiles-Trigger

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_profiles_trigger.sql` (neu)

**Intent**: Sicherstellen, dass `profiles` immer konsistent mit `auth.users` ist —
unabhängig davon, über welchen Pfad ein User angelegt wird (App, Admin, OAuth später).

**Contract**: Trigger-Funktion `public.handle_new_user()` mit `security definer set
search_path = ''`; inserted `public.profiles(id)` mit `NEW.id`. Trigger `on_auth_user_created`
AFTER INSERT ON `auth.users`, FOR EACH ROW.

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

#### 2. Migration remote anwenden (manuell)

**Intent**: Neue Migration auf dem Cloud-Projekt ausführen.

**Contract**: `npx supabase db push` — bestätigt durch `npx supabase migration list`
(neue Migration als `remote applied` sichtbar).

### Success Criteria:

#### Automated Verification:

- `npx supabase migration list` zeigt neue Migration als remote applied

#### Manual Verification:

- Neuen Test-User anlegen (Signup lokal) → im Supabase-Studio SQL-Editor:
  `select * from public.profiles;` zeigt einen Eintrag mit der neuen UUID

**Implementation Note**: Supabase-Mail-Rate-Limit beachten (~2-4 Mails/h Free Tier).
Falls kein frischer Test-User möglich: direkt im Studio mit `insert into auth.users`
testen, ob der Trigger feuert — Studio läuft als `postgres`, kein RLS-Problem.

---

## Phase 3: Middleware-Optimierung

### Overview

`auth.getUser()` nur noch aufrufen, wenn die angefragte Route in `PROTECTED_ROUTES`
liegt. Öffentliche Routes setzen `context.locals.user = null` ohne Netzwerk-Roundtrip.

### Changes Required:

#### 1. `src/middleware.ts` — Route-Check vor Auth-Roundtrip

**File**: `src/middleware.ts`

**Intent**: Supabase-Netzwerkaufruf auf Requests beschränken, die ihn tatsächlich
brauchen — eliminiert den Roundtrip für `/auth/*`, `/`, statische Assets.

**Contract**: Prüfe `isProtected` via `PROTECTED_ROUTES.some(...)` VOR `createClient`.
Wenn nicht geschützt: `context.locals.user = null`, direkt `next()`. Wenn geschützt:
bisherige Logik (createClient → getUser → null-Check → Redirect).

### Success Criteria:

#### Automated Verification:

- `npm run lint` grün
- `npm run build` grün

#### Manual Verification:

- GET auf `/auth/signin` — kein Supabase-Auth-Roundtrip im Netzwerk-Tab der DevTools
- GET auf `/dashboard` ohne Session — Redirect auf `/auth/signin` (Guard noch aktiv)
- GET auf `/dashboard` mit Session — Dashboard lädt mit User-E-Mail

---

## Phase 4: Live-Verifikation

### Overview

Alle Auth-Flows lokal und auf der Prod-URL vollständig durchspielen.

### Changes Required:

Keine Code-Änderungen — nur Push und manuelle Verifikation nach dem CI-Deploy.

### Success Criteria:

#### Automated Verification:

- CI-Lauf auf `main` grün (ci + deploy Jobs)
- `npm run lint && npm run build` lokal grün

#### Manual Verification:

- **Lokal komplett:** Signup (frische +suffix-Mail) → confirm-email → Signin →
  `/dashboard` zeigt korrekte E-Mail → Signout → `/` erreicht → `/dashboard` direkt →
  Redirect auf `/auth/signin`
- **profiles prüfen:** `select * from public.profiles` nach lokalem Signup → Eintrag
  vorhanden (Trigger hat gefeuert)
- **Prod:** identischer Signup-Signin-Signout-Flow auf der Live-URL nach CI-Deploy
- **Middleware-Optimierung auf Prod:** GET `/auth/signin` — kein Auth-Header in
  Supabase-API-Requests (Network-Tab)

---

## Testing Strategy

### Manual Testing Steps:

1. Phase 1: curl mit leerem Body gegen `/api/auth/signup` → 400 mit Zod-Fehler-JSON
2. Phase 2: Trigger-Test im Studio SQL-Editor (`insert into auth.users` als
   Service-Role → `select * from public.profiles`)
3. Phase 3: Browser DevTools Netzwerk-Tab auf `/auth/signin` — keine
   `auth.getUser`-Requests
4. Phase 4: Vollständiger Auth-Flow lokal + auf Live-URL

## Migration Notes

- An S-02/S-03: `profiles` ist jetzt per Trigger konsistent befüllt — kein manueller
  Insert mehr nötig; S-02/S-03 können `profiles.id = auth.uid()` als Foreign Key nutzen.
- Middleware-Optimierung: User ist auf öffentlichen Seiten immer `null`. Falls künftig
  eine personalisierte Startseite gewünscht wird (z. B. Dashboard-Link in der Nav wenn
  eingeloggt), muss `/` zu `PROTECTED_ROUTES` hinzugefügt oder eine separate
  Opt-in-Auth-Route eingeführt werden.

## References

- Roadmap S-01: `context/foundation/roadmap.md:103-113`
- F-01 Archiv (profiles-Note, Middleware-Note): `context/archive/2026-06-12-connect-supabase/plan.md`
- F-01 Impl-Review (Middleware-Finding): `context/archive/2026-06-12-connect-supabase/reviews/impl-review.md`
- Supabase Trigger Best Practice: https://supabase.com/docs/guides/auth/managing-user-data

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: API-Routes validieren + kleine Fixes

#### Automated

- [ ] 1.0 `package.json` listet `zod` unter `dependencies`
- [ ] 1.1 `npm run lint` grün
- [ ] 1.2 `npm run build` grün

#### Manual

- [ ] 1.3 POST `/api/auth/signup` leer → HTTP 400 + Zod-JSON
- [ ] 1.4 POST `/api/auth/signup` valid → Redirect confirm-email
- [ ] 1.5 POST `/api/auth/signin` valid → Redirect /dashboard
- [ ] 1.6 Browser: 7-Zeichen-Passwort wird client-seitig geblockt (keine 400-JSON-Seite)

### Phase 2: profiles-Trigger-Migration

#### Automated

- [ ] 2.1 `npx supabase migration list` zeigt neue Migration als remote applied

#### Manual

- [ ] 2.2 Neuer User → `select * from public.profiles` zeigt Eintrag

### Phase 3: Middleware-Optimierung

#### Automated

- [ ] 3.1 `npm run lint` grün
- [ ] 3.2 `npm run build` grün

#### Manual

- [ ] 3.3 GET `/auth/signin` — kein Auth-Roundtrip im Netzwerk-Tab
- [ ] 3.4 GET `/dashboard` ohne Session → Redirect /auth/signin
- [ ] 3.5 GET `/dashboard` mit Session → Dashboard + User-E-Mail

### Phase 4: Live-Verifikation

#### Automated

- [ ] 4.1 CI-Lauf auf `main` grün (ci + deploy)

#### Manual

- [ ] 4.2 Lokal: Signup → confirm → Signin → Dashboard → Signout
- [ ] 4.3 Lokal: profiles-Eintrag nach Signup vorhanden
- [ ] 4.4 Prod: Signup → confirm → Signin → Dashboard → Signout auf Live-URL
- [ ] 4.5 Prod: GET `/auth/signin` — kein Auth-Header in Supabase-Requests (Network-Tab)
