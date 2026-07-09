# Landing Page „Live Instrument" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Startseite (`/`) wird zur englischsprachigen Showcase-Landing-Page im Stil eines Präzisions-Messinstruments — mit einer Canvas-Live-Simulation im Hero, die einen Messlauf (N Wiederholungen → Verteilung) nachspielt.

**Architecture:** Astro-6-Sektionskomponenten unter `src/components/landing/` mit genau einer React-Insel (`HeroSimulation.tsx`, `client:visible`). Die Simulationslogik ist eine reine, unit-getestete TS-Datei (`simulation.ts`), die sowohl die Insel (Canvas) als auch das statische Server-SVG (`AxisDistribution.astro`) speist. Scroll-Reveals via IntersectionObserver + CSS.

**Tech Stack:** Astro 6 (SSR, Cloudflare-Adapter), React 19, Tailwind 4 (Token-basiert), Vitest, @fontsource (Instrument Serif, JetBrains Mono).

**Spec:** `docs/superpowers/specs/2026-07-09-landing-page-redesign-design.md`

## Global Constraints

- **Branch `feat/landing-live-instrument` — NIEMALS direkt auf `main` pushen.** Push auf `main` deployt automatisch auf Prod. Abschluss ist ein PR (Task 11).
- **Farben ausschließlich über semantische Token-Utilities** (`bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `stroke-primary`, `fill-chart-2`, …). Keine Hex-/Farb-Literale in Markup oder CSS. Der Canvas liest Tokens zur Laufzeit via `getComputedStyle` (`--primary`, `--border`, `--muted-foreground`).
- **Teal (`primary`) nur für „lebende Messung"** (Punkte, Kurven, Live-Badges). **Amber (`chart-2`) genau einmal:** der Einzel-Messpunkt in der Problem-Sektion.
- **Copy der Landing Page: Englisch.** Commits/Doku: Deutsch, Conventional Commits (`feat(landing): …`).
- **Fonts self-hosted via `@fontsource`,** importiert **nur** in `src/pages/index.astro` — App-Seiten laden sie nicht.
- **`prefers-reduced-motion` überall respektieren** (Simulation: Standbild; Reveals: sofort sichtbar).
- **Lint CI-äquivalent:** `npx eslint . --rule '{"prettier/prettier":"off"}'` — das volle `npm run lint` erstickt lokal an CRLF-Rauschen. **Niemals nur Teilmengen linten** (hat schon einen CI-Fail durchgelassen).
- **Unit-Suite:** `npm run test` (Vitest, Glob `src/**/*.test.ts`). Vor jedem Commit grün.
- Pre-Commit-Hooks (husky + lint-staged) formatieren automatisch — committete Dateien können danach minimal anders aussehen als geschrieben; das ist okay.
- Node 22.14 (`.nvmrc`).

---

### Task 1: Branch, Fonts & Font-Tokens

**Files:**

- Modify: `package.json` (Dependencies via `npm install`)
- Modify: `src/styles/global.css:79` (`@theme inline`-Block)

**Interfaces:**

- Produces: Tailwind-Utilities `font-display` (Instrument Serif) und `font-mono` (JetBrains Mono mit System-Fallback) für alle Folge-Tasks.

- [ ] **Step 1: Feature-Branch anlegen**

```bash
git checkout -b feat/landing-live-instrument
```

- [ ] **Step 2: Fontsource-Pakete installieren**

```bash
npm install @fontsource/instrument-serif @fontsource/jetbrains-mono
```

Expected: beide Pakete in `dependencies`, `package-lock.json` konsistent (kein Fehler).

- [ ] **Step 3: Font-Tokens in `global.css` ergänzen**

Im bestehenden `@theme inline`-Block (beginnt Zeile 79) direkt nach `--radius-xl` einfügen:

```css
--font-display: "Instrument Serif", Georgia, "Times New Roman", serif;
--font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
```

Hinweis: `--font-mono` überschreibt Tailwinds Default-Mono-Stack global. App-Seiten laden JetBrains Mono nicht und fallen sauber auf `ui-monospace` zurück — kein visueller Bruch.

- [ ] **Step 4: Build verifizieren**

Run: `npm run build`
Expected: Build erfolgreich, keine CSS-Fehler.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/styles/global.css
git commit -m "feat(landing): Fonts Instrument Serif + JetBrains Mono als Theme-Tokens"
```

---

### Task 2: `simulation.ts` — reine Simulationslogik (TDD)

**Files:**

- Create: `src/components/landing/simulation.ts`
- Test: `src/components/landing/simulation.test.ts`

**Interfaces:**

- Produces (von Task 3, 4, 6, 8 konsumiert):
  - `interface AxisSpec { id: string; left: string; right: string; mean: number; sd: number }`
  - `const AXES: AxisSpec[]` (4 Einträge: E/I, S/N, T/F, J/P)
  - `const RUNS_PER_AXIS = 50`
  - `mulberry32(seed: number): () => number`
  - `simulateRun(spec: AxisSpec, seed: number, n?: number): number[]` — deterministisch, Werte 0..100
  - `mean(values: number[]): number`
  - `stddev(values: number[]): number` — Populations-σ
  - `binValues(values: number[], binCount: number): number[]`
  - `curvePoints(mean: number, sd: number, samples: number): number[]` — Gauß-Höhen 0..1
  - `toSvgPath(heights: number[], width: number, height: number): string`
  - `toSvgArea(heights: number[], width: number, height: number): string`

- [ ] **Step 1: Failing Tests schreiben**

Create `src/components/landing/simulation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  AXES,
  RUNS_PER_AXIS,
  binValues,
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

describe("binValues", () => {
  it("verteilt Werte in die richtigen Bins; Summe = Anzahl", () => {
    const bins = binValues([0, 55, 99.9], 10);
    expect(bins).toHaveLength(10);
    expect(bins[0]).toBe(1);
    expect(bins[5]).toBe(1);
    expect(bins[9]).toBe(1);
    expect(bins.reduce((a, b) => a + b, 0)).toBe(3);
  });

  it("klemmt den Maximalwert 100 in den letzten Bin", () => {
    expect(binValues([100], 10)[9]).toBe(1);
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
```

- [ ] **Step 2: Tests laufen lassen — müssen fehlschlagen**

Run: `npx vitest run src/components/landing/simulation.test.ts`
Expected: FAIL — `Cannot find module './simulation'` (o. ä.).

- [ ] **Step 3: Implementierung schreiben**

Create `src/components/landing/simulation.ts`:

```ts
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
```

- [ ] **Step 4: Tests laufen lassen — müssen bestehen**

Run: `npx vitest run src/components/landing/simulation.test.ts`
Expected: PASS (13 Tests).

- [ ] **Step 5: Volle Suite + Commit**

Run: `npm run test`
Expected: PASS (187 Bestand + 13 neue).

```bash
git add src/components/landing/simulation.ts src/components/landing/simulation.test.ts
git commit -m "feat(landing): deterministische Messlauf-Simulation als reine Logik"
```

---

### Task 3: `AxisDistribution.astro` — statisches Verteilungs-SVG

**Files:**

- Create: `src/components/landing/AxisDistribution.astro`

**Interfaces:**

- Consumes: `AXES`, `RUNS_PER_AXIS`, `simulateRun`, `mean`, `stddev`, `curvePoints`, `toSvgPath`, `toSvgArea` aus `./simulation`
- Produces: Astro-Komponente mit Props `{ axisIndex?: number; seed?: number; showStats?: boolean; class?: string }` — server-gerendertes SVG einer fertigen Verteilung. Genutzt von Task 5 (Hero-Fallback, mit `showStats`) und Task 8 (TestLibrary-Minis).

- [ ] **Step 1: Komponente schreiben**

Create `src/components/landing/AxisDistribution.astro`:

```astro
---
import { AXES, RUNS_PER_AXIS, curvePoints, mean, simulateRun, stddev, toSvgArea, toSvgPath } from "./simulation";

interface Props {
  axisIndex?: number;
  seed?: number;
  showStats?: boolean;
  class?: string;
}

const { axisIndex = 0, seed = 7, showStats = false, class: className } = Astro.props;

const spec = AXES[axisIndex];
const values = simulateRun(spec, seed);
const m = mean(values);
const sd = stddev(values);

const W = 320;
const H = 120;
const BASELINE = H - 24;
const heights = curvePoints(m, Math.max(sd, 1.5), 48);
const curve = toSvgPath(heights, W, BASELINE - 8);
const area = toSvgArea(heights, W, BASELINE - 8);
const ticks = Array.from({ length: 11 }, (_, i) => (i / 10) * W);
---

<figure class={className}>
  <svg
    viewBox={`0 0 ${W} ${H}`}
    class="h-auto w-full"
    role="img"
    aria-label={`Distribution on the ${spec.left}–${spec.right} axis`}
  >
    <path d={area} class="fill-primary/10" transform="translate(0 8)"></path>
    <path d={curve} class="stroke-primary fill-none" stroke-width="1.5" transform="translate(0 8)"></path>
    <line x1="0" y1={BASELINE} x2={W} y2={BASELINE} class="stroke-border" stroke-width="1"></line>
    {
      ticks.map((x, i) => (
        <line
          x1={x}
          y1={BASELINE}
          x2={x}
          y2={BASELINE + (i % 5 === 0 ? 6 : 3)}
          class="stroke-border"
          stroke-width="1"
        />
      ))
    }
    <text x="0" y={H - 2} class="fill-muted-foreground font-mono text-[11px]">{spec.left}</text>
    <text x={W} y={H - 2} text-anchor="end" class="fill-muted-foreground font-mono text-[11px]">{spec.right}</text>
  </svg>
  {
    showStats && (
      <figcaption class="text-muted-foreground mt-2 font-mono text-xs tabular-nums">
        {spec.left}–{spec.right} axis · n {RUNS_PER_AXIS} · mean {m.toFixed(1)} · σ {sd.toFixed(1)}
      </figcaption>
    )
  }
</figure>
```

- [ ] **Step 2: Build verifizieren**

Run: `npm run build`
Expected: Build erfolgreich (Komponente ist noch nirgends eingebunden — reiner Syntax-/Typ-Check via Build).

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/AxisDistribution.astro
git commit -m "feat(landing): statisches Verteilungs-SVG (Server-Fallback + Karten-Visuals)"
```

---

### Task 4: `HeroSimulation.tsx` — Canvas-Insel

**Files:**

- Create: `src/components/landing/HeroSimulation.tsx`

**Interfaces:**

- Consumes: `AXES`, `RUNS_PER_AXIS`, `simulateRun`, `mean`, `stddev`, `curvePoints` aus `./simulation`
- Produces: Default-Export `HeroSimulation` (React, keine Props). Blendet nach Mount das Element `#hero-simulation-fallback` aus (Task 5 rendert es).

- [ ] **Step 1: Komponente schreiben**

Create `src/components/landing/HeroSimulation.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import { AXES, RUNS_PER_AXIS, curvePoints, mean, simulateRun, stddev } from "./simulation";

// Timing der Simulation
const POINT_INTERVAL_MS = 150; // neuer Messpunkt
const SETTLE_MS = 320; // Einschweben eines Punkts
const HOLD_MS = 1400; // Pause + Puls nach vollem Lauf
const BINS = 24;
const CURVE_MIN_POINTS = 8; // ab hier wird die Kurve eingeblendet

interface Stats {
  axisIndex: number;
  run: number;
  mean: number;
  sd: number;
}

interface ThemeColors {
  primary: string;
  border: string;
  muted: string;
}

// Theme-Tokens zur Laufzeit lesen — einzige erlaubte Farbquelle für den Canvas.
function readColors(el: HTMLElement): ThemeColors {
  const s = getComputedStyle(el);
  return {
    primary: s.getPropertyValue("--primary").trim(),
    border: s.getPropertyValue("--border").trim(),
    muted: s.getPropertyValue("--muted-foreground").trim(),
  };
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export default function HeroSimulation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stats, setStats] = useState<Stats>({ axisIndex: 0, run: 0, mean: 0, sd: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // Ab jetzt übernimmt der Canvas — SSR-Fallback ausblenden.
    document.getElementById("hero-simulation-fallback")?.setAttribute("hidden", "");

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cleanups: (() => void)[] = [];

    let colors = readColors(canvas);
    let width = 0;
    let height = 0;

    // Simulationszustand
    let axisIndex = 0;
    let seed = 7;
    let values = simulateRun(AXES[axisIndex], seed);
    let shownAt: number[] = []; // Einblende-Zeitstempel je sichtbarem Punkt
    let phase: "run" | "hold" = "run";
    let phaseStart = 0;
    let lastPointAt = 0;
    let rafId = 0;

    const xFor = (value: number) => (value / 100) * (width - 32) + 16;

    function draw(now: number) {
      if (!ctx || width === 0) return;
      ctx.clearRect(0, 0, width, height);
      const baseline = height - 28;
      const spec = AXES[axisIndex];

      // Achse mit Tick-Marks
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(16, baseline);
      ctx.lineTo(width - 16, baseline);
      ctx.stroke();
      for (let i = 0; i <= 10; i++) {
        const x = xFor(i * 10);
        ctx.beginPath();
        ctx.moveTo(x, baseline);
        ctx.lineTo(x, baseline + (i % 5 === 0 ? 6 : 3));
        ctx.stroke();
      }

      // Pol-Beschriftungen
      ctx.fillStyle = colors.muted;
      ctx.font = "12px 'JetBrains Mono', ui-monospace, monospace";
      ctx.textAlign = "left";
      ctx.fillText(spec.left, 16, baseline + 20);
      ctx.textAlign = "right";
      ctx.fillText(spec.right, width - 16, baseline + 20);

      // Messpunkte: je Bin gestapelt; frische Punkte schweben von oben ein
      const shown = shownAt.length;
      const stack = new Array(BINS).fill(0) as number[];
      ctx.fillStyle = colors.primary;
      for (let i = 0; i < shown; i++) {
        const v = values[i];
        const bin = Math.min(BINS - 1, Math.floor((v / 100) * BINS));
        const level = stack[bin]++;
        const targetY = baseline - 5 - level * 7;
        const t = Math.min(1, (now - shownAt[i]) / SETTLE_MS);
        const y = 12 + (targetY - 12) * easeOutCubic(t);
        ctx.globalAlpha = 0.35 + 0.65 * t;
        ctx.beginPath();
        ctx.arc(xFor(v), y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Verteilungskurve über den Punkten; pulsiert in der Hold-Phase
      if (shown >= CURVE_MIN_POINTS) {
        const current = values.slice(0, shown);
        const heights = curvePoints(mean(current), Math.max(stddev(current), 1.5), 60);
        const pulse = phase === "hold" ? 1.5 + 0.75 * Math.sin((now - phaseStart) / 120) : 1.5;
        ctx.strokeStyle = colors.primary;
        ctx.lineWidth = pulse;
        ctx.globalAlpha = Math.min(1, (shown - CURVE_MIN_POINTS) / 12);
        ctx.beginPath();
        heights.forEach((h, i) => {
          const x = 16 + (i / (heights.length - 1)) * (width - 32);
          const y = baseline - 8 - h * (baseline - 32);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    function frame(now: number) {
      if (phase === "run") {
        if (shownAt.length < RUNS_PER_AXIS && now - lastPointAt >= POINT_INTERVAL_MS) {
          shownAt.push(now);
          lastPointAt = now;
          const current = values.slice(0, shownAt.length);
          setStats({ axisIndex, run: shownAt.length, mean: mean(current), sd: stddev(current) });
        }
        if (shownAt.length === RUNS_PER_AXIS && now - shownAt[shownAt.length - 1] >= SETTLE_MS) {
          phase = "hold";
          phaseStart = now;
        }
      } else if (now - phaseStart >= HOLD_MS) {
        // Nächste Achse, frischer Lauf
        axisIndex = (axisIndex + 1) % AXES.length;
        seed += 1;
        values = simulateRun(AXES[axisIndex], seed);
        shownAt = [];
        phase = "run";
        lastPointAt = now;
        setStats({ axisIndex, run: 0, mean: 0, sd: 0 });
      }
      draw(now);
      rafId = requestAnimationFrame(frame);
    }

    function start() {
      if (rafId) return;
      const now = performance.now();
      lastPointAt = now;
      if (phase === "hold") phaseStart = now;
      rafId = requestAnimationFrame(frame);
    }

    function stop() {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }

    // Größe/DPR — zeichnet nach jedem Resize neu (auch das reduced-Standbild)
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(performance.now());
    });
    ro.observe(canvas);
    cleanups.push(() => ro.disconnect());

    // Theme-Wechsel (.dark auf <html>) → Token-Farben neu lesen
    const themeObserver = new MutationObserver(() => {
      colors = readColors(canvas);
      draw(performance.now());
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    cleanups.push(() => themeObserver.disconnect());

    if (reduced) {
      // Fertiges Standbild: alle Punkte gesetzt, Kurve voll — keine Animation.
      shownAt = values.map(() => performance.now() - SETTLE_MS);
      phase = "hold";
      phaseStart = performance.now() - HOLD_MS; // Puls steht still bei sin(~konstant)
      setStats({ axisIndex, run: RUNS_PER_AXIS, mean: mean(values), sd: stddev(values) });
    } else {
      // Nur animieren, wenn sichtbar (Viewport + Tab)
      const io = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && !document.hidden) start();
          else stop();
        },
        { threshold: 0.1 },
      );
      io.observe(canvas);
      cleanups.push(() => io.disconnect());

      const onVisibility = () => {
        if (document.hidden) stop();
        else start();
      };
      document.addEventListener("visibilitychange", onVisibility);
      cleanups.push(() => document.removeEventListener("visibilitychange", onVisibility));
    }

    return () => {
      stop();
      cleanups.forEach((fn) => fn());
    };
  }, []);

  const spec = AXES[stats.axisIndex];
  return (
    <div className="flex h-full flex-col justify-end">
      <canvas ref={canvasRef} className="h-64 w-full sm:h-80" aria-hidden="true" />
      <p className="text-muted-foreground mt-2 font-mono text-xs tabular-nums">
        {spec.left}–{spec.right} axis · run {stats.run}/{RUNS_PER_AXIS} · mean{" "}
        {stats.run > 0 ? stats.mean.toFixed(1) : "—"} · σ {stats.run > 0 ? stats.sd.toFixed(1) : "—"}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Lint + Build verifizieren**

Run: `npx eslint . --rule '{"prettier/prettier":"off"}'`
Expected: keine Fehler (react-hooks/react-compiler-Regeln zufrieden).

Run: `npm run build`
Expected: Build erfolgreich.

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/HeroSimulation.tsx
git commit -m "feat(landing): Canvas-Insel — Live-Messlauf mit Achsen-Zyklus"
```

---

### Task 5: `Hero.astro` + neue `index.astro` (Assembly, Reveal, Welcome löschen)

**Files:**

- Create: `src/components/landing/Hero.astro`
- Modify: `src/pages/index.astro` (komplett ersetzen)
- Delete: `src/components/Welcome.astro`

**Interfaces:**

- Consumes: `HeroSimulation` (Task 4), `AxisDistribution` (Task 3), `buttonVariants` aus `@/components/ui/button`
- Produces: CSS-Klasse `reveal` (+ `is-visible`-Mechanik) und die Sektions-Assembly in `index.astro`, an die Tasks 6–9 je eine Zeile anfügen. Element-ID `hero-simulation-fallback` (von Task 4 ausgeblendet).

- [ ] **Step 1: Hero-Komponente schreiben**

Create `src/components/landing/Hero.astro`:

```astro
---
import { buttonVariants } from "@/components/ui/button";
import AxisDistribution from "./AxisDistribution.astro";
import HeroSimulation from "./HeroSimulation";
---

<section id="hero" class="grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-2">
  <div>
    <p class="text-muted-foreground font-mono text-xs tracking-[0.2em] uppercase">01 — psychometrics for LLMs</p>
    <h1 class="font-display text-foreground mt-6 text-5xl leading-[1.05] text-balance sm:text-6xl lg:text-7xl">
      Your model has a personality. <em>Measure it.</em>
    </h1>
    <p class="text-muted-foreground mt-6 max-w-xl text-lg">
      persona-forge runs openly licensed psychometric instruments against language models — N repetitions per run,
      distributions per axis, instead of a single random snapshot.
    </p>
    <div class="mt-10 flex flex-col gap-3 sm:flex-row">
      <a href="/auth/signup" class:list={buttonVariants({ size: "lg" })}>Start measuring</a>
      <a href="/auth/signin" class:list={buttonVariants({ variant: "outline", size: "lg" })}>Sign in</a>
    </div>
  </div>
  <div class="relative min-h-[19rem] sm:min-h-[23rem]">
    <div id="hero-simulation-fallback" class="absolute inset-0 flex flex-col justify-end">
      <AxisDistribution axisIndex={0} seed={7} showStats />
    </div>
    <div class="absolute inset-0">
      <HeroSimulation client:visible />
    </div>
  </div>
</section>
```

- [ ] **Step 2: `index.astro` ersetzen**

Replace `src/pages/index.astro` komplett:

```astro
---
import "@fontsource/instrument-serif";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource/jetbrains-mono";
import Hero from "@/components/landing/Hero.astro";
import Layout from "@/layouts/Layout.astro";
---

<Layout title="persona-forge — psychometric profiling for LLMs">
  <main class="mx-auto max-w-6xl px-4">
    <Hero />
  </main>
</Layout>

<style is:global>
  .reveal {
    opacity: 0;
    translate: 0 12px;
    transition:
      opacity 0.6s ease,
      translate 0.6s ease;
  }
  .reveal.is-visible {
    opacity: 1;
    translate: 0 0;
  }
  @media (prefers-reduced-motion: reduce) {
    .reveal {
      opacity: 1;
      translate: none;
      transition: none;
    }
  }
</style>

<script>
  // Scroll-Reveal: einmalig einblenden, dann nicht weiter beobachten.
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.15 },
  );
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
</script>
```

- [ ] **Step 3: `Welcome.astro` löschen**

```bash
git rm src/components/Welcome.astro
```

(Es gibt nur eine Referenz — die alte `index.astro`; per Grep `Welcome` gegenprüfen.)

- [ ] **Step 4: Build + Sichtprüfung**

Run: `npm run build`
Expected: Build erfolgreich.

Run: `npm run dev` (Hintergrund) → `http://localhost:4321/` öffnen.
Expected: Hero mit Serif-Headline links; rechts läuft die Simulation (Punkte tröpfeln, Kurve entsteht, Statuszeile tickt, nach N=50 Achsenwechsel). Theme-Toggle umschalten → Canvas-Farben folgen.

- [ ] **Step 5: Volle Suite, Lint, Commit**

Run: `npm run test` → PASS. `npx eslint . --rule '{"prettier/prettier":"off"}'` → keine Fehler.

```bash
git add src/components/landing/Hero.astro src/pages/index.astro
git commit -m "feat(landing): Hero mit Live-Simulation, engl. Copy, Welcome entfernt"
```

---

### Task 6: `Problem.astro` — „One measurement is an anecdote."

**Files:**

- Create: `src/components/landing/Problem.astro`
- Modify: `src/pages/index.astro` (Import + Einbindung)

**Interfaces:**

- Consumes: `AXES`, `simulateRun`, `mean`, `stddev`, `curvePoints`, `toSvgPath`, `toSvgArea` aus `./simulation`; CSS-Klasse `reveal` (Task 5)
- Produces: Sektion `#problem`. **Einzige Amber-Stelle der Seite** (`fill-chart-2`).

- [ ] **Step 1: Komponente schreiben**

Create `src/components/landing/Problem.astro`:

```astro
---
import { AXES, curvePoints, mean, simulateRun, stddev, toSvgArea, toSvgPath } from "./simulation";

const spec = AXES[0];
const values = simulateRun(spec, 21);
const m = mean(values);
const sd = stddev(values);
// Der "einzelne Messwert" ist ein bewusst irreführender Ausreißer aus demselben Lauf.
const singleValue = Math.max(...values);

const W = 320;
const H = 96;
const BASELINE = H - 16;
const heights = curvePoints(m, Math.max(sd, 1.5), 48);
const curve = toSvgPath(heights, W, BASELINE - 6);
const area = toSvgArea(heights, W, BASELINE - 6);
---

<section id="problem" class="border-border border-t py-20 sm:py-28">
  <p class="reveal text-muted-foreground font-mono text-xs tracking-[0.2em] uppercase">02 — the problem</p>
  <h2 class="reveal font-display text-foreground mt-4 max-w-2xl text-4xl text-balance sm:text-5xl">
    One measurement is an anecdote.
  </h2>
  <p class="reveal text-muted-foreground mt-5 max-w-xl text-lg">
    Ask a model the same questions twice and you get two different people. A single test run is a coin flip dressed up
    as insight — only the distribution over many runs tells you who your model actually is.
  </p>

  <div class="mt-14 grid gap-10 sm:grid-cols-2">
    <figure class="reveal">
      <svg viewBox={`0 0 ${W} ${H}`} class="h-auto w-full" role="img" aria-label="A single measurement point">
        <line x1="0" y1={BASELINE} x2={W} y2={BASELINE} class="stroke-border" stroke-width="1"></line>
        <circle cx={(singleValue / 100) * W} cy={BASELINE - 10} r="4" class="fill-chart-2"></circle>
      </svg>
      <figcaption class="text-muted-foreground mt-3 font-mono text-xs tabular-nums">
        n=1 · score {singleValue.toFixed(1)} — could mean anything
      </figcaption>
    </figure>
    <figure class="reveal">
      <svg viewBox={`0 0 ${W} ${H}`} class="h-auto w-full" role="img" aria-label="A distribution of fifty measurements">
        <path d={area} class="fill-primary/10"></path>
        <path d={curve} class="stroke-primary fill-none" stroke-width="1.5"></path>
        <line x1="0" y1={BASELINE} x2={W} y2={BASELINE} class="stroke-border" stroke-width="1"></line>
      </svg>
      <figcaption class="text-muted-foreground mt-3 font-mono text-xs tabular-nums">
        n=50 · mean {m.toFixed(1)} · σ {sd.toFixed(1)} — the actual picture
      </figcaption>
    </figure>
  </div>
</section>
```

- [ ] **Step 2: In `index.astro` einbinden**

In `src/pages/index.astro` ergänzen — Import:

```astro
import Problem from "@/components/landing/Problem.astro";
```

und im `<main>` nach `<Hero />`:

```astro
<Problem />
```

- [ ] **Step 3: Build + Sichtprüfung + Commit**

Run: `npm run build` → OK. Dev-Server: Sektion blendet beim Scrollen ein; Amber-Punkt links, Teal-Verteilung rechts.

```bash
git add src/components/landing/Problem.astro src/pages/index.astro
git commit -m "feat(landing): Problem-Sektion — Anekdote vs. Verteilung"
```

---

### Task 7: `Method.astro` — Configure → Run → Read

**Files:**

- Create: `src/components/landing/Method.astro`
- Modify: `src/pages/index.astro` (Import + Einbindung)

**Interfaces:**

- Consumes: `Card`, `CardHeader`, `CardTitle`, `CardDescription` aus `@/components/ui/card`; Klasse `reveal`
- Produces: Sektion `#method`.

- [ ] **Step 1: Komponente schreiben**

Create `src/components/landing/Method.astro`:

```astro
---
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const steps = [
  {
    n: "01",
    title: "Configure",
    description:
      "Attach any OpenAI-compatible model — base URL, API key, model name. Pick or create a persona: the system prompt as a first-class, reusable object.",
  },
  {
    n: "02",
    title: "Run",
    description:
      "The instrument runs N times, each repetition in an isolated session with permuted items. Every raw answer is stored, per item and per run.",
  },
  {
    n: "03",
    title: "Read",
    description:
      "Scores aggregate into a distribution per axis — location, spread, type stability. Compare two models or two personas side by side.",
  },
];
---

<section id="method" class="border-border border-t py-20 sm:py-28">
  <p class="reveal text-muted-foreground font-mono text-xs tracking-[0.2em] uppercase">03 — the method</p>
  <h2 class="reveal font-display text-foreground mt-4 max-w-2xl text-4xl text-balance sm:text-5xl">
    Ask the same question fifty times.
  </h2>

  <div class="mt-14 grid gap-4 sm:grid-cols-3">
    {
      steps.map((step) => (
        <div class="reveal">
          <Card className="h-full">
            <CardHeader>
              <p class="text-muted-foreground font-mono text-xs tabular-nums">{step.n}</p>
              <CardTitle className="mt-2">{step.title}</CardTitle>
              <CardDescription>{step.description}</CardDescription>
            </CardHeader>
          </Card>
        </div>
      ))
    }
  </div>
</section>
```

- [ ] **Step 2: In `index.astro` einbinden**

Import ergänzen:

```astro
import Method from "@/components/landing/Method.astro";
```

und im `<main>` nach `<Problem />`:

```astro
<Method />
```

- [ ] **Step 3: Build + Commit**

Run: `npm run build` → OK.

```bash
git add src/components/landing/Method.astro src/pages/index.astro
git commit -m "feat(landing): Methoden-Sektion — Configure/Run/Read"
```

---

### Task 8: `TestLibrary.astro` — wachsende Instrumenten-Bibliothek

**Files:**

- Create: `src/components/landing/TestLibrary.astro`
- Modify: `src/pages/index.astro` (Import + Einbindung)

**Interfaces:**

- Consumes: `AxisDistribution` (Task 3); `Card`-Familie; Klasse `reveal`
- Produces: Sektion `#tests` mit vier Instrument-Karten (`live`/`planned`-Badges).

- [ ] **Step 1: Komponente schreiben**

Create `src/components/landing/TestLibrary.astro`:

```astro
---
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import AxisDistribution from "./AxisDistribution.astro";

// Maße für das Steadfastness-SVG (Positions-Linie + Druck-Impulse)
const W = 320;
const H = 96;
const MID = H / 2;
---

<section id="tests" class="border-border border-t py-20 sm:py-28">
  <p class="reveal text-muted-foreground font-mono text-xs tracking-[0.2em] uppercase">04 — test library</p>
  <h2 class="reveal font-display text-foreground mt-4 max-w-2xl text-4xl text-balance sm:text-5xl">
    A growing library of behavioral instruments.
  </h2>
  <p class="reveal text-muted-foreground mt-5 max-w-xl text-lg">
    Personality is where it starts, not where it ends. Every instrument follows the same discipline: N repetitions,
    isolated sessions, distributions instead of anecdotes.
  </p>

  <div class="mt-14 grid gap-4 sm:grid-cols-2">
    <div class="reveal">
      <Card className="h-full">
        <CardHeader>
          <div class="flex items-center justify-between">
            <CardTitle>OEJTS</CardTitle>
            <span
              class="border-primary/40 text-primary rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase"
            >
              live
            </span>
          </div>
          <CardDescription>
            Open Extended Jungian Type Scales — 32 items, four axes, an MBTI-style type derived from distributions, not
            vibes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div class="grid grid-cols-2 gap-3">
            <AxisDistribution axisIndex={0} seed={11} />
            <AxisDistribution axisIndex={1} seed={12} />
            <AxisDistribution axisIndex={2} seed={13} />
            <AxisDistribution axisIndex={3} seed={14} />
          </div>
        </CardContent>
      </Card>
    </div>

    <div class="reveal">
      <Card className="h-full">
        <CardHeader>
          <div class="flex items-center justify-between">
            <CardTitle>Steadfastness</CardTitle>
            <span
              class="border-primary/40 text-primary rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase"
            >
              live
            </span>
          </div>
          <CardDescription>
            Examinee versus adversary: how firmly does a model hold its position when it is pushed, and when does it
            fold?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <svg viewBox={`0 0 ${W} ${H}`} class="h-auto w-full" role="img" aria-label="A position held under pressure">
            {/* Position des Prüflings: hält unter den ersten Impulsen, gibt beim letzten leicht nach */}
            <path
              d={`M0,${MID} L120,${MID} L132,${MID - 4} L144,${MID} L216,${MID} L228,${MID + 10} L${W},${MID + 10}`}
              class="stroke-primary fill-none"
              stroke-width="1.5"></path>
            {/* Druck-Impulse des Gegenspielers */}
            {
              [120, 216].map((x) => (
                <g>
                  <line x1={x + 6} y1={12} x2={x + 6} y2={MID - 14} class="stroke-border" stroke-width="1" />
                  <path
                    d={`M${x + 2},${MID - 20} L${x + 6},${MID - 12} L${x + 10},${MID - 20}`}
                    class="stroke-muted-foreground fill-none"
                    stroke-width="1"
                  />
                </g>
              ))
            }
          </svg>
          <p class="text-muted-foreground mt-2 font-mono text-xs">pressure applied · position tracked per turn</p>
        </CardContent>
      </Card>
    </div>

    <div class="reveal">
      <Card className="h-full border-dashed">
        <CardHeader>
          <div class="flex items-center justify-between">
            <CardTitle className="text-muted-foreground">Big Five</CardTitle>
            <span
              class="border-border text-muted-foreground rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase"
            >
              planned
            </span>
          </div>
          <CardDescription>
            Mini-IPIP — a public-domain Likert instrument. Five factors, same discipline: distributions per scale.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>

    <div class="reveal">
      <Card className="h-full border-dashed">
        <CardHeader>
          <div class="flex items-center justify-between">
            <CardTitle className="text-muted-foreground">Task-based evals</CardTitle>
            <span
              class="border-border text-muted-foreground rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase"
            >
              planned
            </span>
          </div>
          <CardDescription>
            Which persona, on which model, handles which engineering task best — behavioral fit beyond personality.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  </div>
</section>
```

- [ ] **Step 2: In `index.astro` einbinden**

Import ergänzen:

```astro
import TestLibrary from "@/components/landing/TestLibrary.astro";
```

und im `<main>` nach `<Method />`:

```astro
<TestLibrary />
```

- [ ] **Step 3: Build + Commit**

Run: `npm run build` → OK.

```bash
git add src/components/landing/TestLibrary.astro src/pages/index.astro
git commit -m "feat(landing): Test-Library-Sektion — OEJTS/Steadfastness live, Big Five/Task-Evals geplant"
```

---

### Task 9: `Cta.astro` — Abschluss-CTA + Footer mit Attribution

**Files:**

- Create: `src/components/landing/Cta.astro`
- Modify: `src/pages/index.astro` (Import + Einbindung)

**Interfaces:**

- Consumes: `buttonVariants` aus `@/components/ui/button`; Klasse `reveal`
- Produces: Sektion `#start` + `<footer>` mit OEJTS-Attribution (BY-Pflicht der CC BY-NC-SA 4.0, Quelle: `docs/instruments/oejts-attribution.md`).

- [ ] **Step 1: Komponente schreiben**

Create `src/components/landing/Cta.astro`:

```astro
---
import { buttonVariants } from "@/components/ui/button";
---

<section id="start" class="border-border border-t py-24 text-center sm:py-32">
  <p class="reveal text-muted-foreground font-mono text-xs tracking-[0.2em] uppercase">05 — start</p>
  <h2 class="reveal font-display text-foreground mx-auto mt-4 max-w-2xl text-4xl text-balance sm:text-5xl">
    Stop guessing what your model is like.
  </h2>
  <p class="reveal text-muted-foreground mx-auto mt-5 max-w-xl text-lg">
    Create an account, attach a model, run your first fifty measurements.
  </p>
  <div class="reveal mt-10 flex flex-col justify-center gap-3 sm:flex-row">
    <a href="/auth/signup" class:list={buttonVariants({ size: "lg" })}>Start measuring</a>
    <a href="/auth/signin" class:list={buttonVariants({ variant: "outline", size: "lg" })}>Sign in</a>
  </div>
</section>

<footer class="border-border text-muted-foreground border-t py-10 text-xs">
  <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
    <p>persona-forge — psychometric profiling for LLMs</p>
    <p class="max-w-md sm:text-right">
      OEJTS 1.2 by Eric Jorgenson, Open Psychometrics Project (<a
        href="https://openpsychometrics.org/tests/OJTS/"
        class="hover:text-foreground underline underline-offset-2">openpsychometrics.org</a
      >), licensed
      <a
        href="https://creativecommons.org/licenses/by-nc-sa/4.0/"
        class="hover:text-foreground underline underline-offset-2">CC BY-NC-SA 4.0</a
      >. Not affiliated with the official MBTI.
    </p>
  </div>
</footer>
```

- [ ] **Step 2: In `index.astro` einbinden**

Import ergänzen:

```astro
import Cta from "@/components/landing/Cta.astro";
```

und im `<main>` nach `<TestLibrary />`:

```astro
<Cta />
```

- [ ] **Step 3: Build + Commit**

Run: `npm run build` → OK.

```bash
git add src/components/landing/Cta.astro src/pages/index.astro
git commit -m "feat(landing): CTA-Sektion + Footer mit OEJTS-Attribution (CC BY-NC-SA 4.0)"
```

---

### Task 10: Volle Verifikation + drei Iteration Passes

**Files:**

- Modify: beliebige Landing-Dateien (Feinschliff je Pass)

**Interfaces:**

- Consumes: die komplette Seite aus Tasks 1–9.

- [ ] **Step 1: Technische Verifikation**

```bash
npm run test
npx eslint . --rule '{"prettier/prettier":"off"}'
npm run build
```

Expected: alles grün. (E2E-Suite berührt `/` nicht — `auth-redirect`/`seed` starten auf `/dashboard` bzw. `/auth/signin`; keine Anpassung nötig. Zur Sicherheit `grep -rn "goto(\"/\")" tests/e2e` → kein Treffer.)

- [ ] **Step 2: Screenshot-Matrix erstellen**

Dev-Server starten, dann mit dem Playwright-MCP (browser_navigate → `http://localhost:4321/`) vier Zustände screenshotten:

1. Desktop (1280×900) · Dark (Default bzw. Toggle klicken)
2. Desktop (1280×900) · Light
3. Mobile (390×844, browser_resize) · Dark
4. Mobile (390×844) · Light

Jeweils die volle Seite durchscrollen (Reveals auslösen, Simulation im Blick).

- [ ] **Step 3: Iteration Pass 1 — Layout & Rhythmus**

Mit den Screenshots kritisch prüfen und **konkrete Fixes committen**:

- Vertikaler Rhythmus: konsistente Sektionsabstände? Hero-Balance links/rechts?
- Mobile: kein horizontaler Overflow, Simulation nicht gequetscht, Headline-Umbrüche sauber (`text-balance` greift)?
- Statuszeile/Fallback: Layout-Shift beim Hydrieren sichtbar? (Höhen von Fallback und Canvas angleichen.)

```bash
git add -A && git commit -m "polish(landing): Iteration Pass 1 — Layout & Rhythmus"
```

- [ ] **Step 4: Iteration Pass 2 — Typografie & Farbe**

- Light Mode: Kurve/Punkte kontraststark genug? `fill-primary/10`-Fläche sichtbar, aber dezent?
- Serif-Größenverlauf h1→h2 stimmig? Mono-Labels einheitlich (Tracking, Größe, `uppercase`)?
- Teal-Disziplin: Teal wirklich nur auf Messung/Live-Badges? Amber nur im Problem-Visual?

```bash
git add -A && git commit -m "polish(landing): Iteration Pass 2 — Typografie & Farbe"
```

- [ ] **Step 5: Iteration Pass 3 — Verdichtung & Details**

Der „complexify"-Pass aus dem Video-Prompt — Details, die Wertigkeit erzeugen:

- Wirkt eine Stelle leer/generisch? (Kandidaten: Tick-Marks an Sektionsgrenzen, dezente Achsen-Deko am Seitenrand, Hover-Zustände auf den Library-Karten.)
- Simulation: Timing gut? (HOLD zu kurz/lang, Punkte zu klein?)
- `prefers-reduced-motion` einmal real testen (DevTools-Emulation): Standbild + sichtbare Inhalte überall.

```bash
git add -A && git commit -m "polish(landing): Iteration Pass 3 — Verdichtung & Details"
```

---

### Task 11: PR erstellen (kein Direkt-Push auf `main`)

**Files:** keine (Git/GitHub-Operationen)

- [ ] **Step 1: Push + PR**

```bash
git push -u origin feat/landing-live-instrument
gh pr create --title "feat(landing): Showcase-Landing-Page — Live Instrument" --body "Landing-Page-Redesign nach Spec docs/superpowers/specs/2026-07-09-landing-page-redesign-design.md: englische Showcase-Seite im Messinstrument-Stil mit Canvas-Live-Simulation (N Wiederholungen -> Verteilung), Test-Library-Sektion und korrekter OEJTS-Attribution (CC BY-NC-SA 4.0). Drei Iteration Passes mit Screenshot-Beleg.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 2: CI + AI-Review abwarten und prüfen**

```bash
gh pr checks --watch
```

Expected: `ci` grün; `ai-review/verdict` grün (Scorecard-Kommentar im PR — der erste echte Live-Einsatz des CI-Review-Agenten). Bei rotem Verdict: Findings lesen, beheben, pushen.

- [ ] **Step 3: Ergebnis dem User melden**

Merge ist User-Entscheidung (Merge = Prod-Deploy). PR-Link, Check-Status und die vier finalen Screenshots präsentieren.
