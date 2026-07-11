/**
 * Model Compare Phase 2 — echte Query-Pfade des model-profiles-Service gegen
 * lokales Supabase (der reine Kern ist unit-getestet):
 *   (a) Batch-Query + Pooling: 2 Baseline-Laeufe → ein Profil, Reps gepoolt.
 *   (b) Baseline-Filter auf echten Zeilen: Persona-Lauf wird gezaehlt ausgeschlossen.
 *   (c) RLS-Scoping: B sieht A's Modell NICHT — obwohl A's Laeufe `global`
 *       sichtbar sind, ist A's Config es nicht (owner-only) → kein aufloesbarer
 *       modelName, serverseitig gefiltert.
 *   (d) Geloeschte Config: FK `on delete set null` → Profil verschwindet.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deleteModelConfig } from "@/lib/services/model-configs";
import { getModelProfiles, listModelProfiles } from "@/lib/services/model-profiles";
import { cleanupTestAccount, createTestAccount, type TestAccount } from "./accounts";
import { makeCompletedRun, makeFailedRun, makeModelConfig, makePersona } from "./fixtures";

describe("model-profiles Service (Queries + RLS)", () => {
  let A: TestAccount;
  let B: TestAccount;

  beforeAll(async () => {
    A = await createTestAccount();
    B = await createTestAccount();

    const cfg = await makeModelConfig(A);
    const persona = await makePersona(A, "global");
    // 2 Baseline-Laeufe (2 + 3 verwertbare Reps) + 1 Persona-Lauf (global sichtbar).
    await makeFailedRun(A, null, cfg.id, 2, 0);
    await makeFailedRun(A, null, cfg.id, 3, 0);
    await makeCompletedRun(A, persona.id, cfg.id, "global");
  });

  afterAll(async () => {
    await cleanupTestAccount(A);
    await cleanupTestAccount(B);
  });

  it("(a) poolt Baseline-Laeufe zu einem Profil (Batch-Query, keine Per-Lauf-Schleife)", async () => {
    const items = await listModelProfiles(A.client);
    const item = items.find((i) => i.modelName === "test-model");
    expect(item).toBeDefined();
    expect(item?.runCount).toBe(2);
    expect(item?.usableReps).toBe(5); // 2 + 3 gepoolt
    expect(item?.instruments).toEqual(["oejts"]);
  });

  it("(b) zaehlt den Persona-Lauf als ausgeschlossen, poolt ihn aber nicht", async () => {
    const [profile] = await getModelProfiles(A.client, ["test-model"]);
    expect(profile.meta.excludedPersonaRuns).toBe(1);
    expect(profile.meta.runCount).toBe(2);
    const section = profile.sections[0];
    expect(section.kind).toBe("oejts");
    expect(section.usableReps).toBe(5);
    expect(profile.meta.providerHosts).toEqual(["api.example.com"]);
  });

  it("(c) RLS: B sieht A's Modell nicht — globale Lauf-Sichtbarkeit reicht nicht ohne eigene Config", async () => {
    const items = await listModelProfiles(B.client);
    expect(items.find((i) => i.modelName === "test-model")).toBeUndefined();
    expect(await getModelProfiles(B.client, ["test-model"])).toEqual([]);
  });

  it("(d) geloeschte Config → Laeufe unaufloesbar → Profil verschwindet", async () => {
    const throwaway = await makeModelConfig(A, "sk-throwaway", { modelName: "throwaway-model" });
    await makeFailedRun(A, null, throwaway.id, 1, 0);
    expect((await listModelProfiles(A.client)).some((i) => i.modelName === "throwaway-model")).toBe(true);

    expect(await deleteModelConfig(A.client, throwaway.id)).toBe(true);
    expect((await listModelProfiles(A.client)).some((i) => i.modelName === "throwaway-model")).toBe(false);
  });
});
