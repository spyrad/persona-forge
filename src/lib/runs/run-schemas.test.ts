import { describe, expect, it } from "vitest";
import { runProgressSchema, runViewArraySchema, runViewSchema } from "@/lib/runs/run-schemas";

/** Bekannt-gute RunView-Form (camelCase, wie `services/runs.ts#toView` liefert). */
function goodRunView() {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    personaId: "22222222-2222-2222-2222-222222222222",
    modelConfigId: "33333333-3333-3333-3333-333333333333",
    instrumentId: "oejts-1.2",
    repetitionCount: 10,
    status: "running",
    promptTokens: 1234,
    completionTokens: 567,
    failedCount: 0,
    completedReps: 3,
    visibility: "private",
    isOwn: true,
    createdAt: "2026-06-30T00:00:00.000Z",
    updatedAt: "2026-06-30T00:01:00.000Z",
    finishedAt: "2026-06-30T00:03:00.000Z",
  };
}

/** Bekannt-gute RunProgress-Form (Step-Response). */
function goodRunProgress() {
  return {
    status: "running",
    completedReps: 3,
    totalReps: 10,
    failedCount: 1,
    promptTokens: 1234,
    completionTokens: 567,
    lastRepDurationMs: 33000,
    lastRepError: null,
  };
}

describe("runViewSchema", () => {
  it("akzeptiert eine bekannt-gute Server-Shape", () => {
    expect(runViewSchema.safeParse(goodRunView()).success).toBe(true);
  });

  it("akzeptiert null fuer personaId/modelConfigId (globale/owner-lose Laeufe)", () => {
    const v = { ...goodRunView(), personaId: null, modelConfigId: null };
    expect(runViewSchema.safeParse(v).success).toBe(true);
  });

  it("akzeptiert finishedAt = null", () => {
    const v = { ...goodRunView(), finishedAt: null };
    expect(runViewSchema.safeParse(v).success).toBe(true);
  });

  it("weist Drift ab: umbenanntes Feld (failedCount → failures)", () => {
    const { failedCount: _drop, ...rest } = goodRunView();
    const drifted = { ...rest, failures: 0 };
    expect(runViewSchema.safeParse(drifted).success).toBe(false);
  });

  it("weist Drift ab: falscher Typ (repetitionCount als string)", () => {
    const drifted = { ...goodRunView(), repetitionCount: "10" };
    expect(runViewSchema.safeParse(drifted).success).toBe(false);
  });

  it("weist unbekannte status/visibility-Literale ab (z.enum-Kopie)", () => {
    expect(runViewSchema.safeParse({ ...goodRunView(), status: "cancelled" }).success).toBe(false);
    expect(runViewSchema.safeParse({ ...goodRunView(), visibility: "public" }).success).toBe(false);
  });

  it("non-strict: ein additives unbekanntes Feld bricht NICHT (rueckwaerts-kompatibel)", () => {
    // Pinnt die non-strict-Semantik fest: kein spaeteres `.strict()` soll additive
    // Server-Felder zu einem Drift-Banner machen. Unbekannter Key wird gestrippt.
    const additive = { ...goodRunView(), serverAddedLater: "irrelevant" };
    const result = runViewSchema.safeParse(additive);
    expect(result.success).toBe(true);
    if (result.success) {
      expect("serverAddedLater" in result.data).toBe(false);
    }
  });
});

describe("runViewArraySchema", () => {
  it("akzeptiert ein leeres Array", () => {
    expect(runViewArraySchema.safeParse([]).success).toBe(true);
  });

  it("akzeptiert ein Array bekannt-guter Shapes", () => {
    expect(runViewArraySchema.safeParse([goodRunView(), goodRunView()]).success).toBe(true);
  });

  it("weist das ganze Array ab, wenn EIN Element driftet", () => {
    const { id: _drop, ...broken } = goodRunView();
    expect(runViewArraySchema.safeParse([goodRunView(), broken]).success).toBe(false);
  });
});

describe("runProgressSchema", () => {
  it("akzeptiert eine bekannt-gute Step-Response", () => {
    expect(runProgressSchema.safeParse(goodRunProgress()).success).toBe(true);
  });

  it("weist Drift ab: fehlendes Feld (totalReps)", () => {
    const { totalReps: _drop, ...drifted } = goodRunProgress();
    expect(runProgressSchema.safeParse(drifted).success).toBe(false);
  });

  it("non-strict: ein additives unbekanntes Feld bricht NICHT", () => {
    const additive = { ...goodRunProgress(), serverAddedLater: 42 };
    expect(runProgressSchema.safeParse(additive).success).toBe(true);
  });

  it("akzeptiert lastRepDurationMs = null", () => {
    const p = { ...goodRunProgress(), lastRepDurationMs: null };
    expect(runProgressSchema.safeParse(p).success).toBe(true);
  });

  it("weist Drift ab: fehlendes lastRepError", () => {
    const { lastRepError: _drop, ...drifted } = goodRunProgress();
    expect(runProgressSchema.safeParse(drifted).success).toBe(false);
  });
});
