// @ts-check
import process from "node:process";
import { defineConfig, envField } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";
import node from "@astrojs/node";
import { sentryVitePlugin } from "@sentry/vite-plugin";

// Source-Map-Upload nur, wenn ein Auth-Token gesetzt ist (CI/Build-Zeit). Lokal
// und unter E2E ist der Token nicht gesetzt → Plugin wird NICHT eingehängt, der
// Build bleibt unberührt. EU-Region: SENTRY_URL default https://de.sentry.io/.
const sentrySourceMaps = process.env.SENTRY_AUTH_TOKEN
  ? [
      sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        url: process.env.SENTRY_URL ?? "https://de.sentry.io/",
        telemetry: false,
      }),
    ]
  : [];

// https://astro.build/config
export default defineConfig({
  output: "server",
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss(), ...sentrySourceMaps],
    // "hidden": Source-Maps werden erzeugt (für Sentry-Symbolisierung via Debug-IDs),
    // aber NICHT im Bundle referenziert → nicht im Browser exponiert.
    build: { sourcemap: "hidden" },
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
