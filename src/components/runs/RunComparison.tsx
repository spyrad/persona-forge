import { AlertTriangle, Equal, Scale } from "lucide-react";
import type { AxisDistribution, RunComparisonSide, RunComparisonView } from "@/types";
import { AxisChart, RELIABLE_MIN } from "./axis-chart";
import { formatDateTime } from "@/lib/runs/run-timing";

interface ColorScheme {
  dot: string;
  mean: string;
  text: string;
}

// Farbzuordnung: Lauf A = Teal (chart-1, wie Einzelansicht), Lauf B = Amber
// (chart-2, Kontrast). Die Cutoff-Linie ist neutral/gestrichelt — keine Kollision.
const A: ColorScheme = { dot: "bg-chart-1", mean: "border-chart-1", text: "text-chart-1" };
const B: ColorScheme = { dot: "bg-chart-2", mean: "border-chart-2", text: "text-chart-2" };

/** Mittelwert-Delta mit explizitem Vorzeichen, oder „—" wenn eine Seite leer ist. */
function deltaLabel(a: number | null, b: number | null): string {
  if (a == null || b == null) return "—";
  const d = a - b;
  return `${d > 0 ? "+" : ""}${d.toFixed(1)}`;
}

function SideHeader({ side, letter, color }: { side: RunComparisonSide; letter: "A" | "B"; color: ColorScheme }) {
  const { result, personaName, modelLabel, modelName } = side;
  const agg = result.aggregate;
  return (
    <div className="border-border bg-card space-y-1 rounded-2xl border p-5">
      <div className="text-muted-foreground flex items-center gap-2 font-mono text-xs tracking-[0.2em] uppercase">
        <span className={`size-2.5 rounded-full ${color.dot}`} /> Run {letter}
      </div>
      <p className="font-semibold">{personaName}</p>
      <p className="text-muted-foreground text-sm">
        {modelLabel}
        {modelName ? ` (${modelName})` : ""}
      </p>
      <p className="text-muted-foreground text-xs tabular-nums">{formatDateTime(result.run.createdAt)}</p>
      <p className={`font-mono text-3xl font-bold tracking-widest ${color.text}`}>{agg?.modalType ?? "—"}</p>
      {agg?.typeConsistency != null ? (
        <p className="text-muted-foreground text-xs tabular-nums">
          Stability {Math.round(agg.typeConsistency * 100)} % across {agg.usableReps} runs
        </p>
      ) : null}
    </div>
  );
}

function TypeBanner({ view }: { view: RunComparisonView }) {
  const ta = view.a.result.aggregate?.modalType ?? null;
  const tb = view.b.result.aggregate?.modalType ?? null;

  if (!ta || !tb) {
    return (
      <p className="border-border bg-card text-muted-foreground flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <span>No consistent type in at least one run — a direct type comparison is not possible.</span>
      </p>
    );
  }

  const same = ta === tb;
  return same ? (
    <p className="border-success/30 bg-success/10 text-success flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm">
      <Equal className="size-4 shrink-0" />
      <span>
        Same type: <span className="font-mono font-bold tracking-widest">{ta}</span>
      </span>
    </p>
  ) : (
    <p className="border-chart-2/40 bg-chart-2/10 text-chart-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border px-4 py-3 text-sm">
      <Scale className="size-4 shrink-0" />
      <span>Different types —</span>
      <span>
        A: <span className={`font-mono font-bold tracking-widest ${A.text}`}>{ta}</span>
      </span>
      <span>
        B: <span className={`font-mono font-bold tracking-widest ${B.text}`}>{tb}</span>
      </span>
    </p>
  );
}

/** Mittelwert/SD/Reliabilität einer Seite je Achse. */
function SideStats({ axis, label, color }: { axis: AxisDistribution; label: string; color: ColorScheme }) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground flex items-center gap-1.5 font-mono text-xs tracking-[0.2em] uppercase">
        <span className={`size-2 rounded-full ${color.dot}`} /> Run {label}
      </p>
      {axis.usableCount === 0 ? (
        <p className="text-muted-foreground text-sm">no usable repetition</p>
      ) : (
        <p className="text-muted-foreground text-sm tabular-nums">
          Mean <span className="text-foreground font-medium">{axis.mean?.toFixed(1)}</span> · SD{" "}
          <span className="text-foreground font-medium">{axis.sd?.toFixed(2)}</span> · {axis.usableCount} usable
        </p>
      )}
      {axis.usableCount > 0 && axis.usableCount < RELIABLE_MIN ? (
        <p className="text-chart-2 text-xs">not reliable (n &lt; {RELIABLE_MIN})</p>
      ) : null}
    </div>
  );
}

function AxisCompareCard({ axisA, axisB }: { axisA: AxisDistribution; axisB: AxisDistribution }) {
  return (
    <div className="border-border bg-card space-y-3 rounded-2xl border p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-xl">{axisA.label}</h3>
        <span className="text-muted-foreground text-xs">
          Δ mean (A − B):{" "}
          <span className="text-foreground font-mono font-medium tabular-nums">
            {deltaLabel(axisA.mean, axisB.mean)}
          </span>
        </span>
      </div>

      <AxisChart
        scale={axisA.scale}
        low={axisA.low}
        high={axisA.high}
        series={[
          { scores: axisA.scores, mean: axisA.mean, dotClass: A.dot, meanClass: A.mean },
          { scores: axisB.scores, mean: axisB.mean, dotClass: B.dot, meanClass: B.mean },
        ]}
      />

      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <SideStats axis={axisA} label="A" color={A} />
        <SideStats axis={axisB} label="B" color={B} />
      </div>
    </div>
  );
}

export default function RunComparison({ view }: { view: RunComparisonView }) {
  const { a, b } = view;
  const axesA = a.result.aggregate?.axes ?? [];
  const axesB = b.result.aggregate?.axes ?? [];

  return (
    <div className="space-y-6">
      {/* Köpfe beider Läufe */}
      <section className="grid gap-4 sm:grid-cols-2">
        <SideHeader side={a} letter="A" color={A} />
        <SideHeader side={b} letter="B" color={B} />
      </section>

      <TypeBanner view={view} />

      {/* Verteilung je Achse — überlagert */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-2xl">Distribution per axis</h2>
          <div className="text-muted-foreground flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5">
              <span className={`size-2.5 rounded-full ${A.dot}`} /> {a.personaName}
            </span>
            <span className="flex items-center gap-1.5">
              <span className={`size-2.5 rounded-full ${B.dot}`} /> {b.personaName}
            </span>
          </div>
        </div>
        <div className="space-y-4">
          {axesA.map((axisA) => {
            const axisB = axesB.find((x) => x.key === axisA.key);
            return axisB ? <AxisCompareCard key={axisA.key} axisA={axisA} axisB={axisB} /> : null;
          })}
        </div>
      </section>
    </div>
  );
}
