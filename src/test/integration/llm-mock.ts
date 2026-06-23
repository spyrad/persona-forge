/**
 * fetch-Kanten-Mock für die ausgehende LLM-HTTP-Kante (test-plan §6.2).
 *
 * Stubbt `globalThis.fetch`, sodass ein Chat-Completion-Call eine valide,
 * deterministische OEJTS-Antwort liefert — der ECHTE SSRF-Guard in
 * `chatCompletion` (`openai-compatible.ts:107`) läuft dabei MIT: wir mocken die
 * HTTP-Kante, nicht die Funktion. `restoreLlm()` muss in `afterEach` laufen, sonst
 * leckt der Stub in andere, sequenziell laufende itests (`fileParallelism: false`).
 */
import { vi } from "vitest";
import { OEJTS } from "@/lib/instruments/oejts";

/** Valide OEJTS-Antwort: alle 32 Items mit demselben Skalenwert (1–5). */
export function oejtsAnswersJson(value = 3): string {
  return JSON.stringify({ answers: OEJTS.items.map((it) => ({ id: it.id, value })) });
}

/**
 * Stubbt `fetch` auf eine 200-Antwort im OpenAI-kompatiblen Shape
 * (`choices[0].message.content` + `usage`). Default-Content ist eine vollständige,
 * parsebare OEJTS-Antwort → `processNextRepetition` produziert eine `ok`-Repetition.
 */
export function mockLlmContent(
  content: string = oejtsAnswersJson(),
  usage: { prompt_tokens: number; completion_tokens: number } = { prompt_tokens: 100, completion_tokens: 50 },
): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ choices: [{ message: { content } }], usage }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    ),
  );
}

/**
 * Stubbt `fetch` auf eine 3xx-Antwort → triggert den Redirect-Block
 * (`redirect:"manual"`) an der Outbound-Kante. Beweist, dass ein guard-passender
 * Endpoint, der intern weiterleiten will, abgewiesen wird.
 */
export function mockLlmRedirect(status = 302): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response(null, { status }))),
  );
}

/** Setzt alle fetch-Stubs zurück — IMMER in `afterEach` rufen. */
export function restoreLlm(): void {
  vi.unstubAllGlobals();
}
