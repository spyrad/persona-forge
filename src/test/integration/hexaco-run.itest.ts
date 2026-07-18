/**
 * HEXACO-Lauf end-to-end (Feature hexaco-instrument, Plan 3.3 / Phase-3-Gate).
 *
 * Faehrt einen kompletten HEXACO-Lauf ueber die echte Orchestrierung
 * (`createRun` → `processNextRepetition`-Loop → `getRunResult`); Supabase/RLS
 * laufen echt, nur die ausgehende LLM-fetch-Kante ist gemockt (`mockLlmContent`
 * mit `hexacoAnswersJson`). Beweist: der neue kind='hexaco' persistiert, laeuft
 * ueber den item-basierten Pfad und liefert 6 Faktor-Verteilungen OHNE Modaltyp.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createRun, getRunResult, processNextRepetition } from "@/lib/services/runs";
import { cleanupTestAccount, createTestAccount, type TestAccount } from "./accounts";
import { makeModelConfig } from "./fixtures";
import { hexacoAnswersJson, mockLlmContent, restoreLlm } from "./llm-mock";

describe("hexaco run (integration)", () => {
  let account: TestAccount;
  let modelConfigId: string;

  beforeAll(async () => {
    account = await createTestAccount();
    modelConfigId = (await makeModelConfig(account)).id;
  });

  afterAll(async () => {
    await cleanupTestAccount(account);
  });

  afterEach(() => {
    restoreLlm();
  });

  it("faehrt einen HEXACO-Baseline-Lauf und liefert 6 Faktor-Verteilungen ohne Modaltyp", async () => {
    // Alle 60 Items = 4 → deterministische, verwertbare Antwort je Wiederholung.
    mockLlmContent(hexacoAnswersJson(4));
    const run = await createRun(account.client, account.userId, {
      kind: "hexaco",
      personaId: null, // Baseline
      modelConfigId,
      instrumentId: "hexaco-ipip-60",
      repetitionCount: 2,
    });
    if (!run) throw new Error("createRun lieferte null (Modellkonfig nicht sichtbar?)");
    expect(run.kind).toBe("hexaco");

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
    expect(result?.steadfastness).toBeNull();
    expect(result?.aggregate).not.toBeNull();

    const agg = result?.aggregate;
    // 6 Faktoren H/E/X/A/C/O, jeder mit 2 verwertbaren Wiederholungen.
    expect(agg?.axes.map((a) => a.key)).toEqual(["H", "E", "X", "A", "C", "O"]);
    for (const axis of agg?.axes ?? []) {
      expect(axis.usableCount).toBe(2);
      expect(axis.scores).toHaveLength(2);
      expect(axis.mean).not.toBeNull();
    }
    // HEXACO ist dimensional — kein Modaltyp/Typ-Code.
    expect(agg?.modalType).toBeNull();
    expect(agg?.typeConsistency).toBeNull();
  });
});
