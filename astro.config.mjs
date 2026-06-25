// @ts-check
import process from "node:process";
import { defineConfig, envField } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";
import node from "@astrojs/node";

// https://astro.build/config
export default defineConfig({
  output: "server",
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
  // E2E-gated: unter E2E läuft der Node-Adapter (Standalone), damit der
  // Cloudflare-Adapter NICHT startet und process.env nicht aus .dev.vars
  // überschreibt. Normales dev/build (ohne E2E) nutzt weiter Cloudflare.
  adapter: process.env.E2E ? node({ mode: "standalone" }) : cloudflare(),
  env: {
    schema: {
      SUPABASE_URL: envField.string({ context: "server", access: "secret", optional: true }),
      SUPABASE_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      ENCRYPTION_KEY: envField.string({ context: "server", access: "secret", optional: true }),
    },
  },
});
