import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Integration-Test-Config — getrennt von `vitest.config.ts` (Unit), damit
 * `npm run test` Docker-frei und schnell bleibt. Diese Suite (`*.itest.ts`)
 * fährt zwei echte Supabase-Sessions gegen ein lokales Supabase und ist opt-in
 * (`npm run test:integration`), bis test-plan §3 Phase 3 sie als CI-Gate
 * verdrahtet.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Virtuelles Astro-Modul auf einen process.env-Stub mappen (siehe stub-Datei).
      "astro:env/server": fileURLToPath(new URL("./src/test/integration/astro-env-server.stub.ts", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.itest.ts"],
    setupFiles: ["./src/test/integration/setup.ts"],
    // Sequenziell: alle Tests teilen sich eine lokale DB. Isolation kommt aus
    // eindeutigen Timestamp-Usern + Cleanup, nicht aus parallelen Forks.
    fileParallelism: false,
  },
});
