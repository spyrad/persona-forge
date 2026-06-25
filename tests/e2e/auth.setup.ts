// setup-Projekt: legt einen frischen Test-User an (programmatisch, anon signUp),
// loggt sich ÜBER DAS ECHTE FORMULAR ein und speichert die Session als storageState.
// Lokal ist enable_confirmations=false → der User ist sofort einlogg-bar.
import { test as setup, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const STORAGE_STATE = "playwright/.auth/user.json";
const TEST_PASSWORD = "Test-Password-123!";

function requireLocalSupabase(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_KEY ?? "";
  if (!url || !key) {
    throw new Error("E2E-Setup: SUPABASE_URL/SUPABASE_KEY fehlen (siehe .env.e2e / .env.e2e.example).");
  }
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new Error(`E2E-Setup: SUPABASE_URL ist keine gültige URL: ${url}`);
  }
  // Safety-Guard: NIE gegen Remote/Prod (wie src/test/integration/setup.ts).
  if (hostname !== "127.0.0.1" && hostname !== "localhost") {
    throw new Error(`E2E-Setup: SUPABASE_URL muss lokal sein (127.0.0.1/localhost), war: ${url}.`);
  }
  return { url, key };
}

setup("authenticate", async ({ page }) => {
  const { url, key } = requireLocalSupabase();

  // 1. Frischen Test-User anlegen (Timestamp-Mail → keine Kollision zwischen Läufen).
  const email = `pf-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await supabase.auth.signUp({ email, password: TEST_PASSWORD });
  if (error) throw new Error(`E2E-Setup signUp fehlgeschlagen: ${error.message}`);

  // 2. Über das echte Formular einloggen.
  await page.goto("/auth/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  // 3. Auf den authentifizierten Zielzustand warten + Session speichern.
  await page.waitForURL("**/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.context().storageState({ path: STORAGE_STATE });
});
