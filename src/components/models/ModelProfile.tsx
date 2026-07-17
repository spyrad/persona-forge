import { AlertTriangle, ArrowLeft, Boxes, ShieldCheck, Sigma } from "lucide-react";
import InstrumentAttribution from "@/components/models/InstrumentAttribution";
import { AxisCard } from "@/components/runs/RunResult";
import { ATTRIBUTION_BY_KIND } from "@/lib/instruments/attribution";
import { formatDateTime } from "@/lib/runs/run-timing";
import type { ModelProfileSection, ModelProfileView } from "@/types";

/**
 * Modell-Profil (Model Compare Phase 3): rein präsentational — statisch gerendert,
 * keine Hydration (Muster `RunComparison`). Zeigt Meta-Panel + eine Sektion je
 * Instrument mit gepoolten Baseline-Verteilungen; Dünn-Daten-Hinweis unter
 * `THIN_DATA_MIN` verwertbaren Wiederholungen je Instrument (Spec).
 */

/** Schwelle des Dünn-Daten-Hinweises je Modell+Instrument (Spec: < 5). */
export const THIN_DATA_MIN = 5;

interface Props {
  profile: ModelProfileView;
}

/** Dünn-Daten-Hinweis eines Instruments (nichts rendern ab der Schwelle). */
function ThinDataHint({ usableReps }: { usableReps: number }) {
  if (usableReps >= THIN_DATA_MIN) return null;
  return (
    <p className="border-chart-2/40 bg-chart-2/10 text-chart-2 mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>
        Thin data: only {usableReps} usable repetition{usableReps === 1 ? "" : "s"} — this profile is not statistically
        meaningful yet. Run more baseline repetitions.
      </span>
    </p>
  );
}

