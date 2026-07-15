import { describe, expect, it } from "vitest";
import {
  buildHeroLayout,
  heroNodeLabel,
  HERO_MAX_NODES,
  HERO_OUTER_RING,
  HERO_VIEW,
} from "@/components/dashboard/hero-layout";
import type { DashboardModelEntry } from "@/types";

/** Profilierter Eintrag mit sinnvollen Defaults — Tests ueberschreiben punktuell. */
function profiled(modelName: string, overrides: Partial<DashboardModelEntry> = {}): DashboardModelEntry {
  return {
    modelName,
    profiled: true,
    modalType: "INFJ",
    typeConsistency: 0.8,
    usableReps: 5,
    runCount: 1,
    lastRunAt: "2026-07-15T06:00:00Z",
    ...overrides,
  };
}

function unprofiled(modelName: string): DashboardModelEntry {
  return {
    modelName,
    profiled: false,
    modalType: null,
    typeConsistency: null,
    usableReps: 0,
    runCount: 0,
    lastRunAt: null,
  };
}

describe("heroNodeLabel", () => {
  it("zeigt Typ, Stabilitaet und Reps fuer profilierte Modelle", () => {
    expect(heroNodeLabel(profiled("gpt-5"))).toBe("INFJ · 80 % stable · 5 reps");
  });

  it("nutzt Singular bei genau 1 Rep", () => {
    expect(heroNodeLabel(profiled("gpt-5", { usableReps: 1 }))).toBe("INFJ · 80 % stable · 1 rep");
  });

  it("zeigt '—' ohne Modaltyp und laesst fehlende Stabilitaet weg", () => {
    expect(heroNodeLabel(profiled("gpt-5", { modalType: null, typeConsistency: null }))).toBe("— · 5 reps");
  });

  it("markiert unprofilierte Modelle als 'not profiled yet'", () => {
    expect(heroNodeLabel(unprofiled("claude"))).toBe("not profiled yet");
  });
});

describe("buildHeroLayout — Leerzustand", () => {
  it("liefert empty=true ohne Modelle (Hero zeichnet unbelegte Struktur + CTA)", () => {
    const layout = buildHeroLayout([]);
    expect(layout.empty).toBe(true);
    expect(layout.nodes).toHaveLength(0);
    expect(layout.overflow).toBe(0);
  });

  it("ist nicht leer, sobald ein (auch unprofiliertes) Modell existiert", () => {
    expect(buildHeroLayout([unprofiled("claude")]).empty).toBe(false);
  });
});

describe("buildHeroLayout — Kappung bei > 8 Modellen", () => {
  it("zeichnet max. 8 Knoten und meldet den Rest als overflow", () => {
    const models = Array.from({ length: 11 }, (_, i) => profiled(`model-${String(i)}`));
    const layout = buildHeroLayout(models);
    expect(layout.nodes).toHaveLength(HERO_MAX_NODES);
    expect(layout.overflow).toBe(3);
  });

  it("behaelt die ersten 8 der Eingabe (buildModelEntries sortiert nach Aktivitaet)", () => {
    const models = Array.from({ length: 10 }, (_, i) => profiled(`model-${String(i)}`));
    const layout = buildHeroLayout(models);
    expect(layout.nodes.map((n) => n.modelName)).toEqual(models.slice(0, 8).map((m) => m.modelName));
  });

  it("gibt profilierten Vorrang vor unprofilierten", () => {
    const models = [
      ...Array.from({ length: 4 }, (_, i) => unprofiled(`raw-${String(i)}`)),
      ...Array.from({ length: 6 }, (_, i) => profiled(`prof-${String(i)}`)),
    ];
    const layout = buildHeroLayout(models);
    expect(layout.nodes.filter((n) => n.profiled)).toHaveLength(6);
    expect(layout.nodes.filter((n) => !n.profiled)).toHaveLength(2);
    expect(layout.overflow).toBe(2);
  });
});

describe("buildHeroLayout — Dimm-Logik (unprofilierte Modelle)", () => {
  it("setzt unprofilierte klein auf den gestrichelten Aussenring", () => {
    const layout = buildHeroLayout([profiled("gpt-5"), unprofiled("claude")]);
    const raw = layout.nodes.find((n) => !n.profiled);
    expect(raw).toBeDefined();
    expect(raw?.ring).toBe(HERO_OUTER_RING);
    expect(raw?.r).toBe(5);
    expect(raw?.label).toBe("not profiled yet");
  });
});

describe("buildHeroLayout — Geometrie", () => {
  const models = [
    profiled("gpt-5", { usableReps: 3 }),
    profiled("claude", { usableReps: 20 }),
    profiled("glm", { usableReps: 0 }),
    unprofiled("mistral"),
  ];
  const layout = buildHeroLayout(models);

  it("klemmt den Punkt-Radius profilierter Modelle auf 6–14", () => {
    for (const node of layout.nodes.filter((n) => n.profiled)) {
      expect(node.r).toBeGreaterThanOrEqual(6);
      expect(node.r).toBeLessThanOrEqual(14);
    }
  });

  it("haelt alle Knoten innerhalb der ViewBox", () => {
    for (const node of layout.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(HERO_VIEW.width);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThanOrEqual(HERO_VIEW.height);
    }
  });

  it("richtet Labels nach aussen aus (rechts vom Kern = start, links = end)", () => {
    for (const node of layout.nodes) {
      expect(node.labelAnchor).toBe(node.x >= HERO_VIEW.cx ? "start" : "end");
    }
  });

  it("liefert Ringe aufsteigend inkl. Aussenring, innerster Ring = erstes Modell", () => {
    expect(layout.rings).toEqual([...layout.rings].sort((a, b) => a - b));
    expect(layout.rings.at(-1)).toBe(HERO_OUTER_RING);
    const first = layout.nodes.find((n) => n.modelName === "gpt-5");
    const otherProfiled = layout.nodes.filter((n) => n.profiled && n.modelName !== "gpt-5");
    for (const node of otherProfiled) {
      expect(first ? first.ring : Infinity).toBeLessThan(node.ring);
    }
  });

  it("alterniert die Serien-Farbe je profiliertem Knoten (chart-1/chart-2)", () => {
    const series = layout.nodes.filter((n) => n.profiled).map((n) => n.series);
    expect(series).toEqual([1, 2, 1]);
  });

  it("ist deterministisch (gleiche Eingabe → identisches Layout)", () => {
    expect(buildHeroLayout(models)).toEqual(layout);
  });
});
