/**
 * Standhaftigkeits-Lauf end-to-end (test-plan §6, Task 11).
 *
 * Fährt einen kompletten `steadfastness`-Lauf (2 Fakten, maxRounds 2) über die
 * echte Orchestrierung (`createRun` → `processNextRepetition`-Loop → `getRunResult`);
 * Supabase/RLS laufen echt, nur die ausgehende LLM-fetch-Kante ist gemockt
 * (`mockLlmSteadfastness`, rollen-routend nach Request-Body). Der gemockte Prüfling
 * hält immer die wahre Antwort ("Blue") → das Aggregat muss 0 Kapitulationen zeigen.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createRun, getRunResult, processNextRepetition } from "@/lib/services/runs";
import { cleanupTestAccount, createTestAccount, type TestAccount } from "./accounts";
import { makeModelConfig, makePersona } from "./fixtures";
import { mockLlmSteadfastness, restoreLlm } from "./llm-mock";

describe("steadfastness run (integration)", () => {
  let account: TestAccount;
  let personaId: string;
  let subjectModelId: string;
  let adversaryModelId: string;

  beforeAll(async () => {
    account = await createTestAccount();
    personaId = (await makePersona(account, "global")).id;
    subjectModelId = (await makeModelConfig(account)).id;
    adversaryModelId = (await makeModelConfig(account)).id;
  });

  afterAll(async () => {
    await cleanupTestAccount(account);
  });

  afterEach(() => {
    restoreLlm();
  });

  it("fährt einen steadfastness-Lauf end-to-end und liefert ein Aggregat", async () => {
    mockLlmSteadfastness(2);
    const run = await createRun(account.client, account.userId, {
      kind: "steadfastness",
      personaId,
      modelConfigId: subjectModelId,
      adversaryModelConfigId: adversaryModelId,
      repetitionCount: 2,
      maxRounds: 2,
    });
    if (!run) throw new Error("createRun lieferte null (Persona/Modellkonfig nicht sichtbar?)");

    // Client-Loop bis terminal (Obergrenze als Endlosschleifen-Schutz).
    let status = run.status;
    for (let i = 0; i < 50 && status !== "completed" && status !== "failed"; i++) {
      const p = await processNextRepetition(account.client, account.userId, run.id);
      if (!p) throw new Error("processNextRepetition lieferte null (Lauf nicht mehr sichtbar?)");
      status = p.status;
    }
    expect(status).toBe("completed");

    const result = await getRunResult(account.client, account.userId, run.id);
    expect(result?.state).toBe("ready");
    expect(result?.aggregate).toBeNull(); // Steadfastness nutzt nicht das OEJTS-Aggregat
    expect(result?.steadfastness).not.toBeNull();
    expect(result?.steadfastness?.usableCount).toBe(2);
    // Der gemockte Prüfling hält immer „Blue" → keine Kapitulation.
    expect(result?.steadfastness?.capitulatedCount).toBe(0);
    expect(result?.steadfastness?.steadfastnessScore).toBe(1);
  });
});
