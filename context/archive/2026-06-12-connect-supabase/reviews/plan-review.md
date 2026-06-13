<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Supabase-Projekt anbinden + RLS-Grundgerüst (F-01)

- **Plan**: `context/changes/connect-supabase/plan.md`
- **Mode**: Deep
- **Date**: 2026-06-12
- **Verdict**: REVISE → **SOUND** (nach Triage: alle 4 Findings gefixt)
- **Findings**: 1 critical, 1 warning, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING (gefixt) |
| Plan Completeness | WARNING (gefixt) |

## Grounding

5/5 Pfade ✓, Symbole ✓ (`optional: true`, `wrangler-action@v3`, alle
SUPABASE_-Konsumenten), brief↔plan ✓.

Extern verifiziert (Sub-Agent, mit Quellen):
- `wrangler-action@v3` `secrets:`-Input bestätigt (README + Quellcode):
  newline-separierte Env-Var-Namen, Werte aus Step-`env`, Upload VOR dem
  Deploy (`uploadSecrets()` → `wranglerCommands()`); Default-Command ist
  `deploy`. Erst-Deploy-Falle irrelevant — Worker `persona-forge` existiert.
- `owner_id uuid not null default auth.uid()` bestätigt (Supabase-Discussions
  #4368/#9066): funktioniert via PostgREST als `authenticated`; im
  Studio-Editor (postgres) ist `auth.uid()` NULL → F3.
- Impersonations-SQL (`set local role` + `request.jwt.claims`) ist das
  offiziell empfohlene Muster (Discussion #30124, Supabase-Docs); `set local`
  braucht den `begin…rollback`-Block (im Plan vorhanden).

## Findings

### F1 — Progress↔Phase-Mismatch in Phase 2 (Manual)

- **Severity**: ❌ CRITICAL (mechanischer Progress-Contract)
- **Impact**: 🏃 LOW — quick decision; Fix offensichtlich und eng begrenzt
- **Dimension**: Plan Completeness
- **Location**: `## Progress` / Phase 2 Manual
- **Detail**: 3 Manual-Bullets in Phase 2, aber nur 2 Progress-Checkboxen
  (2.3 mergte Signup+Banner); `/10x-implement` parst die Sektion 1:1.
- **Fix**: 2.3 aufgeteilt → 2.3 Signup/Confirm/Signin, 2.4 Banner
  verschwunden, 2.5 CLAUDE.md.
- **Decision**: FIXED

### F2 — Middleware-Umschalter nicht benannt

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details / Migration Notes
- **Detail**: Mit gesetzten Secrets ruft `src/middleware.ts:7-22` bei jedem
  Request `supabase.auth.getUser()` auf (Roundtrip auch auf öffentlichen
  Seiten); der `/dashboard`-Guard wird scharf. F-01 schaltet das an, ohne es
  zu dokumentieren.
- **Fix**: Notiz in Critical Implementation Details + S-01-Migration-Note
  (Latenz bewerten, ggf. Route-Filterung).
- **Decision**: FIXED

### F3 — Setup-Inserts brauchen explizites owner_id

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Plan Completeness
- **Location**: Phase 1, #4 (RLS-Contract-Beweis)
- **Detail**: Studio-SQL läuft als `postgres` → `auth.uid()` NULL →
  Spalten-Default greift nicht (NOT-NULL-Fehler beim Setup-Insert).
- **Fix**: Hinweis-Satz im Contract von Phase 1 #4 ergänzt.
- **Decision**: FIXED

### F4 — profiles bleibt in F-01 leer; S-01-Mechanik offen

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Blind Spots
- **Location**: Migration Notes
- **Detail**: Migration legt `profiles` an, nichts befüllt sie (bewusst kein
  Trigger); Anlage-Mechanik (Trigger vs. App-Insert) ist S-01-Entscheidung
  und war nicht benannt.
- **Fix**: Migration Note an S-01 ergänzt.
- **Decision**: FIXED
