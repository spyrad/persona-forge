/**
 * Side-Effects des CI-Review-Agenten: PR-Kommentar, Labels, Commit-Status.
 *
 * Liest das JSON von `scripts/ai-review.ts` (Pfad in `RESULT_PATH`) und den
 * Exit-Code des Scorers (`REVIEW_EXIT_CODE`). Der Exit-Code unterscheidet drei
 * Faelle, die im PR verschieden aussehen muessen:
 *
 *   0 = passed  -> Label `ai-cr:passed`, Commit-Status `success`
 *   1 = failed  -> Label `ai-cr:failed`, Commit-Status `failure`
 *   2 = Fehler  -> KEIN Label, Commit-Status `error`, Hinweis-Kommentar
 *
 * Der dritte Fall ist der wichtige: ein z.ai-Ausfall darf den PR nicht so
 * aussehen lassen, als haette der Reviewer ihn abgelehnt.
 *
 * Der Verdict-Status wird als **separater Commit-Status** gepostet, nicht ueber
 * den Job-Exit-Code. Nur ein Commit-Status kann Required Status Check werden —
 * ein in-YAML-Gate allein laesst einen `ai-cr:failed`-Merge still durch
 * (`context/foundation/lessons.md`).
 */
import { readFileSync } from "node:fs";

import {
  COMMENT_MARKER,
  LABEL_FAILED,
  LABEL_PASSED,
  renderComment,
  renderErrorComment,
  type ReviewOutput,
} from "../src/lib/ai-review/report";

/** Context des Commit-Status. Genau dieser String gehoert in die Branch-Protection. */
const STATUS_CONTEXT = "ai-review/verdict";

const EXIT_PASSED = 0;
const EXIT_FAILED = 1;

class ReportError extends Error {}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new ReportError(`Umgebungsvariable ${name} fehlt oder ist leer.`);
  return value;
}

const token = requireEnv("GITHUB_TOKEN");
const repository = requireEnv("GITHUB_REPOSITORY"); // "owner/repo"
const prNumber = requireEnv("PR_NUMBER");
const headSha = requireEnv("HEAD_SHA");

const api = `${process.env.GITHUB_API_URL ?? "https://api.github.com"}/repos/${repository}`;
const runUrl = `${process.env.GITHUB_SERVER_URL ?? "https://github.com"}/${repository}/actions/runs/${process.env.GITHUB_RUN_ID ?? ""}`;

async function gh<T>(path: string, init: Omit<RequestInit, "headers"> = {}): Promise<T> {
  const response = await fetch(`${api}${path}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
      ...(init.body === undefined ? {} : { "content-type": "application/json" }),
    },
  });

  if (!response.ok) {
    const body = (await response.text()).slice(0, 300);
    throw new ReportError(`${init.method ?? "GET"} ${path} -> ${response.status}: ${body}`);
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

interface Comment {
  id: number;
  body?: string;
}

interface Label {
  name: string;
}

/**
 * Ersetzt den vorherigen Reviewer-Kommentar. Reihenfolge ist Absicht: erst den
 * neuen posten, dann den alten loeschen — sonst steht der PR zwischenzeitlich
 * ganz ohne Review da, und ein Absturz dazwischen laesst ihn so zurueck.
 */
async function replaceComment(body: string): Promise<void> {
  const existing = await gh<Comment[]>(`/issues/${prNumber}/comments?per_page=100`);
  const previous = existing.filter((c) => c.body?.startsWith(COMMENT_MARKER));

  await gh(`/issues/${prNumber}/comments`, { method: "POST", body: JSON.stringify({ body }) });

  for (const comment of previous) {
    await gh(`/issues/comments/${comment.id}`, { method: "DELETE" });
  }
}

/** Setzt genau ein Verdict-Label und entfernt das jeweils andere. */
async function setLabel(wanted: string | null): Promise<void> {
  const current = await gh<Label[]>(`/issues/${prNumber}/labels`);
  const names = new Set(current.map((l) => l.name));

  for (const stale of [LABEL_PASSED, LABEL_FAILED]) {
    if (stale !== wanted && names.has(stale)) {
      await gh(`/issues/${prNumber}/labels/${encodeURIComponent(stale)}`, { method: "DELETE" });
    }
  }

  if (wanted !== null && !names.has(wanted)) {
    await gh(`/issues/${prNumber}/labels`, { method: "POST", body: JSON.stringify({ labels: [wanted] }) });
  }
}

async function setStatus(state: "success" | "failure" | "error", description: string): Promise<void> {
  await gh(`/statuses/${headSha}`, {
    method: "POST",
    body: JSON.stringify({
      state,
      context: STATUS_CONTEXT,
      // Die GitHub-API kappt description hart bei 140 Zeichen.
      description: description.slice(0, 140),
      target_url: runUrl,
    }),
  });
}

async function main(): Promise<void> {
  const exitCode = Number(process.env.REVIEW_EXIT_CODE ?? "2");

  // Technischer Fehlschlag: kein Urteil, kein Label, aber sichtbar rot.
  if (exitCode !== EXIT_PASSED && exitCode !== EXIT_FAILED) {
    // Bewusst kein `??`: eine leere REVIEW_ERROR-Variable (der Scorer schrieb
    // nichts auf stderr) muss ebenfalls den Fallback ziehen, nicht "" melden.
    const reported = process.env.REVIEW_ERROR?.trim();
    const detail = reported !== undefined && reported !== "" ? reported : `Scorer endete mit Exit-Code ${exitCode}.`;
    process.stderr.write(`ai-review-report: technischer Fehler — ${detail}\n`);

    await replaceComment(renderErrorComment(detail));
    await setStatus("error", "Reviewer technisch fehlgeschlagen — kein Urteil ueber diesen PR.");
    return;
  }

  const raw = readFileSync(requireEnv("RESULT_PATH"), "utf8");
  const result = JSON.parse(raw) as ReviewOutput;

  await replaceComment(renderComment(result));
  await setLabel(result.verdict === "passed" ? LABEL_PASSED : LABEL_FAILED);

  const summary = `${result.findings.length} Finding(s), Schnitt ${result.average.toFixed(1)}/10`;
  await setStatus(result.verdict === "passed" ? "success" : "failure", summary);

  process.stderr.write(`ai-review-report: ${result.verdict} gemeldet (${summary})\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`ai-review-report: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
