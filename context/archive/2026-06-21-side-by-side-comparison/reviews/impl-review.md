<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Zwei Läufe nebeneinander vergleichen (S-08)

- **Plan**: context/changes/side-by-side-comparison/plan.md
- **Scope**: Phasen 1–3 (komplett)
- **Date**: 2026-06-21
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 3 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

Automated: `npm run lint` 0, `npx astro check` 0 errors, `npm run build` Complete.
Manual: alle Phasen-Items empirisch per Playwright verifiziert (inkl. echter Negativtests
1.5 pending-Lauf, 2.6 unbekannte ID → 404, 2.7 notReady, 2.8 gelöschte Persona → Fallback).

## Findings

### F1 — RunComparison statisch statt client:load (Plan-Abweichung)

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — bewusste Optimierung
- **Dimension**: Plan Adherence
- **Location**: src/pages/runs/compare.astro:113-116
- **Detail**: Plan-Wortlaut nannte `<RunComparison client:load />`. Implementiert ohne client:load (statisches SSR). Korrekte Optimierung — Komponente ist rein präsentational (keine Hooks/State/Handler), spart Hydration + Client-JS und behebt den lucide-Dep-Re-Opt-Hydration-404. Beide Review-Agenten: bessere Adaption, kein Defekt.
- **Fix**: Keiner nötig — bewusste, im Code dokumentierte Abweichung.
- **Decision**: ACCEPTED-AS-RULE (lessons.md: "Astro-Inseln: rein präsentationale React-Komponenten ohne client:load"); Code bereits konform.

### F2 — RELIABLE_MIN doppelt definiert

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — eng begrenzt
- **Dimension**: Pattern Consistency
- **Location**: src/components/runs/RunComparison.tsx:5 + src/components/runs/RunResult.tsx:10
- **Detail**: Konstante `RELIABLE_MIN = 2` (Methodenkern-Schwelle) in zwei Komponenten. Konsistent mit Bestand (lokal je Komponente), aber eine geteilte Quelle wäre DRY.
- **Fix**: Optional `RELIABLE_MIN` nach `axis-chart.tsx` ziehen und in beiden importieren.
- **Decision**: FIXED — `RELIABLE_MIN` nach `axis-chart.tsx` exportiert, in RunResult.tsx + RunComparison.tsx importiert.

### F3 — Wünschenswerte, ungeplante Zusätze

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — keine Aktion nötig
- **Dimension**: Scope Discipline
- **Location**: src/components/runs/RunRunner.tsx:52,182-183; src/components/runs/RunComparison.tsx:54-61; src/pages/runs/compare.astro:46,59-62
- **Detail**: Mehrere kleine, im Plan nicht genannte Verbesserungen, alle harmlos und im Feature-Scope: `encodeURIComponent` der URL-IDs; Stale-Selection-Cleanup bei refetch; TypeBanner-Null-Fall; getrennter notReady-Detailtext A/B; `!supabase||!user`-Vorab-Guard. Keine „not doing"-Grenze verletzt.
- **Fix**: Keiner — als Stärken vermerkt.
- **Decision**: SKIPPED — als Stärken akzeptiert, keine Änderung.
