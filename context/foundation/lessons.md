# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Astro-Inseln: rein präsentationale React-Komponenten ohne `client:load`

- **Context**: src/pages/runs/compare.astro:113-116 (S-08 RunComparison)
- **Problem**: Eine rein präsentationale React-Komponente (keine Hooks/State/Handler) war zunächst mit `client:load` eingebunden. Nach dem Hinzufügen neuer lucide-react-Icons triggerte Vite eine Dep-Re-Optimierung; der bereits ausgelieferte `?v=`-Hash von `lucide-react.js` wurde 404, die Island scheiterte an der Hydration (`[astro-island] Error hydrating … Failed to fetch dynamically imported module`). SSR-Output korrekt, aber Console-Fehler + unnötiges Client-JS.
- **Rule**: React-Komponenten ohne Interaktivität (kein State/Effect/Handler/Browser-API) in Astro OHNE Client-Directive einbinden — statisch SSR-gerendert, keine Hydration, kein JS-Bundle. `client:load` nur bei echter Interaktivität.
- **Applies to**: `src/pages/**/*.astro`, die React-Inseln einbinden.
