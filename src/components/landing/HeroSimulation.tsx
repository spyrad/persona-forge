import { useEffect, useRef, useState } from "react";
import { AXES, RUNS_PER_AXIS, curvePoints, mean, simulateRun, stddev } from "./simulation";

// Timing der Simulation
const POINT_INTERVAL_MS = 150; // neuer Messpunkt
const SETTLE_MS = 320; // Einschweben eines Punkts
const HOLD_MS = 2200; // Pause + Puls nach vollem Lauf — lang genug, um die finalen Werte zu lesen
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
  muted: string;
}

// Theme-Tokens zur Laufzeit lesen — einzige erlaubte Farbquelle für den Canvas.
// Hinweis: oklch()-Strings als fillStyle/strokeStyle werden vor 2023 (Safari <16.4,
// Chrome/Edge <111, Firefox <113) ignoriert und fallen auf Schwarz zurück — akzeptierter
// Support-Floor für den Canvas.
function readColors(el: HTMLElement): ThemeColors {
  const s = getComputedStyle(el);
  return {
    primary: s.getPropertyValue("--primary").trim(),
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

    // Ab jetzt übernimmt der Canvas — SSR-Fallback ausblenden, Insel einblenden.
    // Beide Elemente starten serverseitig überlappend (siehe Hero.astro); der
    // Wechsel passiert atomar hier, damit ohne JS nur der Fallback sichtbar bleibt.
    document.getElementById("hero-simulation-fallback")?.setAttribute("hidden", "");
    document.getElementById("hero-simulation-island")?.classList.remove("opacity-0");

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
      const baseline = height - 8;

      // Achse mit Tick-Marks — muted statt border, damit sie im Light Mode
      // nicht im Weiß verschwindet (Pass 2); Pol-Labels sind HTML unter dem Canvas.
      ctx.strokeStyle = colors.muted;
      ctx.globalAlpha = 0.4;
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
      ctx.globalAlpha = 1;

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
        ctx.arc(xFor(v), y, 3, 0, Math.PI * 2);
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
    cleanups.push(() => {
      ro.disconnect();
    });

    // Theme-Wechsel (.dark auf <html>) → Token-Farben neu lesen
    const themeObserver = new MutationObserver(() => {
      colors = readColors(canvas);
      draw(performance.now());
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    cleanups.push(() => {
      themeObserver.disconnect();
    });

    if (reduced) {
      // Fertiges Standbild: alle Punkte gesetzt, Kurve voll — keine Animation.
      shownAt = values.map(() => performance.now() - SETTLE_MS);
      phase = "hold";
      phaseStart = performance.now() - HOLD_MS; // Puls steht still bei sin(~konstant)
      setStats({ axisIndex, run: RUNS_PER_AXIS, mean: mean(values), sd: stddev(values) });
    } else {
      // Nur animieren, wenn sichtbar (Viewport + Tab)
      let isIntersecting = false;

      const io = new IntersectionObserver(
        ([entry]) => {
          isIntersecting = entry.isIntersecting;
          if (entry.isIntersecting && !document.hidden) start();
          else stop();
        },
        { threshold: 0.1 },
      );
      io.observe(canvas);
      cleanups.push(() => {
        io.disconnect();
      });

      const onVisibility = () => {
        if (document.hidden || !isIntersecting) stop();
        else start();
      };
      document.addEventListener("visibilitychange", onVisibility);
      cleanups.push(() => {
        document.removeEventListener("visibilitychange", onVisibility);
      });
    }

    return () => {
      stop();
      cleanups.forEach((fn) => {
        fn();
      });
    };
  }, []);

  const spec = AXES[stats.axisIndex];
  return (
    <div className="flex h-full flex-col justify-end">
      <canvas ref={canvasRef} className="h-52 w-full sm:h-80" aria-hidden="true" />
      <div className="text-muted-foreground mt-1 flex justify-between px-4 font-mono text-[11px]" aria-hidden="true">
        <span>{spec.left}</span>
        <span>{spec.right}</span>
      </div>
      <p className="text-muted-foreground mt-2 font-mono text-xs tabular-nums">
        {spec.left}–{spec.right} axis · run {stats.run}/{RUNS_PER_AXIS} · mean{" "}
        {stats.run > 0 ? stats.mean.toFixed(1) : "—"} · σ {stats.run > 0 ? stats.sd.toFixed(1) : "—"}
      </p>
    </div>
  );
}
