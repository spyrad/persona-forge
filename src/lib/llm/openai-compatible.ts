/**
 * OpenAI-kompatibler Chat-Completion-Client (server-only) fuer S-04.
 *
 * Kapselt EINEN `POST {baseUrl}/chat/completions`-Call mit den S-02-Sicherheits-
 * mustern (`isPublicHttpsUrl`-Guard auch auf der gespeicherten URL, Bearer-Key,
 * `redirect:"manual"`, AbortController-Timeout) plus Retry/Backoff bei 429/5xx.
 *
 * Invarianten:
 *   * Leakt NIE Key-Material oder Upstream-Header — Fehler tragen nur generische
 *     Texte (Status/Reachability), nie den Key.
 *   * `jsonMode` ist tolerant: lehnt ein Endpunkt `response_format` ab (400/422),
 *     wird der Call EINMAL ohne `response_format` wiederholt (FR-013 —
 *     der Freitext-Fallback-Parser faengt das Ergebnis).
 *   * SSRF-Defense-in-depth: die (entschluesselte) `baseUrl` wird vor dem Call
 *     erneut gegen den Guard geprueft; `redirect:"manual"` verhindert 3xx auf
 *     interne Ziele.
 */
import { isPublicHttpsUrl } from "@/lib/url-guard";
import type { ChatMessage } from "@/lib/runs/oejts-run";

const TIMEOUT_MS = 60_000;
const MAX_ATTEMPTS = 3;

export interface ChatCompletionArgs {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  /** `response_format: {type:"json_object"}` anfordern (tolerant, s. o.). */
  jsonMode?: boolean;
  /** Externes Abbruchsignal (zusaetzlich zum internen Timeout). */
  signal?: AbortSignal;
}

export interface ChatCompletionResult {
  content: string;
  promptTokens: number | null;
  completionTokens: number | null;
}

/** Schmaler Objekt-Cast ohne `any` — fuer das tolerante Antwort-Parsing. */
function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

/** `choices[0].message.content` defensiv extrahieren. */
function extractContent(payload: unknown): string | null {
  const choices = asRecord(payload)?.choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const content = asRecord(asRecord(choices[0])?.message)?.content;
  return typeof content === "string" ? content : null;
}

/** `usage.{prompt,completion}_tokens` extrahieren (fehlt → null/„unbekannt"). */
function extractUsage(payload: unknown): { promptTokens: number | null; completionTokens: number | null } {
  const usage = asRecord(asRecord(payload)?.usage);
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return { promptTokens: num(usage?.prompt_tokens), completionTokens: num(usage?.completion_tokens) };
}

/** Verknuepft den internen Timeout-Controller mit einem optionalen externen Signal. */
function withTimeout(external?: AbortSignal): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, TIMEOUT_MS);
  const onExternalAbort = () => {
    controller.abort();
  };
  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener("abort", onExternalAbort, { once: true });
  }
  return {
    signal: controller.signal,
    cancel: () => {
      clearTimeout(timer);
      external?.removeEventListener("abort", onExternalAbort);
    },
  };
}

/** Exponentielles Backoff (abbrechbar) vor einem Retry. */
function backoff(attempt: number, signal?: AbortSignal): Promise<void> {
  const ms = 500 * 2 ** (attempt - 1);
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

/** True, wenn der Endpunkt zu z.ai gehört (Host endet auf „z.ai"). Nur dann sendet
 *  der Client `thinking:{type:"disabled"}`, da GLM-Modelle sonst per Default reasonen. */
export function isZaiEndpoint(baseUrl: string): boolean {
  try {
    return new URL(baseUrl).hostname.endsWith("z.ai");
  } catch {
    return false;
  }
}

/**
 * Fuehrt einen Chat-Completion-Call aus und gibt Inhalt + Token-Nutzung zurueck.
 * Wirft bei nicht erreichbarem/abweisendem Endpunkt nach erschoepften Retries —
 * der Aufrufer (`processNextRepetition`) faengt das und markiert die Wiederholung
 * als `failed`, ohne den Lauf abzubrechen.
 */
export async function chatCompletion(args: ChatCompletionArgs): Promise<ChatCompletionResult> {
  // Defense-in-depth: auch die gespeicherte/entschluesselte URL gegen den SSRF-Guard.
  if (!isPublicHttpsUrl(args.baseUrl)) {
    throw new Error("base_url is not a public https URL");
  }
  const url = `${args.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  let jsonMode = args.jsonMode ?? false;
  let lastError = "request failed";
  // z.ai-GLM reasont per Default (langsam) — für z.ai-Hosts abschalten. OpenAI würde
  // ein unbekanntes Feld mit 400 ablehnen, daher gehostet-gated.
  const disableThinking = isZaiEndpoint(args.baseUrl);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { signal, cancel } = withTimeout(args.signal);
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${args.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          model: args.model,
          messages: args.messages,
          ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
          ...(disableThinking ? { thinking: { type: "disabled" } } : {}),
        }),
        signal,
        redirect: "manual",
      });
    } catch {
      cancel();
      if (args.signal?.aborted) throw new Error("request aborted");
      lastError = "could not reach endpoint";
      if (attempt < MAX_ATTEMPTS) {
        await backoff(attempt, args.signal);
        continue;
      }
      throw new Error(lastError);
    }

    // SSRF-Haertung: Redirects nicht transparent folgen.
    if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) {
      cancel();
      throw new Error("endpoint redirected — not allowed");
    }

    // jsonMode-Toleranz: Endpunkt lehnt response_format ab → einmal ohne wiederholen.
    if (jsonMode && (res.status === 400 || res.status === 422)) {
      cancel();
      jsonMode = false;
      continue;
    }

    // Retrybare Upstream-Fehler.
    if (res.status === 429 || res.status >= 500) {
      cancel();
      lastError = `endpoint returned status ${res.status}`;
      if (attempt < MAX_ATTEMPTS) {
        await backoff(attempt, args.signal);
        continue;
      }
      throw new Error(lastError);
    }

    if (!res.ok) {
      cancel();
      throw new Error(`endpoint returned status ${res.status}`);
    }

    let payload: unknown;
    try {
      payload = await res.json();
    } catch {
      cancel();
      throw new Error("endpoint returned a non-JSON response");
    }
    cancel();

    const content = extractContent(payload);
    if (content == null) throw new Error("endpoint returned no message content");
    const { promptTokens, completionTokens } = extractUsage(payload);
    return { content, promptTokens, completionTokens };
  }

  throw new Error(lastError);
}
