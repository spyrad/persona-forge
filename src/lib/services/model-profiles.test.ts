/**
 * Unit-Tests des reinen Aggregations-Kerns `buildModelProfiles` (kein I/O) —
 * die Randfall-Regeln der Spec, je Regel ein Test. Die echten Queries + RLS
 * deckt `model-profiles.itest.ts` ab.
 */
import { describe, expect, it } from "vitest";
import { HEXACO } from "@/lib/instruments/hexaco";
import { OEJTS } from "@/lib/instruments/oejts";
import {
  buildModelProfiles,
  type ProfileConfigRow,
  type ProfileRepRow,
  type ProfileRunRow,
} from "@/lib/services/model-profiles";
import type { ItemValue, SteadfastnessExperiment } from "@/types";

// ─── Fixture-Bauer ───────────────────────────────────────────────────────────

function config(id: string, modelName: string, baseUrl = "https://api.example.com/v1", label = `cfg-${id}`) {
  return { id, label, base_url: baseUrl, model_name: modelName } satisfies ProfileConfigRow;
}

let runSeq = 0;
// instrument_id folgt dem kind (serverseitig gebunden, wie createRun) — Tests
// bekommen es automatisch passend, sofern nicht explizit ueberschrieben.
const INSTRUMENT_ID_BY_KIND: Record<string, string> = {
  oejts: "oejts-1.2",
  hexaco: "hexaco-ipip-60",
  steadfastness: "steadfastness",
};
function run(configId: string | null, overrides: Partial<ProfileRunRow> = {}): ProfileRunRow {
  runSeq += 1;
  const kind = overrides.kind ?? "oejts";
  return {
    id: `run-${String(runSeq)}`,
    persona_id: null,
    model_config_id: configId,
    persona_prompt_snapshot: "",
    kind,
    instrument_id: INSTRUMENT_ID_BY_KIND[kind],
    created_at: `2026-07-0${String((runSeq % 8) + 1)}T10:00:00Z`,
    finished_at: null,
    ...overrides,
  };
}

/** Volle OEJTS-Item-Werte mit gegebenem Skalenwert — eine verwertbare Rep. */
function fullItemValues(value: number): ItemValue[] {
  return OEJTS.items.map((it) => ({ id: it.id, value, status: "ok" }));
}

function oejtsRep(runId: string, value = 3): ProfileRepRow {
  return { run_id: runId, item_values: fullItemValues(value), experiment: null };
}

/** Volle HEXACO-Item-Werte (60 Items) — eine verwertbare Rep. */
function hexacoRep(runId: string, value = 4): ProfileRepRow {
  return {
    run_id: runId,
    item_values: HEXACO.items.map((it) => ({ id: it.id, value, status: "ok" })),
    experiment: null,
  };
}

function experiment(capitulated: boolean, done = true): SteadfastnessExperiment {
  return {
    scenario: { trueFact: "f", falseClaim: "l", falseAnswer: "x", openingQuestion: "?", answerChoices: ["a", "x"] },
    initialAnswer: "a",
    initialJustification: "j",
    turns: [],
    capitulated,
    capitulationRound: capitulated ? 2 : null,
    winningStrategy: capitulated ? "gaslighting" : null,
    done,
  };
}

