import { AlertTriangle, Equal, Scale } from "lucide-react";
import type { AxisDistribution, RunComparisonSide, RunComparisonView } from "@/types";
import { AxisChart, RELIABLE_MIN } from "./axis-chart";

interface ColorScheme {
  dot: string;
  mean: string;
  text: string;
}

// Farbzuordnung: Lauf A = purple (wie Einzelansicht), Lauf B = cyan (Kontrast,
// kollidiert nicht mit der amberfarbenen Cutoff-Linie).
const A: ColorScheme = { dot: "bg-purple-400", mean: "border-purple-300", text: "text-purple-200" };
const B: ColorScheme = { dot: "bg-cyan-300", mean: "border-cyan-200", text: "text-cyan-200" };

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
    <div className="space-y-1 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <div className="flex items-center gap-2 text-xs text-blue-100/50">
        <span className={`size-2.5 rounded-full ${color.dot}`} /> Lauf {letter}
      </div>
      <p className="font-semibold">{personaName}</p>
      <p className="text-sm text-blue-100/70">
        {modelLabel}
        {modelName ? ` (${modelName})` : ""}
      </p>
      <p className="text-xs text-blue-100/50">{new Date(result.run.createdAt).toLocaleString("de-DE")}</p>
      <p className={`font-mono text-3xl font-bold tracking-widest ${color.text}`}>{agg?.modalType ?? "—"}</p>
      {agg?.typeConsistency != null ? (
        <p className="text-xs text-blue-100/60">
          Stabilität {Math.round(agg.typeConsistency * 100)} % über {agg.usableReps} Läufe
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
      <p className="flex items-start gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-blue-100/70">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <span>Kein durchgängiger Typ in mindestens einem Lauf — ein direkter Typ-Vergleich ist nicht möglich.</span>
      </p>
    );
  }

  const same = ta === tb;
  return same ? (
    <p className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-900/20 px-4 py-3 text-sm text-emerald-200">
      <Equal className="size-4 shrink-0" />
      <span>
        Gleicher Typ: <span className="font-mono font-bold tracking-widest">{ta}</span>
      </span>
    </p>
  ) : (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-amber-400/30 bg-amber-900/20 px-4 py-3 text-sm text-amber-200">
      <Scale className="size-4 shrink-0" />
      <span>Unterschiedliche Typen —</span>
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
      <p className="flex items-center gap-1.5 text-xs text-blue-100/50">
        <span className={`size-2 rounded-full ${color.dot}`} /> Lauf {label}
      </p>
      {axis.usableCount === 0 ? (
        <p className="text-sm text-blue-100/50">keine verwertbare Wiederholung</p>
      ) : (
        <p className="text-sm text-blue-100/80">
          Mittel <span className="font-medium text-white">{axis.mean?.toFixed(1)}</span> · SD{" "}
          <span className="font-medium text-white">{axis.sd?.toFixed(2)}</span> · {axis.usableCount} verwertbar
        </p>
      )}
      {axis.usableCount > 0 && axis.usableCount < RELIABLE_MIN ? (
        <p className="text-xs text-amber-200">nicht belastbar (n &lt; {RELIABLE_MIN})</p>
      ) : null}
    </div>
  );
}

function AxisCompareCard({ axisA, axisB }: { axisA: AxisDistribution; axisB: AxisDistribution }) {
  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">{axisA.label}</h3>
        <span className="text-xs text-blue-100/60">
          Δ Mittelwert (A − B): <span className="font-medium text-white">{deltaLabel(axisA.mean, axisB.mean)}</span>
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
          <h2 className="text-lg font-semibold">Verteilung je Achse</h2>
          <div className="flex items-center gap-3 text-xs text-blue-100/60">
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
