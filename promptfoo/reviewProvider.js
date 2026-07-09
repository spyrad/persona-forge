/**
 * promptfoo-Provider fuer den CI-Review-Agenten.
 *
 * Ruft den **echten** Entry-Point `scripts/ai-review.ts` als Subprozess auf und
 * reicht den Diff ueber stdin hinein. Damit prueft das Regressions-Gate genau
 * den Pfad, der in CI laeuft — inklusive `prepareDiff`, Prompt-Bau, LLM-Call und
 * der deterministischen `decideVerdict`-Schwelle. Ein reiner Prompt-Test wuerde
 * Kappung und Schwelle auslassen, also gerade das, was das Merge-Gate ausmacht.
 *
 * promptfoo kann unsere TypeScript-Module nicht direkt importieren; der
 * Subprozess-Umweg ueber `tsx` ersetzt einen Build-Schritt.
 *
 * Exit-Codes des Scorers: 0 = passed, 1 = failed, 2 = technischer Fehler.
 * Nur 2 ist hier ein Fehler — ein `failed` ist ein gueltiges Ergebnis.
 */
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const EXIT_PASSED = 0;
const EXIT_FAILED = 1;

/** Projekt-Root, damit `scripts/ai-review.ts` unabhaengig vom Aufruf-cwd greift. */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

class ReviewProvider {
  constructor(options = {}) {
    this.providerId = options.id ?? "ai-review";
    this.config = options.config ?? {};
  }

  id() {
    return this.providerId;
  }

  /**
   * @param {string} prompt Der rohe `git diff` (aus `vars.diff`, per `file://` geladen)
   * @param {{vars?: Record<string, unknown>}} context
   */
  async callApi(prompt, context = {}) {
    const vars = context.vars ?? {};

    const env = {
      ...process.env,
      PR_TITLE: String(vars.title ?? ""),
      PR_BODY: String(vars.body ?? ""),
    };
    if (this.config.model) env.REVIEW_MODEL = String(this.config.model);
    if (this.config.diffBudget) env.REVIEW_DIFF_BUDGET = String(this.config.diffBudget);

    for (const name of ["ZAI_BASE_URL", "ZAI_API_KEY", "REVIEW_MODEL"]) {
      if (!env[name]) return { error: `Umgebungsvariable ${name} fehlt.` };
    }

    const { code, stdout, stderr } = await run("npx", ["tsx", "scripts/ai-review.ts"], prompt, env);

    if (code !== EXIT_PASSED && code !== EXIT_FAILED) {
      return { error: `Scorer endete mit Exit-Code ${code}: ${lastLine(stderr)}` };
    }

    // Die Ausgabe bleibt ein JSON-String — so greifen `is-json` und
    // `javascript`-Assertions wie in der promptfoo-Doku.
    return { output: stdout.trim() };
  }
}

function lastLine(text) {
  const lines = text.trim().split("\n");
  return lines[lines.length - 1] ?? "";
}

function run(command, args, stdin, env) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { env, cwd: ROOT, shell: process.platform === "win32" });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));

    child.on("error", reject);
    child.on("close", (code) => resolvePromise({ code, stdout, stderr }));

    child.stdin.write(stdin);
    child.stdin.end();
  });
}

export default ReviewProvider;
