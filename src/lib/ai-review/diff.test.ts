import { describe, expect, it } from "vitest";
import { prepareDiff } from "@/lib/ai-review/diff";

/** Baut einen `diff --git`-Block mit `size` Zeichen Fuellung im Body. */
function block(path: string, size = 40): string {
  const filler = "+".repeat(Math.max(size, 1)) + "\n";
  return `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -0,0 +1 @@\n${filler}`;
}

const MIGRATION = "supabase/migrations/20260709120000_runs.sql";
const API_ROUTE = "src/pages/api/personas/index.ts";

describe("prepareDiff", () => {
  it("gibt bei leerem Diff nichts zurueck", () => {
    expect(prepareDiff("", 1000)).toEqual({ diff: "", truncated: false, droppedFiles: [] });
  });

  it("verwirft Rausch-Dateien (Lockfile, dist, Snapshot)", () => {
    const raw =
      block("package-lock.json") +
      block("dist/index.js") +
      block("src/lib/utils.test.ts.snap") +
      block("src/lib/utils.ts");
    const result = prepareDiff(raw, 10_000);

    expect(result.droppedFiles).toEqual(["package-lock.json", "dist/index.js", "src/lib/utils.test.ts.snap"]);
    expect(result.diff).toContain("src/lib/utils.ts");
    expect(result.diff).not.toContain("package-lock.json");
    expect(result.truncated).toBe(true);
  });

  it("verwirft Binaerdateien", () => {
    const raw =
      `diff --git a/public/logo.png b/public/logo.png\nBinary files a/public/logo.png and b/public/logo.png differ\n` +
      block("src/lib/utils.ts");
    const result = prepareDiff(raw, 10_000);

    expect(result.droppedFiles).toEqual(["public/logo.png"]);
    expect(result.diff).toContain("src/lib/utils.ts");
  });

  it("sortiert Migrationen und API-Routen nach vorne", () => {
    const raw =
      block("README.md") +
      block("src/lib/utils.ts") +
      block("src/components/Card.tsx") +
      block(API_ROUTE) +
      block(MIGRATION);
    const { diff } = prepareDiff(raw, 10_000);

    const order = [MIGRATION, API_ROUTE, "src/components/Card.tsx", "src/lib/utils.ts", "README.md"];
    const positions = order.map((p) => diff.indexOf(`a/${p} `));

    expect(positions.every((p) => p !== -1)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("zaehlt Testdateien als Test, nicht als src/lib", () => {
    // `src/lib/x.test.ts` faellt sonst in die src/lib-Prioritaet und verdraengt echte Logik.
    const raw = block("src/lib/utils.test.ts") + block("src/lib/utils.ts");
    const { diff } = prepareDiff(raw, 10_000);

    expect(diff.indexOf("a/src/lib/utils.ts ")).toBeLessThan(diff.indexOf("a/src/lib/utils.test.ts "));
  });

  it("laesst die Migration die Kappung ueberleben, obwohl das Lockfile im Roh-Diff davor steht", () => {
    // Der Kern-Regressionstest: erst filtern, dann priorisieren, dann kappen.
    const raw = block("package-lock.json", 5000) + block("README.md", 5000) + block(MIGRATION, 100);
    const result = prepareDiff(raw, 400);

    expect(result.diff).toContain(MIGRATION);
    expect(result.diff).not.toContain("package-lock.json");
    expect(result.droppedFiles).toContain("README.md");
    expect(result.truncated).toBe(true);
  });

  it("meldet Budget-Opfer als droppedFiles", () => {
    const raw = block(MIGRATION, 100) + block("README.md", 5000);
    const result = prepareDiff(raw, 300);

    expect(result.diff).toContain(MIGRATION);
    expect(result.droppedFiles).toEqual(["README.md"]);
    expect(result.truncated).toBe(true);
  });

  it("fuellt den Restplatz NICHT mit niedrigpriorisierten Dateien auf", () => {
    // Gefunden bei der manuellen Verifikation gegen 9e7ce22: eine kleine Doku-Datei
    // rutschte in den Diff, waehrend der groessere src/lib-Service verworfen wurde.
    // Praefix-Semantik: die erste nicht passende Datei beendet die Aufnahme.
    const raw = block(MIGRATION, 100) + block("src/lib/services/x.ts", 900) + block("docs/notes.md", 50);
    const result = prepareDiff(raw, 400);

    expect(result.diff).toContain(MIGRATION);
    expect(result.diff).not.toContain("docs/notes.md");
    expect(result.droppedFiles).toEqual(["src/lib/services/x.ts", "docs/notes.md"]);
  });

  it("schneidet eine einzelne uebergrosse Datei an, statt gar nichts zu liefern", () => {
    const raw = block(MIGRATION, 5000);
    const result = prepareDiff(raw, 200);

    expect(result.diff.length).toBe(200);
    expect(result.diff).toContain(MIGRATION);
    expect(result.truncated).toBe(true);
  });

  it("meldet truncated=false, wenn alles passt", () => {
    const raw = block(MIGRATION, 20) + block(API_ROUTE, 20);
    const result = prepareDiff(raw, 10_000);

    expect(result.truncated).toBe(false);
    expect(result.droppedFiles).toEqual([]);
  });
});
