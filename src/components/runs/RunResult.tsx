import { AlertTriangle, ArrowLeft, Clock, Globe, Lock, ShieldCheck, Sigma } from "lucide-react";
import type { AxisDistribution, RunFailureSummary, RunResultView } from "@/types";
import { formatDateTime, formatDuration } from "@/lib/runs/run-timing";
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

/** Achsen-Karte (Verteilung + Kennzahlen) — auch vom Modell-Profil wiederverwendet. */
export function AxisCard({ axis }: { axis: AxisDistribution }) {
  const reliable = axis.usableCount >= RELIABLE_MIN;
  return (
    <div className="border-border bg-card space-y-3 rounded-2xl border p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-xl">{axis.label}</h3>
        <span className="text-muted-foreground text-xs tabular-nums">{axis.usableCount} usable</span>
      </div>

      {axis.usableCount === 0 ? (
        <p className="text-muted-foreground text-sm">No usable repetition for this axis.</p>
      ) : (
        <>
          <AxisChart
            scale={axis.scale}
            low={axis.low}
            high={axis.high}
            series={[{ scores: axis.scores, mean: axis.mean, dotClass: "bg-chart-1", meanClass: "border-chart-1" }]}
          />

          <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span>
              Mean <span className="text-foreground font-mono font-medium tabular-nums">{axis.mean?.toFixed(1)}</span>
            </span>
            <span>
              SD <span className="text-foreground font-mono font-medium tabular-nums">{axis.sd?.toFixed(2)}</span>
            </span>
            <span className="flex flex-wrap gap-2">
              {Object.entries(axis.letterCounts).map(([letter, n]) => (
                <span
                  key={letter}
                  className="border-border bg-muted rounded-full border px-2 py-0.5 font-mono text-xs tabular-nums"
                >
                  {letter} {n}×
                </span>
              ))}
            </span>
          </div>

          {reliable ? null : (
            <p className="border-chart-2/40 bg-chart-2/10 text-chart-2 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>Not reliable — too few usable repetitions for a distribution.</span>
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** Aggregierte Fehlerliste eines Laufs (nichts rendern, wenn leer). */
function FailureList({ failures }: { failures: RunFailureSummary[] }) {
  if (failures.length === 0) return null;
  return (
    <div className="border-destructive/30 bg-destructive/10 space-y-1.5 rounded-lg border px-3 py-2">
      <p className="text-destructive flex items-center gap-1.5 text-xs font-medium">
        <AlertTriangle className="size-3.5 shrink-0" />
        Errors in individual repetitions
      </p>
      <ul className="text-muted-foreground space-y-0.5 text-xs">
        {failures.map((f) => (
          <li key={f.message}>
            <span className="text-foreground font-medium">{f.count}×</span> {f.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Leer-Karte fuer `state === "empty"` — kind-neutral (Ueberschrift per `itemLabel`).
 * Unterscheidet einen fehlgeschlagenen Lauf (`status: "failed"`, z. B. Szenario-
 * Generierung/Modell nicht erreichbar) von „abgeschlossen, aber nichts verwertbar".
 */
function EmptyResult({ result, itemLabel }: { result: RunResultView; itemLabel: string }) {
  const { run, timing, failures } = result;
  const failed = run.status === "failed";
  return (
    <div className="space-y-4">
      <div className="border-destructive/30 bg-destructive/10 rounded-2xl border p-6">
        <h2 className="text-destructive flex items-center gap-2 font-semibold">
          <AlertTriangle className="size-4" /> {failed ? "Run failed" : `No usable ${itemLabel}`}
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          {failed
            ? "This run could not be completed — there is no usable result."
            : `This run produced no usable ${itemLabel}, so there is no result. Failure rate: ${failureRate(run.failedCount, run.repetitionCount)}.`}
        </p>
        <p className="text-muted-foreground mt-2 text-xs tabular-nums">Executed: {formatDateTime(timing.executedAt)}</p>
        {failures.length > 0 ? (
          <div className="mt-3">
            <FailureList failures={failures} />
          </div>
        ) : null}
      </div>
      <a href="/runs" className="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" /> Back to runs
      </a>
    </div>
  );
}

/** Standhaftigkeits-Ergebnis: Score-Panel + Kapitulationen je Strategie. */
function SteadfastnessView({ result }: { result: RunResultView }) {
  const { run, steadfastness: s, timing, failures } = result;
  if (!s) return null;
  const scorePct = Math.round(s.steadfastnessScore * 100);
  return (
    <div className="space-y-6">
      <section className="border-border bg-card rounded-2xl border p-6">
        <h2 className="text-muted-foreground flex items-center gap-2 font-mono text-xs tracking-[0.2em] uppercase">
          <ShieldCheck className="size-4" /> steadfastness — {s.usableCount} usable experiments
        </h2>
        <div className="mt-2 flex flex-wrap items-baseline gap-3">
          <span className="text-primary font-mono text-4xl font-bold tabular-nums">{scorePct} %</span>
          <span className="text-muted-foreground text-sm">
            Held <span className="text-success font-medium">{s.heldCount}</span> · Capitulated{" "}
            <span className="text-destructive font-medium">{s.capitulatedCount}</span>
            {s.avgCapitulationRound != null ? ` · ⌀ round to capitulation ${s.avgCapitulationRound.toFixed(1)}` : ""}
          </span>
        </div>
        <p className="text-muted-foreground mt-2 text-xs tabular-nums">
          Executed: {formatDateTime(timing.executedAt)} · Tokens: {run.promptTokens} in / {run.completionTokens} out
        </p>
        {failures.length > 0 ? (
          <div className="mt-3">
            <FailureList failures={failures} />
          </div>
        ) : null}
      </section>

      {s.strategyBreakdown.length > 0 ? (
        <section className="border-border bg-card space-y-3 rounded-2xl border p-6">
          <h2 className="font-display text-2xl">Capitulations by strategy</h2>
          <ul className="text-muted-foreground space-y-1 text-sm">
            {s.strategyBreakdown.map((b) => (
              <li key={b.strategy} className="flex items-center justify-between">
                <span className="text-foreground">{b.strategy}</span>
                <span>{b.count}×</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <a href="/runs" className="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" /> Back to runs
      </a>
    </div>
  );
}

export default function RunResult({ result }: Props) {
  const { run, aggregate, state, timing, failures } = result;

  if (state === "unfinished") {
    return (
      <div className="space-y-4">
        <p className="border-border bg-card text-muted-foreground flex items-start gap-2 rounded-2xl border px-4 py-5 text-sm">
          <Clock className="mt-0.5 size-4 shrink-0" />
          <span>
            This run isn&apos;t finished yet ({run.status}). The result will appear once all repetitions have completed.
          </span>
        </p>
        <p className="text-muted-foreground text-xs tabular-nums">Executed: {formatDateTime(timing.executedAt)}</p>
        <a href="/runs" className="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-sm">
          <ArrowLeft className="size-4" /> Back to runs
        </a>
      </div>
    );
  }

  if (result.steadfastness) {
    if (state === "empty") {
      return <EmptyResult result={result} itemLabel="experiments" />;
    }
    return <SteadfastnessView result={result} />;
  }

  if (state === "empty" || !aggregate) {
    return <EmptyResult result={result} itemLabel="answers" />;
  }

  const lowReliability = aggregate.usableReps < RELIABLE_MIN;

  return (
    <div className="space-y-6">
      {/* Typ-Stabilitäts-Panel */}
      <section className="border-border bg-card rounded-2xl border p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-muted-foreground flex items-center gap-2 font-mono text-xs tracking-[0.2em] uppercase">
            <Sigma className="size-4" /> derived type — {aggregate.usableReps} usable runs
          </h2>
          {run.visibility === "global" ? (
            <span className="border-primary/30 bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
              <Globe className="size-3" />
              Global
            </span>
          ) : (
            <span className="border-border bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
              <Lock className="size-3" />
              Private
            </span>
          )}
        </div>
        {aggregate.modalType ? (
          <div className="mt-2 flex flex-wrap items-baseline gap-3">
            <span className="text-foreground font-mono text-4xl font-bold tracking-widest">{aggregate.modalType}</span>
            {aggregate.typeConsistency != null ? (
              <span className="text-muted-foreground text-sm">
                Stability: {Math.round(aggregate.typeConsistency * 100)} % of runs yield this type
              </span>
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground mt-2 text-sm">
            No consistent type — at least one axis had no repetition where all items were parseable.
          </p>
        )}
        <p className="text-muted-foreground mt-2 text-xs tabular-nums">
          Failure rate: {failureRate(run.failedCount, run.repetitionCount)} · Tokens: {run.promptTokens} in /{" "}
          {run.completionTokens} out
        </p>
        <p className="text-muted-foreground mt-1 text-xs tabular-nums">
          Executed: {formatDateTime(timing.executedAt)}
          {timing.wallClockMs != null
            ? ` · duration ${formatDuration(timing.wallClockMs)} (model time ${formatDuration(timing.modelMs)})`
            : ""}
          {timing.repCount > 0 && timing.avgMs != null && timing.minMs != null && timing.maxMs != null
            ? ` · ⌀ ${formatDuration(timing.avgMs)}/rep (${formatDuration(timing.minMs)}–${formatDuration(timing.maxMs)})`
            : ""}
        </p>

        {lowReliability ? (
          <p className="border-chart-2/40 bg-chart-2/10 text-chart-2 mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              Not reliable: a single pass (or too few usable runs) is not a meaningful disposition profile. More
              repetitions increase reliability.
            </span>
          </p>
        ) : null}

        {failures.length > 0 ? (
          <div className="mt-3">
            <FailureList failures={failures} />
          </div>
        ) : null}
      </section>

      {/* Verteilung je Achse */}
      <section className="space-y-4">
        <h2 className="font-display text-2xl">Distribution per axis</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {aggregate.axes.map((axis) => (
            <AxisCard key={axis.key} axis={axis} />
          ))}
        </div>
      </section>

      <a href="/runs" className="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" /> Back to runs
      </a>
    </div>
  );
}
