/**
 * Reine, deterministische Scoring-Funktionen fuer OEJTS (S-05):
 *   - scoreAxes:  geparste Item-Werte EINER Wiederholung → Achsen-Score je Achse.
 *   - deriveType: Achsen-Scores → 4-Buchstaben-Typ (oder null bei Luecke).
 *   - axisScale:  Skalengrenzen (min/max/cutoff) je Achse fuer die Visualisierung.
 *
 * Scoring (Instrument-Header `oejts.ts`): score(Achse) = constant + Σ(sign · value);
 * > cutoff → high-Pol, sonst low-Pol. Achsen-weiser Dropout: ist EIN Item einer
 * Achse unparsed (value null/fehlend), liefert die Achse `null` — kein erfundener
 * Wert (Ehrlichkeits-Guardrail). Bewusst frei von I/O — unit-testbar.
 */
import type { Instrument, ItemValue } from "@/types";

/** Skalengrenzen einer Achse (aus den Item-Vorzeichen-Extrema hergeleitet). */
export interface AxisScale {
  min: number;
  max: number;
  cutoff: number;
}

/**
 * Berechnet je Achse `constant + Σ(sign · value)` ueber ihre Items. Ist ein Item
 * der Achse unparsed (value `null`) oder fehlt es in der Wertemenge, liefert die
 * Achse `null` (Dropout) — die anderen Achsen bleiben unberuehrt.
 */
export function scoreAxes(values: ItemValue[], instrument: Instrument): Record<string, number | null> {
  const valueById = new Map<string, number | null>();
  for (const v of values) valueById.set(v.id, v.status === "ok" ? v.value : null);

  const result: Record<string, number | null> = {};
  for (const axis of instrument.axes) {
    const items = instrument.items.filter((it) => it.axis === axis.key);
    let sum = axis.constant;
    let dropped = false;
    for (const it of items) {
      const value = valueById.get(it.id);
      if (value == null) {
        dropped = true;
        break;
      }
      sum += it.sign * value;
    }
    result[axis.key] = dropped ? null : sum;
  }
  return result;
}

/**
 * Leitet den Buchstaben-Typ aus den Achsen-Scores ab (Buchstaben-Reihenfolge =
 * Achsen-Reihenfolge des Instruments). `score > midpoint` → `high`, sonst `low`. Ist
 * EINE Achse `null` (Dropout) oder traegt das Instrument keine Modaltyp-Pole
 * (`hasModalType` falsy bzw. `high`/`low` fehlen, z. B. HEXACO), gibt es keinen Typ → `null`.
 */
export function deriveType(axisScores: Record<string, number | null>, instrument: Instrument): string | null {
  if (instrument.hasModalType !== true) return null;
  let type = "";
  for (const axis of instrument.axes) {
    const score = axisScores[axis.key];
    if (score == null || axis.high == null || axis.low == null) return null;
    type += score > axis.midpoint ? axis.high : axis.low;
  }
  return type;
}

/**
 * Skalengrenzen je Achse aus den Item-Vorzeichen-Extrema: jedes Item traegt
 * `sign·1`/`sign·5` als Extreme bei; `min = constant + Σ min_i`,
 * `max = constant + Σ max_i`. Bewusst je Achse berechnet (die Konstanten
 * verschieben die Skala) statt global `8..40` anzunehmen. `cutoff` traegt den
 * `midpoint` der Achse (Chart-Referenzlinie; Feldname bleibt stabil, P2).
 */
export function axisScale(axisKey: string, instrument: Instrument): AxisScale {
  const axis = instrument.axes.find((a) => a.key === axisKey);
  if (!axis) throw new Error(`axisScale: unknown axis ${axisKey}`);
  let min = axis.constant;
  let max = axis.constant;
  for (const it of instrument.items.filter((i) => i.axis === axisKey)) {
    const lo = it.sign * 1;
    const hi = it.sign * 5;
    min += Math.min(lo, hi);
    max += Math.max(lo, hi);
  }
  return { min, max, cutoff: axis.midpoint };
}
