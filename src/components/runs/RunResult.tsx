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

function AxisCard({ axis }: { axis: AxisDistribution }) {
  const reliable = axis.usableCount >= RELIABLE_MIN;
  return (
    <div className="border-border bg-card space-y-3 rounded-2xl border p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">{axis.label}</h3>
        <span className="text-muted-foreground text-xs">{axis.usableCount} verwertbar</span>
      </div>

      {axis.usableCount === 0 ? (
        <p className="text-muted-foreground text-sm">Keine verwertbare Wiederholung für diese Achse.</p>
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
              Mittelwert <span className="text-foreground font-medium">{axis.mean?.toFixed(1)}</span>
            </span>
            <span>
              SD <span className="text-foreground font-medium">{axis.sd?.toFixed(2)}</span>
            </span>
            <span className="flex flex-wrap gap-2">
              {Object.entries(axis.letterCounts).map(([letter, n]) => (
                <span key={letter} className="border-border bg-muted rounded-full border px-2 py-0.5 text-xs">
                  {letter} {n}×
                </span>
              ))}
            </span>
          </div>

          {reliable ? null : (
            <p className="border-chart-2/40 bg-chart-2/10 text-chart-2 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>Nicht belastbar — zu wenige verwertbare Läufe für eine Verteilung.</span>
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
        Fehler bei einzelnen Wiederholungen
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
          <AlertTriangle className="size-4" /> {failed ? "Lauf fehlgeschlagen" : `Keine verwertbaren ${itemLabel}`}
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          {failed
            ? "Dieser Lauf konnte nicht abgeschlossen werden — es gibt kein verwertbares Ergebnis."
            : `Dieser Lauf lieferte keine verwertbaren ${itemLabel}, daher gibt es kein Ergebnis. Fehlquote: ${failureRate(run.failedCount, run.repetitionCount)}.`}
        </p>
        <p className="text-muted-foreground mt-2 text-xs">Ausgeführt: {formatDateTime(timing.executedAt)}</p>
        {failures.length > 0 ? (
          <div className="mt-3">
            <FailureList failures={failures} />
          </div>
        ) : null}
      </div>
      <a href="/runs" className="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" /> Zurück zu den Läufen
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
        <h2 className="text-muted-foreground flex items-center gap-2 text-sm">
          <ShieldCheck className="size-4" /> Standhaftigkeit über {s.usableCount} verwertbare Experimente
        </h2>
        <div className="mt-2 flex flex-wrap items-baseline gap-3">
          <span className="text-primary font-mono text-4xl font-bold">{scorePct} %</span>
          <span className="text-muted-foreground text-sm">
            Gehalten <span className="text-success font-medium">{s.heldCount}</span> · Kapituliert{" "}
            <span className="text-destructive font-medium">{s.capitulatedCount}</span>
            {s.avgCapitulationRound != null ? ` · ⌀ Runde bis Einknicken ${s.avgCapitulationRound.toFixed(1)}` : ""}
          </span>
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          Ausgeführt: {formatDateTime(timing.executedAt)} · Tokens: {run.promptTokens} ein / {run.completionTokens} aus
        </p>
        {failures.length > 0 ? (
          <div className="mt-3">
            <FailureList failures={failures} />
          </div>
        ) : null}
      </section>

      {s.strategyBreakdown.length > 0 ? (
        <section className="border-border bg-card space-y-3 rounded-2xl border p-6">
          <h2 className="text-lg font-semibold">Kapitulationen je Strategie</h2>
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
        <ArrowLeft className="size-4" /> Zurück zu den Läufen
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
            Dieser Lauf ist noch nicht abgeschlossen ({run.status}). Das Ergebnis erscheint, sobald alle Wiederholungen
            durchgelaufen sind.
          </span>
        </p>
        <p className="text-muted-foreground text-xs">Ausgeführt: {formatDateTime(timing.executedAt)}</p>
        <a href="/runs" className="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-sm">
          <ArrowLeft className="size-4" /> Zurück zu den Läufen
        </a>
      </div>
    );
  }

  if (result.steadfastness) {
    if (state === "empty") {
      return <EmptyResult result={result} itemLabel="Experimente" />;
    }
    return <SteadfastnessView result={result} />;
  }

  if (state === "empty" || !aggregate) {
    return <EmptyResult result={result} itemLabel="Antworten" />;
  }

  const lowReliability = aggregate.usableReps < RELIABLE_MIN;

  return (
    <div className="space-y-6">
      {/* Typ-Stabilitäts-Panel */}
      <section className="border-border bg-card rounded-2xl border p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-muted-foreground flex items-center gap-2 text-sm">
            <Sigma className="size-4" /> Abgeleiteter Typ über {aggregate.usableReps} verwertbare Läufe
          </h2>
          {run.visibility === "global" ? (
            <span className="border-primary/30 bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
              <Globe className="size-3" />
              Global
            </span>
          ) : (
            <span className="border-border bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
              <Lock className="size-3" />
              Privat
            </span>
          )}
        </div>
        {aggregate.modalType ? (
          <div className="mt-2 flex flex-wrap items-baseline gap-3">
            <span className="text-foreground font-mono text-4xl font-bold tracking-widest">{aggregate.modalType}</span>
            {aggregate.typeConsistency != null ? (
              <span className="text-muted-foreground text-sm">
                Stabilität: {Math.round(aggregate.typeConsistency * 100)} % der Läufe ergeben diesen Typ
              </span>
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground mt-2 text-sm">
            Kein durchgängiger Typ — mindestens eine Achse hatte in keiner Wiederholung alle Items parsebar.
          </p>
        )}
        <p className="text-muted-foreground mt-2 text-xs">
          Fehlquote: {failureRate(run.failedCount, run.repetitionCount)} · Tokens: {run.promptTokens} ein /{" "}
          {run.completionTokens} aus
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          Ausgeführt: {formatDateTime(timing.executedAt)}
          {timing.wallClockMs != null
            ? ` · Dauer ${formatDuration(timing.wallClockMs)} (Modell-Zeit ${formatDuration(timing.modelMs)})`
            : ""}
          {timing.repCount > 0 && timing.avgMs != null && timing.minMs != null && timing.maxMs != null
            ? ` · ⌀ ${formatDuration(timing.avgMs)}/Rep (${formatDuration(timing.minMs)}–${formatDuration(timing.maxMs)})`
            : ""}
        </p>

        {lowReliability ? (
          <p className="border-chart-2/40 bg-chart-2/10 text-chart-2 mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              Nicht belastbar: ein Einzeldurchlauf (oder zu wenige verwertbare Läufe) ist kein aussagekräftiges
              Dispositionsprofil. Mehr Wiederholungen erhöhen die Aussagekraft.
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
        <h2 className="text-lg font-semibold">Verteilung je Achse</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {aggregate.axes.map((axis) => (
            <AxisCard key={axis.key} axis={axis} />
          ))}
        </div>
      </section>

      <a href="/runs" className="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" /> Zurück zu den Läufen
      </a>
    </div>
  );
}
