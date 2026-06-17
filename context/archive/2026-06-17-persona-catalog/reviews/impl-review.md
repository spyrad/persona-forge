<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Persona-Katalog (S-03)

- **Plan**: context/changes/persona-catalog/plan.md
- **Scope**: Phase 1 + 2 von 2
- **Date**: 2026-06-17
- **Verdict**: REJECTED → nach Triage behoben (F1 gefixt)
- **Findings**: 1 critical · 1 warning · 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | FAIL (F1, behoben) |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS (Test 20/20, Lint/Build/astro check grün) |

## Findings

### F1 — Nutzer-Personas default 'global' (system_prompt-Leak)

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — echter Produkt-Intent-Trade-off
- **Dimension**: Safety & Quality (Plan-Fehler, kein Implementierungs-Drift)
- **Location**: supabase/migrations/20260617053000_personas.sql:25 + src/lib/services/personas.ts:89-98
- **Detail**: Spalte `visibility not null default 'global'`; `createPersona` setzte `visibility` nicht → jede UI-Persona wurde 'global' und für alle authentifizierten Nutzer sichtbar (select-Policy `visibility='global' OR owner=uid`), `system_prompt` leakt cross-tenant. Plan sagte „Default global", widerspricht aber FR-009 („globale Objekte nur per Seed/Migration"); model_configs ist immer privat.
- **Fix A**: `visibility: "private"` explizit in createPersona (Sofort-Fix, keine Migration).
  - Strength: Einzeiler, behebt Leak sofort; Seed bleibt explizit 'global'.
  - Confidence: HIGH — Muster aus duplicatePersona/model_configs.
- **Fix B**: Neue Migration `alter column visibility set default 'private'` (Defense-in-Depth).
  - Strength: Auch rohe DB-Inserts safe; Privacy-by-default.
  - Confidence: HIGH — additive, risikoarme DDL.
- **Decision**: FIXED via Fix A + B (personas.ts visibility:'private' + migration 20260617185800_personas_visibility_default_private.sql)

### F2 — Ungeplanter „Anpassen"-Button (Kopier-Verhalten aufgespalten)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW
- **Dimension**: Scope Discipline
- **Location**: src/components/personas/PersonaCatalog.tsx:585-596 (+ adapt() :241)
- **Detail**: Plan beschrieb „Kopieren" als einen vorbefüllenden Pfad; implementiert sind „Kopieren" (Sofort-Duplicate) + „Anpassen" (Formular vorbefüllt). Im Changelog 2026-06-17 (S2) als abgestimmte Hybrid-Entscheidung dokumentiert, aber nicht im Plan; Pencil-Icon mit leichter „Bearbeiten"-Anmutung.
- **Fix**: Entscheidung als Addendum in plan.md festhalten.
- **Decision**: FIXED — Addendum-Sektion in plan.md ergänzt.

### F3 — createPersona-Signatur vs. dokumentierter Plan-Kontrakt

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: src/lib/services/personas.ts:80-84
- **Detail**: Plan-Kontrakt nennt `createPersona(sb, input)`; real `(sb, userId, input)` — `userId` nötig für isOwn-Ableitung, konsistent über alle Aufrufer. Rein dokumentarisch.
- **Decision**: SKIPPED — Code korrekt, kein Handlungsbedarf.
