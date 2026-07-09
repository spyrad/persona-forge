# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Astro-Inseln: rein präsentationale React-Komponenten ohne `client:load`

- **Context**: src/pages/runs/compare.astro:113-116 (S-08 RunComparison)
- **Problem**: Eine rein präsentationale React-Komponente (keine Hooks/State/Handler) war zunächst mit `client:load` eingebunden. Nach dem Hinzufügen neuer lucide-react-Icons triggerte Vite eine Dep-Re-Optimierung; der bereits ausgelieferte `?v=`-Hash von `lucide-react.js` wurde 404, die Island scheiterte an der Hydration (`[astro-island] Error hydrating … Failed to fetch dynamically imported module`). SSR-Output korrekt, aber Console-Fehler + unnötiges Client-JS.
- **Rule**: React-Komponenten ohne Interaktivität (kein State/Effect/Handler/Browser-API) in Astro OHNE Client-Directive einbinden — statisch SSR-gerendert, keine Hydration, kein JS-Bundle. `client:load` nur bei echter Interaktivität.
- **Applies to**: `src/pages/**/*.astro`, die React-Inseln einbinden.

## LLM-Scoring: Modelle extrahieren Fakten zuverlässig, Noten würfeln sie

- **Context**: `src/lib/ai-review/` (ci-review-agent Phase 2, 2026-07-09)
- **Problem**: Der PR-Reviewer liess glm-5.2 je Kriterium eine Note 1–10 vergeben, `decideVerdict` zog daraus deterministisch ein Pass/Fail. Gemessen mit `temperature: 0` und identischem Diff über drei Läufe: `apiQuartet` schwankte 3/8/8, das Verdict kippte `failed`→`passed`→`passed`. Für ein Kriterium, das der Diff gar nicht berührte (`dataSafety` ohne Migration), erfand das Modell Noten zwischen 1 und 7 — ein Falsch-Positiv, das saubere PRs blockiert hätte. Eine exakte Schwelle auf einer gewürfelten Zahl ist Scheinsicherheit; ein `applicable`-Flag half nicht, das Modell setzte es stets auf `true`.
- **Rule**: Lass ein LLM nie eine Bewertungszahl erfinden, die eine Automatik dann als Schwelle liest. Gib ihm einen geschlossenen Katalog objektiv nachweisbarer Regeln (`z.enum`) und lass es nur **Findings** melden — Regel-ID, Datei, Beleg. Schweregrad und Score leitest du im Code ab. „Fehlt `export const prerender = false`?" ist abzählbar, „ist das eine 3 oder eine 8?" nicht. Nebeneffekt: „Kriterium nicht berührt" und „Kriterium erfüllt" ergeben beide _kein_ Finding und damit volle Punktzahl — das Falsch-Positiv verschwindet strukturell statt per Prompt-Bitte.
- **Applies to**: jede LLM-gestützte Bewertung, deren Ergebnis ein automatisches Gate steuert (`src/lib/ai-review/**`, künftige Scorer/Judges).

## Diff-Parser: Binärmarker nur in Metazeilen erkennen, nie im Dateiinhalt

- **Context**: `src/lib/ai-review/diff.ts:isBinaryBlock` (ci-review-agent Phase 2, 2026-07-09)
- **Problem**: Die Binär-Erkennung prüfte `body.includes("GIT binary patch")` über den ganzen `diff --git`-Block. Damit verwarf der Reviewer ausgerechnet `diff.ts` selbst aus dem Review — deren Quelltext enthält den Marker als String-Literal. Das Ergebnis war kein Absturz, sondern ein stiller blinder Fleck: `passed` über eine Datei, die nie gelesen wurde.
- **Rule**: In einem `git diff` tragen hinzugefügte/entfernte Zeilen ein `+`/`-`-Präfix; Metazeilen (`Binary files … differ`, `GIT binary patch`) nicht. Werte Marker ausschliesslich auf präfixlosen Zeilen aus. Allgemeiner: ein Parser, der Diff-Inhalt und Diff-Metadaten nicht trennt, verschluckt genau die Dateien, die über sein eigenes Format handeln.
- **Applies to**: `src/lib/ai-review/diff.ts` und jeden künftigen Diff-/Patch-Parser.

## CI-Gate: in-YAML `needs:` blockt den Job, aber nur ein Required-Check macht den Skip sichtbar

- **Context**: `.github/workflows/ci.yml` (S-01 „lint-fail skippt deploy lautlos"; testing-quality-gates-wiring Phase 3)
- **Problem**: `deploy` hängt per `needs: [ci, integration]` an den Test-Jobs. Ein roter/geskippter Test-Job _skippt_ den Deploy — aber ohne GitHub-Branch-Protection ist ein geskippter Deploy operativ ununterscheidbar von einem erfolgreichen: der Push meldet „ok", Prod bleibt still auf altem Stand, kein Alarm.
- **Rule**: Ein in-YAML `needs:`-Gate ist nur die halbe Miete. Damit ein roter/geskippter Pipeline-Lauf SICHTBAR wird (und ein Merge/Deploy ihn nicht still umgeht), müssen die Jobs als _Required Status Checks_ in der Branch-Protection von `main` gesetzt sein — das kann YAML nicht ausdrücken. Beide verdrahten.
- **Applies to**: jede Deploy-Gating-Änderung an `.github/workflows/*.yml` + GitHub-Branch-Protection auf `main`.
