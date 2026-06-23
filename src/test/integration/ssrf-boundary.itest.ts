/**
 * Risk #3 — SSRF-Boundary (test-plan §2).
 *
 * Der Guard `isPublicHttpsUrl` ist isoliert unit-getestet (`url-guard.test.ts`).
 * Diese Suite testet NICHT die volle Form-Matrix erneut, sondern beweist die
 * VERDRAHTUNG an den ZWEI separaten, unabhängigen Call-Sites (es gibt keinen
 * gemeinsamen Outbound-Wrapper):
 *   1. test-connection (Route): frische URL (Zod-refine) + gespeicherte URL
 *      (Defense-in-depth, Call-Zeit) + 3xx-Redirect-Block.
 *   2. Run-Step (`chatCompletion` via `processNextRepetition`): der Guard wirft
 *      VOR dem fetch → die Repetition wird `failed`; + 3xx-Redirect-Block.
 *
 * Repräsentative Payloads je Site (§2-Anti-Pattern: nicht url-guard.test.ts spiegeln).
 * Mock-Grenze (§6.2): nur die ausgehende LLM-fetch-Kante; Supabase/RLS laufen echt.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { processNextRepetition } from "@/lib/services/runs";
import { POST as testConnectionPost } from "@/pages/api/models/test-connection";
import { cleanupTestAccount, createTestAccount, type TestAccount } from "./accounts";
import { makeModelConfig, makePersona, makeRunningRun } from "./fixtures";
import { mockLlmContent, mockLlmRedirect, restoreLlm } from "./llm-mock";
import { authedCookieHeader, makeApiContext } from "./route-context";

const TC_URL = "http://localhost/api/models/test-connection";
const GUARD_OK_URL = "https://api.example.com/v1";

/** Repräsentative SSRF-Payloads (volle Matrix → `url-guard.test.ts`). */
const SSRF_URLS = {
  metadata: "https://169.254.169.254", // Cloud-Metadata
  localhost: "https://localhost",
  dword: "https://2852039166", // numerische (dword) Form von 169.254.169.254
};

describe("Risk #3 — SSRF-Boundary", () => {
  let account: TestAccount;
  let cookie: string;
  let personaId: string;

  beforeAll(async () => {
    account = await createTestAccount();
    cookie = await authedCookieHeader(account);
    personaId = (await makePersona(account, "global")).id;
  });

  afterAll(async () => {
    await cleanupTestAccount(account);
  });

  afterEach(() => {
    restoreLlm();
  });

  /** base_url eines Configs direkt setzen — umgeht den Service-Guard (gespeicherte bösartige URL). */
  async function setBaseUrl(configId: string, url: string): Promise<void> {
    const { error } = await account.client.from("model_configs").update({ base_url: url }).eq("id", configId);
    if (error) throw new Error(`setBaseUrl: ${error.message}`);
  }

  /** Status + Fehlertext der jüngsten Repetition eines Laufs. */
  async function lastRep(runId: string): Promise<{ status: string; error: string | null }> {
    const { data, error } = await account.client
      .from("run_repetitions")
      .select("status, error")
      .eq("run_id", runId)
      .order("rep_index", { ascending: false })
      .limit(1)
      .single();
    if (error) throw new Error(`lastRep: ${error.message}`);
    return data;
  }

  describe("Call-Site 1 — test-connection (Route)", () => {
    it("authentifizierter Aufruf mit gültiger URL erreicht den Guard (kein 401)", async () => {
      mockLlmContent(); // probeModels GET /models → 200
      const res = await testConnectionPost(
        makeApiContext({ method: "POST", url: TC_URL, cookie, json: { baseUrl: GUARD_OK_URL, apiKey: "x" } }),
      );
      expect(res.status).not.toBe(401);
    });

    it.each(Object.entries(SSRF_URLS))("frische SSRF-URL (%s) → 400 (validationError)", async (_name, url) => {
      const res = await testConnectionPost(
        makeApiContext({ method: "POST", url: TC_URL, cookie, json: { baseUrl: url, apiKey: "x" } }),
      );
      expect(res.status).toBe(400);
    });

    it("gespeicherte SSRF-URL → ok:false (Defense-in-depth zur Call-Zeit)", async () => {
      const config = await makeModelConfig(account);
      await setBaseUrl(config.id, SSRF_URLS.metadata);
      const res = await testConnectionPost(
        makeApiContext({ method: "POST", url: TC_URL, cookie, json: { configId: config.id } }),
      );
      const body = (await res.json()) as { ok: boolean; reason?: string };
      expect(body.ok).toBe(false);
      expect(body.reason).toContain("base_url");
    });

    it("3xx-Redirect (guard-passende URL) → ok:false (Redirect-Block)", async () => {
      mockLlmRedirect(302);
      const res = await testConnectionPost(
        makeApiContext({ method: "POST", url: TC_URL, cookie, json: { baseUrl: GUARD_OK_URL, apiKey: "x" } }),
      );
      const body = (await res.json()) as { ok: boolean; reason?: string };
      expect(body.ok).toBe(false);
      expect(body.reason).toMatch(/redirect/i);
    });
  });

  describe("Call-Site 2 — Run-Step (chatCompletion)", () => {
    it("gespeicherte SSRF-URL → Repetition failed (Guard wirft VOR dem fetch)", async () => {
      const config = await makeModelConfig(account);
      await setBaseUrl(config.id, SSRF_URLS.metadata);
      const run = await makeRunningRun(account, personaId, config.id, 0, 3);
      // KEIN fetch-Mock: griffe der Guard nicht, käme es zum echten Outbound-fetch.
      const progress = await processNextRepetition(account.client, account.userId, run.id);
      expect(progress?.failedCount).toBe(1);
      const rep = await lastRep(run.id);
      expect(rep.status).toBe("failed");
      expect(rep.error).toMatch(/public https URL/i);
    });

    it("3xx-Redirect (guard-passende URL) → Repetition failed (Redirect-Block)", async () => {
      mockLlmRedirect(302);
      const config = await makeModelConfig(account);
      const run = await makeRunningRun(account, personaId, config.id, 0, 3);
      const progress = await processNextRepetition(account.client, account.userId, run.id);
      expect(progress?.failedCount).toBe(1);
      const rep = await lastRep(run.id);
      expect(rep.status).toBe("failed");
      expect(rep.error).toMatch(/redirect/i);
    });

    it("Positiv-Kontrolle: guard-passende URL + valide Antwort → Repetition ok", async () => {
      mockLlmContent();
      const config = await makeModelConfig(account);
      const run = await makeRunningRun(account, personaId, config.id, 0, 3);
      const progress = await processNextRepetition(account.client, account.userId, run.id);
      const rep = await lastRep(run.id);
      expect(rep.status).toBe("ok");
      expect(progress?.failedCount).toBe(0);
    });
  });
});
