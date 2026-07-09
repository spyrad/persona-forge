/**
 * Verdict-Schwelle des CI-Review-Agenten.
 *
 * Diese Funktion **ist** das Merge-Gate. Sie muss deshalb deterministisch und
 * unabhaengig vom Modell sein: das LLM liefert nur Scores und Begruendungen,
 * die Pass/Fail-Entscheidung faellt hier im Code. So bleibt sie unit-testbar
 * und laesst sich justieren, ohne den Prompt anzufassen.
 *
 * Bewusst rein: kein `process`, kein Netz.
 */
import { CRITERIA, CRITERION_TITLES, type ReviewResult } from "@/lib/ai-review/schema";

/** Faellt ein einzelnes Kriterium darunter, ist der PR raus — egal wie gut der Rest ist. */
export const MIN_CRITERION_SCORE = 5;
/** Der Durchschnitt aller sechs Kriterien muss mindestens hier liegen. */
export const MIN_AVERAGE_SCORE = 7;

export type Verdict = "passed" | "failed";

export interface VerdictResult {
  verdict: Verdict;
  /** Menschenlesbare Gruende fuer ein `failed` — leer bei `passed`. */
  reasons: string[];
  /** Durchschnitt der sechs Scores, ungerundet. */
  average: number;
}

/** Arithmetisches Mittel der sechs Scores. */
export function averageScore(result: ReviewResult): number {
  const sum = CRITERIA.reduce((acc, key) => acc + result.criteria[key].score, 0);
  return sum / CRITERIA.length;
}

/**
 * Wendet die Schwellen an. `failed`, sobald ein einzelnes Kriterium unter
 * {@link MIN_CRITERION_SCORE} liegt **oder** der Durchschnitt unter
 * {@link MIN_AVERAGE_SCORE}.
 */
export function decideVerdict(result: ReviewResult): VerdictResult {
  const reasons: string[] = [];

  for (const key of CRITERIA) {
    const { score } = result.criteria[key];
    if (score < MIN_CRITERION_SCORE) {
      reasons.push(
        `${CRITERION_TITLES[key]}: ${score}/10 liegt unter der Mindestpunktzahl von ${MIN_CRITERION_SCORE}.`,
      );
    }
  }

  const average = averageScore(result);
  if (average < MIN_AVERAGE_SCORE) {
    reasons.push(`Durchschnitt ${average.toFixed(1)}/10 liegt unter der Mindestpunktzahl von ${MIN_AVERAGE_SCORE}.`);
  }

  return {
    verdict: reasons.length === 0 ? "passed" : "failed",
    reasons,
    average,
  };
}
