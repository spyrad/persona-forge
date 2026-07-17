/**
 * Reine, deterministische Aggregation eines OEJTS-Laufs (S-05):
 * verdichtet die geparsten Wiederholungen je Achse zu einer Verteilung
 * (Mittelwert, Populations-SD, Roh-Verteilung, Buchstaben-Haeufigkeit,
 * Beitragszahl) und leitet die laufweite Typ-Stabilitaet ab (Modaltyp +
 * Konsistenz). Eingabe sind die Wiederholungen, kein DB-Zugriff — unit-testbar.
 *
 * Methodik:
 *   - Achsen-weiser Dropout (via `scoreAxes`): eine Wiederholung traegt zu einer
 *     Achse nur bei, wenn alle ihre Items geparst sind; `usableCount` je Achse.
 *   - Modaltyp = je Achse der haeufigere Pol-Buchstabe ueber die beitragenden
 *     Wiederholungen. Tie-Break bei Gleichstand: der Pol, auf dessen Seite der
 *     mittlere Score relativ zum Cutoff faellt (> cutoff → high), sonst low —
 *     deterministisch.
 *   - Typ-Konsistenz = Anteil der Wiederholungen mit vollstaendigem Typ, die exakt
 *     dem Modaltyp entsprechen (Nenner = Wiederholungen mit vollstaendigem Typ).
 */
import { axisScale, deriveType, scoreAxes } from "@/lib/runs/oejts-score";
import type { AxisDistribution, Instrument, RunAggregate, RunRepetition } from "@/types";

/** Populations-Standardabweichung (durch n; SD=0 bei n=1 wohldefiniert). */
function populationStdDev(scores: number[], mean: number): number {
  if (scores.length === 0) return 0;
  const variance = scores.reduce((acc, x) => acc + (x - mean) ** 2, 0) / scores.length;
  return Math.sqrt(variance);
}

/**
 * Aggregiert die Wiederholungen eines Laufs zu Achsen-Verteilungen + Typ-Stabilitaet.
 * Nur Wiederholungen mit vorhandenen `item_values` werden gewertet; der Dropout
 * (in `scoreAxes`) entscheidet je Achse, ob die Wiederholung beitraegt.
 */
export function aggregateRun(reps: Pick<RunRepetition, "item_values">[], instrument: Instrument): RunAggregate {
  // Achsen-Scores je verwertbarer Wiederholung (mit Dropout).
  const perRepScores: Record<string, number | null>[] = [];
  for (const rep of reps) {
    if (!rep.item_values) continue;
    perRepScores.push(scoreAxes(rep.item_values, instrument));
  }

  // Modaltyp-Pole nur bei `hasModalType`-Instrumenten (OEJTS); Likert-Instrumente
  // (HEXACO) liefern leere Buchstaben + leere letterCounts — rein dimensional.
  const wantsType = instrument.hasModalType === true;

  const axes: AxisDistribution[] = instrument.axes.map((axis) => {
    const scores: number[] = [];
    for (const s of perRepScores) {
      const v = s[axis.key];
      if (v != null) scores.push(v);
    }
    const letterCounts: Record<string, number> = {};
    if (wantsType && axis.high != null && axis.low != null) {
      for (const score of scores) {
        const letter = score > axis.midpoint ? axis.high : axis.low;
        letterCounts[letter] = (letterCounts[letter] ?? 0) + 1;
      }
    }
    const mean = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const sd = mean != null ? populationStdDev(scores, mean) : null;
    return {
      key: axis.key,
      label: axis.label ?? axis.key,
      mean,
      sd,
      scores,
      letterCounts,
      usableCount: scores.length,
      scale: axisScale(axis.key, instrument),
      high: axis.high ?? "",
      low: axis.low ?? "",
    };
  });

  // Modaltyp: je Achse Mehrheits-Buchstabe (Tie-Break ueber Mean-Seite).
  let modalType: string | null = wantsType ? "" : null;
  for (const axis of axes) {
    if (modalType === null) break;
    if (axis.usableCount === 0 || axis.mean == null || axis.high === "" || axis.low === "") {
      modalType = null;
      break;
    }
    const highCount = axis.letterCounts[axis.high] ?? 0;
    const lowCount = axis.letterCounts[axis.low] ?? 0;
    let letter: string;
    if (highCount > lowCount) letter = axis.high;
    else if (lowCount > highCount) letter = axis.low;
    else letter = axis.mean > axis.scale.cutoff ? axis.high : axis.low; // Tie-Break
    modalType += letter;
  }

  // Typ-Konsistenz: Anteil vollstaendiger Wiederholungs-Typen == Modaltyp.
  let typeConsistency: number | null = null;
  if (modalType) {
    const completeTypes = perRepScores.map((s) => deriveType(s, instrument)).filter((t): t is string => t !== null);
    if (completeTypes.length > 0) {
      const matches = completeTypes.filter((t) => t === modalType).length;
      typeConsistency = matches / completeTypes.length;
    }
  }

  // Verwertbare Wiederholungen: trugen zu mindestens einer Achse bei.
  const usableReps = perRepScores.filter((s) => Object.values(s).some((v) => v != null)).length;

  return { axes, modalType, typeConsistency, usableReps };
}
