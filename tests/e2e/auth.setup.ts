// setup-Projekt: legt einen frischen Test-User an (programmatisch, anon signUp),
// loggt sich ÜBER DAS ECHTE FORMULAR ein und speichert die Session als storageState.
// Lokal ist enable_confirmations=false → der User ist sofort einlogg-bar.
// Zusätzlich landen die Zugangsdaten in playwright/.auth/ (gitignored), damit
// datenseedende Tests einen supabase-js-Client als DENSELBEN User öffnen können —
// sonst blieben ihre Zeilen für den Browser RLS-unsichtbar.
import { test as setup, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { requireLocalSupabase, saveTestUser, STORAGE_STATE, TEST_PASSWORD } from "./support/supabase";

setup("authenticate", async ({ page }) => {
  const { url, key } = requireLocalSupabase();

  // 1. Frischen Test-User anlegen (Timestamp-Mail → keine Kollision zwischen Läufen).
  const email = `pf-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await supabase.auth.signUp({ email, password: TEST_PASSWORD });
  if (error) throw new Error(`E2E-Setup signUp fehlgeschlagen: ${error.message}`);

  // 2. Über das echte Formular einloggen.
  await page.goto("/auth/signin");
  // Erst nach abgeschlossener Insel-Hydration füllen (Astro entfernt dann das
  // ssr-Attribut): vor der Hydration gefüllte kontrollierte Inputs setzt React
  // beim Hydratisieren auf leeren State zurück → Submit mit leeren Feldern
  // (Race, auf beladener Maschine deterministisch verloren). State-basiert,
  // kein Timeout.
  await page.locator('astro-island[component-url*="SignInForm"]:not([ssr])').waitFor();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  // 3. Auf den authentifizierten Zielzustand warten + Session speichern.
  await page.waitForURL("**/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.context().storageState({ path: STORAGE_STATE });
  saveTestUser({ email, password: TEST_PASSWORD });
});
