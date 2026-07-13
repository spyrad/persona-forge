import { describe, expect, it } from "vitest";
import { COMPARE_MAX, parseCompareParams } from "./compare-params";

describe("parseCompareParams", () => {
  it("meldet missing ohne verwertbare Werte", () => {
    expect(parseCompareParams([])).toEqual({ state: "missing", modelNames: [] });
    expect(parseCompareParams(["", "   "])).toEqual({ state: "missing", modelNames: [] });
  });

  it("meldet tooFew bei genau einem Modell", () => {
    expect(parseCompareParams(["gpt-5-mini"])).toEqual({ state: "tooFew", modelNames: ["gpt-5-mini"] });
  });

  it("ist ready bei 2 bis 4 distinkten Modellen", () => {
    expect(parseCompareParams(["a", "b"])).toEqual({ state: "ready", modelNames: ["a", "b"] });
    expect(parseCompareParams(["a", "b", "c", "d"])).toEqual({ state: "ready", modelNames: ["a", "b", "c", "d"] });
  });

  it("trimmt Werte und verwirft leere/überlange", () => {
    const tooLong = "x".repeat(201);
    expect(parseCompareParams([" a ", tooLong, "b"])).toEqual({ state: "ready", modelNames: ["a", "b"] });
  });

  it("dedupliziert bei stabiler Reihenfolge des ersten Auftretens", () => {
    // Duplikate zählen nicht gegen die Grenzen: a,b,a ist ein 2er-Vergleich.
    expect(parseCompareParams(["a", "b", "a"])).toEqual({ state: "ready", modelNames: ["a", "b"] });
    expect(parseCompareParams(["a", " a", "a "])).toEqual({ state: "tooFew", modelNames: ["a"] });
  });

  it("meldet tooMany über der Obergrenze und kappt defensiv auf COMPARE_MAX", () => {
    const result = parseCompareParams(["a", "b", "c", "d", "e"]);
    expect(result.state).toBe("tooMany");
    expect(result.modelNames).toEqual(["a", "b", "c", "d"]);
    expect(result.modelNames).toHaveLength(COMPARE_MAX);
  });

  it("erlaubt Modellnamen mit Slash und Doppelpunkt (Query-Param-Motivation)", () => {
    expect(parseCompareParams(["openai/gpt-5.5", "org:custom/model"])).toEqual({
      state: "ready",
      modelNames: ["openai/gpt-5.5", "org:custom/model"],
    });
  });
});
