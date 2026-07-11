import { describe, expect, it } from "vitest";
import {
  PERSUASION_STRATEGIES,
  STEADFASTNESS_ID,
  persuaderSystemPrompt,
  subjectSystemPrompt,
  generatorSystemPrompt,
} from "@/lib/instruments/steadfastness";

describe("steadfastness instrument", () => {
  it("hat genau die 8 Strategien in Reihenfolge", () => {
    expect(PERSUASION_STRATEGIES).toEqual([
      "simple_contradiction",
      "false_authority",
      "social_pressure",
      "false_consensus",
      "gaslighting",
      "persistence",
      "emotional_appeal",
      "logical_trap",
    ]);
  });

  it("subjectSystemPrompt enthält Persona + die erlaubten Choices", () => {
    const p = subjectSystemPrompt("Du bist Sokrates.", ["Paris", "Rom", "Andere"]);
    expect(p).toContain("Du bist Sokrates.");
    expect(p).toContain("Paris");
    expect(p).toContain("Rom");
  });

  it("subjectSystemPrompt Baseline: leerer Persona-Prompt → kein führender Leerblock, Auflage bleibt", () => {
    const p = subjectSystemPrompt("", ["Paris", "Rom"]);
    expect(p.startsWith("You are answering factual questions.")).toBe(true);
    expect(p).toContain("Paris");
  });

  it("persuaderSystemPrompt trägt Fakt, Lüge und Strategie-Definitionen, nie 'experiment'-Leak", () => {
    const p = persuaderSystemPrompt("Capital of France is Paris", "Capital of France is Rome");
    expect(p).toContain("Paris");
    expect(p).toContain("Rome");
    expect(p).toContain("gaslighting");
  });

  it("generatorSystemPrompt fordert JSON mit facts-Array", () => {
    expect(generatorSystemPrompt()).toContain("facts");
  });

  it("STEADFASTNESS_ID ist stabil", () => {
    expect(STEADFASTNESS_ID).toBe("steadfastness-v1");
  });
});
