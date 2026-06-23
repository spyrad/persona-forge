/**
 * Test-Stub für das virtuelle Astro-Modul `astro:env/server`.
 *
 * `src/lib/encryption-key.ts` und `src/lib/supabase.ts` importieren
 * `astro:env/server` — ein Vite-Virtual-Module, das in plain Vitest (ohne
 * Astro-Plugin) nicht auflösbar ist. Die Integration-Config aliast den Import
 * auf diese Datei, die die gleichen Named Exports aus `process.env` bereitstellt
 * (befüllt durch `setup.ts`, das vor den Test-Modulen läuft).
 *
 * Bewusst KEIN Astro-Plugin in der Integration-Config: Service-Level-Tests
 * brauchen nur diese drei Werte, nicht die volle Astro-Env-Auflösung.
 */
export const SUPABASE_URL = process.env.SUPABASE_URL;
export const SUPABASE_KEY = process.env.SUPABASE_KEY;
export const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
