<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Sichtbarkeit privat/global für Personas und Ergebnisse (S-07)

- **Plan**: context/changes/visibility-controls/plan.md
- **Scope**: Phasen 1–3 (vollständig)
- **Date**: 2026-06-21
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Beide Review-Agenten (Plan-Drift + Safety/Pattern) unabhängig: Plan-Adherence sehr
hoch, alle Guardrails respektiert, FR-008-Immutability gewahrt (Services patchen
ausschließlich `{visibility, updated_at}`), RLS-Kern verifiziert. Automatisierte
Success-Criteria grün (Lint, `astro check` 0 err, 48 Vitest, Build). Manuelle
Criteria 1.6–3.4 via Playwright/Zwei-Account-Gate bestätigt.

## Findings

### F1 — Service-Param-Reihenfolge weicht vom Plan-Contract ab

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/services/personas.ts:167, src/lib/services/runs.ts:157
- **Detail**: Plan notierte `(sb, id, visibility, userId)`; implementiert ist `(sb, userId, id, visibility)`. Intern konsistent, Routen rufen korrekt auf — rein kosmetische Contract-Abweichung, kein Defekt.
- **Fix**: Plan-Contract-Notiz nachziehen (oder ignorieren).
- **Decision**: SKIPPED — kosmetisch, nicht triagiert (User: Speichern + abschließen)

### F2 — Sicherheits-Kern bestätigt (Positiv-Befund)

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260620092033_personas_update_own_policy.sql
- **Detail**: RLS `personas_update_own` blockt korrekt: fremde Persona (owner≠uid → false), globale Seed-Persona (owner_id NULL → `NULL = uid` ist SQL-NULL, nicht true → blockiert). `using` + `with check` beide owner-scoped, `(select auth.uid())`-initplan-Caching. FR-008-Immutability rein app-seitig — bewusst, im Plan als „NOT doing" geführt.
- **Fix**: keiner — zur Kenntnis.
- **Decision**: SKIPPED — Positiv-Befund

### F3 — visibilitySchema in beiden PATCH-Routen dupliziert

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/personas/[id].ts:11, src/pages/api/runs/[id].ts:11
- **Detail**: Wortgleiches `z.object({visibility: z.enum(["private","global"])})` in beiden Routen. Repo dupliziert kleine zod-Schemas pro Route ohnehin (z. B. `idSchema`) → konventionskonform.
- **Fix**: optional als shared Schema extrahieren.
- **Decision**: SKIPPED — konventionskonform

### F4 — RunResult-Badge zeigt „Privat" unabhängig von isOwn

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: src/components/runs/RunResult.tsx:196
- **Detail**: Listen zeigen „Privat" nur bei isOwn; das Detail-Badge zeigt es immer im else-Zweig. Harmlos — die Result-Seite lädt RLS-gescoped nur sichtbare Läufe (ein fremder privater Lauf ist nie ladbar).
- **Fix**: optional angleichen (else → `: isOwn ? Privat : null`).
- **Decision**: SKIPPED — harmlos, RLS-gated
