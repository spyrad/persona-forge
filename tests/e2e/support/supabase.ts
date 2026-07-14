/**
 * Gemeinsame Supabase-Basis der E2E-Schicht: Safety-Guard (NIE gegen Remote/Prod)
 * und die Zugangsdaten des im `setup`-Projekt angelegten Test-Users.
 *
 * Warum eine Datei mit den Credentials: der Browser erbt die Session ueber
 * `storageState`, aber ein Test, der Daten SEEDET, braucht einen eigenen
 * `@supabase/supabase-js`-Client, der als DERSELBE User angemeldet ist —
 * sonst sieht der Browser die Zeilen wegen RLS gar nicht. Die Datei liegt neben
 * dem `storageState` unter `playwright/.auth/` (gitignored) und traegt nur die
 * Zugangsdaten eines lokalen Wegwerf-Users.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Festes Test-Passwort (≥ 8 Zeichen, erfuellt die Auth-Policy). */
export const TEST_PASSWORD = "Test-Password-123!";

export const STORAGE_STATE = "playwright/.auth/user.json";
const USER_FILE = "playwright/.auth/user-credentials.json";

interface TestUser {
  email: string;
  password: string;
}

/**
 * Liest SUPABASE_URL/KEY und verweigert alles, was nicht lokal ist (gleicher
 * Guard wie `src/test/integration/setup.ts` — E2E fasst Prod nie an).
 */
export function requireLocalSupabase(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_KEY ?? "";
  if (!url || !key) {
    throw new Error("E2E: SUPABASE_URL/SUPABASE_KEY fehlen (siehe .env.e2e / .env.e2e.example).");
  }
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new Error(`E2E: SUPABASE_URL ist keine gueltige URL: ${url}`);
  }
  if (hostname !== "127.0.0.1" && hostname !== "localhost") {
    throw new Error(`E2E: SUPABASE_URL muss lokal sein (127.0.0.1/localhost), war: ${url}.`);
  }
  return { url, key };
}

/** Persistiert die Zugangsdaten des Setup-Users (nur lokal, gitignored). */
export function saveTestUser(user: TestUser): void {
  mkdirSync(dirname(USER_FILE), { recursive: true });
  writeFileSync(USER_FILE, JSON.stringify(user), "utf8");
}

/** Laedt die Zugangsdaten des Setup-Users. */
export function loadTestUser(): TestUser {
  if (!existsSync(USER_FILE)) {
    throw new Error(`E2E: ${USER_FILE} fehlt — laeuft das setup-Projekt (auth.setup.ts)?`);
  }
  return JSON.parse(readFileSync(USER_FILE, "utf8")) as TestUser;
}

/**
 * Angemeldeter supabase-js-Client fuer denselben User, dessen Session der Browser
 * per `storageState` traegt — die Bruecke zwischen Test-Seeding und UI (RLS).
 */
export async function signInAsTestUser(): Promise<SupabaseClient> {
  const { url, key } = requireLocalSupabase();
  const { email, password } = loadTestUser();
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`E2E: signIn des Test-Users schlug fehl: ${error.message}`);
  return client;
}
