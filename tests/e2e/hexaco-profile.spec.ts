/**
 * HEXACO-Profil — ein Baseline-Lauf erscheint dimensional profiliert (Plan hexaco-instrument 5.2).
 *
 * Risiko: HEXACO ist das zweite, gemeinfreie Instrument OHNE Modaltyp. Scoring und
 * Aggregation sind unit-/integration-getestet, aber nur der Browser beweist die
 * Kette Auth/RLS → Routing → Baseline-Filter (`persona_id null` + leerer Snapshot)
 * → serverseitige Aggregation → HEXACO-spezifisches Rendering (Phase 4): der Lauf
 * muss in der Lauf-Liste als HEXACO/Baseline erkennbar sein und im Modell-Profil als
 * dimensionale 6-Faktor-Sektion erscheinen — KEIN Typ-Code, und die Attribution als
 * „Public domain (IPIP)". Genau diese kind-Verzweigung (hexaco statt oejts) lebt nur
 * im gerenderten UI; eine still auf OEJTS zurückfallende Sektion würde hier rot.
 *
 * Real bleibt alles außer dem LLM: Auth, Routing, DB, Aggregation, Rendering. Der
 * Baseline-Lauf wird geseedet statt gefahren — 60 Items × N Reps wären nicht-
 * deterministische, teure LLM-Calls (siehe `support/seed.ts`).
 *
 * Seed-Exemplar: `seed.spec.ts`.
 */
import { test, expect } from "@playwright/test";
import { HEXACO } from "@/lib/instruments/hexaco";
import { signInAsTestUser } from "./support/supabase";
import { cleanupSeeded, seedBaselineModel, type SeededModel } from "./support/seed";

/** Eindeutiger Modellname je Test-Lauf — Parallel-/Re-Runs kollidieren nicht. */
function uniqueModelName(slug: string): string {
  return `e2e-${slug}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

test("a seeded HEXACO baseline run appears as a dimensional six-factor profile, not a type code", async ({ page }) => {
  const sb = await signInAsTestUser();
  const seeded: SeededModel[] = [];

  try {
    // Zwei HEXACO-Baseline-Läufe (Pooling), neutrale Antworten (3) → alle sechs
    // Faktoren am midpoint, alle 60 Items verwertbar (> Dünn-Daten-Schwelle 5).
    const model = await seedBaselineModel(sb, uniqueModelName("hexaco"), {
      runs: 2,
      repsPerRun: 5,
      answerValue: 3,
      instrument: HEXACO,
      kind: "hexaco",
    });
    seeded.push(model);

    // 1. Lauf-Liste: der Lauf ist als HEXACO UND als baseline erkennbar und verlinkt ins Profil.
    await page.goto("/runs");
    const runItem = page.getByRole("listitem").filter({ hasText: model.modelName }).first();
    await expect(runItem.getByText("HEXACO", { exact: true })).toBeVisible();
    await expect(runItem.getByText("baseline", { exact: true })).toBeVisible();
    const profileLink = runItem.getByRole("link", { name: `View model profile for ${model.modelName}` });
    await expect(profileLink).toBeVisible();

    // 2. Profil: die beiden Baseline-Läufe von genau diesem Modell werden gepoolt.
    await profileLink.click();
    await page.waitForURL(`**/models/profile?m=${encodeURIComponent(model.modelName)}`);
    await expect(page.getByText(model.modelName, { exact: true }).first()).toBeVisible();
    await expect(page.getByText("2 baseline runs aggregated")).toBeVisible();

    // 3. Dimensionale HEXACO-Sektion (Phase 4): sechs Faktoren, ausdrücklich kein Typ-Code.
    await expect(
      page.getByText("Six factor distributions (H/E/X/A/C/O) — dimensional, no single-type code."),
    ).toBeVisible();
    // Dimensional heißt: KEIN OEJTS-Typ-Panel — die „No consistent type"-Meldung darf nicht erscheinen.
    await expect(page.getByText("No consistent type", { exact: false })).toHaveCount(0);

    // 4. Alle sechs Faktoren als Achsen-Karten (jede Karte rendert das Label als <h3>).
    for (const axis of HEXACO.axes) {
      await expect(page.getByRole("heading", { level: 3, name: axis.label })).toBeVisible();
    }

    // 5. Attribution je Instrument: HEXACO ist gemeinfrei, nicht CC-lizenziert.
    await expect(page.getByText("Public domain (IPIP)", { exact: false }).first()).toBeVisible();
  } finally {
    // Cleanup im finally: ein roter Test hinterlässt keine Karteileichen für den nächsten Lauf.
    await cleanupSeeded(sb, seeded);
  }
});
