// Seed-Exemplar für /10x-e2e: an diesem Test werden generierte Tests modelliert.
// Muster: role-/label-basierte Locators, auf Zustand warten (nie Timeout),
// unabhängig (eigenes goto/Assertion), keine geteilten Daten.
// Schützt nichts Risiko-Spezifisches — reine Pipeline-/Vorlagen-Smoke auf der
// öffentlichen Sign-in-Seite (kein Auth nötig).
import { test, expect } from "@playwright/test";

test("sign-in page renders its form (seed exemplar)", async ({ page }) => {
  await page.goto("/auth/signin");

  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});
