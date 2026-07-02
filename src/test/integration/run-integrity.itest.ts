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

    it("Nebenläufigkeit: zwei parallele steps bleiben integer (23505-Catch, keine Duplikate)", async () => {
      mockLlmContent();
      const run = await makeRunningRun(account, personaId, modelConfigId, 0, 3);

      const [p1, p2] = await Promise.all([
        processNextRepetition(account.client, account.userId, run.id),
        processNextRepetition(account.client, account.userId, run.id),
      ]);

      // Kein Call propagiert die unique-Verletzung nach außen.
      expect(p1).not.toBeNull();
      expect(p2).not.toBeNull();

      // Die Anzahl hängt am Interleaving: zielen beide auf rep_index=1, fängt der
      // 23505-Catch den Verlierer → 1 Repetition; läuft einer ganz durch, bevor der
      // andere zählt, entstehen rep_index 1 & 2 → 2 Repetitions. Beides ist integer
      // (deterministisch geseedet, keine Duplikate) — die Garantie ist NICHT „genau
      // eine", sondern „kein Duplikat, keine Lücke, kein Überschreiten".
      const reps = await repRows(run.id);
      expect(reps.length).toBeGreaterThanOrEqual(1);
      expect(reps.length).toBeLessThanOrEqual(2);
      expect(reps.length).toBeLessThanOrEqual(run.repetitionCount);

      // rep_index ist exakt die lückenlose Menge {1..n} — eindeutig (kein Duplikat
      // dank unique(run_id, rep_index)) und ohne Lücke ab 1.
      expect(reps.map((r) => r.rep_index)).toEqual(Array.from({ length: reps.length }, (_, i) => i + 1));

      // Beide Calls melden gültigen, nicht-lügenden Fortschritt; der zuletzt
      // abgeschlossene entspricht der tatsächlichen Repetition-Zahl.
      for (const p of [p1, p2]) {
        expect(p?.completedReps).toBeGreaterThanOrEqual(1);
        expect(p?.completedReps).toBeLessThanOrEqual(reps.length);
      }
      expect(Math.max(p1?.completedReps ?? 0, p2?.completedReps ?? 0)).toBe(reps.length);
    });

    it("misst duration_ms je Wiederholung und setzt finished_at beim Abschluss", async () => {
      mockLlmContent();
      // 0 vorab eingefügte Reps, repetitionCount = 1.
      const run = await makeRunningRun(account, personaId, modelConfigId, 0, 1);

      // Schritt 1: schreibt Wiederholung 1 inkl. gemessener Dauer, Lauf bleibt "running".
      const step1 = await processNextRepetition(account.client, account.userId, run.id);
      expect(typeof step1?.lastRepDurationMs).toBe("number");

      // Schritt 2: alle Reps geschrieben → Lauf wird finalisiert (finished_at gesetzt).
      const step2 = await processNextRepetition(account.client, account.userId, run.id);
      expect(step2?.status).toBe("completed");
      expect(step2?.lastRepDurationMs).toBeNull();

      const { data: reps, error: repErr } = await account.client
        .from("run_repetitions")
        .select("duration_ms")
        .eq("run_id", run.id);
      if (repErr) throw new Error(repErr.message);
      expect(reps).toHaveLength(1);
      expect(typeof reps[0].duration_ms).toBe("number");

      const { data: runRow, error: runErr } = await account.client
        .from("runs")
        .select("finished_at, status")
        .eq("id", run.id)
        .single();
      if (runErr) throw new Error(runErr.message);
      expect(runRow.status).toBe("completed");
      expect(runRow.finished_at).not.toBeNull();
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
      expect(result?.failures).toEqual([{ message: "itest: simulierter Fehlschlag", count: 2 }]);
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
