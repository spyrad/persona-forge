# Review-Snapshot: live-run-visualisierung

Scope: LiveRunStage.tsx, RunRunner.tsx, stage-cells.ts, stage-cells.test.ts, global.css · Geprueft bis: `64b073c` · Datum: 2026-07-19
Gesamt-Verdikt: REJECTED (1 blocking; Plan Adherence + Scope Discipline PASS 6/6 MATCH; Rules uebersprungen — keine Coding-Rules)

## Findings

### F1 — Safety & Quality — [S:Hoch × I:Hoch] (principled/blocking)

`src/components/runs/RunRunner.tsx:319-320` — `setCells`-Updater liest `prevFailedRef.current` deferred, die Folgezeile ueberschreibt den Ref synchron → `failedDelta` immer 0 → fehlgeschlagene Item-Reps rendern "ok" (teal), nie "failed" (rot). Kern-Unterscheidung der Buehne im Integrationspfad tot; Unit-Tests decken nur die pure Funktion, nicht das Wiring.
Fix: `const prevFailed = prevFailedRef.current;` vor dem setState, Konstante im Updater verwenden, Ref danach nachziehen. Beseitigt zugleich Ref-Read-waehrend-Render (React-Compiler-Contract).
Decision: FIXED

### F2 — Safety & Quality — [S:Mittel × I:Mittel] (principled/non-blocking)

`src/components/runs/RunRunner.tsx:259` — `refetch()` ohne try/catch; `void refetch()` im Finale-Timer und Fehlerpfade erzeugen bei Netzwerkfehler unhandled promise rejections (Inkonsistenz zu `deleteRunRequest`/`setVisibility`, die wrappen).
Fix: Netzwerkfehler zentral in `refetch` fangen (`try { … } catch { setServerError("Network error — please try again."); }`).
Decision: FIXED

### F3 — Safety & Quality — [S:Mittel × I:Niedrig] (principled/non-blocking)

`src/components/runs/RunRunner.tsx:414` — `start()` waehrend laufendem Finale cleart den Timer und verwirft dessen pending `refetch` → Vorlauf bleibt stale in der Liste (dauerhaft, falls der neue Lauf interrupted endet).
Fix: in `start()` beim Clear eines anstehenden Finale-Timers (`finaleTimerRef.current !== null`) einmal `void refetch()` nachziehen.
Decision: FIXED

### F4 — Pattern Consistency — [S:Niedrig × I:Niedrig] (principled/nit)

`src/components/runs/LiveRunStage.tsx:31` — "done" rendert `bg-primary/55` (gedimmtes "ok"), Doku sagt "neutral"; Plan 1.2 legte `primary = ok/done` aber explizit fest — vermutlich bewusste Entscheidung ohne Kommentar.
Fix: Entweder Kommentar "verarbeitet = Akzentfarbe (Plan 1.2)" ergaenzen ODER echte Neutral-Tokens (`bg-muted-foreground/40`).
Decision: FIXED

### F5 — Pattern Consistency — [S:Niedrig × I:Niedrig] (principled/nit)

`src/components/runs/RunRunner.tsx:785 vs. 801` — Tick-Scope inkonsistent: Reps-Tick nur um die Zahl, Token-Tick um die ganze Zeile inkl. Label.
Fix: im Token-Absatz nur die Zahlenwerte in je einen keyed `stage-tick`-Span wrappen.
Decision: FIXED

### F6 — Architecture — [S:Niedrig × I:Niedrig] (torvalds/nit)

`src/components/runs/RunRunner.tsx:801` — `key={promptTokens + completionTokens}` haengt an der Server-Invariante monotonen Wachstums.
Fix: zusammengesetzter Key ``key={`${promptTokens}-${completionTokens}`}``.
Decision: FIXED

### F7 — Architecture — [S:Niedrig × I:Niedrig] (torvalds/nit)

`src/components/runs/RunRunner.tsx:718` — `FINALE_MS - 500` koppelt als Magic Number an die 0.5s-Dauer von `.stage-fade-out` (global.css).
Fix: benannte Konstante `FADE_OUT_MS = 500` neben `FINALE_MS` mit Kommentar-Verweis auf `.stage-fade-out`.
Decision: FIXED
