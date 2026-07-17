import { describe, expect, it } from "vitest";
import { createSchema } from "@/pages/api/runs/create-schema";

describe("createSchema (diskriminiert nach kind)", () => {
  it("OEJTS: ohne kind → default 'oejts', ohne adversary gültig", () => {
    const r = createSchema.safeParse({
      personaId: "11111111-1111-4111-8111-111111111111",
      modelConfigId: "22222222-2222-4222-8222-222222222222",
      repetitionCount: 5,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.kind).toBe("oejts");
  });

  it("Steadfastness: braucht adversaryModelConfigId + maxRounds", () => {
    const ok = createSchema.safeParse({
      kind: "steadfastness",
      personaId: "11111111-1111-4111-8111-111111111111",
      modelConfigId: "22222222-2222-4222-8222-222222222222",
      adversaryModelConfigId: "33333333-3333-4333-8333-333333333333",
      repetitionCount: 5,
      maxRounds: 12,
    });
    expect(ok.success).toBe(true);
  });

  it("Steadfastness ohne adversary → Fehler", () => {
    const bad = createSchema.safeParse({
      kind: "steadfastness",
      personaId: "11111111-1111-4111-8111-111111111111",
      modelConfigId: "22222222-2222-4222-8222-222222222222",
      repetitionCount: 5,
      maxRounds: 12,
    });
    expect(bad.success).toBe(false);
  });

  it("HEXACO: kind 'hexaco' → instrumentId default 'hexaco-ipip-60'", () => {
    const r = createSchema.safeParse({
      kind: "hexaco",
      personaId: "11111111-1111-4111-8111-111111111111",
      modelConfigId: "22222222-2222-4222-8222-222222222222",
      repetitionCount: 5,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.kind).toBe("hexaco");
      if (r.data.kind === "hexaco") expect(r.data.instrumentId).toBe("hexaco-ipip-60");
    }
  });

  it("HEXACO: expliziter instrumentId wird durchgereicht, invalider repetitionCount abgelehnt", () => {
    const ok = createSchema.safeParse({
      kind: "hexaco",
      personaId: null,
      modelConfigId: "22222222-2222-4222-8222-222222222222",
      instrumentId: "hexaco-ipip-60",
      repetitionCount: 3,
    });
    expect(ok.success).toBe(true);
    const bad = createSchema.safeParse({
      kind: "hexaco",
      personaId: null,
      modelConfigId: "22222222-2222-4222-8222-222222222222",
      repetitionCount: 0,
    });
    expect(bad.success).toBe(false);
  });

  it("Baseline: personaId null ist gültig (beide kinds)", () => {
    const oejts = createSchema.safeParse({
      personaId: null,
      modelConfigId: "22222222-2222-4222-8222-222222222222",
      repetitionCount: 5,
    });
    expect(oejts.success).toBe(true);
    if (oejts.success) expect(oejts.data.personaId).toBeNull();

    const steadfast = createSchema.safeParse({
      kind: "steadfastness",
      personaId: null,
      modelConfigId: "22222222-2222-4222-8222-222222222222",
      adversaryModelConfigId: "33333333-3333-4333-8333-333333333333",
      repetitionCount: 5,
      maxRounds: 12,
    });
    expect(steadfast.success).toBe(true);
  });

  it("personaId FEHLEND (undefined) bleibt ein Fehler — nullable, nicht optional", () => {
    const bad = createSchema.safeParse({
      modelConfigId: "22222222-2222-4222-8222-222222222222",
      repetitionCount: 5,
    });
    expect(bad.success).toBe(false);
  });
});
