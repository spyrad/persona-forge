<!-- PLAN-REVIEW-REPORT -->
# Plan Review: E-Mail-Auth end-to-end (S-01)

- **Plan**: `context/changes/email-auth-live/plan.md`
- **Mode**: Deep
- **Date**: 2026-06-13
- **Verdict**: REVISE → SOUND (nach Triage, alle Findings gefixt)
- **Findings**: 1 critical · 2 warnings · 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING (F1, gefixt) |
| Lean Execution | PASS |
| Architectural Fitness | WARNING (F2, gefixt) |
| Blind Spots | PASS |
| Plan Completeness | WARNING (F3, F4, gefixt) |

## Grounding

6/6 paths ✓, symbols ✓ (PROTECTED_ROUTES, createClient, redirect("/"), profiles),
brief↔plan ✓. zod transitiv vorhanden (zod@4.4.3), aber undeklariert → F3.
profiles-Schema (id PK + created_at default) — Trigger-Insert sicher.
Middleware-Blast-Radius clean — nur dashboard.astro (protected) liest locals.user.

## Findings

### F1 — Passwort-Mindestlänge: Client 6 vs. Plan-Server 8

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Phase 1, Schritt 1 (signup.ts Zod min(8))
- **Detail**: `SignUpForm.tsx:8` erzwingt `MIN_PASSWORD_LENGTH = 6`, Plan-Server `z.string().min(8)`. Forms posten nativ → 6–7-Zeichen-Passwort besteht Client-Check, Server gibt 400-JSON → Browser rendert rohes JSON. Prod-sichtbare Regression, vom Plan nicht bemerkt.
- **Fix A ⭐ Recommended**: Client auf 8 angleichen (`MIN_PASSWORD_LENGTH = 8` + Placeholder/Hint in SignUpForm.tsx).
  - Strength: Erfüllt dokumentierte S-01-Entscheidung "min 8"; Single Source über Client+Server.
  - Tradeoff: Phase 1 wächst um einen Komponenten-Edit.
  - Confidence: HIGH — Mismatch im Code direkt belegt.
- **Fix B**: Server auf min(6) setzen.
  - Strength: Kein Client-Edit.
  - Tradeoff: Widerspricht der dokumentierten Entscheidung "min 8"; schwächt das Passwort.
- **Decision**: FIXED via Fix A — SignUpForm.tsx-Edit in Phase 1 ergänzt (min 8 + Placeholder "Min. 8 characters"); Verifikation 1.6 + Browser-Criterion ergänzt.

### F2 — 400-JSON-Response: Rationale falsch, Error-Kanal inkonsistent

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Critical Implementation Details — "Zod-Fehler → 400"
- **Detail**: Plan begründet 400-JSON mit "die React-Forms können die Antwort auswerten" — falsch. SignInForm/SignUpForm machen kein `fetch()`, posten nativ, zeigen Fehler nur via `serverError`-Prop aus `?error=`-Query-Param. Supabase-Fehler nutzen weiter Redirect-mit-Param; Validierungsfehler gäben 400-JSON → zwei Stile in einer Route. 400-JSON ist aber curl-testbar (Success-Criteria nutzen das).
- **Fix**: Rationale korrigieren — 400-JSON = bewusster API-/Defense-in-Depth-Contract (curl-testbar); Browser-Pfad via Client-Validierung abgesichert (hängt an F1). Trennung 400-JSON (API) vs. `?error=`-Redirect (Browser-UI) explizit dokumentieren.
- **Decision**: FIXED — Begründung im Plan ersetzt; Kanal-Trennung + F1-Abhängigkeit festgehalten.

### F3 — `zod` nicht als Dependency deklariert + v4-API-Drift

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1
- **Detail**: `zod` nur transitiv in node_modules (zod@4.4.3); `npm update` kann es entfernen → Build bricht. Phase 1 hatte keinen install-Schritt. `result.error.flatten()` ist in Zod 4 deprecated (`z.flattenError()` / `.issues`).
- **Fix**: Phase 1 Schritt 0 `npm install zod` (direkte Dep) + Error-Serialisierung auf `z.flattenError(result.error)` umgestellt.
- **Decision**: FIXED — Schritt 0 + v4-Contract ergänzt; Automated-Criterion 1.0 + Progress.

### F4 — Phase 4: 4 manuelle Criteria, nur 3 Progress-Items

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4 Success Criteria ↔ ## Progress
- **Detail**: Prod-Middleware-Check ("GET /auth/signin — kein Auth-Header") hatte kein Progress-Tracking-Item.
- **Fix**: Progress-Item 4.5 ergänzt.
- **Decision**: FIXED — 4.5 hinzugefügt.
