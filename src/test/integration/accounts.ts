/**
 * Zwei-Account-Fixture für Integration-Tests.
 *
 * Stellt frisch angelegte, authentifizierte `@supabase/supabase-js`-Clients
 * bereit (A, B) und räumt die je User angelegten Domänen-Daten wieder auf.
 * Jeder Client hält seine eigene In-Memory-Session (`persistSession: false`),
 * sodass zwei Accounts im selben Prozess sich nicht ins Gehege kommen.
 *
 * Hinweis: Test-USER selbst werden nicht gelöscht (das bräuchte service_role,
 * was wir bewusst meiden). Die lokale Test-DB wird per `npx supabase db reset`
 * zurückgesetzt; eindeutige Timestamp-Mails verhindern Kollisionen zwischen Läufen.
 */
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

/** Festes Test-Passwort (≥ 8 Zeichen, erfüllt die Auth-Policy). */
const TEST_PASSWORD = "Test-Password-123!";

export interface TestAccount {
  client: SupabaseClient;
  userId: string;
  email: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Test-Fixture: ${name} fehlt (siehe setup.ts).`);
  return value;
}

/** Legt einen neuen Test-Account an (signUp → signIn) und gibt den Client + User-ID zurück. */
export async function createTestAccount(): Promise<TestAccount> {
  const client = createSupabaseClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `pf-itest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

  const { error: signUpError } = await client.auth.signUp({ email, password: TEST_PASSWORD });
  if (signUpError) throw new Error(`createTestAccount signUp failed: ${signUpError.message}`);

  const { data, error } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  if (error) throw new Error(`createTestAccount signIn failed: ${error.message}`);
  return { client, userId: data.user.id, email };
}

/**
 * Löscht die vom Account angelegten Domänen-Daten (owner-scoped; RLS erlaubt das
 * eigene Delete) und meldet den Client ab. Reihenfolge: runs zuerst, damit der
 * run_repetitions-Cascade greift, dann personas + model_configs.
 */
export async function cleanupTestAccount(account: TestAccount): Promise<void> {
  const { client, userId } = account;
  await client.from("runs").delete().eq("owner_id", userId);
  await client.from("personas").delete().eq("owner_id", userId);
  await client.from("model_configs").delete().eq("owner_id", userId);
  await client.auth.signOut();
}
