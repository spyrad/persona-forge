import { describe, expect, it } from "vitest";
import { aggregateSteadfastness } from "@/lib/runs/steadfastness-aggregate";
import type { SteadfastnessExperiment, SteadfastnessScenario } from "@/types";

const sc: SteadfastnessScenario = {
  trueFact: "t",
  falseClaim: "f",
  falseAnswer: "F",
  openingQuestion: "q",
  answerChoices: ["T", "F"],
};
function exp(over: Partial<SteadfastnessExperiment>): SteadfastnessExperiment {
  return {
    scenario: sc,
    initialAnswer: "T",
    initialJustification: "",
    turns: [],
    capitulated: false,
    capitulationRound: null,
    winningStrategy: null,
    done: true,
    ...over,
  };
}

describe("aggregateSteadfastness", () => {
  it("leere Eingabe → alles 0/null", () => {
    const a = aggregateSteadfastness([]);
    expect(a).toEqual({
      capitulationRate: 0,
      steadfastnessScore: 1,
      capitulatedCount: 0,
      heldCount: 0,
      usableCount: 0,
      avgCapitulationRound: null,
      strategyBreakdown: [],
    });
  });

  it("mischt gehalten + kapituliert korrekt", () => {
    const a = aggregateSteadfastness([
      exp({ capitulated: false }),
      exp({ capitulated: true, capitulationRound: 2, winningStrategy: "gaslighting" }),
      exp({ capitulated: true, capitulationRound: 4, winningStrategy: "gaslighting" }),
      exp({ capitulated: true, capitulationRound: 3, winningStrategy: "false_authority" }),
    ]);
    expect(a.usableCount).toBe(4);
    expect(a.capitulatedCount).toBe(3);
    expect(a.heldCount).toBe(1);
    expect(a.capitulationRate).toBeCloseTo(0.75);
    expect(a.steadfastnessScore).toBeCloseTo(0.25);
    expect(a.avgCapitulationRound).toBeCloseTo(3); // (2+4+3)/3
    expect(a.strategyBreakdown).toEqual([
      { strategy: "gaslighting", count: 2 },
      { strategy: "false_authority", count: 1 },
    ]);
  });

  it("alle gehalten → Rate 0, avgRound null, kein Breakdown", () => {
    const a = aggregateSteadfastness([exp({ capitulated: false }), exp({ capitulated: false })]);
    expect(a.capitulationRate).toBe(0);
    expect(a.avgCapitulationRound).toBeNull();
    expect(a.strategyBreakdown).toEqual([]);
  });
});
