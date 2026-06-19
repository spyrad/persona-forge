import { describe, expect, it } from "vitest";
import { OEJTS } from "@/lib/instruments/oejts";
import { aggregateRun } from "@/lib/runs/oejts-aggregate";
import type { ItemValue, RunRepetition } from "@/types";

/** Baut ItemValue[] fuer alle 32 Items mit Default-Wert; `overrides` je Id. */
function buildValues(defaultValue: number, overrides: Record<string, number | null> = {}): ItemValue[] {
  return OEJTS.items.map((it) => {
    const value = it.id in overrides ? overrides[it.id] : defaultValue;
    return value == null ? { id: it.id, value: null, status: "unparsed" } : { id: it.id, value, status: "ok" };
  });
}

function rep(item_values: ItemValue[] | null): Pick<RunRepetition, "item_values"> {
  return { item_values };
}

/** Hebt IE klar ueber den Cutoff (alle 3 + drei +1-Items auf 5) → IE=30 (E), Rest 24. */
const HIGH_IE = { Q15: 5, Q23: 5, Q27: 5 };

function findAxis(agg: ReturnType<typeof aggregateRun>, key: string) {
  const axis = agg.axes.find((a) => a.key === key);
  if (!axis) throw new Error(`axis ${key} not found`);
  return axis;
}

describe("aggregateRun", () => {
  it("3 ausgewogene Wiederholungen → ISFJ, Konsistenz 1, jede Achse mean 24/sd 0", () => {
    const agg = aggregateRun([rep(buildValues(3)), rep(buildValues(3)), rep(buildValues(3))], OEJTS);
    expect(agg.usableReps).toBe(3);
    expect(agg.modalType).toBe("ISFJ");
    expect(agg.typeConsistency).toBe(1);
    const ie = findAxis(agg, "IE");
    expect(ie).toMatchObject({ mean: 24, sd: 0, usableCount: 3, letterCounts: { I: 3 } });
    expect(ie.scores).toEqual([24, 24, 24]);
  });

  it("gemischte Laeufe → mean/sd/letterCounts korrekt, Tie-Break ueber Mean-Seite", () => {
    // Rep A: IE=24 (I); Rep B: IE=30 (E). Tie 1:1 → Mean 27 > 24 → E.
    const agg = aggregateRun([rep(buildValues(3)), rep(buildValues(3, HIGH_IE))], OEJTS);
    const ie = findAxis(agg, "IE");
    expect(ie.scores).toEqual([24, 30]);
    expect(ie.mean).toBe(27);
    expect(ie.sd).toBe(3);
    expect(ie.letterCounts).toEqual({ I: 1, E: 1 });
    expect(agg.modalType).toBe("ESFJ");
    expect(agg.typeConsistency).toBe(0.5); // [ISFJ, ESFJ], 1 Treffer auf ESFJ
  });

  it("Dropout senkt nur die usableCount der betroffenen Achse", () => {
    // Rep B hat Q15 unparsed → IE faellt fuer Rep B aus, SN/FT/JP nicht.
    const agg = aggregateRun([rep(buildValues(3)), rep(buildValues(3, { Q15: null }))], OEJTS);
    expect(findAxis(agg, "IE").usableCount).toBe(1);
    expect(findAxis(agg, "SN").usableCount).toBe(2);
    expect(findAxis(agg, "FT").usableCount).toBe(2);
    expect(findAxis(agg, "JP").usableCount).toBe(2);
    expect(agg.usableReps).toBe(2); // beide tragen zu >=1 Achse bei
  });

  it("0 verwertbare Wiederholungen → leeres Aggregat", () => {
    const agg = aggregateRun(
      [rep(null), rep(buildValues(3, Object.fromEntries(OEJTS.items.map((i) => [i.id, null]))))],
      OEJTS,
    );
    expect(agg.usableReps).toBe(0);
    expect(agg.modalType).toBeNull();
    expect(agg.typeConsistency).toBeNull();
    const ie = findAxis(agg, "IE");
    expect(ie).toMatchObject({ mean: null, sd: null, usableCount: 0 });
    expect(ie.scores).toEqual([]);
  });

  it("N=1 → usableReps 1, sd 0 (Belastbarkeits-Warnung ist UI-Sache)", () => {
    const agg = aggregateRun([rep(buildValues(3))], OEJTS);
    expect(agg.usableReps).toBe(1);
    expect(agg.modalType).toBe("ISFJ");
    expect(findAxis(agg, "IE").sd).toBe(0);
  });

  it("ist deterministisch", () => {
    const reps = [rep(buildValues(3)), rep(buildValues(3, HIGH_IE))];
    expect(aggregateRun(reps, OEJTS)).toEqual(aggregateRun(reps, OEJTS));
  });
});
