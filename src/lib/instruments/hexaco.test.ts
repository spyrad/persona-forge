import { describe, expect, it } from "vitest";
import { HEXACO } from "@/lib/instruments/hexaco";
import { axisScale, deriveType, scoreAxes } from "@/lib/runs/oejts-score";
import type { ItemValue } from "@/types";

const FACTORS = ["H", "E", "X", "A", "C", "O"] as const;

/** Baut ItemValue[] fuer alle 60 Items mit Default-Wert; `overrides` je Id. */
function buildValues(defaultValue: number, overrides: Record<string, number | null> = {}): ItemValue[] {
  return HEXACO.items.map((it) => {
    const value = it.id in overrides ? overrides[it.id] : defaultValue;
    return value == null ? { id: it.id, value: null, status: "unparsed" } : { id: it.id, value, status: "ok" };
  });
}

/** Antwortmuster nach Keying: `pos` fuer sign +1, `neg` fuer sign -1. */
function valuesByKeying(pos: number, neg: number): ItemValue[] {
  return HEXACO.items.map((it) => ({ id: it.id, value: it.sign === 1 ? pos : neg, status: "ok" }));
}

describe("HEXACO — Struktur", () => {
  it("hat 60 Items, 6 Achsen, keinen Modaltyp", () => {
    expect(HEXACO.items.length).toBe(60);
    expect(HEXACO.axes.map((a) => a.key)).toEqual([...FACTORS]);
    expect(HEXACO.hasModalType).toBe(false);
  });

  it("traegt exakt 10 Items je Faktor", () => {
    for (const f of FACTORS) {
      expect(HEXACO.items.filter((it) => it.axis === f)).toHaveLength(10);
    }
  });

  it("ist 30/30 keying-balanciert und hat je Faktor >= 2 revers gekeyte Items", () => {
    expect(HEXACO.items.filter((it) => it.sign === 1)).toHaveLength(30);
    expect(HEXACO.items.filter((it) => it.sign === -1)).toHaveLength(30);
    for (const f of FACTORS) {
      const reverse = HEXACO.items.filter((it) => it.axis === f && it.sign === -1);
      expect(reverse.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("leitet die constant je Achse aus der Zahl revers gekeyter Items ab (6 × n_minus)", () => {
    for (const axis of HEXACO.axes) {
      const nMinus = HEXACO.items.filter((it) => it.axis === axis.key && it.sign === -1).length;
      expect(axis.constant).toBe(6 * nMinus);
    }
  });
});

describe("scoreAxes (HEXACO-Keying)", () => {
  it("alle Items = 3 (neutral) → jeder Faktor exakt am midpoint 30", () => {
    // Referenz gegen die Formel: constant + 3·Σ(sign); der midpoint jeder Achse ist 30.
    const scores = scoreAxes(buildValues(3), HEXACO);
    expect(scores).toEqual({ H: 30, E: 30, X: 30, A: 30, C: 30, O: 30 });
    for (const axis of HEXACO.axes) expect(scores[axis.key]).toBe(axis.midpoint);
  });

  it("maximale Keying-Zustimmung (pos=5, revers=1) → jeder Faktor am Max 50", () => {
    const scores = scoreAxes(valuesByKeying(5, 1), HEXACO);
    for (const f of FACTORS) expect(scores[f]).toBe(50);
  });

  it("maximale Keying-Ablehnung (pos=1, revers=5) → jeder Faktor am Min 10", () => {
    const scores = scoreAxes(valuesByKeying(1, 5), HEXACO);
    for (const f of FACTORS) expect(scores[f]).toBe(10);
  });

  it("Reverse-Item hebt den Score bei niedriger Zustimmung — Keying-Vorzeichen greift", () => {
    // Aus neutral (alle 3 → alle 30): ein revers gekeytes Item von 3 → 2 hebt den
    // Faktor um +1 (6 − antwort), ein positiv gekeytes Item von 3 → 2 senkt ihn um 1.
    const reverseUp = scoreAxes(buildValues(3, { H2: 2 }), HEXACO); // H2 ist sign -1
    expect(reverseUp.H).toBe(31);
    expect(reverseUp.E).toBe(30); // andere Faktoren unberuehrt

    const positiveDown = scoreAxes(buildValues(3, { H1: 2 }), HEXACO); // H1 ist sign +1
    expect(positiveDown.H).toBe(29);
  });

  it("Achsen-weiser Dropout: ein unparsed-Item → nur dieser Faktor null", () => {
    const scores = scoreAxes(buildValues(3, { O1: null }), HEXACO);
    expect(scores.O).toBeNull();
    expect(scores.H).toBe(30);
  });

  it("ist deterministisch", () => {
    const v = buildValues(3, { H2: 5 });
    expect(scoreAxes(v, HEXACO)).toEqual(scoreAxes(v, HEXACO));
  });
});

describe("deriveType / axisScale (HEXACO ist dimensional)", () => {
  it("liefert keinen Modaltyp (hasModalType false)", () => {
    expect(deriveType(scoreAxes(buildValues(3), HEXACO), HEXACO)).toBeNull();
  });

  it("axisScale je Faktor: min 10, max 50, cutoff = midpoint 30", () => {
    for (const axis of HEXACO.axes) {
      expect(axisScale(axis.key, HEXACO)).toEqual({ min: 10, max: 50, cutoff: 30 });
    }
  });
});
