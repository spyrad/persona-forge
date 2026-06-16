/**
 * Service-Schicht fuer `model_configs` — kapselt Supabase-CRUD und die
 * AES-256-GCM-Verschluesselung des API-Keys.
 *
 * Invarianten:
 *   * Gibt NIE Key-Material an den Aufrufer zurueck — Lese-Operationen
 *     selektieren die Key-Spalten gar nicht erst (VIEW_COLUMNS) und mappen auf
 *     `ModelConfigView` (`hasKey`).
 *   * `owner_id` wird beim Insert NICHT gesetzt — die Spalte hat
 *     `default auth.uid()` (siehe Migration, wie `_rls_probe`); explizites
 *     Setzen waere fehleranfaellig (falscher Wert scheitert an der insert-Policy).
 *   * RLS erzwingt den owner-Scope serverseitig; der Service verlaesst sich
 *     darauf (kein eigener owner-Filter).
 *
 * Den `SupabaseClient` reicht die API-Route herein (aus `createClient`), analog
 * zum bestehenden Auth-Muster. Der `ENCRYPTION_KEY`-Zugriff liegt in
 * `getEncryptionKey()` (server-only) — `crypto.ts` bleibt key-parametrisiert.
 */
import { decryptApiKey, encryptApiKey } from "@/lib/crypto";
import { getEncryptionKey } from "@/lib/encryption-key";
import type { createClient } from "@/lib/supabase";
import type { CreateModelConfigInput, ModelConfig, ModelConfigView, UpdateModelConfigInput } from "@/types";

type SupabaseClient = NonNullable<ReturnType<typeof createClient>>;

const TABLE = "model_configs";

/** Nur client-sichere Spalten — die Key-Spalten werden bewusst nie selektiert. */
const VIEW_COLUMNS = "id, label, base_url, model_name, created_at, updated_at";

/** DB-Zeilenform der client-sicheren Projektion (ohne Key-Spalten). */
type ModelConfigViewRow = Pick<ModelConfig, "id" | "label" | "base_url" | "model_name" | "created_at" | "updated_at">;

function toView(row: ModelConfigViewRow): ModelConfigView {
  return {
    id: row.id,
    label: row.label,
    baseUrl: row.base_url,
    modelName: row.model_name,
    hasKey: true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Wirft einen echten Error (only-throw-error); Rohtext mappt die Route auf eine sichere Meldung. */
function fail(action: string, message: string): never {
  throw new Error(`model-configs ${action} failed: ${message}`);
}

/** Listet die Konfigs des angemeldeten Nutzers (RLS-gescoped), neueste zuerst. */
export async function listModelConfigs(sb: SupabaseClient): Promise<ModelConfigView[]> {
  const { data, error } = await sb.from(TABLE).select(VIEW_COLUMNS).order("created_at", { ascending: false });
  if (error) fail("list", error.message);
  return (data as ModelConfigViewRow[]).map(toView);
}

/** Legt eine Konfig an; verschluesselt den Key vor dem Insert. owner_id via DB-Default. */
export async function createModelConfig(sb: SupabaseClient, input: CreateModelConfigInput): Promise<ModelConfigView> {
  const encrypted = await encryptApiKey(input.apiKey, getEncryptionKey());
  const { data, error } = await sb
    .from(TABLE)
    .insert({
      label: input.label,
      base_url: input.baseUrl,
      model_name: input.modelName,
      key_ciphertext: encrypted.ciphertext,
      key_iv: encrypted.iv,
      key_version: encrypted.keyVersion,
    })
    .select(VIEW_COLUMNS)
    .single();
  if (error) fail("create", error.message);
  return toView(data);
}

/**
 * Aktualisiert Metadaten (immer) und `updated_at`; der Key wird nur ersetzt,
 * wenn `apiKey` gesetzt ist — sonst bleibt der bestehende Ciphertext unberuehrt.
 * Gibt `null`, wenn keine Zeile getroffen wurde (fremde/fehlende id via RLS) —
 * die Route mappt das auf 404.
 */
export async function updateModelConfig(
  sb: SupabaseClient,
  id: string,
  input: UpdateModelConfigInput,
): Promise<ModelConfigView | null> {
  const patch: Record<string, string | number> = {
    label: input.label,
    base_url: input.baseUrl,
    model_name: input.modelName,
    updated_at: new Date().toISOString(),
  };
  if (input.apiKey) {
    const encrypted = await encryptApiKey(input.apiKey, getEncryptionKey());
    patch.key_ciphertext = encrypted.ciphertext;
    patch.key_iv = encrypted.iv;
    patch.key_version = encrypted.keyVersion;
  }
  const { data, error } = await sb.from(TABLE).update(patch).eq("id", id).select(VIEW_COLUMNS).maybeSingle();
  if (error) fail("update", error.message);
  return data ? toView(data) : null;
}

/**
 * Loescht eine Konfig (RLS beschraenkt auf die eigene; fremde/fehlende id →
 * kein Effekt). Gibt `true`, wenn eine Zeile getroffen wurde, sonst `false` —
 * die Route mappt `false` auf 404 (analog zu `updateModelConfig`).
 */
export async function deleteModelConfig(sb: SupabaseClient, id: string): Promise<boolean> {
  const { data, error } = await sb.from(TABLE).delete().eq("id", id).select("id").maybeSingle();
  if (error) fail("delete", error.message);
  return data !== null;
}

/**
 * Server-only: laedt eine Konfig inkl. entschluesseltem API-Key fuer den
 * Verbindungstest. Der Key wird NUR fuer den Upstream-Call genutzt und NIE an
 * den Client zurueckgegeben. Gibt `null`, wenn die Konfig nicht existiert oder
 * (per RLS) nicht dem Aufrufer gehoert.
 */
export async function getDecryptedTarget(
  sb: SupabaseClient,
  id: string,
): Promise<{ baseUrl: string; apiKey: string } | null> {
  const { data, error } = await sb
    .from(TABLE)
    .select("base_url, key_ciphertext, key_iv, key_version")
    .eq("id", id)
    .maybeSingle();
  if (error) fail("test-target", error.message);
  if (!data) return null;
  const row = data as Pick<ModelConfig, "base_url" | "key_ciphertext" | "key_iv" | "key_version">;
  const apiKey = await decryptApiKey(
    { ciphertext: row.key_ciphertext, iv: row.key_iv, keyVersion: row.key_version },
    getEncryptionKey(),
  );
  return { baseUrl: row.base_url, apiKey };
}
