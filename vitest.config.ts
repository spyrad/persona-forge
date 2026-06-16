import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Default Node environment — der Krypto-Helper nutzt nur Standard-Web-Crypto
    // (in Node 22 global verfügbar). Kein Astro-Plugin, kein Worker-Pool nötig.
    include: ["src/**/*.test.ts"],
  },
});
