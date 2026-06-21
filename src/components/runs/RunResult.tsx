import { AlertTriangle, ArrowLeft, Clock, Globe, Lock, Sigma } from "lucide-react";
import type { AxisDistribution, RunResultView } from "@/types";
import { AxisChart, RELIABLE_MIN } from "./axis-chart";

interface Props {
  result: RunResultView;
}

/** Fehlquote als Text (`failed/total (pct %)`). */
function failureRate(failed: number, total: number): string {
  if (total <= 0) return "—";
  const pct = Math.round((failed / total) * 100);
  return `${String(failed)}/${String(total)} (${String(pct)} %)`;
}

function AxisCard({ axis }: { axis: AxisDistribution }) {
  const reliable = axis.usableCount >= RELIABLE_MIN;
  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">{axis.label}</h3>
        <span className="text-xs text-blue-100/50">{axis.usableCount} verwertbar</span>
      </div>

      {axis.usableCount === 0 ? (
        <p className="text-sm text-blue-100/50">Keine verwertbare Wiederholung für diese Achse.</p>
      ) : (
        <>
          <AxisChart
            scale={axis.scale}
            low={axis.low}
            high={axis.high}
            series={[
              { scores: axis.scores, mean: axis.mean, dotClass: "bg-purple-400", meanClass: "border-purple-300" },
            ]}
          />

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-blue-100/80">
            <span>
              Mittelwert <span className="font-medium text-white">{axis.mean?.toFixed(1)}</span>
            </span>
            <span>
              SD <span className="font-medium text-white">{axis.sd?.toFixed(2)}</span>
            </span>
            <span className="flex flex-wrap gap-2">
              {Object.entries(axis.letterCounts).map(([letter, n]) => (
                <span key={letter} className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-xs">
                  {letter} {n}×
                </span>
              ))}
            </span>
          </div>

          {reliable ? null : (
            <p className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-900/20 px-3 py-2 text-xs text-amber-200">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>Nicht belastbar — zu wenige verwertbare Läufe für eine Verteilung.</span>
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default function RunResult({ result }: Props) {
  const { run, aggregate, state } = result;

  if (state === "unfinished") {
    return (
      <div className="space-y-4">
        <p className="flex items-start gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-sm text-blue-100/70">
          <Clock className="mt-0.5 size-4 shrink-0" />
          <span>
            Dieser Lauf ist noch nicht abgeschlossen ({run.status}). Das Ergebnis erscheint, sobald alle Wiederholungen
            durchgelaufen sind.
          </span>
        </p>
        <a href="/runs" className="inline-flex items-center gap-1 text-sm text-blue-200 hover:text-white">
          <ArrowLeft className="size-4" /> Zurück zu den Läufen
        </a>
      </div>
    );
  }

  if (state === "empty" || !aggregate) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-6">
          <h2 className="flex items-center gap-2 font-semibold text-red-200">
            <AlertTriangle className="size-4" /> Keine verwertbaren Antworten
          </h2>
          <p className="mt-2 text-sm text-blue-100/70">
            Dieser Lauf lieferte keine parsebaren Wiederholungen, daher gibt es keine Verteilung. Fehlquote:{" "}
            {failureRate(run.failedCount, run.repetitionCount)}.
          </p>
        </div>
        <a href="/runs" className="inline-flex items-center gap-1 text-sm text-blue-200 hover:text-white">
          <ArrowLeft className="size-4" /> Zurück zu den Läufen
        </a>
      </div>
    );
  }

  const lowReliability = aggregate.usableReps < RELIABLE_MIN;

  return (
    <div className="space-y-6">
      {/* Typ-Stabilitäts-Panel */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm text-blue-100/60">
            <Sigma className="size-4" /> Abgeleiteter Typ über {aggregate.usableReps} verwertbare Läufe
          </h2>
          {run.visibility === "global" ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-blue-400/30 bg-blue-500/20 px-2 py-0.5 text-xs text-blue-200">
              <Globe className="size-3" />
              Global
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-xs text-blue-100/60">
              <Lock className="size-3" />
              Privat
            </span>
          )}
        </div>
        {aggregate.modalType ? (
          <div className="mt-2 flex flex-wrap items-baseline gap-3">
            <span className="font-mono text-4xl font-bold tracking-widest text-white">{aggregate.modalType}</span>
            {aggregate.typeConsistency != null ? (
              <span className="text-sm text-blue-100/70">
                Stabilität: {Math.round(aggregate.typeConsistency * 100)} % der Läufe ergeben diesen Typ
              </span>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-sm text-blue-100/70">
            Kein durchgängiger Typ — mindestens eine Achse hatte in keiner Wiederholung alle Items parsebar.
          </p>
        )}
        <p className="mt-2 text-xs text-blue-100/50">
          Fehlquote: {failureRate(run.failedCount, run.repetitionCount)} · Tokens: {run.promptTokens} ein /{" "}
          {run.completionTokens} aus
        </p>

        {lowReliability ? (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-900/20 px-3 py-2 text-sm text-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              Nicht belastbar: ein Einzeldurchlauf (oder zu wenige verwertbare Läufe) ist kein aussagekräftiges
              Dispositionsprofil. Mehr Wiederholungen erhöhen die Aussagekraft.
            </span>
          </p>
        ) : null}
      </section>

      {/* Verteilung je Achse */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Verteilung je Achse</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {aggregate.axes.map((axis) => (
            <AxisCard key={axis.key} axis={axis} />
          ))}
        </div>
      </section>

      <a href="/runs" className="inline-flex items-center gap-1 text-sm text-blue-200 hover:text-white">
        <ArrowLeft className="size-4" /> Zurück zu den Läufen
      </a>
    </div>
  );
}
