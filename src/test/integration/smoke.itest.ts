/**
 * Smoke-Test: beweist, dass das Integration-Harness steht — zwei Accounts
 * lassen sich anlegen, authentifizieren, und sehen über die Service-Schicht
 * ihre (leere) eigene Modellkonfig-Liste. Verifiziert nebenbei, dass der
 * `astro:env/server`-Stub-Pfad (über `listModelConfigs` → `encryption-key`)
 * sauber auflöst.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { listModelConfigs } from "@/lib/services/model-configs";
import { cleanupTestAccount, createTestAccount, type TestAccount } from "./accounts";
import { makeFailedRun, makeModelConfig, makePendingRun, makePersona, makeRunningRun } from "./fixtures";
import { mockLlmContent, oejtsAnswersJson, restoreLlm } from "./llm-mock";

describe("integration smoke: two authenticated accounts", () => {
  let accountA: TestAccount;
  let accountB: TestAccount;

  beforeAll(async () => {
    accountA = await createTestAccount();
    accountB = await createTestAccount();
  });

  afterAll(async () => {
    await cleanupTestAccount(accountA);
    await cleanupTestAccount(accountB);
  });

  it("beide Accounts sind authentifiziert mit eigener User-ID", () => {
    expect(accountA.userId).toBeTruthy();
    expect(accountB.userId).toBeTruthy();
    expect(accountA.userId).not.toBe(accountB.userId);
  });

  it("jeder Account sieht seine eigene (leere) Modellkonfig-Liste", async () => {
    await expect(listModelConfigs(accountA.client)).resolves.toEqual([]);
    await expect(listModelConfigs(accountB.client)).resolves.toEqual([]);
  });
});

/** Phase-2-Harness-Smoke: die neuen Run-Builder + der fetch-Kanten-Mock stehen. */
describe("integration smoke: Phase-2-Harness (Run-Builder + LLM-Mock)", () => {
  let account: TestAccount;
  let personaId: string;
  let modelConfigId: string;

  beforeAll(async () => {
    account = await createTestAccount();
    personaId = (await makePersona(account, "global")).id;
    modelConfigId = (await makeModelConfig(account)).id;
  });

  afterAll(async () => {
    await cleanupTestAccount(account);
  });

  afterEach(() => {
    restoreLlm();
  });

  async function countReps(runId: string): Promise<number> {
    const { count } = await account.client
      .from("run_repetitions")
      .select("id", { count: "exact", head: true })
      .eq("run_id", runId);
    return count ?? 0;
  }

  // Die Builder geben den createRun-Snapshot zurück (status=pending, wie makeCompletedRun);
  // der nach dem Update wirksame Status wird frisch aus der DB gelesen.
  async function dbStatus(runId: string): Promise<string> {
    const { data } = await account.client.from("runs").select("status, failed_count").eq("id", runId).single();
    return (data as { status: string }).status;
  }

  it("makePendingRun: Status pending, 0 Repetitions", async () => {
    const run = await makePendingRun(account, personaId, modelConfigId);
    expect(await dbStatus(run.id)).toBe("pending");
    expect(await countReps(run.id)).toBe(0);
  });

  it("makeRunningRun: DB-Status running, genau writtenReps Repetitions", async () => {
    const run = await makeRunningRun(account, personaId, modelConfigId, 2, 3);
    expect(await dbStatus(run.id)).toBe("running");
    expect(await countReps(run.id)).toBe(2);
  });

  it("makeFailedRun: DB-Status completed (≥1 ok), failed + ok Repetitions geschrieben", async () => {
    const run = await makeFailedRun(account, personaId, modelConfigId, 2, 1);
    expect(await dbStatus(run.id)).toBe("completed");
    expect(await countReps(run.id)).toBe(3);
  });

  it("mockLlmContent: fetch-Stub liefert valide OEJTS-Completion-Shape", async () => {
    mockLlmContent();
    const res = await fetch("https://api.example.com/v1/chat/completions");
    const body = (await res.json()) as { choices: { message: { content: string } }[] };
    expect(body.choices[0].message.content).toBe(oejtsAnswersJson());
  });
});
