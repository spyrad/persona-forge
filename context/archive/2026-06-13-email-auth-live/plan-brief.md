# E-Mail-Auth end-to-end (S-01) — Plan Brief

> Full plan: `context/changes/email-auth-live/plan.md`

## What & Why

Die existierenden Auth-Flows sind gescaffoldet und seit F-01 mit Supabase verbunden —
sie funktionieren, aber roh: kein Input-Validation, kein profiles-Anlage-Mechanismus,
unnötige Supabase-Roundtrips auf öffentlichen Seiten. S-01 verdrahtet diese Lücken
und beweist den vollständigen Auth-Flow lokal und auf der Live-URL.

## Starting Point

Auth-Scaffold (Signup/Signin/Signout API-Routes, Pages, Middleware, Dashboard) ist
funktionsfähig und durch F-01 mit Supabase verbunden. `profiles`-Tabelle existiert,
aber leer — kein Trigger. Middleware ruft `auth.getUser()` auf jedem Request auf.

## Desired End State

Nutzer kann sich per E-Mail + Passwort registrieren, anmelden und geschützte Seiten
erreichen; Unangemeldete werden auf `/auth/signin` geleitet. Nach Signup existiert
automatisch ein `profiles`-Eintrag (DB-Trigger). Auth-Server-Roundtrip läuft nur
auf geschützten Routen.

## Key Decisions Made

| Decision | Choice | Why | Source |
|---|---|---|---|
| profiles-Anlage-Mechanik | DB-Trigger `handle_new_user` | Datenbank-Invariante — konsistent unabhängig vom Auth-Pfad | Plan |
| Middleware-Optimierung | Route-Check vor `auth.getUser()` | Eliminiert Roundtrip auf `/auth/*` und `/` | Plan |
| Passwort-Mindestlänge | 8 Zeichen (Zod) | Supabase-Standard; kein Zeichenklassen-Overhead | Plan |
| Post-Signin-Redirect | `/dashboard` | User landet direkt im geschützten Bereich | Plan |
| Zod-Fehler-Response | HTTP 400 + JSON | Testbar; React-Forms können auswerten statt URL-Param-Parse | Plan |

## Scope

**In scope:**
- Zod-Validierung auf `signup.ts` + `signin.ts`
- Signin-Redirect auf `/dashboard`
- DB-Trigger für automatische `profiles`-Anlage
- Middleware-Optimierung (Route-Check vor Auth-Roundtrip)
- `config-status.ts` Text auf Englisch
- Live-Verifikation lokal + Prod

**Out of scope:**
- Passwort-Reset-Flow
- E-Mail-Template-Customization
- confirm-email-Page-Redesign
- Redirect-after-login mit returnTo-Parameter
- Rate-Limiting / CAPTCHA
- env-Schema-Hardening (`optional: true` entfernen)

## Architecture / Approach

Vier sequenzielle Phasen: (1) API-Layer-Fixes ohne DB-Änderungen — sofort testbar via
curl; (2) DB-Migration + `supabase db push` — Trigger in der Cloud; (3) Middleware
umbauen — Route-Check isoliert testbar via Browser DevTools; (4) Push auf `main` und
vollständige Prod-Verifikation.

## Phases at a Glance

| Phase | Was es liefert | Key Risk |
|---|---|---|
| 1. API-Routes + Fixes | Zod-Validierung, Signin→/dashboard, englischer Text | Zod-Import — `zod` muss im Projekt vorhanden sein |
| 2. profiles-Trigger | Automatische profiles-Anlage bei Signup | `security definer` + search_path korrekt setzen |
| 3. Middleware-Optimierung | Kein Auth-Roundtrip auf öffentlichen Seiten | User = null auf /auth/\* — Nav-Bar-Änderungen ausgeschlossen |
| 4. Live-Verifikation | Prod-Beweis des vollständigen Auth-Flows | Supabase Mail-Rate-Limit Free Tier (~2-4 Mails/h) |

**Prerequisites:** F-01 abgeschlossen (Supabase verbunden, RLS-Foundation migriert) — ✅ done  
**Estimated effort:** ~1 Session, 4 kurze Phasen

## Open Risks & Assumptions

- `zod` ist eine direkte Dependency von `@supabase/ssr` oder ähnlich — falls nicht,
  muss `npm install zod` ergänzt werden (wahrscheinlich bereits vorhanden via shadcn).
- Supabase Mail-Rate-Limit verhindert ggf. Signup-Test auf Prod in Phase 4;
  Signin mit Phase-1-User als Fallback akzeptiert.

## Success Criteria (Summary)

- POST `/api/auth/signup` mit leerem Body → HTTP 400 + JSON-Fehler
- Signup → confirm → Signin → `/dashboard` (zeigt User-E-Mail) → Signout → Redirect
  `/` → Direktzugriff `/dashboard` → Redirect `/auth/signin`
- CI-Lauf nach Push grün; identischer Flow auf Live-URL
