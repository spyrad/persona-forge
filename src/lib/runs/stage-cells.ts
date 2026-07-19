/**
 * Live-Run-Bühne: Zell-Ableitung + Stage-Zustandsmaschine als pure Funktionen
 * (Feature live-run-visualisierung, Plan 1.3).
 *
 * Beide Funktionen sind bewusst DOM-frei und ohne Seiteneffekte — die einzige
 * echte Logik der Bühne, unit-getestet in `stage-cells.test.ts`. RunRunner
 * orchestriert nur (Plan-Review: Race-Schutz durch eine Stelle statt vier).
 *
 * Verifizierte Zähler-Semantik (services/runs.ts):
 * - Item-Läufe: `completedReps` zählt ALLE verarbeiteten Reps (ok + failed);
 *   `failedCount` steigt pro fehlgeschlagenem Step → das Outcome der einzelnen
 *   Rep ist das failedCount-Delta zwischen zwei Snapshots.
 * - Steadfastness: `failed_count` wird erst am Lauf-Ende gepatcht → Fakt-Zellen
 *   sind live nur neutral "done"; die Erfolgs-/Fehlerfarbe kommt pauschal über
 *   den Finale-Zustand (`finale-success`/`finale-failed`), nie geraten.
 */
import type { RunProgress } from "@/types";

/** Zustand einer einzelnen Zelle der Bühne. */
export type StageCell = "pending" | "ok" | "failed" | "done";

/** Sichtbarer Zustand der Bühne; `null` = Panel nicht (mehr) sichtbar. */
export type StageState = "live" | "finale-success" | "finale-failed" | "interrupted";

/** Ereignisse der Übergangstabelle (Plan 2.3). */
export type StageEvent =
  | "start"
  | "terminal-completed"
  | "terminal-failed"
  | "error"
  | "cancel"
  | "dismiss"
  | "finale-timeout";

/** Lauf-Art der Zell-Ableitung: Item-Läufe (OEJTS/HEXACO) vs. Steadfastness. */
export type StageKind = "item" | "steadfastness";

/**
 * Übergangstabelle der Bühne (Plan 2.3). Unzulässige Übergänge sind No-ops
 * (geben den aktuellen Zustand zurück) — z. B. Cancel im Finale: der Button
 * existiert dort nicht mehr, und selbst ein verirrtes Ereignis ändert nichts.
 */
export function nextStageState(current: StageState | null, event: StageEvent): StageState | null {
  switch (current) {
    case null:
      return event === "start" ? "live" : null;
    case "live":
      switch (event) {
        case "terminal-completed":
          return "finale-success";
        case "terminal-failed":
          return "finale-failed";
        case "error":
          return "interrupted";
        case "cancel":
          return null;
        default:
          return current;
      }
    case "finale-success":
    case "finale-failed":
      return event === "finale-timeout" ? null : current;
    case "interrupted":
      return event === "dismiss" ? null : current;
  }
}

/** Startzustand: alle Zellen offen. */
export function initStageCells(total: number): StageCell[] {
  return Array.from({ length: total }, () => "pending");
}

/**
 * Wendet einen RunProgress-Snapshot auf die Zellliste an (Delta-Ableitung).
 *
 * `prevFailedCount` ist der failedCount des VORHERIGEN Snapshots — das Delta
 * bestimmt bei Item-Läufen das Outcome der neu abgeschlossenen Rep(s). Kein
 * Fortschritt → gibt `prev` referenzgleich zurück (kein unnötiges Re-Render).
 * Bei einem Delta > 1 (defensiv, kommt im Step-Loop nicht vor) tragen die
 * zuletzt abgeschlossenen Slots die Fehler.
 */
export function reduceStageCells(
  prev: StageCell[],
  prevFailedCount: number,
  progress: RunProgress,
  kind: StageKind,
): StageCell[] {
  const done = Math.min(progress.completedReps, prev.length);
  const prevDone = prev.filter((c) => c !== "pending").length;
  if (done <= prevDone) return prev;
  const failedDelta = kind === "item" ? Math.max(0, progress.failedCount - prevFailedCount) : 0;
  const next = [...prev];
  for (let i = prevDone; i < done; i++) {
    const isFailedSlot = kind === "item" && i >= done - failedDelta;
    next[i] = kind === "steadfastness" ? "done" : isFailedSlot ? "failed" : "ok";
  }
  return next;
}
