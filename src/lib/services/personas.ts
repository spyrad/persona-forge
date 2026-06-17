/**
 * Service-Schicht fuer `public.personas` — kapselt das Supabase-CRUD.
 *
 * Invarianten:
 *   * Personas sind UNVERAENDERLICH (FR-008): es gibt KEIN `update`. Eine
 *     Aenderung entsteht nur als Kopie (`duplicatePersona`, neue Zeile).
 *   * `owner_id` wird beim Insert NICHT explizit gesetzt — die Spalte hat
 *     `default auth.uid()` (siehe Migration, wie `model_configs`/`_rls_probe`).
 *   * RLS erzwingt den Scope serverseitig: select sieht eigene + globale, alle
 *     Writes bleiben owner-only. Der Service verlaesst sich darauf (kein eigener
 *     owner-Filter).
 *
 * `isOwn` wird im View-Mapping aus `owner_id === userId` abgeleitet (steuert
 * Loeschbarkeit/Badge); dafuer selektieren die Lese-Operationen `owner_id` mit.
 */
import { compilePersonaPrompt } from "@/lib/persona-compile";
import type { createClient } from "@/lib/supabase";
import type { CreatePersonaInput, Persona, PersonaStructuredFields, PersonaView } from "@/types";

type SupabaseClient = NonNullable<ReturnType<typeof createClient>>;

const TABLE = "personas";

/** Spalten der client-sicheren Projektion (inkl. owner_id fuer `isOwn`-Ableitung). */
const VIEW_COLUMNS =
  "id, owner_id, name, description, tags, system_prompt, visibility, source_kind, structured_fields, created_at, updated_at";

/** DB-Zeilenform der View-Projektion. */
type PersonaViewRow = Pick<
  Persona,
  | "id"
  | "owner_id"
  | "name"
  | "description"
  | "tags"
  | "system_prompt"
  | "visibility"
  | "source_kind"
  | "structured_fields"
  | "created_at"
  | "updated_at"
>;

function toView(row: PersonaViewRow, userId: string): PersonaView {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    tags: row.tags,
    systemPrompt: row.system_prompt,
    visibility: row.visibility,
    sourceKind: row.source_kind,
    // jsonb kommt als `unknown` zurueck; unsere eigene Schreibseite garantiert die
    // Form (nur bei source_kind = 'structured' gesetzt).
    structuredFields: (row.structured_fields as PersonaStructuredFields | null) ?? null,
    isOwn: row.owner_id === userId,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Wirft einen echten Error (only-throw-error); Rohtext mappt die Route auf eine sichere Meldung. */
function fail(action: string, message: string): never {
  throw new Error(`personas ${action} failed: ${message}`);
}

/** Listet sichtbare Personas (eigene + globale, RLS-gescoped), neueste zuerst. */
export async function listPersonas(sb: SupabaseClient, userId: string): Promise<PersonaView[]> {
  const { data, error } = await sb.from(TABLE).select(VIEW_COLUMNS).order("created_at", { ascending: false });
  if (error) fail("list", error.message);
  return (data as PersonaViewRow[]).map((row) => toView(row, userId));
}

/**
 * Legt eine Persona an. owner_id via DB-Default, visibility = Default ('global').
 * Bei `sourceKind = 'structured'` wird der `system_prompt` serverseitig aus den
 * Feldern kompiliert und die Felder selbst in `structured_fields` abgelegt; bei
 * `'freeform'` wird der getippte Prompt direkt gespeichert.
 */
export async function createPersona(
  sb: SupabaseClient,
  userId: string,
  input: CreatePersonaInput,
): Promise<PersonaView> {
  const systemPrompt =
    input.sourceKind === "structured" ? compilePersonaPrompt(input.structuredFields) : input.systemPrompt;
  const structuredFields = input.sourceKind === "structured" ? input.structuredFields : null;

  const { data, error } = await sb
    .from(TABLE)
    .insert({
      name: input.name,
      description: input.description,
      tags: input.tags,
      system_prompt: systemPrompt,
      source_kind: input.sourceKind,
      structured_fields: structuredFields,
    })
    .select(VIEW_COLUMNS)
    .single();
  if (error) fail("create", error.message);
  return toView(data, userId);
}

/**
 * Kopiert eine sichtbare Persona (eigene ODER globale) in eine neue, eigene,
 * private Zeile mit Namens-Suffix „(Kopie)". owner_id via DB-Default
 * (= aktueller Nutzer). Gibt `null`, wenn die Quelle nicht existiert oder (per
 * RLS) nicht sichtbar ist — die Route mappt das auf 404.
 */
export async function duplicatePersona(sb: SupabaseClient, userId: string, id: string): Promise<PersonaView | null> {
  const { data: source, error: readError } = await sb
    .from(TABLE)
    .select("name, description, tags, system_prompt, source_kind, structured_fields")
    .eq("id", id)
    .maybeSingle();
  if (readError) fail("duplicate-read", readError.message);
  if (!source) return null;
  const src = source as Pick<
    Persona,
    "name" | "description" | "tags" | "system_prompt" | "source_kind" | "structured_fields"
  >;

  const { data, error } = await sb
    .from(TABLE)
    .insert({
      name: `${src.name} (Kopie)`,
      description: src.description,
      tags: src.tags,
      system_prompt: src.system_prompt,
      source_kind: src.source_kind,
      structured_fields: src.structured_fields,
      visibility: "private",
    })
    .select(VIEW_COLUMNS)
    .single();
  if (error) fail("duplicate", error.message);
  return toView(data, userId);
}

/**
 * Loescht eine Persona (RLS: nur die eigene; fremde/globale/fehlende id → kein
 * Effekt). Gibt `true`, wenn eine Zeile getroffen wurde, sonst `false` — die
 * Route mappt `false` auf 404 (S-02-Lesson: 0-Row-Match ist kein Erfolg).
 */
export async function deletePersona(sb: SupabaseClient, id: string): Promise<boolean> {
  const { data, error } = await sb.from(TABLE).delete().eq("id", id).select("id").maybeSingle();
  if (error) fail("delete", error.message);
  return data !== null;
}
