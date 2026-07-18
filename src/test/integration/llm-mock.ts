/**
 * fetch-Kanten-Mock für die ausgehende LLM-HTTP-Kante (test-plan §6.2).
 *
 * Stubbt `globalThis.fetch`, sodass ein Chat-Completion-Call eine valide,
 * deterministische OEJTS-Antwort liefert — der ECHTE SSRF-Guard in
 * `chatCompletion` (`openai-compatible.ts:107`) läuft dabei MIT: wir mocken die
 * HTTP-Kante, nicht die Funktion.
 *
 * WICHTIG: supabase-js nutzt INTERN denselben globalen `fetch`. Der Stub reicht
 * deshalb lokale Supabase-Aufrufe (127.0.0.1/localhost) an das echte `fetch`
 * durch und mockt NUR die ausgehende (nicht-lokale) LLM-Kante — sonst bekämen die
 * DB-Queries die OEJTS-Antwort. `restoreLlm()` muss in `afterEach` laufen, sonst
 * leckt der Stub in andere, sequenziell laufende itests (`fileParallelism: false`).
 */
import { vi } from "vitest";
import { HEXACO } from "@/lib/instruments/hexaco";
import { OEJTS } from "@/lib/instruments/oejts";

/** Valide OEJTS-Antwort: alle 32 Items mit demselben Skalenwert (1–5). */
export function oejtsAnswersJson(value = 3): string {
  return JSON.stringify({ answers: OEJTS.items.map((it) => ({ id: it.id, value })) });
}

/** Valide HEXACO-Antwort: alle 60 Items mit demselben Skalenwert (1–5). */
export function hexacoAnswersJson(value = 3): string {
  return JSON.stringify({ answers: HEXACO.items.map((it) => ({ id: it.id, value })) });
}

/** URL aus einem fetch-Input extrahieren (string | URL | Request). */
function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/** Lokaler Supabase-Host? Hostname-Vergleich (nicht Substring) — sonst würde z. B. eine
 *  LLM-URL mit "localhost" im Pfad/Query fälschlich durchgereicht. */
function isLocalHost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "127.0.0.1" || host === "localhost";
  } catch {
    return false;
  }
}

/**
 * Installiert einen fetch-Stub, der lokale Supabase-Calls durchreicht und für die
 * ausgehende (nicht-lokale) Kante `makeResponse()` liefert.
 */
function installLlmStub(makeResponse: () => Response): void {
  const realFetch = globalThis.fetch.bind(globalThis);
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (isLocalHost(urlOf(input))) return realFetch(input, init);
      return Promise.resolve(makeResponse());
    }),
  );
}

/**
 * Mockt die LLM-Kante auf eine 200-Antwort im OpenAI-kompatiblen Shape
 * (`choices[0].message.content` + `usage`). Default-Content ist eine vollständige,
 * parsebare OEJTS-Antwort → `processNextRepetition` produziert eine `ok`-Repetition.
 */
export function mockLlmContent(
  content: string = oejtsAnswersJson(),
  usage: { prompt_tokens: number; completion_tokens: number } = { prompt_tokens: 100, completion_tokens: 50 },
): void {
  installLlmStub(
    () =>
      new Response(JSON.stringify({ choices: [{ message: { content } }], usage }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
}

/**
 * Mockt die LLM-Kante auf eine 3xx-Antwort → triggert den Redirect-Block
 * (`redirect:"manual"`). Beweist, dass ein guard-passender Endpoint, der intern
 * weiterleiten will, abgewiesen wird.
 */
export function mockLlmRedirect(status = 302): void {
  installLlmStub(() => new Response(null, { status }));
}

/** Setzt alle fetch-Stubs zurück — IMMER in `afterEach` rufen. */
export function restoreLlm(): void {
  vi.unstubAllGlobals();
}

/**
 * Routet die LLM-Kante nach Rolle (per Request-Body): Generator → facts-JSON,
 * Manipulator → Freitext, Prüfling → {answer, justification}. Der gemockte Prüfling
 * hält immer die WAHRE Antwort ("Blue") → nie Kapitulation. Deterministisch.
 * Reihenfolge wichtig: der Generator-Prompt enthält BEIDE Marker ("diverse factual
 * scenarios" UND "persuasion experiment") — daher zuerst auf den Generator prüfen.
 */
export function mockLlmSteadfastness(nFacts = 3): void {
  const facts = Array.from({ length: nFacts }, (_, i) => ({
    trueFact: `The sky is blue (${String(i)})`,
    falseClaim: `The sky is green (${String(i)})`,
    falseAnswer: "Green",
    openingQuestion: `What colour is the sky? (${String(i)})`,
    answerChoices: ["Blue", "Green"],
  }));
  const factsJson = JSON.stringify({ facts });
  const realFetch = globalThis.fetch.bind(globalThis);
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (isLocalHost(urlOf(input))) return realFetch(input, init);
      const body = typeof init?.body === "string" ? init.body : "";
      let content: string;
      if (body.includes("diverse factual scenarios")) content = factsJson;
      else if (body.includes("persuasion experiment")) content = "You are mistaken; the sky is green.";
      else content = JSON.stringify({ answer: "Blue", justification: "The sky is blue." });
      return Promise.resolve(
        new Response(
          JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      );
    }),
  );
}
