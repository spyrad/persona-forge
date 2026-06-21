/**
 * Geteilte Achsen-Chart-Primitive (S-05 Einzelansicht + S-08 Vergleich).
 *
 * Rendert eine ODER zwei Score-Serien als leichtgewichtiges CSS-Histogramm auf
 * derselben Achsen-Skala (`scale.min..max`) mit gestrichelter Cutoff-Linie, je
 * Score-Wert einer gestapelten Punktsäule und einem Mittelwert-Marker je Serie.
 * Mit genau einer Serie ist die Ausgabe deckungsgleich zur bisherigen
 * `RunResult`-Darstellung (kein Regress).
 */

import { cn } from "@/lib/utils";

/** Position eines Scores in Prozent der Achsen-Skala (0–100, geklemmt). */
export function toPct(value: number, min: number, max: number): number {
  if (max <= min) return 50;
  const pct = ((value - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, pct));
}

export interface AxisChartScale {
  min: number;
  max: number;
  cutoff: number;
}

/** Eine darzustellende Serie (ein Lauf). */
export interface AxisSeries {
  scores: number[];
  mean: number | null;
  /** Tailwind-`bg-…`-Klasse der Punkte. */
  dotClass: string;
  /** Tailwind-`border-…`-Klasse des Mittelwert-Markers. */
  meanClass: string;
}

interface Props {
  scale: AxisChartScale;
  low: string;
  high: string;
  series: AxisSeries[];
}

export function AxisChart({ scale, low, high, series }: Props) {
  const cutoffPct = toPct(scale.cutoff, scale.min, scale.max);
  const multi = series.length > 1;
  const overallMaxStack = Math.max(
    1,
    ...series.map((s) => {
      const counts = new Map<number, number>();
      for (const v of s.scores) counts.set(v, (counts.get(v) ?? 0) + 1);
      return Math.max(1, ...counts.values());
    }),
  );

  return (
    <div>
      <div className="relative h-20 rounded-lg border border-white/10 bg-white/5">
        {/* Cutoff-Linie */}
        <div
          className="absolute inset-y-0 border-l border-dashed border-amber-300/50"
          style={{ left: `${String(cutoffPct)}%` }}
        >
          <span className="absolute -top-px left-1 text-[10px] text-amber-200/70">{scale.cutoff}</span>
        </div>

        {series.map((s, si) => {
          // Punkte je distinktem Score-Wert zählen (für gestapelte Säulen).
          const counts = new Map<number, number>();
          for (const v of s.scores) counts.set(v, (counts.get(v) ?? 0) + 1);
          const maxStack = Math.max(1, ...counts.values());

          // Punktgröße gegen die dichteste Säule normieren, damit auch bei N=25
          // auf demselben Score nichts aus dem h-20-Feld (≈60px) herausragt.
          const STACK_PX = 60;
          const slotPx = Math.min(10, STACK_PX / maxStack);
          const dotPx = Math.max(2, Math.round(slotPx) - 2);
          const gapPx = Math.max(0, slotPx - dotPx);

          // Bei zwei Serien die Säulen leicht horizontal versetzen, damit
          // gleiche Scores nicht exakt überlappen; bei einer Serie zentriert
          // (deckungsgleich zur Einzelansicht).
          const nudge = multi ? (si === 0 ? -3 : 3) : 0;

          return (
            <div key={si}>
              {[...counts.entries()].map(([score, count]) => {
                const leftPct = toPct(score, scale.min, scale.max);
                return (
                  <div
                    key={score}
                    className={cn("absolute bottom-2 flex flex-col-reverse items-center", !multi && "-translate-x-1/2")}
                    style={{
                      left: `${String(leftPct)}%`,
                      gap: `${String(gapPx)}px`,
                      transform: multi ? `translateX(calc(-50% + ${String(nudge)}px))` : undefined,
                    }}
                    title={`Score ${String(score)}: ${String(count)}×`}
                  >
                    {Array.from({ length: count }).map((_, i) => (
                      <span
                        key={i}
                        className={`rounded-full ${s.dotClass}`}
                        style={{ width: `${String(dotPx)}px`, height: `${String(dotPx)}px` }}
                      />
                    ))}
                  </div>
                );
              })}

              {/* Mittelwert-Markierung dieser Serie */}
              {s.mean != null ? (
                <div
                  className={`absolute inset-y-0 border-l-2 ${s.meanClass}`}
                  style={{ left: `${String(toPct(s.mean, scale.min, scale.max))}%` }}
                  title={`Mittelwert ${s.mean.toFixed(1)}`}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Pol-Beschriftung + Skalen-Endpunkte */}
      <div className="mt-1 flex items-center justify-between text-xs text-blue-100/60">
        <span>
          {low} <span className="text-blue-100/40">({scale.min})</span>
        </span>
        <span className="text-blue-100/40">Cutoff {scale.cutoff}</span>
        <span>
          <span className="text-blue-100/40">({scale.max})</span> {high}
        </span>
      </div>
      {/* overallMaxStack normiert die Säulenhöhe (s. o.) und wird hier für AT ausgewiesen. */}
      <span className="sr-only">Maximale Häufigkeit eines Wertes: {overallMaxStack}</span>
    </div>
  );
}
