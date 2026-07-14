/**
 * Model Compare — Happy Path über alle Grenzen (Plan 5.2).
 *
 * Risiko: Die Modell-Profile entstehen erst aus dem Zusammenspiel von Auth/RLS,
 * Routing (`?m=`), Baseline-Filter (`persona_id null` + leerer Snapshot) und
 * serverseitiger Aggregation — jede einzelne Schicht ist getestet (Unit +
 * `model-profiles.itest.ts`), aber nur der Browser beweist die Kette: Ein Nutzer
 * mit Baseline-Läufen kommt von der Lauf-Liste ins Modell-Profil und von dort in
 * einen 2-Modell-Vergleich, und sieht dort genau seine Daten.
 *
 * Real bleibt alles außer dem LLM: Auth, Routing, DB, Aggregation, Rendering.
 * Die Baseline-Daten werden geseedet statt gefahren — ein echter Lauf wäre N
 * nicht-deterministische LLM-Calls (siehe `support/seed.ts`).
 *
 * Seed-Exemplar: `seed.spec.ts`.
 */
import { test, expect, type Page } from "@playwright/test";
import { signInAsTestUser } from "./support/supabase";
import { cleanupSeeded, seedBaselineModel, type SeededModel } from "./support/seed";

/** Eindeutige Modellnamen je Test-Lauf — Parallel-/Re-Runs kollidieren nicht. */
function uniqueModelName(slug: string): string {
  return `e2e-${slug}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Wartet auf die abgeschlossene Hydration einer Insel (nie auf Zeit — Memory `dev-ssr-noise`). */
async function waitForIsland(page: Page, component: string): Promise<void> {
  await page.locator(`astro-island[component-url*="${component}"]:not([ssr])`).waitFor();
}

test("baseline runs lead from the run list to a model profile and a two-model comparison", async ({ page }) => {
  const sb = await signInAsTestUser();
  const seeded: SeededModel[] = [];

  try {
    // Zwei Modelle mit Baseline-Daten: A aus zwei Läufen (Pooling), B aus einem.
    // Verschiedene Antwortwerte → im Vergleich unterscheidbare Verteilungen.
    const modelA = await seedBaselineModel(sb, uniqueModelName("model-a"), {
      runs: 2,
      repsPerRun: 5,
      answerValue: 2,
    });
    seeded.push(modelA);
    const modelB = await seedBaselineModel(sb, uniqueModelName("model-b"), {
      runs: 1,
      repsPerRun: 5,
      answerValue: 4,
    });
    seeded.push(modelB);

    // 1. Lauf-Liste: Baseline-Läufe sind als solche erkennbar und verlinken ins Profil (5.1).
    await page.goto("/runs");
    const runItem = page.getByRole("listitem").filter({ hasText: modelA.modelName }).first();
    // Badge nur im Listeneintrag suchen — „baseline" steht sonst auch im
    // Persona-Dropdown des Start-Formulars („No persona (baseline)").
    await expect(runItem.getByText("baseline", { exact: true })).toBeVisible();
    const profileLink = runItem.getByRole("link", { name: `View model profile for ${modelA.modelName}` });
    await expect(profileLink).toBeVisible();

    // 2. Profil: aggregiert genau die zwei Baseline-Läufe von Modell A (10 Reps gepoolt).
    await profileLink.click();
    await page.waitForURL(`**/models/profile?m=${encodeURIComponent(modelA.modelName)}`);
    await expect(page.getByText(modelA.modelName, { exact: true })).toBeVisible();
    await expect(page.getByText("2 baseline runs aggregated")).toBeVisible();
    await expect(page.getByText("10 usable reps pooled from 2 runs")).toBeVisible();
    // Fremde Modelle tauchen im Profil von A nicht auf.
    await expect(page.getByText(modelB.modelName, { exact: true })).toHaveCount(0);

    // 3. Auswahl: beide Modelle in der Profil-Sektion der Modell-Seite anhaken.
    await page.goto("/models");
    await waitForIsland(page, "ModelProfilePicker");
    for (const name of [modelA.modelName, modelB.modelName]) {
      await page.getByRole("listitem").filter({ hasText: name }).getByRole("checkbox").check();
    }
    await expect(page.getByText("2 models selected — ready to compare (max. 4).")).toBeVisible();

    // 4. Vergleich: beide Modelle stehen mit ihrer Datenbasis nebeneinander.
    await page.getByRole("button", { name: "Compare", exact: true }).click();
    await page.waitForURL(/\/models\/compare\?/);
    // Der Modellname steht je Spalte mehrfach (Meta-Kopf + Serien-Legende je Achse) → `.first()`.
    await expect(page.getByText(modelA.modelName, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(modelB.modelName, { exact: true }).first()).toBeVisible();
    await expect(page.getByText("2 baseline runs", { exact: true })).toBeVisible();
    await expect(page.getByText("1 baseline run", { exact: true })).toBeVisible();
  } finally {
    await cleanupSeeded(sb, seeded);
  }
});
