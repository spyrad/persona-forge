<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Supabase-Projekt anbinden + RLS-Grundgerüst (F-01)

- **Plan**: context/changes/connect-supabase/plan.md
- **Scope**: Full Plan (Phase 1–2)
- **Date**: 2026-06-12
- **Verdict**: APPROVED
- **Findings**: 0 critical · 0 warnings · 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS (5/5 MATCH, 0 Drift) |
| Scope Discipline | PASS (Negativliste vollständig respektiert) |
| Safety & Quality | PASS (keine Secrets im Repo, RLS default-deny) |
| Architecture | PASS |
| Pattern Consistency | PASS (Migration übertrifft Konvention) |
| Success Criteria | PASS (alle automatisierten Checks grün) |

## Evidenz (Kurzfassung)

- Migration zeilengenau plankonform: 7 Policies, alle `to authenticated` + `(select auth.uid())`, Owner-Index, kein security definer, anon default-deny
- Keine echten Secrets in getrackten Dateien (inkl. Historie via `git log --all`); `.example`-Dateien nur Platzhalter
- ci.yml-Diff exakt die geplanten +6 Zeilen (`secrets:`-Input + Step-`env`); wrangler-action schlägt bei fehlendem Secret laut fehl (kein leerer Upload)
- Automatisierte Checks frisch verifiziert: `supabase migration list` synced, lint grün, build grün, CI-Run 27433538447 `success` (ci + deploy), Deploy-Log „2 secrets successfully uploaded"
- Negativliste: kein Domänen-Schema, kein zod/Service-Layer, kein Auth-Ausbau, `optional: true` unangetastet, kein seed.sql

## Findings

### F1 — .gitignore deckt .dev.vars-Varianten nicht ab

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: .gitignore:46
- **Detail**: Ignoriert wird nur exakt `.dev.vars`. Wrangler unterstützt umgebungsspezifische Dateien (`.dev.vars.staging` etc.) — die würden NICHT ignoriert und könnten echte Secrets ins Repo tragen. Für `.env` existiert das Pendant (`.env.*` + `!.env.example`).
- **Fix**: `.dev.vars.*` + `!.dev.vars.example` ergänzen, analog zum .env-Muster.
- **Decision**: FIXED (Fix now — .gitignore um beide Zeilen ergänzt)

### F2 — Fehlende delete-Policy auf profiles unkommentiert

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: supabase/migrations/20260612164633_rls_foundation.sql:22
- **Detail**: `profiles` hat select/insert/update, aber kein delete (sicher: default-deny, Löschung via auth.users-Cascade). `_rls_probe` hat delete. Die Asymmetrie ist gewollt, aber unkommentiert — S-02/S-03 kopieren das Muster wörtlich und könnten delete versehentlich statt bewusst weglassen.
- **Fix**: Migration ist bereits remote angewendet (kein Edit) — Hinweis „profiles ohne delete-Policy: Löschung nur via auth.users-Cascade" in die Migration Notes des Plans bzw. die nächste Migration tragen.
- **Decision**: FIXED (Fix now — Migration Notes in plan.md ergänzt: bewusste Asymmetrie, delete-Policy beim Muster-Kopieren nicht weglassen)

### F3 — Check 2.3 per dokumentierter Adaption abgehakt

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/connect-supabase/plan.md:361
- **Detail**: 2.3 verlangt wörtlich Signup→Confirm→Signin auf der Live-URL; bewiesen wurde Signin (Bestands-User) — Signup hing am Supabase-Mail-Rate-Limit (Free Tier). Vom Owner explizit so entschieden, im Epilogue-Commit dokumentiert. Kein Rubber-Stamping; wörtlicher Signup-Beweis steht als freiwillige Nachprobe aus.
- **Fix**: Nach Ablauf des Rate-Limit-Fensters (~1 h) Signup mit frischer Mail auf der Live-URL nachholen — rein bestätigend, kein Plan-Edit nötig.
- **Decision**: SKIPPED (Nachprobe macht Damian selbst, freiwillig)
