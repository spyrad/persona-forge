import { afterEach, describe, expect, it, vi } from "vitest";
import { chatCompletion, extractUpstreamError, isZaiEndpoint } from "./openai-compatible";

describe("isZaiEndpoint", () => {
  it("erkennt z.ai-Endpunkte am Host (Standard + Coding)", () => {
    expect(isZaiEndpoint("https://api.z.ai/api/paas/v4/")).toBe(true);
    expect(isZaiEndpoint("https://api.z.ai/api/coding/paas/v4/")).toBe(true);
  });

  it("verneint Nicht-z.ai und Müll", () => {
    expect(isZaiEndpoint("https://api.openai.com/v1")).toBe(false);
    expect(isZaiEndpoint("not-a-url")).toBe(false);
  });
});

describe("chatCompletion — thinking-Gate", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Stubt global.fetch, sammelt die geparsten Request-Bodies, antwortet 200 mit gültigem JSON. */
  function stubFetchCapturing(): { bodies: Record<string, unknown>[] } {
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => {
        bodies.push(JSON.parse(init.body as string) as Record<string, unknown>);
        return Promise.resolve({
          ok: true,
          status: 200,
          type: "basic",
          json: () =>
            Promise.resolve({
              choices: [{ message: { content: '{"answers":[]}' } }],
              usage: { prompt_tokens: 1, completion_tokens: 1 },
            }),
        } as unknown as Response);
      }),
    );
    return { bodies };
  }

  const baseArgs = {
    apiKey: "k",
    model: "glm-5.2",
    messages: [{ role: "user" as const, content: "hi" }],
  };

  it("sendet thinking:disabled an einen z.ai-Endpunkt", async () => {
    const cap = stubFetchCapturing();
    await chatCompletion({ ...baseArgs, baseUrl: "https://api.z.ai/api/coding/paas/v4/" });
    expect(cap.bodies[0]).toMatchObject({ thinking: { type: "disabled" } });
  });

  it("sendet KEIN thinking-Feld an OpenAI", async () => {
    const cap = stubFetchCapturing();
    await chatCompletion({ ...baseArgs, model: "gpt-4o-mini", baseUrl: "https://api.openai.com/v1" });
    expect(cap.bodies[0]).not.toHaveProperty("thinking");
  });
});

describe("extractUpstreamError", () => {
  it("zieht error.message aus dem Upstream-Body", () => {
    expect(extractUpstreamError('{"error":{"message":"insufficient balance"}}')).toBe("insufficient balance");
  });

  it("akzeptiert error als flachen String", () => {
    expect(extractUpstreamError('{"error":"rate limited"}')).toBe("rate limited");
  });

  it("gibt null bei fehlendem Feld oder Nicht-JSON", () => {
    expect(extractUpstreamError("{}")).toBeNull();
    expect(extractUpstreamError("not json")).toBeNull();
    expect(extractUpstreamError('{"error":{}}')).toBeNull();
  });

  it("kappt auf 200 Zeichen (plus Ellipsis)", () => {
    const long = "x".repeat(300);
    const out = extractUpstreamError(JSON.stringify({ error: { message: long } }));
    expect(out).toHaveLength(201);
    expect(out?.endsWith("…")).toBe(true);
  });
});

describe("chatCompletion — Upstream-Fehlertext", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Stubt fetch mit einem festen Status + JSON-Body (als text() lesbar). */
  function stubFetchStatus(status: number, body: unknown): void {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: status >= 200 && status < 300,
          status,
          type: "basic",
          text: () => Promise.resolve(JSON.stringify(body)),
          json: () => Promise.resolve(body),
        } as unknown as Response),
      ),
    );
  }

  // baseUrl OpenAI + jsonMode weglassen → 400 fällt direkt auf den !res.ok-Wurf
  // (kein 429-Retry-Backoff, kein jsonMode-off-Retry) → schneller, deterministischer Test.
  const baseArgs = {
    apiKey: "k",
    model: "gpt-4o-mini",
    messages: [{ role: "user" as const, content: "hi" }],
    baseUrl: "https://api.openai.com/v1",
  };

  it("hängt den Upstream-error.message an den geworfenen Fehler an", async () => {
    stubFetchStatus(400, { error: { message: "insufficient balance" } });
    await expect(chatCompletion(baseArgs)).rejects.toThrow("insufficient balance");
  });

  it("bleibt beim generischen Text, wenn kein message im Body steht", async () => {
    stubFetchStatus(400, {});
    await expect(chatCompletion(baseArgs)).rejects.toThrow("endpoint returned status 400");
  });
});
