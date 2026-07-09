/**
 * Rendert das Scorer-Ergebnis als PR-Kommentar (Markdown).
 *
 * Reine Funktion: kein `process`, kein Netz, kein GitHub-SDK. Die API-Aufrufe
 * liegen in `scripts/ai-review-report.ts`. So bleibt genau der Teil testbar,
 * der stillschweigend das Falsche ausgeben koennte.
 */
import { CRITERIA, CRITERION_TITLES, type Criterion, type Finding, type Severity } from "@/lib/ai-review/schema";
import { MIN_CRITERION_SCORE, type Verdict } from "@/lib/ai-review/verdict";

/**
 * Unsichtbarer Marker, an dem der Workflow seinen eigenen Kommentar
 * wiedererkennt. Ohne ihn haengt jeder Push einen weiteren Kommentar an.
 */
export const COMMENT_MARKER = "<!-- ai-cr -->";

export const LABEL_PASSED = "ai-cr:passed";
export const LABEL_FAILED = "ai-cr:failed";
/** Setzt der Mensch dieses Label, laeuft der Reviewer erneut. */
export const LABEL_RERUN = "ai-cr:review";

/** Ein Finding, angereichert um die im Code abgeleiteten Felder. */
export type EnrichedFinding = Finding & { criterion: Criterion; severity: Severity };

/** Die JSON-Ausgabe von `scripts/ai-review.ts` auf stdout. */
export interface ReviewOutput {
  verdict: Verdict;
  average: number;
  scores: Record<Criterion, number>;
  reasons: string[];
  summary: string;
  findings: EnrichedFinding[];
  meta: {
    truncated: boolean;
    droppedFiles: string[];
    model: string;
    elapsedMs: number;
  };
}

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "🔴 kritisch",
  warning: "🟡 Warnung",
  observation: "🔵 Hinweis",
};

/** Reihenfolge fuer die Findings-Tabelle: Schwerwiegendes zuerst. */
const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, warning: 1, observation: 2 };

/** Verhindert, dass ein `|` aus dem Diff die Markdown-Tabelle zerlegt. */
function escapeCell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}

/** Kappt lange Belege, damit der Kommentar lesbar bleibt. */
function truncate(text: string, max = 120): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function scoreTable(scores: Record<Criterion, number>): string {
  const rows = CRITERIA.map((criterion) => {
    const score = scores[criterion];
    const mark = score < MIN_CRITERION_SCORE ? "❌" : "✅";
    return `| ${mark} | ${CRITERION_TITLES[criterion]} | ${score}/10 |`;
  });
  return ["| | Kriterium | Score |", "| :-: | --- | :-: |", ...rows].join("\n");
}

function findingsTable(findings: EnrichedFinding[]): string {
  const sorted = [...findings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  const rows = sorted.map(
    (f) =>
      `| ${SEVERITY_LABEL[f.severity]} | \`${f.rule}\` | \`${escapeCell(f.file)}\` | ${escapeCell(truncate(f.evidence))} |`,
  );
  return ["| Schwere | Regel | Datei | Beleg |", "| --- | --- | --- | --- |", ...rows].join("\n");
}

/**
 * Baut den PR-Kommentar. Beginnt immer mit {@link COMMENT_MARKER}, damit der
 * Workflow den Vorgaenger findet und loeschen kann.
 */
export function renderComment(result: ReviewOutput): string {
  const passed = result.verdict === "passed";
  const heading = passed ? "✅ AI Code Review: bestanden" : "❌ AI Code Review: nicht bestanden";

  const parts: string[] = [
    COMMENT_MARKER,
    `## ${heading}`,
    "",
    result.summary,
    "",
    scoreTable(result.scores),
    "",
    `**Durchschnitt:** ${result.average.toFixed(1)}/10`,
  ];

  if (result.reasons.length > 0) {
    parts.push("", "### Warum blockiert", ...result.reasons.map((r) => `- ${r}`));
  }

  if (result.findings.length > 0) {
    parts.push("", `### Findings (${result.findings.length})`, "", findingsTable(result.findings));
  } else {
    parts.push("", "Keine Verstoesse gegen die Projekt-Konventionen gefunden.");
  }

  if (result.meta.truncated) {
    const dropped =
      result.meta.droppedFiles.length > 0
        ? ` Nicht geprueft: ${result.meta.droppedFiles.map((f) => `\`${f}\``).join(", ")}.`
        : "";
    parts.push(
      "",
      `> ⚠️ Der Diff wurde aus Budgetgruenden gekuerzt.${dropped} Das Urteil stuetzt sich nur auf den geprueften Teil.`,
    );
  }

  parts.push(
    "",
    "---",
    `<sub>Modell \`${result.meta.model}\` · ${(result.meta.elapsedMs / 1000).toFixed(1)}s · ` +
      `Der Reviewer prueft projektspezifische Konventionen, die ESLint nicht sieht. ` +
      `Erneut ausfuehren: Label \`${LABEL_RERUN}\` setzen.</sub>`,
  );

  return parts.join("\n");
}

/** Kommentar fuer einen technischen Fehlschlag (Exit-Code 2). */
export function renderErrorComment(message: string): string {
  return [
    COMMENT_MARKER,
    "## ⚠️ AI Code Review konnte nicht ausgefuehrt werden",
    "",
    "Der Reviewer ist technisch fehlgeschlagen. Das ist **kein** Urteil ueber diesen PR.",
    "",
    "```",
    truncate(message, 500),
    "```",
    "",
    `<sub>Erneut ausfuehren: Label \`${LABEL_RERUN}\` setzen.</sub>`,
  ].join("\n");
}
