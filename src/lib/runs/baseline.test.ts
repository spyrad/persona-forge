import { describe, expect, it } from "vitest";
import { isBaselineRun } from "@/lib/runs/baseline";

describe("isBaselineRun", () => {
  it("Baseline: personaId null + leerer Snapshot", () => {
    expect(isBaselineRun(null, "")).toBe(true);
  });

  it("Baseline: Whitespace-Snapshot zaehlt als leer", () => {
    expect(isBaselineRun(null, "  \n ")).toBe(true);
  });

  it("KEINE Baseline: personaId null, aber Snapshot gefuellt (= Persona geloescht)", () => {
    expect(isBaselineRun(null, "Du bist Sokrates.")).toBe(false);
  });

  it("KEINE Baseline: Persona gesetzt (auch bei leerem Snapshot)", () => {
    expect(isBaselineRun("11111111-1111-4111-8111-111111111111", "")).toBe(false);
    expect(isBaselineRun("11111111-1111-4111-8111-111111111111", "Prompt")).toBe(false);
  });
});
