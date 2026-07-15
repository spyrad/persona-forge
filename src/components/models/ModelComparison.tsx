import { AlertTriangle, Boxes, ShieldCheck, Sigma } from "lucide-react";
import { AxisChart } from "@/components/runs/axis-chart";
import { THIN_DATA_MIN } from "@/components/models/ModelProfile";
import OejtsAttribution from "@/components/models/OejtsAttribution";
import { formatDateTime } from "@/lib/runs/run-timing";
import type { ModelCompareView, ModelProfileSection, ModelProfileView } from "@/types";

/**
 * Modell-Vergleich (Model Compare Phase 4): rein präsentational — statisch
 * gerendert, keine Hydration (Muster `RunComparison`/`ModelProfile`). Zeigt
 * 2–4 Profile nebeneinander: Meta-Kopf je Spalte, je Instrument eine Sektion
 * mit überlagerten Achsen-Verteilungen (OEJTS) bzw. Score-Karten
 * (Steadfastness); Modelle ohne Daten im Instrument erscheinen als Empty-State.
 */

interface ColorScheme {
  dot: string;
  mean: string;
  text: string;
}

// Serien-Farben in Spaltenreihenfolge: chart-1 (Teal) und chart-2 (Amber) wie
// im Lauf-Vergleich, chart-3/chart-4 für die dritte/vierte Spalte.
const COLORS: ColorScheme[] = [
  { dot: "bg-chart-1", mean: "border-chart-1", text: "text-chart-1" },
  { dot: "bg-chart-2", mean: "border-chart-2", text: "text-chart-2" },
  { dot: "bg-chart-3", mean: "border-chart-3", text: "text-chart-3" },
  { dot: "bg-chart-4", mean: "border-chart-4", text: "text-chart-4" },
];

/** Farbe einer Spalte (Index ist durch die Routen-Kappung auf 4 begrenzt). */
function colorAt(index: number): ColorScheme {
  return COLORS[index % COLORS.length];
}

/** Grid-Spaltenklasse je Profil-Anzahl (statisch, damit Tailwind sie sieht). */
function columnsClass(count: number): string {
  if (count === 2) return "sm:grid-cols-2";
  if (count === 3) return "sm:grid-cols-2 lg:grid-cols-3";
  return "sm:grid-cols-2 lg:grid-cols-4";
}

/** Meta-Kopf einer Spalte: Modellname + Datenbasis (analog `ModelProfile`-Meta-Panel, kompakt). */
function ColumnHeader({ profile, color }: { profile: ModelProfileView; color: ColorScheme }) {
  const { meta } = profile;
  return (
    <div className="border-border bg-card space-y-1 rounded-2xl border p-5">
      <div className="text-muted-foreground flex items-center gap-2 font-mono text-xs tracking-[0.2em] uppercase">
        <span className={`size-2.5 rounded-full ${color.dot}`} /> model
      </div>
      <p className="text-foreground font-mono text-xl font-bold break-all">{meta.modelName}</p>
      <p className="text-muted-foreground text-sm tabular-nums">
        {meta.runCount} baseline run{meta.runCount === 1 ? "" : "s"}
        {meta.excludedPersonaRuns > 0 ? ` · ${String(meta.excludedPersonaRuns)} persona excluded` : ""}
      </p>
      {meta.firstRunAt ? (
        <p className="text-muted-foreground text-xs tabular-nums">
          {formatDateTime(meta.firstRunAt)}
          {meta.lastRunAt && meta.lastRunAt !== meta.firstRunAt ? ` — ${formatDateTime(meta.lastRunAt)}` : ""}
        </p>
      ) : null}
      <p className="text-muted-foreground text-xs">
        {meta.configLabels.join(", ")} · {meta.providerHosts.join(", ")}
        {meta.providerHosts.length > 1 ? " (mixed)" : ""}
      </p>
    </div>
  );
}

/** OEJTS-Sektion eines Profils, falls vorhanden. */
function oejtsSection(profile: ModelProfileView): Extract<ModelProfileSection, { kind: "oejts" }> | undefined {
  return profile.sections.find((s): s is Extract<ModelProfileSection, { kind: "oejts" }> => s.kind === "oejts");
}

