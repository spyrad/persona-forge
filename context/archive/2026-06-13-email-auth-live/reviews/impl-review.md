<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: E-Mail-Auth end-to-end (S-01)

- **Plan**: context/changes/email-auth-live/plan.md
- **Scope**: Phasen 1–4 (alle)
- **Date**: 2026-06-15
- **Verdict**: NEEDS ATTENTION (vor Triage) → alle Funde fixiert/triagiert
- **Findings**: 0 critical, 3 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING (F3, behoben) |
| Scope Discipline | PASS |
| Safety & Quality | WARNING (F1/F4/F5, behoben) |
| Architecture | PASS |
| Pattern Consistency | WARNING (F2, behoben) |
| Success Criteria | PASS |

## Findings

### F1 — Rohe Supabase-Fehler in der URL (?error=)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — echter Tradeoff (UX-Hints vs. Leakage)
- **Dimension**: Safety & Quality
- **Location**: signin.ts:42, signup.ts:47, callback.ts:25
- **Detail**: `encodeURIComponent(error.message)` spiegelte unkontrollierte Supabase-Texte in URL/UI → User-Enumeration + Info-Leak (Rate-Limit/Konfig).
- **Fix**: Neuer Helper `src/lib/auth-errors.ts::safeAuthError()` — loggt Rohtext serverseitig, gibt user-sichere Meldung zurück (bekannter `code` → spezifischer Text wie `email_not_confirmed`, sonst generischer Fallback). Verdrahtet in signin/signup/callback.
- **Decision**: FIXED — verifiziert per curl (`?error=Invalid email or password.`)

### F2 — `prerender = false` fehlt in signup.ts + signin.ts

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/auth/{signup,signin}.ts
- **Detail**: callback.ts hatte es, CLAUDE.md fordert es als API-Konvention; im selben Change inkonsistent.
- **Fix**: `export const prerender = false` in beiden ergänzt.
- **Decision**: FIXED

### F3 — Tote Felder docsUrl/docsLabel (Plan-Drift)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW
- **Dimension**: Plan Adherence
- **Location**: src/lib/config-status.ts:7-8 (+ Konsument src/layouts/Layout.astro:26-34)
- **Detail**: Plan wollte die Felder entfernen — waren nur aus dem Objekt-Literal raus, nicht aus dem Interface. Beim Entfernen aus dem Interface fiel auf: `Layout.astro` rendert `cfg.docsUrl`/`cfg.docsLabel` in einem nie befüllten (toten) Block → Lint-Error `no-unsafe-assignment`. Der Drift-Agent hatte diesen Konsumenten übersehen.
- **Fix**: Interface-Felder entfernt **und** den toten Docs-Link-Block aus `Layout.astro` gestrichen.
- **Decision**: FIXED — Lint grün

### F4 — middleware `getUser()` ohne try/catch

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🔎 MEDIUM
- **Dimension**: Safety & Quality (Reliability)
- **Location**: src/middleware.ts:18-21
- **Detail**: Externer Call ungeschützt — bei Supabase-Ausfall 500 statt sauberem Redirect.
- **Fix**: try/catch → bei Fehler `locals.user = null` (greift den bestehenden Redirect auf `/auth/signin`), Fehler serverseitig geloggt.
- **Decision**: FIXED — Dashboard-Guard per curl weiterhin 302

### F5 — callback.ts ignoriert error/error_description

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality (Reliability)
- **Location**: src/pages/auth/callback.ts:11
- **Detail**: Supabase hängt bei Verify-Fehler `?error=…&error_description=…` an; Handler prüfte nur `code` → echter Grund ging als „Missing confirmation code" verloren.
- **Fix**: error/error_description zuerst geprüft → freundliche, gemappte Meldung; Rohtext geloggt.
- **Decision**: FIXED — verifiziert per curl

### F6 — Trigger-Migration nicht idempotent

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Data safety
- **Location**: supabase/migrations/20260614174810_profiles_trigger.sql
- **Detail**: Sonst sauber (security definer, search_path='', RLS auf profiles aktiv). Kein `on conflict (id) do nothing`, kein `drop trigger if exists`. Migration ist bereits remote applied → Nacharbeit bräuchte neue Migration.
- **Fix**: (deferred) neue Migration mit `on conflict (id) do nothing` für Doppel-Insert-Robustheit.
- **Decision**: SKIPPED → Follow-up (`follow-ups/review-fixes.md`)
