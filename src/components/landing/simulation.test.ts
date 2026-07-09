import { describe, expect, it } from "vitest";
import {
  AXES,
  RUNS_PER_AXIS,
  curvePoints,
  mean,
  mulberry32,
  simulateRun,
  stddev,
  toSvgArea,
  toSvgPath,
} from "./simulation";

describe("mulberry32", () => {
  it("liefert deterministisch dieselbe Sequenz für denselben Seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("liefert Werte in [0, 1)", () => {
    const rand = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = rand();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("simulateRun", () => {
  const spec = AXES[0];

  it("ist deterministisch für denselben Seed", () => {
    expect(simulateRun(spec, 1)).toEqual(simulateRun(spec, 1));
  });

  it("liefert unterschiedliche Läufe für unterschiedliche Seeds", () => {
    expect(simulateRun(spec, 1)).not.toEqual(simulateRun(spec, 2));
  });

  it("liefert RUNS_PER_AXIS Werte im Bereich 0..100", () => {
    const values = simulateRun(spec, 3);
    expect(values).toHaveLength(RUNS_PER_AXIS);
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it("landet nahe an Ziel-Mittelwert und Ziel-Streuung", () => {
    const values = simulateRun(spec, 5, 500);
    expect(Math.abs(mean(values) - spec.mean)).toBeLessThan(2);
    expect(Math.abs(stddev(values) - spec.sd)).toBeLessThan(2);
  });
});

describe("mean / stddev", () => {
  it("berechnet Mittelwert und Populations-σ korrekt", () => {
    const values = [2, 4, 4, 4, 5, 5, 7, 9];
    expect(mean(values)).toBe(5);
    expect(stddev(values)).toBe(2);
  });
});

describe("curvePoints", () => {
  it("liefert samples Höhen, Maximum ~1 nahe dem Mittelwert", () => {
    const pts = curvePoints(50, 10, 51);
    expect(pts).toHaveLength(51);
    const maxIdx = pts.indexOf(Math.max(...pts));
    expect(maxIdx).toBe(25);
    expect(pts[maxIdx]).toBeCloseTo(1, 5);
  });

  it("bricht bei sd=0 nicht (Guard auf Mindest-Streuung)", () => {
    const pts = curvePoints(50, 0, 11);
    expect(pts.every((p) => Number.isFinite(p))).toBe(true);
  });
});

describe("toSvgPath / toSvgArea", () => {
  it("baut einen M/L-Pfad über die volle Breite", () => {
    const d = toSvgPath([0, 1, 0], 100, 50);
    expect(d).toMatch(/^M0\.0,50\.0 L50\.0,0\.0 L100\.0,50\.0$/);
  });

  it("schließt die Fläche zur Basislinie", () => {
    const d = toSvgArea([0, 1, 0], 100, 50);
    expect(d.startsWith("M0.0,50.0")).toBe(true);
    expect(d.endsWith("L100,50 L0,50 Z")).toBe(true);
  });
});
