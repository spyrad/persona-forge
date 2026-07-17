/**
 * Unit-Tests des reinen Dashboard-Kerns (kein I/O): `buildModelEntries` +
 * `buildDashboardSummary` mit injizierten Fake-Quellen (Plan-Entscheidung
 * „reiner Kern + DI", kein vi.mock). Die echten Queries + RLS deckt die
 * Route/E2E ab (Plan Phase 4).
 */
import { describe, expect, it, vi } from "vitest";
import { buildDashboardSummary, buildModelEntries, type DashboardSources } from "@/lib/services/dashboard";
import type { DashboardRunStats, ModelConfigView, ModelProfileView, RunAggregate } from "@/types";

// ─── Fixture-Bauer ───────────────────────────────────────────────────────────

function oejtsAggregate(modalType: string | null, typeConsistency: number | null, usableReps = 5): RunAggregate {
  return { axes: [], hasModalType: true, modalType, typeConsistency, usableReps };
}

function profile(
  modelName: string,
  overrides: { modalType?: string | null; lastRunAt?: string | null; steadfastOnly?: boolean } = {},
): ModelProfileView {
  const { modalType = "INFJ", lastRunAt = "2026-07-10T10:00:00Z", steadfastOnly = false } = overrides;
  return {
    meta: {
      modelName,
      configLabels: [`cfg-${modelName}`],
      providerHosts: ["api.example.com"],
      runCount: 2,
      excludedPersonaRuns: 0,
      firstRunAt: "2026-07-01T10:00:00Z",
      lastRunAt,
    },
    sections: steadfastOnly
      ? [
          {
            kind: "steadfastness",
            runCount: 2,
            usableReps: 4,
            aggregate: { usableCount: 4, capitulated: 1, capitulationRate: 0.25, byStrategy: [], meanRounds: 2 },
          },
        ]
      : [{ kind: "oejts", runCount: 2, usableReps: 5, aggregate: oejtsAggregate(modalType, 0.8) }],
  } as ModelProfileView;
}

function config(modelName: string): ModelConfigView {
  return {
    id: `cfg-${modelName}`,
    label: `cfg-${modelName}`,
    baseUrl: "https://api.example.com/v1",
    modelName,
    hasKey: true,
    createdAt: "2026-07-01T09:00:00Z",
    updatedAt: "2026-07-01T09:00:00Z",
  };
}

const RUN_STATS: DashboardRunStats = { count: 7, lastRunAt: "2026-07-14T20:00:00Z" };

/** Voll funktionierende Quellen; einzelne per Override kaputt machen. */
function sources(overrides: Partial<DashboardSources> = {}): DashboardSources {
  return {
    loadProfiles: () => Promise.resolve([profile("model-a")]),
    loadConfigs: () => Promise.resolve([config("model-a"), config("model-b")]),
    loadPersonaCount: () => Promise.resolve(3),
    loadRunStats: () => Promise.resolve(RUN_STATS),
    ...overrides,
  };
}

// ─── buildModelEntries ───────────────────────────────────────────────────────

describe("buildModelEntries", () => {
  it("mappt ein profiliertes Modell mit Typ, Stabilitaet und lastRunAt", () => {
    const entries = buildModelEntries([profile("model-a")], [config("model-a")]);
    expect(entries).toEqual([
      {
        modelName: "model-a",
        profiled: true,
        modalType: "INFJ",
        typeConsistency: 0.8,
        usableReps: 5,
        runCount: 2,
        lastRunAt: "2026-07-10T10:00:00Z",
      },
    ]);
  });

  it("liefert null-Typ bei Profil ohne OEJTS-Sektion (nur Steadfastness), bleibt aber profiliert", () => {
    const [entry] = buildModelEntries([profile("model-a", { steadfastOnly: true })], []);
    expect(entry.profiled).toBe(true);
    expect(entry.modalType).toBeNull();
    expect(entry.typeConsistency).toBeNull();
    expect(entry.usableReps).toBe(4);
  });

  it("haengt konfigurierte Modelle ohne Profil gedimmt (profiled: false) hinten an, dedupliziert", () => {
    const entries = buildModelEntries([profile("model-a")], [config("model-a"), config("model-b"), config("model-b")]);
    expect(entries.map((e) => e.modelName)).toEqual(["model-a", "model-b"]);
    expect(entries[1]).toMatchObject({ profiled: false, modalType: null, usableReps: 0, lastRunAt: null });
  });

  it("sortiert profilierte nach juengster Aktivitaet (Hero kappt spaeter auf die zuletzt aktiven)", () => {
    const entries = buildModelEntries(
      [
        profile("model-alt", { lastRunAt: "2026-07-01T10:00:00Z" }),
        profile("model-neu", { lastRunAt: "2026-07-14T10:00:00Z" }),
      ],
      [],
    );
    expect(entries.map((e) => e.modelName)).toEqual(["model-neu", "model-alt"]);
  });

  it("liefert leere Liste bei frischem Account (keine Profile, keine Configs)", () => {
    expect(buildModelEntries([], [])).toEqual([]);
  });
});

// ─── buildDashboardSummary (Teilausfall) ─────────────────────────────────────

describe("buildDashboardSummary", () => {
  it("liefert alle Sektionen mit Daten, wenn alle Quellen funktionieren", async () => {
    const summary = await buildDashboardSummary(sources());
    expect(summary.models.error).toBe(false);
    expect(summary.models.data).toHaveLength(2); // model-a profiliert + model-b unprofiliert
    expect(summary.personas).toEqual({ error: false, data: { count: 3 } });
    expect(summary.runs).toEqual({ error: false, data: RUN_STATS });
  });

  it("faellt EINE Quelle aus, bleiben die uebrigen intakt und der Hook feuert", async () => {
    const onSourceError = vi.fn();
    const summary = await buildDashboardSummary(
      sources({ loadPersonaCount: () => Promise.reject(new Error("boom")), onSourceError }),
    );
    expect(summary.personas).toEqual({ error: true, data: null });
    expect(summary.models.error).toBe(false);
    expect(summary.runs.error).toBe(false);
    expect(onSourceError).toHaveBeenCalledTimes(1);
    expect(onSourceError).toHaveBeenCalledWith("personas", expect.any(Error));
  });

  it("kippt die Modell-Sektion als Ganzes, wenn nur die Config-Query ausfaellt", async () => {
    const onSourceError = vi.fn();
    const summary = await buildDashboardSummary(
      sources({ loadConfigs: () => Promise.reject(new Error("configs down")), onSourceError }),
    );
    expect(summary.models).toEqual({ error: true, data: null });
    expect(summary.personas.error).toBe(false);
    expect(onSourceError).toHaveBeenCalledWith("models", expect.any(Error));
  });

  it("loggt ohne injizierten Hook per console.error (→ Sentry via captureConsole im Worker)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const summary = await buildDashboardSummary(sources({ loadRunStats: () => Promise.reject(new Error("rls")) }));
      expect(summary.runs).toEqual({ error: true, data: null });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(String(spy.mock.calls[0][0])).toContain("runs");
    } finally {
      spy.mockRestore();
    }
  });
});
