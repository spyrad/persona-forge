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
import { encryptApiKey } from "@/lib/crypto";
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
 */
export async function updateModelConfig(
  sb: SupabaseClient,
  id: string,
  input: UpdateModelConfigInput,
): Promise<ModelConfigView> {
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
  const { data, error } = await sb.from(TABLE).update(patch).eq("id", id).select(VIEW_COLUMNS).single();
  if (error) fail("update", error.message);
  return toView(data);
}

/** Loescht eine Konfig (RLS beschraenkt auf die eigene). */
export async function deleteModelConfig(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from(TABLE).delete().eq("id", id);
  if (error) fail("delete", error.message);
}