/** Steadfastness-Sektion eines Profils, falls vorhanden. */
function steadfastnessSection(
  profile: ModelProfileView,
): Extract<ModelProfileSection, { kind: "steadfastness" }> | undefined {
  return profile.sections.find(
    (s): s is Extract<ModelProfileSection, { kind: "steadfastness" }> => s.kind === "steadfastness",
  );
}

/** Typ-Panel je Modell: modaler Typ + Stabilität, Dünn-Daten-Marker unter der Schwelle. */
function OejtsTypePanel({
  profile,
  section,
  color,
}: {
  profile: ModelProfileView;
  section: Extract<ModelProfileSection, { kind: "oejts" }> | undefined;
  color: ColorScheme;
}) {
  return (
    <div className="border-border bg-card space-y-1 rounded-2xl border p-5">
      <p className="text-muted-foreground flex items-center gap-1.5 font-mono text-xs tracking-[0.2em] uppercase">
        <span className={`size-2 rounded-full ${color.dot}`} /> {profile.meta.modelName}
      </p>
      {section ? (
        <>
          <p className={`font-mono text-3xl font-bold tracking-widest ${color.text}`}>
            {section.aggregate.modalType ?? "—"}
          </p>
          <p className="text-muted-foreground text-xs tabular-nums">
            {section.aggregate.typeConsistency != null
              ? `Stability ${String(Math.round(section.aggregate.typeConsistency * 100))} % · `
              : ""}
            {section.usableReps} usable reps from {section.runCount} run{section.runCount === 1 ? "" : "s"}
          </p>
          {section.usableReps < THIN_DATA_MIN ? (
            <p className="text-chart-2 flex items-center gap-1 text-xs">
              <AlertTriangle className="size-3.5 shrink-0" /> thin data (&lt; {THIN_DATA_MIN} reps)
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-muted-foreground text-sm">No OEJTS baseline data for this model.</p>
      )}
    </div>
  );
}

/** Überlagerte OEJTS-Achsen-Verteilungen aller Modelle mit Daten. */
function OejtsCompare({ profiles }: { profiles: ModelProfileView[] }) {
  // Spaltenfarbe folgt der Profil-Position — Modelle ohne OEJTS-Daten behalten
  // ihre Farbe im Typ-Panel, tauchen in den Charts aber nicht auf.
  const withData = profiles
    .map((profile, index) => ({ profile, section: oejtsSection(profile), color: colorAt(index) }))
    .filter((e): e is typeof e & { section: NonNullable<ReturnType<typeof oejtsSection>> } => e.section != null);
  if (withData.length === 0) return null;

  // Achsen-Referenz: erstes Modell mit Daten; alle OEJTS-Aggregate teilen
  // dieselbe Instrument-Definition (Match per key wie `RunComparison`).
  const referenceAxes = withData[0]?.section.aggregate.axes ?? [];

  return (
    <section className="space-y-4">
      <h2 className="font-display text-2xl">Distribution per axis</h2>
      <div className="space-y-4">
        {referenceAxes.map((referenceAxis) => {
          const series = withData.flatMap((e) => {
            const axis = e.section.aggregate.axes.find((x) => x.key === referenceAxis.key);
            return axis
              ? [{ scores: axis.scores, mean: axis.mean, dotClass: e.color.dot, meanClass: e.color.mean }]
              : [];
          });
          const stats = withData.flatMap((e) => {
            const axis = e.section.aggregate.axes.find((x) => x.key === referenceAxis.key);
            return axis ? [{ modelName: e.profile.meta.modelName, axis, color: e.color }] : [];
          });
          return (
            <div key={referenceAxis.key} className="border-border bg-card space-y-3 rounded-2xl border p-5">
              <h3 className="font-display text-xl">{referenceAxis.label}</h3>
              <AxisChart
                scale={referenceAxis.scale}
                low={referenceAxis.low}
                high={referenceAxis.high}
                series={series}
              />
              <div className={`grid gap-x-4 gap-y-2 ${columnsClass(stats.length)}`}>
                {stats.map(({ modelName, axis, color }) => (
                  <div key={modelName} className="space-y-1">
                    <p className="text-muted-foreground flex items-center gap-1.5 truncate font-mono text-xs">
                      <span className={`size-2 shrink-0 rounded-full ${color.dot}`} /> {modelName}
                    </p>
                    {axis.usableCount === 0 ? (
                      <p className="text-muted-foreground text-sm">no usable repetition</p>
                    ) : (
                      <p className="text-muted-foreground text-sm tabular-nums">
                        Mean <span className="text-foreground font-medium">{axis.mean?.toFixed(1)}</span> · SD{" "}
                        <span className="text-foreground font-medium">{axis.sd?.toFixed(2)}</span> · {axis.usableCount}{" "}
                        usable
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Steadfastness nebeneinander: Score-Karte je Modell (Empty-State ohne Daten). */
function SteadfastnessCompare({ profiles }: { profiles: ModelProfileView[] }) {
  // Nur rendern, wenn mindestens ein Modell Steadfastness-Daten hat.
  if (!profiles.some((p) => steadfastnessSection(p))) return null;
  return (
    <section className="space-y-4">
      <h2 className="text-muted-foreground flex items-center gap-2 font-mono text-xs tracking-[0.2em] uppercase">
        <ShieldCheck className="size-4" /> steadfastness
      </h2>
      <div className={`grid gap-4 ${columnsClass(profiles.length)}`}>
        {profiles.map((profile, index) => {
          const section = steadfastnessSection(profile);
          const color = colorAt(index);
          return (
            <div key={profile.meta.modelName} className="border-border bg-card space-y-1 rounded-2xl border p-5">
              <p className="text-muted-foreground flex items-center gap-1.5 truncate font-mono text-xs">
                <span className={`size-2 shrink-0 rounded-full ${color.dot}`} /> {profile.meta.modelName}
              </p>
              {section ? (
                <>
                  <p className={`font-mono text-3xl font-bold tabular-nums ${color.text}`}>
                    {Math.round(section.aggregate.steadfastnessScore * 100)} %
                  </p>
                  <p className="text-muted-foreground text-xs tabular-nums">
                    Held <span className="text-success font-medium">{section.aggregate.heldCount}</span> · Capitulated{" "}
                    <span className="text-destructive font-medium">{section.aggregate.capitulatedCount}</span> ·{" "}
                    {section.usableReps} usable from {section.runCount} run{section.runCount === 1 ? "" : "s"}
                  </p>
                  {section.usableReps < THIN_DATA_MIN ? (
                    <p className="text-chart-2 flex items-center gap-1 text-xs">
                      <AlertTriangle className="size-3.5 shrink-0" /> thin data (&lt; {THIN_DATA_MIN})
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-muted-foreground text-sm">No steadfastness baseline data.</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function ModelComparison({ view }: { view: ModelCompareView }) {
  const { profiles } = view;
  const hasOejts = profiles.some((p) => oejtsSection(p));
  return (
    <div className="space-y-6">
      {/* Meta-Köpfe aller Modelle */}
      <section className={`grid gap-4 ${columnsClass(profiles.length)}`}>
        {profiles.map((profile, index) => (
          <ColumnHeader key={profile.meta.modelName} profile={profile} color={colorAt(index)} />
        ))}
      </section>

      {hasOejts ? (
        <section className="space-y-4">
          <h2 className="text-muted-foreground flex items-center gap-2 font-mono text-xs tracking-[0.2em] uppercase">
            <Sigma className="size-4" /> personality (oejts)
          </h2>
          <div className={`grid gap-4 ${columnsClass(profiles.length)}`}>
            {profiles.map((profile, index) => (
              <OejtsTypePanel
                key={profile.meta.modelName}
                profile={profile}
                section={oejtsSection(profile)}
                color={colorAt(index)}
              />
            ))}
          </div>
          <OejtsCompare profiles={profiles} />
        </section>
      ) : (
        <p className="text-muted-foreground flex items-start gap-2 text-sm">
          <Boxes className="mt-0.5 size-4 shrink-0" /> None of the selected models has OEJTS baseline data.
        </p>
      )}

      <SteadfastnessCompare profiles={profiles} />

      {/* Attribution (Spec-Abnahme-Kriterium), sobald OEJTS-Ergebnisse gezeigt werden */}
      {hasOejts ? <OejtsAttribution /> : null}
    </div>
  );
}
