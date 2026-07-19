import { cn } from "@/lib/utils";
import type { StageCell, StageState } from "@/lib/runs/stage-cells";

/**
 * Live-Run-Bühne: rein präsentative Zellen-Ebene des Lauf-Panels
 * (Feature live-run-visualisierung, Plan 1.2).
 *
 * Dumme Komponente ohne eigenen State — Zellzustände und Bühnen-Zustand kommen
 * fertig abgeleitet aus `stage-cells.ts` (RunRunner orchestriert). `aria-hidden`:
 * die Bühne ist dekorative Verstärkung; die zugängliche Wahrheit bleiben die
 * unveränderten Textzeilen des Panels (Plan: A11y-Entscheidung).
 */

interface Props {
  cells: StageCell[];
  /** Herzschlag an der aktiven Zelle: eine Step-Antwort steht aus. */
  waiting: boolean;
  /** Steadfastness `generating`: ganze Reihe atmet, kein Zellen-Fortschritt. */
  generating: boolean;
  stageState: StageState;
}

/** Zell-Klassen je Zustand — Farben ausschließlich semantische Tokens. */
function cellClass(cell: StageCell, isActive: boolean): string {
  switch (cell) {
    case "ok":
      return "border-primary/40 bg-primary text-primary stage-cell-pop";
    case "failed":
      return "border-destructive/40 bg-destructive/60 text-destructive stage-cell-flash";
    case "done":
      // Bewusst Akzentfarbe statt Neutral-Grau (Plan 1.2: primary = ok/done):
      // "verarbeitet" soll positiv lesbar sein; eine ok/failed-Differenzierung
      // existiert bei Steadfastness live ohnehin nicht (Impl-Review F4).
      return "border-primary/30 bg-primary/55 text-primary stage-cell-pop";
    case "pending":
      // Aktive Zelle pulsiert in der "läuft"-Farbe (Amber, chart-2) — Farb-Semantik
      // der App: Amber = running.
      return isActive ? "border-chart-2/50 bg-chart-2/40 text-chart-2 stage-heartbeat" : "border-border bg-muted";
  }
}

export default function LiveRunStage({ cells, waiting, generating, stageState }: Props) {
  const finale = stageState === "finale-success" || stageState === "finale-failed";
  const interrupted = stageState === "interrupted";
  // Die nächste offene Zelle trägt den Herzschlag — nur solange die Bühne lebt
  // und tatsächlich eine Antwort aussteht (ehrlich: kein Puls ohne Warten).
  const activeIndex = stageState === "live" && !generating && waiting ? cells.indexOf("pending") : -1;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex flex-wrap justify-center gap-1.5 py-2",
        generating && stageState === "live" && "stage-heartbeat",
      )}
    >
      {cells.map((cell, i) => (
        <span
          key={i}
          className={cn(
            "size-3.5 rounded-sm border transition-colors",
            interrupted
              ? // Eingefroren: alle Zellen grau gedimmt, keine Animationen.
                "border-border bg-muted-foreground/30"
              : finale
                ? stageState === "finale-success"
                  ? "border-success/40 bg-success/80 text-success stage-finale"
                  : "border-destructive/40 bg-destructive/70 text-destructive stage-finale"
                : cellClass(cell, i === activeIndex),
          )}
          // Finale läuft als sanfte Welle über die Zellen (gestaffelter Start).
          style={finale ? { animationDelay: `${String(i * 30)}ms` } : undefined}
        />
      ))}
    </div>
  );
}
