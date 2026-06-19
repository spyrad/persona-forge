import { describe, expect, it } from "vitest";
import { OEJTS } from "@/lib/instruments/oejts";
import { axisScale, deriveType, scoreAxes } from "@/lib/runs/oejts-score";
import type { ItemValue } from "@/types";

/** Baut ItemValue[] fuer alle 32 Items mit Default-Wert; `overrides` je Id. */
function buildValues(defaultValue: number, overrides: Record<string, number | null> = {}): ItemValue[] {
  return OEJTS.items.map((it) => {
    const value = it.id in overrides ? overrides[it.id] : defaultValue;
    return value == null ? { id: it.id, value: null, status: "unparsed" } : { id: it.id, value, status: "ok" };
  });
}

describe("scoreAxes", () => {
  it("alle Items = 3 (ausgewogen) → jede Achse exakt am Cutoff 24", () => {
    // Referenzwert gegen die dokumentierte Formel: constant + 3·Σ(sign).
    const scores = scoreAxes(buildValues(3), OEJTS);
    expect(scores).toEqual({ IE: 24, SN: 24, FT: 24, JP: 24 });
  });

  it("hebt eine Achse ueber den Cutoff, wenn ein +1-Item steigt", () => {
    // Q15 (IE, sign +1) von 3 → 4 hebt IE auf 25 (> 24), andere Achsen unberuehrt.
    const scores = scoreAxes(buildValues(3, { Q15: 4 }), OEJTS);
    expect(scores.IE).toBe(25);
    expect(scores.SN).toBe(24);
  });

  it("Achsen-weiser Dropout: ein unparsed-Item → nur diese Achse null", () => {
    const scores = scoreAxes(buildValues(3, { Q15: null }), OEJTS);
    expect(scores.IE).toBeNull();
    expect(scores.SN).toBe(24);
    expect(scores.FT).toBe(24);
    expect(scores.JP).toBe(24);
  });

  it("ist deterministisch", () => {
    const v = buildValues(3, { Q15: 4 });
    expect(scoreAxes(v, OEJTS)).toEqual(scoreAxes(v, OEJTS));
  });
});

describe("deriveType", () => {
  it("alle 3 → ISFJ (jede Achse am Cutoff zaehlt als low)", () => {
    expect(deriveType(scoreAxes(buildValues(3), OEJTS), OEJTS)).toBe("ISFJ");
  });

  it("Cutoff-Grenzfall: 24 → low, 25 → high", () => {
    // Q15=4 → IE=25 → E (high); restliche Achsen 24 → low.
    expect(deriveType(scoreAxes(buildValues(3, { Q15: 4 }), OEJTS), OEJTS)).toBe("ESFJ");
  });

  it("null, wenn eine Achse unparsed (kein vollstaendiger Typ)", () => {
    expect(deriveType(scoreAxes(buildValues(3, { Q15: null }), OEJTS), OEJTS)).toBeNull();
  });
});

describe("axisScale", () => {
  it("berechnet min/max/cutoff je Achse aus den Vorzeichen-Extrema", () => {
    for (const axis of OEJTS.axes) {
      expect(axisScale(axis.key, OEJTS)).toEqual({ min: 8, max: 40, cutoff: 24 });
    }
  });

  it("wirft bei unbekannter Achse", () => {
    expect(() => axisScale("ZZ", OEJTS)).toThrow();
  });
});
