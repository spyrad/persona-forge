import { describe, expect, it } from "vitest";
import {
  COMMENT_MARKER,
  LABEL_RERUN,
  renderComment,
  renderErrorComment,
  type EnrichedFinding,
  type ReviewOutput,
} from "@/lib/ai-review/report";
import { RULES, type RuleId } from "@/lib/ai-review/schema";
import { decideVerdict, scoresFrom, severityOf } from "@/lib/ai-review/verdict";

const finding = (rule: RuleId, file = "src/x.ts", evidence = "Beleg."): EnrichedFinding => ({
  rule,
  file,
  evidence,
  criterion: RULES[rule].criterion,
  severity: severityOf({ rule, file, evidence }),
});

/** Baut ein ReviewOutput aus Findings — Scores und Verdict wie in Produktion abgeleitet. */
function output(findings: EnrichedFinding[], overrides: Partial<ReviewOutput["meta"]> = {}): ReviewOutput {
  const v = decideVerdict({ findings, summary: "" });
  return {
    verdict: v.verdict,
    average: v.average,
    scores: scoresFrom(findings),
    reasons: v.reasons,
    summary: "Kurze Zusammenfassung.",
    findings,
    meta: { truncated: false, droppedFiles: [], model: "glm-5.2", elapsedMs: 12_345, ...overrides },
  };
}

describe("renderComment", () => {
  it("beginnt mit dem Dedup-Marker", () => {
    // Ohne den Marker findet der Workflow seinen Vorgaenger nicht und haengt
    // bei jedem Push einen weiteren Kommentar an.
    expect(renderComment(output([]))).toMatch(new RegExp(`^${COMMENT_MARKER}`));
  });

  it("meldet einen sauberen Diff als bestanden", () => {
    const md = renderComment(output([]));

    expect(md).toContain("bestanden");
    expect(md).not.toContain("nicht bestanden");
    expect(md).toContain("Keine Verstoesse");
    expect(md).toContain("10.0/10");
  });

  it("meldet einen kritischen Verstoss als nicht bestanden und begruendet ihn", () => {
    const md = renderComment(output([finding("missing-rls", "supabase/migrations/x.sql")]));

    expect(md).toContain("nicht bestanden");
    expect(md).toContain("Warum blockiert");
    expect(md).toContain("Datensicherheit");
    expect(md).toContain("`missing-rls`");
    expect(md).toContain("supabase/migrations/x.sql");
  });

  it("listet alle sechs Kriterien mit Score", () => {
    const md = renderComment(output([]));

    expect(md).toContain("API-Route-Quartett");
    expect(md).toContain("Scope- & Plan-Treue");
    expect((md.match(/\d\/10 \|/g) ?? []).length).toBe(6);
  });

  it("sortiert Findings nach Schwere", () => {
    const md = renderComment(
      output([finding("manual-class-concat"), finding("missing-rls"), finding("color-literal")]),
    );

    const critical = md.indexOf("missing-rls");
    const warning = md.indexOf("color-literal");
    const observation = md.indexOf("manual-class-concat");

    expect(critical).toBeLessThan(warning);
    expect(warning).toBeLessThan(observation);
  });

  it("entschaerft Pipes im Beleg, damit die Tabelle nicht zerbricht", () => {
    const md = renderComment(output([finding("color-literal", "src/a.tsx", 'cn("a" | "b")')]));
    const row = md.split("\n").find((l) => l.includes("color-literal"));

    expect(row).toBeDefined();
    expect(row).toContain("\\|");
    // Genau vier Spalten -> fuenf Pipes am Zeilenrand und zwischen den Zellen.
    expect((row?.match(/(?<!\\)\|/g) ?? []).length).toBe(5);
  });

  it("ersetzt Zeilenumbrueche im Beleg", () => {
    const md = renderComment(output([finding("color-literal", "src/a.tsx", "erste\nzweite")]));
    const row = md.split("\n").find((l) => l.includes("color-literal"));

    expect(row).toContain("erste zweite");
  });

  it("weist eine Kuerzung samt verworfener Dateien aus", () => {
    // Ein Urteil auf Basis eines gekappten Diffs muss als solches erkennbar sein.
    const md = renderComment(output([], { truncated: true, droppedFiles: ["src/lib/big.ts"] }));

    expect(md).toContain("gekuerzt");
    expect(md).toContain("src/lib/big.ts");
  });

  it("nennt Modell und den Weg zum erneuten Lauf", () => {
    const md = renderComment(output([]));

    expect(md).toContain("glm-5.2");
    expect(md).toContain(LABEL_RERUN);
  });
});

describe("renderErrorComment", () => {
  it("stellt klar, dass ein technischer Fehler kein Urteil ist", () => {
    const md = renderErrorComment("ECONNRESET");

    expect(md).toMatch(new RegExp(`^${COMMENT_MARKER}`));
    expect(md).toContain("kein** Urteil");
    expect(md).toContain("ECONNRESET");
  });

  it("kappt sehr lange Fehlermeldungen", () => {
    const md = renderErrorComment("x".repeat(2000));
    expect(md.length).toBeLessThan(1000);
  });
});
