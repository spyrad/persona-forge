// Risk #5 (test-plan.md): Auth-Gap — eine unauthentifizierte Anfrage erreicht eine
// geschützte Route. Das ist genau der Pfad, den E2E über die Integration-Tests hinaus
// zeigt: Middleware-302-Redirect + Cookie-Roundtrip im echten Browser.
// Provenance: test-plan.md Risk #5; Seed: seed.spec.ts.
import { test, expect } from "@playwright/test";

test.describe("auth redirect (Risk #5)", () => {
  // Test A — ohne Session: geschützte Route → Redirect auf /auth/signin.
  test.describe("unauthenticated", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("redirects /dashboard to sign-in", async ({ page }) => {
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/auth\/signin/);
      await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    });
  });

  // Test B — mit Session (storageState aus dem chromium-Projekt): kein Redirect.
  test("authenticated user reaches /dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });
});