/** OEJTS-Sektion: Typ-Panel + Achsen-Verteilungen (gepoolt über alle Baseline-Läufe). */
function OejtsSection({ section }: { section: Extract<ModelProfileSection, { kind: "oejts" }> }) {
  const { aggregate } = section;
  return (
    <section className="space-y-4">
      <div className="border-border bg-card rounded-2xl border p-6">
        <h2 className="text-muted-foreground flex items-center gap-2 font-mono text-xs tracking-[0.2em] uppercase">
          <Sigma className="size-4" /> personality (oejts) — {section.usableReps} usable reps pooled from{" "}
          {section.runCount} run{section.runCount === 1 ? "" : "s"}
        </h2>
        {aggregate.modalType ? (
          <div className="mt-2 flex flex-wrap items-baseline gap-3">
            <span className="text-foreground font-mono text-4xl font-bold tracking-widest">{aggregate.modalType}</span>
            {aggregate.typeConsistency != null ? (
              <span className="text-muted-foreground text-sm">
                Stability: {Math.round(aggregate.typeConsistency * 100)} % of repetitions yield this type
              </span>
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground mt-2 text-sm">
            No consistent type — at least one axis had no repetition where all items were parseable.
          </p>
        )}
        <ThinDataHint usableReps={section.usableReps} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {aggregate.axes.map((axis) => (
          <AxisCard key={axis.key} axis={axis} />
        ))}
      </div>
    </section>
  );
}

/** HEXACO-Sektion: dimensionales Profil (kein Typ-Code) + Achsen-Verteilungen (gepoolt). */
function HexacoSection({ section }: { section: Extract<ModelProfileSection, { kind: "hexaco" }> }) {
  const { aggregate } = section;
  return (
    <section className="space-y-4">
      <div className="border-border bg-card rounded-2xl border p-6">
        <h2 className="text-muted-foreground flex items-center gap-2 font-mono text-xs tracking-[0.2em] uppercase">
          <Sigma className="size-4" /> personality (hexaco) — {section.usableReps} usable reps pooled from{" "}
          {section.runCount} run{section.runCount === 1 ? "" : "s"}
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Six factor distributions (H/E/X/A/C/O) — dimensional, no single-type code.
        </p>
        <ThinDataHint usableReps={section.usableReps} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {aggregate.axes.map((axis) => (
          <AxisCard key={axis.key} axis={axis} />
        ))}
      </div>
    </section>
  );
}

/** Steadfastness-Sektion: Score-Panel + Strategie-Breakdown (gepoolt). */
function SteadfastnessSection({ section }: { section: Extract<ModelProfileSection, { kind: "steadfastness" }> }) {
  const { aggregate: s } = section;
  const scorePct = Math.round(s.steadfastnessScore * 100);
  return (
    <section className="border-border bg-card rounded-2xl border p-6">
      <h2 className="text-muted-foreground flex items-center gap-2 font-mono text-xs tracking-[0.2em] uppercase">
        <ShieldCheck className="size-4" /> steadfastness — {s.usableCount} usable experiments pooled from{" "}
        {section.runCount} run{section.runCount === 1 ? "" : "s"}
      </h2>
      <div className="mt-2 flex flex-wrap items-baseline gap-3">
        <span className="text-primary font-mono text-4xl font-bold tabular-nums">{scorePct} %</span>
        <span className="text-muted-foreground text-sm">
          Held <span className="text-success font-medium">{s.heldCount}</span> · Capitulated{" "}
          <span className="text-destructive font-medium">{s.capitulatedCount}</span>
          {s.avgCapitulationRound != null ? ` · ⌀ round to capitulation ${s.avgCapitulationRound.toFixed(1)}` : ""}
        </span>
      </div>
      {s.strategyBreakdown.length > 0 ? (
        <ul className="text-muted-foreground mt-3 space-y-1 text-sm">
          {s.strategyBreakdown.map((b) => (
            <li key={b.strategy} className="flex items-center justify-between">
              <span className="text-foreground">{b.strategy}</span>
              <span>{b.count}×</span>
            </li>
          ))}
        </ul>
      ) : null}
      <ThinDataHint usableReps={section.usableReps} />
    </section>
  );
}

export default function ModelProfile({ profile }: Props) {
  const { meta, sections } = profile;
  return (
    <div className="space-y-6">
      {/* Meta-Panel: was floss ein, was wurde ausgeschlossen */}
      <section className="border-border bg-card rounded-2xl border p-6">
        <h2 className="text-muted-foreground flex items-center gap-2 font-mono text-xs tracking-[0.2em] uppercase">
          <Boxes className="size-4" /> model profile — baseline runs only
        </h2>
        <p className="text-foreground mt-2 font-mono text-3xl font-bold">{meta.modelName}</p>
        <p className="text-muted-foreground mt-2 text-sm tabular-nums">
          {meta.runCount} baseline run{meta.runCount === 1 ? "" : "s"} aggregated
          {meta.excludedPersonaRuns > 0
            ? `, ${String(meta.excludedPersonaRuns)} persona run${meta.excludedPersonaRuns === 1 ? "" : "s"} excluded`
            : ""}
        </p>
        {meta.firstRunAt ? (
          <p className="text-muted-foreground mt-1 text-xs tabular-nums">
            Period: {formatDateTime(meta.firstRunAt)}
            {meta.lastRunAt && meta.lastRunAt !== meta.firstRunAt ? ` — ${formatDateTime(meta.lastRunAt)}` : ""}
          </p>
        ) : null}
        <p className="text-muted-foreground mt-1 text-xs">
          Configs: {meta.configLabels.join(", ")} · Provider{meta.providerHosts.length === 1 ? "" : "s"}:{" "}
          {meta.providerHosts.join(", ")}
          {meta.providerHosts.length > 1 ? " (mixed providers pooled)" : ""}
        </p>
      </section>

      {sections.map((section) => {
        if (section.kind === "oejts") return <OejtsSection key={section.kind} section={section} />;
        if (section.kind === "hexaco") return <HexacoSection key={section.kind} section={section} />;
        return <SteadfastnessSection key={section.kind} section={section} />;
      })}

      {/* Attribution je gezeigtem Instrument (Spec-Abnahme-Kriterium): OEJTS und/oder HEXACO */}
      <div className="space-y-1">
        {sections
          .filter(
            (s): s is Extract<ModelProfileSection, { kind: "oejts" | "hexaco" }> =>
              s.kind === "oejts" || s.kind === "hexaco",
          )
          .map((s) => (
            <InstrumentAttribution key={s.kind} attribution={ATTRIBUTION_BY_KIND[s.kind]} />
          ))}
      </div>

      <a href="/models" className="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" /> Back to model configs
      </a>
    </div>
  );
}
