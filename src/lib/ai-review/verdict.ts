/**
 * Score-Ableitung und Verdict-Schwelle des CI-Review-Agenten.
 *
 * Diese Datei **ist** das Merge-Gate. Das LLM liefert nur noch Findings
 * (welche Regel, welche Datei, welcher Beleg); Schweregrad, Score und
 * Pass/Fail entstehen hier deterministisch. Derselbe Findings-Satz ergibt
 * immer dasselbe Urteil — unit-testbar, ohne Modell.
 *
 * Ein Kriterium ohne Findings bekommt volle Punktzahl. Das deckt beide
 * harmlosen Faelle ab: "sauber umgesetzt" und "vom Diff gar nicht beruehrt".
 * Genau daran scheiterte die Noten-Variante, die fuer nicht beruehrte
 * Kriterien Noten zwischen 1 und 7 erfand.
 *
 * Bewusst rein: kein `process`, kein Netz.
 */
import {
  CRITERIA,
  CRITERION_TITLES,
  RULES,
  type Criterion,
  type Finding,
  type ReviewResult,
  type Severity,
} from "@/lib/ai-review/schema";

export const MAX_SCORE = 10;
export const MIN_SCORE = 1;

/** Faellt ein Kriterium darunter, ist der PR raus — egal wie gut der Rest ist. */
export const MIN_CRITERION_SCORE = 5;
/** Der Durchschnitt ueber alle sechs Kriterien muss mindestens hier liegen. */
export const MIN_AVERAGE_SCORE = 7;

/**
 * Punktabzug je Schweregrad. Ein einzelnes `critical` druckt ein Kriterium von
 * 10 auf 4 und damit unter {@link MIN_CRITERION_SCORE} — ein fehlendes RLS
 * blockt also allein, ohne dass der Durchschnitt mitspielen muss.
 */
const PENALTY: Record<Severity, number> = {
  critical: 6,
  warning: 3,
  observation: 1,
};

export type Verdict = "passed" | "failed";

export interface VerdictResult {
  verdict: Verdict;
  /** Abgeleiteter Score je Kriterium, 1..10. */
  scores: Record<Criterion, number>;
  /** Menschenlesbare Gruende fuer ein `failed` — leer bei `passed`. */
  reasons: string[];
  /** Durchschnitt ueber alle sechs Kriterien. */
  average: number;
}

/** Findings eines Kriteriums. */
export function findingsFor(findings: Finding[], criterion: Criterion): Finding[] {
  return findings.filter((f) => RULES[f.rule].criterion === criterion);
}

export function severityOf(finding: Finding): Severity {
  return RULES[finding.rule].severity;
}

/**
 * Leitet den Score eines Kriteriums ab: volle Punktzahl minus Abzuege,
 * nach unten auf {@link MIN_SCORE} begrenzt.
 */
export function scoreFor(findings: Finding[], criterion: Criterion): number {
  const penalty = findingsFor(findings, criterion).reduce((sum, f) => sum + PENALTY[severityOf(f)], 0);
  return Math.max(MIN_SCORE, MAX_SCORE - penalty);
}

/** Scores aller sechs Kriterien. */
export function scoresFrom(findings: Finding[]): Record<Criterion, number> {
  return Object.fromEntries(CRITERIA.map((c) => [c, scoreFor(findings, c)])) as Record<Criterion, number>;
}

/**
 * Wendet die Schwellen an. `failed`, sobald ein Kriterium unter
 * {@link MIN_CRITERION_SCORE} liegt **oder** der Durchschnitt unter
 * {@link MIN_AVERAGE_SCORE}.
 */
export function decideVerdict(result: ReviewResult): VerdictResult {
  const scores = scoresFrom(result.findings);
  const reasons: string[] = [];

  for (const criterion of CRITERIA) {
    const score = scores[criterion];
    if (score < MIN_CRITERION_SCORE) {
      const critical = findingsFor(result.findings, criterion).filter((f) => severityOf(f) === "critical").length;
      const detail = critical > 0 ? ` (${critical}x kritisch)` : "";
      reasons.push(
        `${CRITERION_TITLES[criterion]}: ${score}/10 liegt unter der Mindestpunktzahl von ${MIN_CRITERION_SCORE}${detail}.`,
      );
    }
  }

  const average = CRITERIA.reduce((sum, c) => sum + scores[c], 0) / CRITERIA.length;
  if (average < MIN_AVERAGE_SCORE) {
    reasons.push(`Durchschnitt ${average.toFixed(1)}/10 liegt unter der Mindestpunktzahl von ${MIN_AVERAGE_SCORE}.`);
  }

  return {
    verdict: reasons.length === 0 ? "passed" : "failed",
    scores,
    reasons,
    average,
  };
}
