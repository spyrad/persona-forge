import { describe, expect, it } from "vitest";
import { RULES, RULE_IDS, type Finding, type RuleId } from "@/lib/ai-review/schema";
import { MIN_CRITERION_SCORE, decideVerdict, scoreFor, scoresFrom, severityOf } from "@/lib/ai-review/verdict";

const f = (rule: RuleId, file = "src/x.ts"): Finding => ({ rule, file, evidence: "Beleg." });

const review = (findings: Finding[]) => ({ findings, summary: "Zusammenfassung." });

describe("Regel-Katalog", () => {
  it("ordnet jede Regel genau einem Kriterium und Schweregrad zu", () => {
    for (const id of RULE_IDS) {
      expect(RULES[id].criterion).toBeTruthy();
      expect(["critical", "warning", "observation"]).toContain(RULES[id].severity);
      expect(RULES[id].description.length).toBeGreaterThan(10);
    }
  });
});

describe("scoreFor", () => {
  it("gibt volle Punktzahl ohne Findings", () => {
    expect(scoreFor([], "dataSafety")).toBe(10);
  });

  it("zaehlt nur Findings des eigenen Kriteriums", () => {
    // Ein UI-Verstoss darf die Datensicherheit nicht beruehren.
    expect(scoreFor([f("color-literal")], "dataSafety")).toBe(10);
    expect(scoreFor([f("color-literal")], "uiConventions")).toBe(7);
  });

  it("druckt ein einzelnes critical unter die Einzelschwelle", () => {
    const score = scoreFor([f("missing-rls", "supabase/migrations/x.sql")], "dataSafety");
    expect(score).toBe(4);
    expect(score).toBeLessThan(MIN_CRITERION_SCORE);
  });

  it("summiert mehrere Findings und begrenzt nach unten auf 1", () => {
    expect(scoreFor([f("color-literal"), f("manual-class-concat")], "uiConventions")).toBe(6);
    const viele = [f("missing-rls"), f("blanket-policy"), f("hardcoded-secret")];
    expect(scoreFor(viele, "dataSafety")).toBe(1);
  });
});

describe("scoresFrom", () => {
  it("liefert fuer einen leeren Diff ueberall volle Punktzahl", () => {
    const scores = scoresFrom([]);
    expect(Object.values(scores)).toEqual([10, 10, 10, 10, 10, 10]);
  });
});

describe("decideVerdict", () => {
  it("laesst einen Diff ohne Findings durch", () => {
    const v = decideVerdict(review([]));

    expect(v.verdict).toBe("passed");
    expect(v.reasons).toEqual([]);
    expect(v.average).toBe(10);
  });

  it("blockt bei einem einzelnen critical, obwohl der Schnitt hoch bleibt", () => {
    // Der Kernfall: fehlende RLS blockt allein. Schnitt (10*5+4)/6 = 9.0.
    const v = decideVerdict(review([f("missing-rls", "supabase/migrations/x.sql")]));

    expect(v.verdict).toBe("failed");
    expect(v.average).toBe(9);
    expect(v.reasons).toHaveLength(1);
    expect(v.reasons[0]).toContain("Datensicherheit");
    expect(v.reasons[0]).toContain("1x kritisch");
  });

  it("laesst eine einzelne Warnung durch", () => {
    // Ein fehlendes prerender ist ein Hinweis, kein Merge-Blocker: 10-3 = 7.
    const v = decideVerdict(review([f("missing-prerender", "src/pages/api/x.ts")]));

    expect(v.scores.apiQuartet).toBe(7);
    expect(v.verdict).toBe("passed");
  });

  it("blockt, wenn zwei Warnungen dasselbe Kriterium unter die Schwelle druecken", () => {
    const v = decideVerdict(review([f("missing-prerender"), f("lowercase-handler")]));

    expect(v.scores.apiQuartet).toBe(4);
    expect(v.verdict).toBe("failed");
  });

  it("laesst eine einzelne Beobachtung folgenlos", () => {
    const v = decideVerdict(review([f("manual-class-concat")]));

    expect(v.scores.uiConventions).toBe(9);
    expect(v.verdict).toBe("passed");
  });

  it("laesst je eine Warnung pro Kriterium gerade noch durch (Schnitt exakt 7)", () => {
    const jeEineWarnung = [
      f("color-literal"),
      f("missing-prerender"),
      f("missing-test-for-risky-change"),
      f("undeclared-change"),
      f("logic-in-route"),
    ];
    // dataSafety bleibt ohne Finding bei 10: (7+7+10+7+7+7)/6 = 7.5
    const v = decideVerdict(review(jeEineWarnung));
    expect(v.average).toBeGreaterThanOrEqual(7);
    expect(v.verdict).toBe("passed");
  });

  it("blockt bei zu niedrigem Durchschnitt, obwohl jedes Kriterium die Einzelschwelle haelt", () => {
    const breitVerteilt = [
      f("color-literal"), // warning  -> uiConventions 10-3-1 = 6
      f("manual-class-concat"), // observation
      f("missing-prerender"), // warning  -> apiQuartet 7
      f("uncached-auth-uid", "supabase/migrations/a.sql"), // 3x observation
      f("uncached-auth-uid", "supabase/migrations/b.sql"), // -> dataSafety 7
      f("uncached-auth-uid", "supabase/migrations/c.sql"),
      f("missing-test-for-risky-change"), // warning -> testCoverage 7
      f("undeclared-change"), // warning -> scopeDiscipline 7
      f("logic-in-route"), // warning -> architectureConsistency 7
    ];
    const v = decideVerdict(review(breitVerteilt));

    // (6+7+7+7+7+7)/6 = 6.83 — kein Kriterium unter 5, aber der Schnitt reisst.
    expect(Math.min(...Object.values(v.scores))).toBeGreaterThanOrEqual(MIN_CRITERION_SCORE);
    expect(v.average).toBeLessThan(7);
    expect(v.verdict).toBe("failed");
    expect(v.reasons).toHaveLength(1);
    expect(v.reasons[0]).toContain("Durchschnitt");
  });

  it("meldet dieselbe Regel mehrfach, wenn mehrere Dateien sie verletzen", () => {
    const v = decideVerdict(review([f("color-literal", "src/a.tsx"), f("color-literal", "src/b.tsx")]));

    expect(v.scores.uiConventions).toBe(4);
    expect(v.verdict).toBe("failed");
  });

  it("ist deterministisch: gleiche Findings, gleiches Urteil", () => {
    // Das ist der ganze Zweck des Umbaus — die Noten-Variante kippte hier.
    const findings = [f("missing-prerender"), f("color-literal"), f("logic-in-route")];
    const a = decideVerdict(review(findings));
    const b = decideVerdict(review([...findings]));

    expect(a).toEqual(b);
  });
});

describe("severityOf", () => {
  it("liest den Schweregrad aus dem Katalog, nicht aus dem Modell", () => {
    expect(severityOf(f("missing-rls"))).toBe("critical");
    expect(severityOf(f("missing-prerender"))).toBe("warning");
    expect(severityOf(f("manual-class-concat"))).toBe("observation");
  });
});
