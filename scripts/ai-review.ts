/**
 * Entry-Point des CI-Review-Agenten (Baustufe 1).
 *
 *   git diff main...HEAD | npx tsx scripts/ai-review.ts
 *
 * Liest den Diff von stdin, laesst ihn von einem LLM gegen die sechs Kriterien
 * bewerten und schreibt die Scorecard als JSON auf **stdout**. Alle Meldungen
 * gehen auf stderr, damit stdout maschinenlesbar bleibt.
 *
 * Laeuft ausserhalb von Astro: `astro:env/server` ist unter plain `tsx` nicht
 * aufloesbar, und im CI existiert keine User-Session. Config kommt deshalb aus
 * `process.env`; der DB-/Krypto-Pfad wird nicht angefasst.
 *
 * Exit-Codes (die Action unterscheidet daran "Reviewer sagt nein" von
 * "Reviewer ist kaputt"):
 *   0 = passed
 *   1 = failed
 *   2 = technischer Fehler
 */
import { NoObjectGeneratedError, Output, ToolLoopAgent, stepCountIs } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

import { prepareDiff } from "../src/lib/ai-review/diff";
import { buildPrompt, REVIEW_INSTRUCTIONS } from "../src/lib/ai-review/prompt";
import type { ReviewOutput } from "../src/lib/ai-review/report";
import { RULES, reviewSchema } from "../src/lib/ai-review/schema";
import { decideVerdict, severityOf } from "../src/lib/ai-review/verdict";
import { isZaiEndpoint } from "../src/lib/llm/openai-compatible";

/**
 * Das SDK loggt Warnungen per `console.warn` — und das landet auf **stdout**,
 * mitten im JSON, das die Action parst. Wir leiten sie auf stderr um, statt sie
 * stumm zu schalten: die z.ai-Warnung ("responseFormat is not supported") ist
 * erwartet und soll im CI-Log sichtbar bleiben.
 */
(globalThis as { AI_SDK_LOG_WARNINGS?: unknown }).AI_SDK_LOG_WARNINGS = (warnings: unknown): void => {
  // Das SDK reicht je nach Version ein Array oder eine einzelne Warnung durch.
  for (const warning of Array.isArray(warnings) ? warnings : [warnings]) {
    process.stderr.write(`ai-review: SDK-Warnung: ${JSON.stringify(warning)}\n`);
  }
};

/**
 * Zeichen-Budget des Diffs. Grob ~4 Zeichen je Token, also ~30k Token Input.
 *
 * Angehoben von 60k nach dem ersten echten CI-Lauf (PR #2): ein 151k-Zeichen-Diff
 * verlor dort beide `scripts/`-Dateien, obwohl der Lauf nur 18.950 Token
 * verbrauchte. Der z.ai-Flat-Plan macht Token kostenneutral; die Grenze schuetzt
 * vor Latenz und "lost in the middle", nicht vor Kosten.
 */
const DEFAULT_DIFF_BUDGET = 120_000;

/**
 * Null Tools — aber die Struktur-Ausgabe zaehlt selbst als Step. `stepCountIs(1)`
 * wuerde abbrechen, bevor `Output.object` geliefert wird. Der SDK-Default (20)
 * waere in CI ein Budget-Risiko.
 */
const MAX_STEPS = 2;

const EXIT_PASSED = 0;
const EXIT_FAILED = 1;
const EXIT_ERROR = 2;

/** Technischer Abbruch. Wird oben abgefangen und auf Exit-Code 2 gemappt. */
class ReviewError extends Error {}

/**
 * Bricht ab, ohne `process.exit()` zu rufen: ein harter Exit waehrend der
 * stdin-Handle noch schliesst, loest auf Windows einen libuv-Assert aus
 * (`!(handle->flags & UV_HANDLE_CLOSING)`) und verfaelscht den Exit-Code.
 * Stattdessen werfen und `process.exitCode` setzen — Node beendet sich sauber.
 */
function fail(message: string): never {
  throw new ReviewError(message);
}

