import { afterEach, describe, expect, it, vi } from "vitest";
import { chatCompletion, isZaiEndpoint } from "./openai-compatible";

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
