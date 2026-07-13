import { useState } from "react";
import { GitCompare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COMPARE_MAX, COMPARE_MIN } from "@/lib/models/compare-params";
import type { ModelProfileListItem } from "@/types";

/**
 * Einstieg in Profil + Vergleich (Model Compare Phase 4.1): rendert die
 * Modell-Karten der `/models`-Profil-Sektion als Insel mit Vergleichs-Auswahl
 * (Checkbox-Muster analog Run-Liste, Cap `COMPARE_MAX`). Der Compare-Button
 * baut `/models/compare?m=a&m=b…` und aktiviert sich ab `COMPARE_MIN`.
 */

interface Props {
  items: ModelProfileListItem[];
}

/** Navigiert zur Vergleichsseite (Multi-Param `?m=`, Namen URL-encodiert). */
function navigateToCompare(modelNames: string[]) {
  const query = modelNames.map((n) => `m=${encodeURIComponent(n)}`).join("&");
  window.location.href = `/models/compare?${query}`;
}

export default function ModelProfilePicker({ items }: Props) {
  // Geordnete Auswahl von Modellnamen (Reihenfolge = Spaltenreihenfolge im Vergleich).
  const [selected, setSelected] = useState<string[]>([]);

  /** Schaltet ein Modell in der Vergleichs-Auswahl an/aus (Cap COMPARE_MAX). */
  function toggleSelected(modelName: string) {
    setSelected((prev) => {
      if (prev.includes(modelName)) return prev.filter((n) => n !== modelName);
      if (prev.length >= COMPARE_MAX) return prev;
      return [...prev, modelName];
    });
  }

  return (
    <div className="space-y-4">
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <li
            key={item.modelName}
            className="border-border bg-card hover:border-primary/40 rounded-2xl border p-4 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <a href={`/models/profile?m=${encodeURIComponent(item.modelName)}`} className="group min-w-0">
                <span className="text-foreground group-hover:text-primary font-mono font-semibold break-all transition-colors">
                  {item.modelName}
                </span>
                <span className="text-muted-foreground mt-1 block text-xs tabular-nums">
                  {item.runCount} baseline run{item.runCount === 1 ? "" : "s"} · {item.usableReps} usable reps ·{" "}
                  {item.instruments.join(", ")}
                </span>
              </a>
              {/* Vergleichs-Haken (Muster Run-Liste): gesperrt, sobald COMPARE_MAX andere gewaehlt sind. */}
              <label
                className="border-border bg-muted hover:bg-accent inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors has-disabled:cursor-not-allowed has-disabled:opacity-40"
                title={`Select for comparison (max. ${String(COMPARE_MAX)})`}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(item.modelName)}
                  disabled={selected.length >= COMPARE_MAX && !selected.includes(item.modelName)}
                  onChange={() => {
                    toggleSelected(item.modelName);
                  }}
                  className="accent-primary size-3.5"
                />
                <GitCompare className="size-3.5" />
                Compare
              </label>
            </div>
          </li>
        ))}
      </ul>

      {/* Randfall-Hinweis (Plan 4.3): mit nur einem Modell mit Daten ist kein Vergleich moeglich. */}
      {items.length === 1 ? (
        <p className="text-muted-foreground text-xs">
          Comparison needs at least {COMPARE_MIN} models with baseline data — run a baseline for another model first.
        </p>
      ) : null}

      {/* Sticky Vergleichs-Leiste (Muster Run-Liste): erscheint ab einer Auswahl,
          der Button aktiviert sich ab COMPARE_MIN Modellen. */}
      {selected.length > 0 ? (
        <div className="border-primary/30 bg-muted sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3">
          <span className="text-muted-foreground text-sm tabular-nums">
            {selected.length < COMPARE_MIN
              ? `${String(selected.length)} model selected — select at least ${String(COMPARE_MIN)} to compare.`
              : `${String(selected.length)} models selected — ready to compare (max. ${String(COMPARE_MAX)}).`}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setSelected([]);
              }}
              className="border-border bg-muted text-foreground hover:bg-accent"
            >
              Clear selection
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={selected.length < COMPARE_MIN}
              onClick={() => {
                navigateToCompare(selected);
              }}
            >
              <GitCompare className="size-3.5" />
              Compare
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
