/**
 * Dashboard Mission Control — Register-Kette über alle Grenzen (Plan 4.1).
 *
 * Risiko: Die Dashboard-Kennzahlen existieren nur im Zusammenspiel von Auth/RLS,
 * der Mehrquellen-Aggregation (`getDashboardSummary` bündelt Modelle/Personas/Runs
 * per `Promise.allSettled`, Teilausfall je Quelle) und dem Routing in die
 * Modell-Profile. Jede Schicht ist einzeln getestet (Unit + `dashboard.test.ts` +
 * `model-profiles.itest.ts`), aber nur der Browser beweist die Kette: Ein
 * angemeldeter Nutzer mit Baseline-Läufen sieht sein Modell im Register — profiliert,
 * mit gepoolten Reps und abgeleitetem Typ — und gelangt von dort ins Profil.
 *
 * Real bleibt alles außer dem LLM: Auth, RLS, Aggregation, Routing, Rendering.
 * Die Baseline-Daten werden geseedet statt gefahren (siehe `support/seed.ts`).
 *
 * Seed-Exemplar: `seed.spec.ts`.
 */
import { test, expect } from "@playwright/test";
import { signInAsTestUser } from "./support/supabase";
import { cleanupSeeded, seedBaselineModel, type SeededModel } from "./support/seed";

/** Eindeutige Modellnamen je Test-Lauf — Parallel-/Re-Runs kollidieren nicht. */
function uniqueModelName(slug: string): string {
  return `e2e-${slug}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

test("a seeded baseline model surfaces in the dashboard register with pooled reps and links to its profile", async ({
  page,
}) => {
  const sb = await signInAsTestUser();
  const seeded: SeededModel[] = [];

  try {
    // Ein Modell aus zwei Baseline-Läufen → im Register gepoolt zu 10 verwertbaren
    // Reps; uniforme Antworten ergeben einen deterministischen Typ (100 % stabil).
    const model = await seedBaselineModel(sb, uniqueModelName("dashboard"), {
      runs: 2,
      repsPerRun: 5,
      answerValue: 2,
    });
    seeded.push(model);

    // 1. Dashboard lädt hinter der Auth/RLS-Grenze (PROTECTED_ROUTES → hier authentifiziert).
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    // 2. Kein Teilausfall: alle drei Summary-Quellen (Modelle/Personas/Runs) haben
    //    sich zusammengesetzt — keine ERR-Kachel („source unavailable" nur im Fehlerfall).
    await expect(page.getByText("source unavailable")).toHaveCount(0);

    // 3. Register: das geseedete Modell erscheint profiliert mit aggregierten Kennzahlen.
    //    Auf die Register-Zeile (listitem) scopen — der Hero-SVG trägt dieselben Labels.
    const row = page.getByRole("listitem").filter({ hasText: model.modelName });
    await expect(row.getByText("10 reps")).toBeVisible(); // 2 Läufe × 5 Reps gepoolt
    await expect(row.getByText(/% stable/)).toBeVisible(); // Typ + Stabilität abgeleitet
    const profileLink = row.getByRole("link");
    await expect(profileLink).toBeVisible();

    // 4. Routing: der Register-Link führt ins Profil, das genau diese Baseline-Daten aggregiert.
    await profileLink.click();
    await page.waitForURL(`**/models/profile?m=${encodeURIComponent(model.modelName)}`);
    await expect(page.getByText(model.modelName, { exact: true })).toBeVisible();
    await expect(page.getByText("2 baseline runs aggregated")).toBeVisible();
  } finally {
    await cleanupSeeded(sb, seeded);
  }
});
