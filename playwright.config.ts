import { defineConfig, devices } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// .env.e2e direkt parsen (kein dotenv — TLS-Interception-Gotcha, wie src/test/integration/setup.ts).
// Bereits gesetzte Env-Werte gewinnen; Datei nur als Fallback.
const envPath = fileURLToPath(new URL("./.env.e2e", import.meta.url));
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

// Port 4329 (distinkt vom normalen Dev-Server 4321): verhindert, dass
// reuseExistingServer einen laufenden Prod-Dev-Server (Cloudflare-Adapter)
// wiederverwendet.
const PORT = 4329;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "playwright/.auth/user.json" },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    // --mode e2e → Astro lädt .env.e2e nativ für astro:env/server.
    command: `npm run dev -- --port ${PORT} --mode e2e`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // E2E → astro.config.mjs schaltet auf den Node-Adapter (kein Cloudflare,
      // kein .dev.vars-Override). astro:env/server liest SUPABASE_URL/KEY direkt
      // aus process.env (diesem env-Block).
      E2E: "1",
      SUPABASE_URL: process.env.SUPABASE_URL ?? "",
      SUPABASE_KEY: process.env.SUPABASE_KEY ?? "",
    },
  },
});
