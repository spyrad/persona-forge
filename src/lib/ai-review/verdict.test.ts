import { describe, expect, it } from "vitest";
import { CRITERIA, type Criterion, type ReviewResult } from "@/lib/ai-review/schema";
import { averageScore, decideVerdict } from "@/lib/ai-review/verdict";

/** Baut ein ReviewResult; `overrides` setzt einzelne Kriterien abweichend. */
function result(base: number, overrides: Partial<Record<Criterion, number>> = {}): ReviewResult {
  const criteria = Object.fromEntries(
    CRITERIA.map((key) => [key, { score: overrides[key] ?? base, reasoning: "Begruendung." }]),
  ) as ReviewResult["criteria"];

  return { criteria, summary: "Zusammenfassung." };
}

describe("averageScore", () => {
  it("mittelt ueber alle sechs Kriterien", () => {
    expect(averageScore(result(8))).toBe(8);
    expect(averageScore(result(9, { dataSafety: 3 }))).toBe((9 * 5 + 3) / 6);
  });
});

describe("decideVerdict", () => {
  it("laesst einen sauberen PR durch", () => {
    const verdict = decideVerdict(result(9));

    expect(verdict.verdict).toBe("passed");
    expect(verdict.reasons).toEqual([]);
  });

  it("blockt bei einem einzelnen Ausreisser, auch wenn der Schnitt hoch ist", () => {
    // 4 bei dataSafety, sonst 10 → Schnitt 9.0, aber ein RLS-Loch bleibt ein RLS-Loch.
    const verdict = decideVerdict(result(10, { dataSafety: 4 }));

    expect(verdict.verdict).toBe("failed");
    expect(verdict.average).toBeGreaterThan(8);
    expect(verdict.reasons).toHaveLength(1);
    expect(verdict.reasons[0]).toContain("Datensicherheit");
  });

  it("blockt bei zu niedrigem Durchschnitt, obwohl jedes Kriterium die Mindestpunktzahl haelt", () => {
    // Alle exakt 5: kein Einzel-Verstoss, aber Schnitt 5 < 7.
    const verdict = decideVerdict(result(5));

    expect(verdict.verdict).toBe("failed");
    expect(verdict.reasons).toHaveLength(1);
    expect(verdict.reasons[0]).toContain("Durchschnitt");
  });

  it("nennt Einzel- und Durchschnitts-Verstoss getrennt", () => {
    const verdict = decideVerdict(result(6, { dataSafety: 2, apiQuartet: 3 }));

    expect(verdict.verdict).toBe("failed");
    expect(verdict.reasons).toHaveLength(3); // zwei Ausreisser + Durchschnitt
  });

  it("laesst die Grenzfaelle exakt auf der Schwelle durch", () => {
    // Ein Kriterium exakt auf 5 (nicht darunter), Summe 42 → Schnitt exakt 7.0.
    // 8 + 8 + 5 + 8 + 6 + 7 = 42
    const verdict = decideVerdict(result(8, { dataSafety: 5, scopeDiscipline: 6, architectureConsistency: 7 }));

    expect(verdict.average).toBe(7);
    expect(verdict.verdict).toBe("passed");
    expect(verdict.reasons).toEqual([]);
  });
});
