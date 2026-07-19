import { describe, expect, it } from "vitest";
import {
  initStageCells,
  nextStageState,
  reduceStageCells,
  type StageCell,
  type StageEvent,
  type StageState,
} from "@/lib/runs/stage-cells";
import type { RunProgress } from "@/types";

/** Bekannt-guter RunProgress-Snapshot (Item-Lauf, mid-run). */
function progress(overrides: Partial<RunProgress> = {}): RunProgress {
  return {
    status: "running",
    completedReps: 0,
    totalReps: 5,
    failedCount: 0,
    promptTokens: 0,
    completionTokens: 0,
    lastRepDurationMs: null,
    lastRepError: null,
    ...overrides,
  };
}

describe("initStageCells", () => {
  it("liefert N offene Zellen (N=1 und N=25, die Grenzwerte der Spec)", () => {
    expect(initStageCells(1)).toEqual(["pending"]);
    const max = initStageCells(25);
    expect(max).toHaveLength(25);
    expect(max.every((c) => c === "pending")).toBe(true);
  });
});

describe("reduceStageCells — Item-Läufe (failedCount-Delta)", () => {
  it("ok-Folge: jede neue Rep ohne failedCount-Anstieg wird 'ok'", () => {
    let cells = initStageCells(3);
    cells = reduceStageCells(cells, 0, progress({ completedReps: 1, totalReps: 3 }), "item");
    expect(cells).toEqual(["ok", "pending", "pending"]);
    cells = reduceStageCells(cells, 0, progress({ completedReps: 2, totalReps: 3 }), "item");
    expect(cells).toEqual(["ok", "ok", "pending"]);
  });

  it("Fehler-Delta: failedCount-Anstieg markiert die neue Rep als 'failed'", () => {
    let cells = initStageCells(3);
    cells = reduceStageCells(cells, 0, progress({ completedReps: 1, totalReps: 3 }), "item");
    cells = reduceStageCells(cells, 0, progress({ completedReps: 2, totalReps: 3, failedCount: 1 }), "item");
    expect(cells).toEqual(["ok", "failed", "pending"]);
  });

  it("gemischte Folge bis zum vollen Lauf (N=25 inklusive Grenze)", () => {
    let cells = initStageCells(25);
    let failed = 0;
    for (let step = 1; step <= 25; step++) {
      const fails = step % 5 === 0 ? failed + 1 : failed;
      cells = reduceStageCells(
        cells,
        failed,
        progress({ completedReps: step, totalReps: 25, failedCount: fails }),
        "item",
      );
      failed = fails;
    }
    expect(cells.filter((c) => c === "failed")).toHaveLength(5);
    expect(cells.filter((c) => c === "ok")).toHaveLength(20);
    expect(cells[4]).toBe("failed"); // Schritt 5 trug das erste Delta
  });

  it("kein Fortschritt: identischer Snapshot gibt prev referenzgleich zurück", () => {
    const cells: StageCell[] = ["ok", "pending", "pending"];
    const next = reduceStageCells(cells, 0, progress({ completedReps: 1, totalReps: 3 }), "item");
    expect(next).toBe(cells);
  });

  it("completedReps über Zellenzahl hinaus wird gekappt (defensiv)", () => {
    const cells = reduceStageCells(initStageCells(2), 0, progress({ completedReps: 5, totalReps: 2 }), "item");
    expect(cells).toHaveLength(2);
    expect(cells.every((c) => c === "ok")).toBe(true);
  });
});

describe("reduceStageCells — Steadfastness (neutral 'done')", () => {
  it("generating → experimenting: erst kein Fortschritt, dann neutrale 'done'-Zellen", () => {
    let cells = initStageCells(4);
    const generating = reduceStageCells(
      cells,
      0,
      progress({ completedReps: 0, totalReps: 4, phase: "generating" }),
      "steadfastness",
    );
    expect(generating).toBe(cells); // kein Zellen-Fortschritt während generating
    cells = reduceStageCells(
      cells,
      0,
      progress({ completedReps: 1, totalReps: 4, phase: "experimenting", currentScenario: 2 }),
      "steadfastness",
    );
    expect(cells).toEqual(["done", "pending", "pending", "pending"]);
  });

  it("bleibt neutral 'done', selbst wenn failedCount sich änderte (live nicht positionierbar)", () => {
    const cells = reduceStageCells(
      initStageCells(3),
      0,
      progress({ completedReps: 2, totalReps: 3, failedCount: 1, phase: "experimenting" }),
      "steadfastness",
    );
    expect(cells).toEqual(["done", "done", "pending"]);
  });
});

describe("nextStageState — Übergangstabelle (Plan 2.3)", () => {
  it("deckt alle definierten Übergänge", () => {
    expect(nextStageState(null, "start")).toBe("live");
    expect(nextStageState("live", "terminal-completed")).toBe("finale-success");
    expect(nextStageState("live", "terminal-failed")).toBe("finale-failed");
    expect(nextStageState("live", "error")).toBe("interrupted");
    expect(nextStageState("live", "cancel")).toBeNull();
    expect(nextStageState("finale-success", "finale-timeout")).toBeNull();
    expect(nextStageState("finale-failed", "finale-timeout")).toBeNull();
    expect(nextStageState("interrupted", "dismiss")).toBeNull();
  });

  it("unzulässige Übergänge sind No-ops (z. B. Cancel im Finale)", () => {
    const noops: [StageState | null, StageEvent][] = [
      ["finale-success", "cancel"],
      ["finale-failed", "error"],
      ["finale-success", "dismiss"],
      ["interrupted", "cancel"],
      ["interrupted", "finale-timeout"],
      ["live", "dismiss"],
      ["live", "finale-timeout"],
      ["live", "start"],
    ];
    for (const [state, event] of noops) {
      expect(nextStageState(state, event)).toBe(state);
    }
    // Aus dem Nichts passiert nichts außer "start".
    expect(nextStageState(null, "terminal-completed")).toBeNull();
    expect(nextStageState(null, "dismiss")).toBeNull();
  });
});