/** Liest eine Pflicht-Variable oder bricht mit klarer Meldung ab. */
function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    fail(`Umgebungsvariable ${name} fehlt oder ist leer.`);
  }
  return value;
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    fail("Kein Diff auf stdin. Aufruf: git diff main...HEAD | npx tsx scripts/ai-review.ts");
  }
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin as AsyncIterable<Buffer | string>) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  const baseURL = requireEnv("ZAI_BASE_URL");
  const apiKey = requireEnv("ZAI_API_KEY");
  const model = requireEnv("REVIEW_MODEL");

  const budget = Number(process.env.REVIEW_DIFF_BUDGET ?? DEFAULT_DIFF_BUDGET);
  if (!Number.isFinite(budget) || budget <= 0) {
    fail(`REVIEW_DIFF_BUDGET muss eine positive Zahl sein, war: ${process.env.REVIEW_DIFF_BUDGET}`);
  }

  const rawDiff = await readStdin();
  if (rawDiff.trim() === "") {
    fail("Der Diff auf stdin ist leer — nichts zu bewerten.");
  }

  const prepared = prepareDiff(rawDiff, budget);
  process.stderr.write(
    `ai-review: Diff ${rawDiff.length} -> ${prepared.diff.length} Zeichen` +
      (prepared.truncated ? ` (gekuerzt, ${prepared.droppedFiles.length} Datei(en) verworfen)` : "") +
      "\n",
  );

  // `supportsStructuredOutputs: false` ist keine Bequemlichkeit, sondern Pflicht:
  // der z.ai-Coding-Endpunkt kennt nur `response_format: json_object`, kein
  // `json_schema`. Mit `true` sendet das SDK ein Schema, das z.ai ignoriert —
  // GLM antwortet dann mit Fliesstext. Die Struktur-Vorgabe steht deshalb im
  // Prompt (SCHEMA_HINT); `Output.object` validiert sie nur noch.
  const provider = createOpenAICompatible({ name: "zai", apiKey, baseURL, supportsStructuredOutputs: false });

  const agent = new ToolLoopAgent({
    model: provider(model),
    instructions: REVIEW_INSTRUCTIONS,
    output: Output.object({ schema: reviewSchema }),
    stopWhen: stepCountIs(MAX_STEPS),
    // Ein Merge-Gate soll bei gleichem Diff gleich urteilen. GLM bietet keinen
    // Seed, also gibt es keine Garantie — gemessen senkt temperature 0 die
    // Score-Spannweite an der Entscheidungsgrenze aber spuerbar.
    temperature: 0,
  });

  // `thinking` ist kein OpenAI-Standardfeld. Der openai-compatible-Provider
  // spiegelt providerOptions["zai"] in den Request-Body. Ohne das reasont GLM
  // per Default und der CI-Lauf wird unnoetig langsam.
  const providerOptions = isZaiEndpoint(baseURL) ? { zai: { thinking: { type: "disabled" } } } : undefined;

  const started = Date.now();
  const result = await agent.generate({
    prompt: buildPrompt({
      title: process.env.PR_TITLE ?? "",
      body: process.env.PR_BODY ?? "",
      diff: prepared.diff,
      truncated: prepared.truncated,
      droppedFiles: prepared.droppedFiles,
    }),
    ...(providerOptions ? { providerOptions } : {}),
  });
  const elapsedMs = Date.now() - started;

  const review = result.output;
  const { verdict, reasons, average, scores } = decideVerdict(review);

  process.stderr.write(
    `ai-review: ${verdict} (Schnitt ${average.toFixed(1)}, ${review.findings.length} Finding(s)) ` +
      `in ${(elapsedMs / 1000).toFixed(1)}s, ${result.usage.totalTokens ?? "?"} Tokens\n`,
  );

  // Typ festgenagelt: driftet die Ausgabe, bricht der Typecheck — nicht erst
  // `ai-review-report.ts` zur Laufzeit im CI.
  const output: ReviewOutput = {
    verdict,
    average,
    scores,
    reasons,
    summary: review.summary,
    // Findings mit dem im Code abgeleiteten Schweregrad angereichert —
    // die Action rendert daraus den PR-Kommentar.
    findings: review.findings.map((f) => ({
      ...f,
      criterion: RULES[f.rule].criterion,
      severity: severityOf(f),
    })),
    meta: {
      truncated: prepared.truncated,
      droppedFiles: prepared.droppedFiles,
      model,
      elapsedMs,
    },
  };

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

  process.exitCode = verdict === "passed" ? EXIT_PASSED : EXIT_FAILED;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`ai-review: ${message}\n`);

  // Bei Schema-Verstoessen die Rohantwort mitgeben — sonst ist der Fehler
  // "response did not match schema" im CI-Log nicht diagnostizierbar.
  if (NoObjectGeneratedError.isInstance(error) && error.text) {
    process.stderr.write(`ai-review: Rohantwort des Modells:\n${error.text}\n`);
  }

  process.exitCode = EXIT_ERROR;
});
