/**
 * Risk #4 — Lauf-Integrität (test-plan §2/§6.5).
 *
 * Friert drei beobachtbare Eigenschaften der Run-Engine ein — NICHT die
 * Cascade-/Catch-Mechanik selbst, sondern ihren Effekt:
 *   1. Abort verwirft den Lauf vollständig (run + alle Repetitions, via DB-Cascade).
 *   2. Der Step ist idempotent — Terminal-Status UND echte Nebenläufigkeit
 *      (23505-Unique-Catch) fügen keine Duplikat-Repetition ein.
 *   3. Ein teilweise fehlgeschlagener Lauf meldet seine Fehlerquote + ein Aggregat
 *      über die verwertbaren Reps; ein unfertiger/leerer Lauf surfacet NIE ein
 *      fake-leeres `ready`.
 *
 * Mock-Grenze (§6.2): nur die ausgehende LLM-fetch-Kante (für den Happy-Path des
 * Nebenläufigkeitstests); Supabase/RLS laufen echt.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { deleteRun, getRunResult, processNextRepetition } from "@/lib/services/runs";
import { cleanupTestAccount, createTestAccount, type TestAccount } from "./accounts";
import {
  makeCompletedRun,
  makeFailedRun,
  makeModelConfig,
  makePendingRun,
  makePersona,
  makeRunningRun,
  rowExists,
} from "./fixtures";
import { mockLlmContent, restoreLlm } from "./llm-mock";

describe("Risk #4 — Lauf-Integrität", () => {
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

  /** Repetition-Zeilen eines Laufs (id + rep_index, nach rep_index sortiert). */
  async function repRows(runId: string): Promise<{ id: string; rep_index: number }[]> {
    const { data, error } = await account.client
      .from("run_repetitions")
      .select("id, rep_index")
      .eq("run_id", runId)
      .order("rep_index");
    if (error) throw new Error(`repRows: ${error.message}`);
    return data;
  }

  describe("Abort verwirft vollständig", () => {
    it("entfernt run + alle Repetitions (DB-Cascade) und macht das Ergebnis unsichtbar", async () => {
      const run = await makeRunningRun(account, personaId, modelConfigId, 2, 3);
      const reps = await repRows(run.id);
      expect(reps).toHaveLength(2);

      const deleted = await deleteRun(account.client, run.id);
      expect(deleted).toBe(true);

      expect(await rowExists(account, "runs", run.id)).toBe(false);
      // Cascade-Gegenprobe: die Child-Repetitions sind mitgelöscht.
      expect(await rowExists(account, "run_repetitions", reps[0].id)).toBe(false);
      expect(await rowExists(account, "run_repetitions", reps[1].id)).toBe(false);
      // Kein partielles Aggregat mehr abrufbar.
      expect(await getRunResult(account.client, account.userId, run.id)).toBeNull();
    });

    it("zweiter Abort ist ein No-Op (idempotent)", async () => {
      const run = await makeRunningRun(account, personaId, modelConfigId, 1, 3);
      expect(await deleteRun(account.client, run.id)).toBe(true);
      expect(await deleteRun(account.client, run.id)).toBe(false);
    });
  });

  describe("Step-Idempotenz", () => {
    it("Terminal-Status: erneuter step fügt keine Repetition ein", async () => {
      const run = await makeCompletedRun(account, personaId, modelConfigId, "global");
      const before = (await repRows(run.id)).length;

      const progress = await processNextRepetition(account.client, account.userId, run.id);
      expect(progress?.status).toBe("completed");
      expect((await repRows(run.id)).length).toBe(before);
    });

    it("Nebenläufigkeit: zwei parallele steps → genau eine Repetition (23505-Catch)", async () => {
      mockLlmContent();
      const run = await makeRunningRun(account, personaId, modelConfigId, 0, 3);

      const [p1, p2] = await Promise.all([
        processNextRepetition(account.client, account.userId, run.id),
        processNextRepetition(account.client, account.userId, run.id),
      ]);

      // Genau eine Repetition mit rep_index=1 — der Verlierer dupliziert nicht.
      const reps = await repRows(run.id);
      expect(reps).toHaveLength(1);
      expect(reps[0].rep_index).toBe(1);
      // Beide Calls liefern konsistenten Fortschritt (kein Throw, beide ≥1 fertig).
      expect(p1).not.toBeNull();
      expect(p2).not.toBeNull();
      expect(p1?.completedReps).toBe(1);
      expect(p2?.completedReps).toBe(1);
    });
  });

  describe("Failure-Quote & kein partielles Aggregat", () => {
    it("teilweiser Fehlschlag: Fehlerquote + Aggregat über verwertbare Reps", async () => {
      const run = await makeFailedRun(account, personaId, modelConfigId, 8, 2);
      const result = await getRunResult(account.client, account.userId, run.id);

      expect(result?.state).toBe("ready");
      expect(result?.aggregate?.usableReps).toBe(8);
      expect(result?.run.failedCount).toBe(2);
      expect(result?.run.status).toBe("completed");
    });

    it("unfertiger Lauf (running/pending): kein Aggregat, state unfinished", async () => {
      const running = await makeRunningRun(account, personaId, modelConfigId, 1, 3);
      const runningResult = await getRunResult(account.client, account.userId, running.id);
      expect(runningResult?.aggregate).toBeNull();
      expect(runningResult?.state).toBe("unfinished");

      const pending = await makePendingRun(account, personaId, modelConfigId, 3);
      const pendingResult = await getRunResult(account.client, account.userId, pending.id);
      expect(pendingResult?.aggregate).toBeNull();
      expect(pendingResult?.state).toBe("unfinished");
    });

    it("Voll-Fehlschlag: status failed, state empty — kein fake-leeres ready", async () => {
      const run = await makeFailedRun(account, personaId, modelConfigId, 0, 3);
      const result = await getRunResult(account.client, account.userId, run.id);

      expect(result?.run.status).toBe("failed");
      expect(result?.state).toBe("empty");
      expect(result?.aggregate?.usableReps).toBe(0);
    });
  });
});
