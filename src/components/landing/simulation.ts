// Reine Simulationslogik für die Landing-Page (Hero-Canvas + statische SVGs).
// Kein DOM, keine Seiteneffekte — deterministisch über geseedete PRNG.

export interface AxisSpec {
  id: string;
  left: string;
  right: string;
  /** Ziel-Mittelwert auf der Skala 0..100 */
  mean: number;
  /** Ziel-Streuung (Standardabweichung) */
  sd: number;
}

export const RUNS_PER_AXIS = 50;

// Vier OEJTS-Achsen mit bewusst unterschiedlichem Charakter:
// schmal/stabil (T/F) bis breit/streuend (S/N) — die Produkt-Story als Daten.
export const AXES: AxisSpec[] = [
  { id: "E/I", left: "I", right: "E", mean: 62, sd: 8 },
  { id: "S/N", left: "S", right: "N", mean: 44, sd: 15 },
  { id: "T/F", left: "T", right: "F", mean: 71, sd: 5 },
  { id: "J/P", left: "J", right: "P", mean: 52, sd: 11 },
];

/** Mulberry32 — kleiner, schneller, deterministischer PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Simuliert einen Messlauf: n normalverteilte Werte (Box-Muller) um
 * spec.mean/spec.sd, geklemmt auf 0..100.
 */
export function simulateRun(spec: AxisSpec, seed: number, n: number = RUNS_PER_AXIS): number[] {
  const rand = mulberry32(seed);
  const values: number[] = [];
  for (let i = 0; i < n; i++) {
    const u1 = Math.max(rand(), 1e-9);
    const u2 = rand();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    values.push(Math.min(100, Math.max(0, spec.mean + z * spec.sd)));
  }
  return values;
}

/** Arithmetisches Mittel. Erwartet ein nicht-leeres Array. */
export function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Populations-Standardabweichung. Erwartet ein nicht-leeres Array. */
export function stddev(values: number[]): number {
  const m = mean(values);
  return Math.sqrt(values.reduce((acc, v) => acc + (v - m) ** 2, 0) / values.length);
}

/** Zählt Werte (0..100) in binCount gleich breite Bins; 100 fällt in den letzten. */
export function binValues(values: number[], binCount: number): number[] {
  const bins = new Array(binCount).fill(0) as number[];
  for (const v of values) {
    bins[Math.min(binCount - 1, Math.floor((v / 100) * binCount))]++;
  }
  return bins;
}

/**
 * Gauß-Glockenkurve als Höhen 0..1 an `samples` Stützstellen über 0..100.
 * sd wird auf minimal 1 geklemmt (Division durch 0).
 */
export function curvePoints(m: number, sd: number, samples: number): number[] {
  const s = Math.max(sd, 1);
  const pts: number[] = [];
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 100;
    pts.push(Math.exp(-0.5 * ((x - m) / s) ** 2));
  }
  return pts;
}

/** Höhen (0..1) → SVG-Pfad; y=height ist die Basislinie. */
export function toSvgPath(heights: number[], width: number, height: number): string {
  const n = heights.length;
  return heights
    .map((h, i) => {
      const x = (i / (n - 1)) * width;
      const y = height - h * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/** Wie toSvgPath, aber als geschlossene Fläche zur Basislinie. */
export function toSvgArea(heights: number[], width: number, height: number): string {
  return `${toSvgPath(heights, width, height)} L${width},${height} L0,${height} Z`;
}
