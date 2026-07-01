# z.ai thinking:disabled Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `chatCompletion` sendet `thinking:{type:"disabled"}` nur an z.ai-Endpunkte, damit GLM-Läufe schnell und mit direkt parsebarem JSON antworten.

**Architecture:** Reiner exportierter Host-Gate-Helfer `isZaiEndpoint(baseUrl)` plus additives Feld im bestehenden Request-Body von `chatCompletion`. Eine Datei + ein neuer Test. Keine Migration, keine UI, kein neuer Dependency.

**Tech Stack:** TypeScript, Vitest (Node-Env, Docker-frei).

## Global Constraints

- Änderungen ausschließlich in `src/lib/llm/openai-compatible.ts` (+ neue Testdatei).
- Additiv/verhaltenserhaltend für Nicht-z.ai: `api.openai.com` bekommt das Feld nie.
- Detektion per **Hostname** (`new URL(baseUrl).hostname.endsWith("z.ai")`), nicht per `includes`.
- Reiner Helfer ohne I/O (unit-testbar).
- Unit-Tests: `npm run test` (Vitest, Node-Env, `src/**/*.test.ts`).
- Kein Push in diesem Plan — nur lokale Commits; Deploy separat mit User-Go.

---

### Task 1: `isZaiEndpoint` + `thinking:disabled`-Wiring

**Files:**

- Modify: `src/lib/llm/openai-compatible.ts` (Helfer exportieren + Body erweitern)
- Test: `src/lib/llm/openai-compatible.test.ts` (neu)

**Interfaces:**

- Consumes: bestehendes `chatCompletion(args: ChatCompletionArgs)` und dessen `args.baseUrl`/`args.model`/`args.messages`.
- Produces: `isZaiEndpoint(baseUrl: string): boolean` (exportiert); `chatCompletion` sendet bei z.ai-Host zusätzlich `thinking: { type: "disabled" }` im JSON-Body.

- [ ] **Step 1: Failing test schreiben**

Erstelle `src/lib/llm/openai-compatible.test.ts`:

```ts
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
```

- [ ] **Step 2: Test ausführen, Fehlschlag verifizieren**

Run: `npm run test -- src/lib/llm/openai-compatible.test.ts`
Expected: FAIL — `isZaiEndpoint` ist noch nicht exportiert (Import schlägt fehl) bzw. der z.ai-Body enthält noch kein `thinking`.

- [ ] **Step 3: Helfer exportieren**

In `src/lib/llm/openai-compatible.ts` direkt vor `export async function chatCompletion` (heute Zeile ~105) den Helfer einfügen:

```ts
/** True, wenn der Endpunkt zu z.ai gehört (Host endet auf „z.ai"). Nur dann sendet
 *  der Client `thinking:{type:"disabled"}`, da GLM-Modelle sonst per Default reasonen. */
export function isZaiEndpoint(baseUrl: string): boolean {
  try {
    return new URL(baseUrl).hostname.endsWith("z.ai");
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Body-Wiring in `chatCompletion`**

In `chatCompletion`, nach `let lastError = "request failed";` (heute Zeile ~112) und VOR der `for`-Schleife die Konstante ergänzen:

```ts
let lastError = "request failed";
// z.ai-GLM reasont per Default (langsam) — für z.ai-Hosts abschalten. OpenAI würde
// ein unbekanntes Feld mit 400 ablehnen, daher gehostet-gated.
const disableThinking = isZaiEndpoint(args.baseUrl);
```

Und im `body: JSON.stringify({...})` (heute Zeile ~125-129) das Feld additiv anhängen:

```ts
        body: JSON.stringify({
          model: args.model,
          messages: args.messages,
          ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
          ...(disableThinking ? { thinking: { type: "disabled" } } : {}),
        }),
```

- [ ] **Step 5: Test ausführen, Erfolg verifizieren**

Run: `npm run test -- src/lib/llm/openai-compatible.test.ts`
Expected: PASS (4 Fälle: 2× `isZaiEndpoint`, z.ai-Body mit `thinking`, OpenAI-Body ohne).

- [ ] **Step 6: Voller Unit-Lauf + Build**

Run: `npm run test`
Expected: alle Tests grün (bisher 73 + 4 neue).

Run: `npm run build`
Expected: Typecheck + Build grün.

- [ ] **Step 7: Commit**

```bash
git add src/lib/llm/openai-compatible.ts src/lib/llm/openai-compatible.test.ts
git commit -m "feat(llm): thinking:disabled fuer z.ai-Endpunkte (schnelle GLM-Laeufe)"
```

---

## Deployment (nach Abnahme, mit User-Go)

Reiner Code-Change (keine Migration). `main` pushen → Worker-Deploy + CI. Live-Abnahme:
z.ai-Lauf starten → Wiederholungen laufen in ~2–3 s statt 10–16 s durch, Ergebnis zügig.
