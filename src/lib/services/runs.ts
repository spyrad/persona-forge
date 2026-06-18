/**
 * Service-Schicht fuer `public.runs` — kapselt das Supabase-CRUD eines Test-Laufs.
 *
 * Phase 1 (dieser Stand): Anlegen/Liste/Lesen/Loeschen, OHNE LLM-Ausfuehrung.
 * Die Orchestrierung (`processNextRepetition`) kommt in Phase 2.
 *
 * Invarianten:
 *   * `owner_id` wird beim Insert NICHT gesetzt — DB-Default `auth.uid()`.
 *   * `visibility` immer 'private' (Toggle = S-07; privacy-by-default, S-03-Lesson F1).
 *   * Ein Lauf ist selbst-enthalten: `persona_prompt_snapshot` haelt den aufgeloesten
 *     Persona-System-Prompt fest (reproduzierbar, auch wenn Persona spaeter geloescht wird).
 *   * RLS erzwingt den Scope serverseitig (select own-or-global, writes owner-only).
 */
import type { createClient } from "@/lib/supabase";
import type { CreateRunInput, Run, RunView } from "@/types";

type SupabaseClient = NonNullable<ReturnType<typeof createClient>>;

const TABLE = "runs";

/** Spalten der View-Projektion (inkl. owner_id fuer `isOwn`) + eingebetteter Wiederholungs-Count. */
const VIEW_COLUMNS =
  "id, owner_id, persona_id, model_config_id, instrument_id, repetition_count, status, prompt_tokens, completion_tokens, failed_count, visibility, created_at, updated_at, run_repetitions(count)";

type RunViewRow = Pick<
  Run,
  | "id"
  | "owner_id"
  | "persona_id"
  | "model_config_id"
  | "instrument_id"
  | "repetition_count"
  | "status"
  | "prompt_tokens"
  | "completion_tokens"
  | "failed_count"
  | "visibility"
  | "created_at"
  | "updated_at"
> & { run_repetitions?: { count: number }[] };

function toView(row: RunViewRow, userId: string): RunView {
  return {
    id: row.id,
    personaId: row.persona_id,
    modelConfigId: row.model_config_id,
    instrumentId: row.instrument_id,
    repetitionCount: row.repetition_count,
    status: row.status,
    promptTokens: row.prompt_tokens,
    completionTokens: row.completion_tokens,
    failedCount: row.failed_count,
    completedReps: row.run_repetitions?.[0]?.count ?? 0,
    visibility: row.visibility,
    isOwn: row.owner_id === userId,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function fail(action: string, message: string): never {
  throw new Error(`runs ${action} failed: ${message}`);
}

/** Listet sichtbare Laeufe (eigene + globale, RLS-gescoped), neueste zuerst. */
export async function listRuns(sb: SupabaseClient, userId: string): Promise<RunView[]> {
  const { data, error } = await sb.from(TABLE).select(VIEW_COLUMNS).order("created_at", { ascending: false });
  if (error) fail("list", error.message);
  return (data as RunViewRow[]).map((row) => toView(row, userId));
}

/** Liest einen einzelnen Lauf (RLS-gescoped). `null` wenn nicht sichtbar/vorhanden. */
export async function getRun(sb: SupabaseClient, userId: string, id: string): Promise<RunView | null> {
  const { data, error } = await sb.from(TABLE).select(VIEW_COLUMNS).eq("id", id).maybeSingle();
  if (error) fail("get", error.message);
  return data ? toView(data, userId) : null;
}

/**
 * Legt einen Lauf an (Status `pending`). Loest die Persona RLS-gescoped auf und
 * schreibt deren `system_prompt` als Snapshot; validiert, dass auch die
 * Modellkonfig sichtbar/eigen ist. Beides nicht sichtbar → Fehler (Route → 400/404).
 */
export async function createRun(sb: SupabaseClient, userId: string, input: CreateRunInput): Promise<RunView> {
  // Persona RLS-gescoped lesen (eigene oder globale) → Snapshot.
  const { data: persona, error: pErr } = await sb
    .from("personas")
    .select("system_prompt")
    .eq("id", input.personaId)
    .maybeSingle();
  if (pErr) fail("create:persona", pErr.message);
  if (!persona) fail("create", "persona not found or not visible");

  // Modellkonfig-Sichtbarkeit pruefen (RLS: nur eigene).
  const { data: model, error: mErr } = await sb
    .from("model_configs")
    .select("id")
    .eq("id", input.modelConfigId)
    .maybeSingle();
  if (mErr) fail("create:model", mErr.message);
  if (!model) fail("create", "model config not found or not visible");

  const { data, error } = await sb
    .from(TABLE)
    .insert({
      persona_id: input.personaId,
      model_config_id: input.modelConfigId,
      persona_prompt_snapshot: persona.system_prompt,
      instrument_id: input.instrumentId,
      repetition_count: input.repetitionCount,
      visibility: "private",
      // owner_id via DB-Default (auth.uid())
    })
    .select(VIEW_COLUMNS)
    .single();
  if (error) fail("create", error.message);
  return toView(data, userId);
}

/**
 * Loescht einen Lauf (RLS: nur die eigene; fremde/fehlende id → kein Effekt).
 * Child-Zeilen (`run_repetitions`) gehen per `on delete cascade` mit. Gibt `true`,
 * wenn eine Zeile getroffen wurde, sonst `false` (Route → 404). Dient auch als Abbruch.
 */
export async function deleteRun(sb: SupabaseClient, id: string): Promise<boolean> {
  const { data, error } = await sb.from(TABLE).delete().eq("id", id).select("id").maybeSingle();
  if (error) fail("delete", error.message);
  return data !== null;
}