function steadfastRep(runId: string, exp: SteadfastnessExperiment): ProfileRepRow {
  return { run_id: runId, item_values: null, experiment: exp };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("buildModelProfiles", () => {
  it("poolt Reps ueber mehrere Baseline-Laeufe desselben Modells (je Rep gleiches Gewicht)", () => {
    const cfg = config("c1", "gpt-test");
    const r1 = run("c1");
    const r2 = run("c1");
    const reps = [oejtsRep(r1.id, 1), oejtsRep(r1.id, 1), oejtsRep(r2.id, 5)];

    const [profile] = buildModelProfiles([cfg], [r1, r2], reps);
    expect(profile.meta.runCount).toBe(2);
    expect(profile.sections).toHaveLength(1);
    const section = profile.sections[0];
    expect(section.kind).toBe("oejts");
    expect(section.usableReps).toBe(3); // 2 + 1 gepoolt, nicht je Lauf gemittelt
  });

  it("schliesst Persona-Laeufe aus und zaehlt sie — inkl. geloeschter Persona (null + Snapshot gefuellt)", () => {
    const cfg = config("c1", "gpt-test");
    const baseline = run("c1");
    const withPersona = run("c1", { persona_id: "p-1", persona_prompt_snapshot: "Du bist Pirat." });
    const orphaned = run("c1", { persona_id: null, persona_prompt_snapshot: "Du warst Pirat." });

    const [profile] = buildModelProfiles([cfg], [baseline, withPersona, orphaned], [oejtsRep(baseline.id)]);
    expect(profile.meta.runCount).toBe(1);
    expect(profile.meta.excludedPersonaRuns).toBe(2);
    expect(profile.sections[0].usableReps).toBe(1);
  });

  it("Modell ohne Baseline-Laeufe erscheint nicht (nur Persona-Laeufe → nicht waehlbar)", () => {
    const cfg = config("c1", "gpt-test");
    const withPersona = run("c1", { persona_id: "p-1", persona_prompt_snapshot: "Du bist Pirat." });
    expect(buildModelProfiles([cfg], [withPersona], [])).toEqual([]);
  });

  it("Lauf mit geloeschter Config (model_config_id null) wird komplett ignoriert", () => {
    const cfg = config("c1", "gpt-test");
    const ok = run("c1");
    const orphanConfig = run(null);
    const [profile] = buildModelProfiles([cfg], [ok, orphanConfig], [oejtsRep(ok.id)]);
    expect(profile.meta.runCount).toBe(1);
    expect(profile.meta.excludedPersonaRuns).toBe(0); // nicht als Persona-Lauf fehlgezaehlt
  });

  it("fasst Configs mit gleichem modelName ueber Provider zusammen (Provider-Streuung ausgewiesen)", () => {
    const a = config("c1", "gpt-test", "https://api.openai.example/v1", "direkt");
    const b = config("c2", "gpt-test", "https://coding.zai.example/v4", "via z.ai");
    const r1 = run("c1");
    const r2 = run("c2");

    const profiles = buildModelProfiles([a, b], [r1, r2], [oejtsRep(r1.id), oejtsRep(r2.id)]);
    expect(profiles).toHaveLength(1);
    expect(profiles[0].meta.providerHosts).toEqual(["api.openai.example", "coding.zai.example"]);
    expect(profiles[0].meta.configLabels).toEqual(["direkt", "via z.ai"]);
  });

  it("Instrument ohne Daten bekommt KEINE Sektion (nur vorhandene Instrumente erscheinen)", () => {
    const cfg = config("c1", "gpt-test");
    const r1 = run("c1"); // nur OEJTS
    const [profile] = buildModelProfiles([cfg], [r1], [oejtsRep(r1.id)]);
    expect(profile.sections.map((s) => s.kind)).toEqual(["oejts"]);
  });

  it("poolt Steadfastness-Experimente ueber Laeufe; nicht-done Experimente zaehlen nicht", () => {
    const cfg = config("c1", "gpt-test");
    const r1 = run("c1", { kind: "steadfastness" });
    const r2 = run("c1", { kind: "steadfastness" });
    const reps = [
      steadfastRep(r1.id, experiment(true)),
      steadfastRep(r1.id, experiment(false)),
      steadfastRep(r2.id, experiment(false)),
      steadfastRep(r2.id, experiment(false, false)), // nicht done → unverwertbar
    ];

    const [profile] = buildModelProfiles([cfg], [r1, r2], reps);
    const section = profile.sections[0];
    expect(section.kind).toBe("steadfastness");
    expect(section.usableReps).toBe(3);
    if (section.kind === "steadfastness") {
      expect(section.aggregate.capitulatedCount).toBe(1);
      expect(section.aggregate.heldCount).toBe(2);
    }
  });

  it("baut eine HEXACO-Sektion (6 Faktoren, kein Modaltyp) neben der OEJTS-Sektion", () => {
    const cfg = config("c1", "gpt-test");
    const oejtsRun = run("c1"); // kind oejts
    const hexRun = run("c1", { kind: "hexaco" });
    const reps = [oejtsRep(oejtsRun.id, 3), hexacoRep(hexRun.id, 4), hexacoRep(hexRun.id, 2)];

    const [profile] = buildModelProfiles([cfg], [oejtsRun, hexRun], reps);
    expect(profile.sections.map((s) => s.kind)).toEqual(["oejts", "hexaco"]);

    const hex = profile.sections.find((s) => s.kind === "hexaco");
    expect(hex?.usableReps).toBe(2);
    if (hex?.kind === "hexaco") {
      expect(hex.aggregate.axes.map((a) => a.key)).toEqual(["H", "E", "X", "A", "C", "O"]);
      expect(hex.aggregate.hasModalType).toBe(false);
      expect(hex.aggregate.modalType).toBeNull();
    }
  });

  it("keine Baseline-Daten insgesamt → leere Liste; Profile alphabetisch sortiert", () => {
    expect(buildModelProfiles([], [], [])).toEqual([]);

    const a = config("c1", "zeta");
    const b = config("c2", "alpha");
    const r1 = run("c1");
    const r2 = run("c2");
    const profiles = buildModelProfiles([a, b], [r1, r2], [oejtsRep(r1.id), oejtsRep(r2.id)]);
    expect(profiles.map((p) => p.meta.modelName)).toEqual(["alpha", "zeta"]);
  });
});
