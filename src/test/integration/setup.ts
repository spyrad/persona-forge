/**
 * Integration-Setup (Vitest `setupFiles`): lädt `.env.test` in `process.env`,
 * bevor die Test-Module (und damit der `astro:env/server`-Stub) ausgewertet
 * werden.
 *
 * Bewusst KEIN `dotenv`-Paket (lokale TLS-Interception macht npm-Installs
 * fragil, siehe CLAUDE.md) — wir parsen die Datei direkt mit `node:fs`.
 *
 * Safety-Guard: verweigert den Lauf, wenn `SUPABASE_URL` nicht auf eine lokale
 * Instanz zeigt — Integration-Tests dürfen NIE gegen eine Remote-/Prod-DB laufen.
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const envPath = fileURLToPath(new URL("../../../.env.test", import.meta.url));

if (existsSync(envPath)) {
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    // Bereits gesetzte Env-Werte (z. B. aus CI) gewinnen — Datei nur als Fallback.
    if (!(key in process.env)) process.env[key] = value;
  }
}

const url = process.env.SUPABASE_URL ?? "";
if (!url) {
  throw new Error(
    "Integration-Setup: SUPABASE_URL fehlt. Lege .env.test an (siehe .env.test.example) " +
      "oder übernimm die Werte aus `npx supabase status`.",
  );
}
if (!/127\.0\.0\.1|localhost/.test(url)) {
  throw new Error(
    `Integration-Setup: SUPABASE_URL muss auf lokales Supabase zeigen (127.0.0.1/localhost), ` +
      `war aber: ${url}. Integration-Tests laufen NICHT gegen eine Remote-/Prod-DB.`,
  );
}
if (!process.env.SUPABASE_KEY) {
  throw new Error("Integration-Setup: SUPABASE_KEY fehlt (lokaler anon-key aus `npx supabase status`).");
}
if (!process.env.ENCRYPTION_KEY) {
  throw new Error(
    "Integration-Setup: ENCRYPTION_KEY fehlt (base64 32-Byte) — createModelConfig verschlüsselt beim Insert.",
  );
}
