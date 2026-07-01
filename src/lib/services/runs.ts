/**
 * Service-Schicht fuer `public.runs` — kapselt das Supabase-CRUD eines Test-Laufs.
 *
 * Phase 1 (dieser Stand): Anlegen/Liste/Lesen/Loeschen, OHNE LLM-Ausfuehrung.
 * Die Orchestrierung (`processNextRepetition`) kommt in Phase 2.
 *
 * Invarianten:
 *   * `owner_id` wird beim Insert NICHT gesetzt — DB-Default `auth.uid()`.
 *   * `visibility` default 'global' (FR-003; explizit gesetzt, DB-Default bleibt
 *     'private' als Defense-in-Depth). Umschalten via `updateRunVisibility` (S-07).
 *   * Ein Lauf ist selbst-enthalten: `persona_prompt_snapshot` haelt den aufgeloesten
 *     Persona-System-Prompt fest (reproduzierbar, auch wenn Persona spaeter geloescht wird).
 *   * RLS erzwingt den Scope serverseitig (select own-or-global, writes owner-only).
 */
import { OEJTS } from "@/lib/instruments/oejts";
import { chatCompletion } from "@/lib/llm/openai-compatible";
import { aggregateRun } from "@/lib/runs/oejts-aggregate";
import { buildOejtsMessages, parseOejtsResponse, permuteItems } from "@/lib/runs/oejts-run";
import { getDecryptedTarget } from "@/lib/services/model-configs";
import type { createClient } from "@/lib/supabase";
import type {
  CreateRunInput,
  ItemValue,
  RepetitionStatus,
  Run,
  RunProgress,
  RunRepetition,
  RunResultView,
  RunStatus,
  RunView,
  Visibility,
} from "@/types";

type SupabaseClient = NonNullable<ReturnType<typeof createClient>>;

const TABLE = "runs";

/** Spalten der View-Projektion (inkl. owner_id fuer `isOwn`) + eingebetteter Wiederholungs-Count. */
const VIEW_COLUMNS =
  "id, owner_id, persona_id, model_config_id, instrument_id, repetition_count, status, prompt_tokens, completion_tokens, failed_count, visibility, created_at, updated_at, finished_at, run_repetitions(count)";

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
  | "finished_at"
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
    finishedAt: row.finished_at,
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
 * Modellkonfig sichtbar/eigen ist. Gibt `null`, wenn Persona ODER Modellkonfig
 * nicht sichtbar ist (die Route mappt das auf 400) — echte DB-Fehler werfen.
 */
export async function createRun(sb: SupabaseClient, userId: string, input: CreateRunInput): Promise<RunView | null> {
  // Persona RLS-gescoped lesen (eigene oder globale) → Snapshot.
  const { data: persona, error: pErr } = await sb
    .from("personas")
    .select("system_prompt")
    .eq("id", input.personaId)
    .maybeSingle();
  if (pErr) fail("create:persona", pErr.message);
  if (!persona) return null;

  // Modellkonfig-Sichtbarkeit pruefen (RLS: nur eigene).
  const { data: model, error: mErr } = await sb
    .from("model_configs")
    .select("id")
    .eq("id", input.modelConfigId)
    .maybeSingle();
  if (mErr) fail("create:model", mErr.message);
  if (!model) return null;

  const { data, error } = await sb
    .from(TABLE)
    .insert({
      persona_id: input.personaId,
      model_config_id: input.modelConfigId,
      persona_prompt_snapshot: persona.system_prompt,
      instrument_id: input.instrumentId,
      repetition_count: input.repetitionCount,
      // FR-003: Default ist 'global', explizit gesetzt (DB-Default bleibt
      // 'private' als Defense-in-Depth). Umschalten via updateRunVisibility (S-07).
      visibility: "global",
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

/**
 * Schaltet die Sichtbarkeit eines EIGENEN Laufs um (privat/global, S-07).
 * In-Place-Update nur des `visibility`-Felds (+ `updated_at`); RLS (`runs_update_own`)
 * erzwingt owner-only. Das Ergebnis erbt die Sichtbarkeit ueber `run_repetitions`
 * (Parent-Subquery). Eine fremde/fehlende id trifft 0 Zeilen → `null` (Route → 404).
 */
export async function updateRunVisibility(
  sb: SupabaseClient,
  userId: string,
  id: string,
  visibility: Visibility,
): Promise<RunView | null> {
  const { data, error } = await sb
    .from(TABLE)
    .update({ visibility, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(VIEW_COLUMNS)
    .maybeSingle();
  if (error) fail("update-visibility", error.message);
  return data ? toView(data, userId) : null;
}

// ─── Ergebnis-Auswertung (S-05) ──────────────────────────────────────────────

/**
 * Mappt eine `run_repetitions`-Zeile auf die fuer das Scoring noetigen Felder.
 * Der typisierte Parameter launtert das `any` des untypisierten Clients (gleiches
 * Muster wie `toView`/`toStepState`) — kein Cast + Property-Zugriff.
 */
function toRepForScoring(row: Pick<RunRepetition, "item_values">): Pick<RunRepetition, "item_values"> {
  return { item_values: row.item_values };
}

/**
 * Liest einen Lauf + seine Wiederholungen RLS-gescoped und aggregiert das Ergebnis
 * on-the-fly (deterministisch, keine persistierten Aggregate; NFR Reproduzierbarkeit).
 * `null` wenn der Lauf nicht sichtbar ist (Route → 404). `pending`/`running` →
 * `state:'unfinished'`; 0 verwertbare Wiederholungen → `state:'empty'`; sonst `ready`.
 * Die „<2 verwertbar"-Schwelle ist eine Darstellungs-Sache (UI), hier werden nur die
 * Zahlen geliefert.
 */
export async function getRunResult(sb: SupabaseClient, userId: string, id: string): Promise<RunResultView | null> {
  const run = await getRun(sb, userId, id);
  if (!run) return null;

  if (run.status === "pending" || run.status === "running") {
    return { run, aggregate: null, state: "unfinished" };
  }

  const { data, error } = await sb.from("run_repetitions").select("item_values").eq("run_id", id);
  if (error) fail("result:reps", error.message);
  const reps = (data as Pick<RunRepetition, "item_values">[]).map(toRepForScoring);

  const aggregate = aggregateRun(reps, OEJTS);
  return { run, aggregate, state: aggregate.usableReps === 0 ? "empty" : "ready" };
}

// ─── Orchestrierung (Phase 2) ────────────────────────────────────────────────

/** Lauf-Felder, die ein Step-Aufruf braucht. */
const STEP_COLUMNS =
  "id, owner_id, model_config_id, persona_prompt_snapshot, repetition_count, status, prompt_tokens, completion_tokens, failed_count";

/** Typisierter Step-Stand eines Laufs (camelCase). */
interface RunStepState {
  modelConfigId: string | null;
  personaPromptSnapshot: string;
  repetitionCount: number;
  status: RunStatus;
  promptTokens: number;
  completionTokens: number;
  failedCount: number;
}

/**
 * Mappt eine `runs`-Zeile auf den getippten Step-Stand. Der typisierte Parameter
 * launtert das `any` des untypisierten Supabase-Clients (gleiches Muster wie
 * `toView`), sodass die Orchestrierung typsicher auf den Feldern arbeitet.
 */
function toStepState(
  row: Pick<
    Run,
    | "model_config_id"
    | "persona_prompt_snapshot"
    | "repetition_count"
    | "status"
    | "prompt_tokens"
    | "completion_tokens"
    | "failed_count"
  >,
): RunStepState {
  return {
    modelConfigId: row.model_config_id,
    personaPromptSnapshot: row.persona_prompt_snapshot,
    repetitionCount: row.repetition_count,
    status: row.status,
    promptTokens: row.prompt_tokens,
    completionTokens: row.completion_tokens,
    failedCount: row.failed_count,
  };
}

/**
 * Deterministischer Seed je (Lauf, Wiederholung) — FNV-1a ueber `runId:repIndex`.
 * Gleicher Lauf + gleiche rep_index → gleiche Permutation (Reproduzierbarkeit).
 */
function seedFrom(runId: string, repIndex: number): number {
  let h = 0x811c9dc5;
  const s = `${runId}:${repIndex}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Zaehlt die bereits geschriebenen Wiederholungen eines Laufs (RLS-gescoped). */
async function countReps(sb: SupabaseClient, runId: string): Promise<number> {
  const { count, error } = await sb
    .from("run_repetitions")
    .select("id", { count: "exact", head: true })
    .eq("run_id", runId);
  if (error) fail("step:count", error.message);
  return count ?? 0;
}

/** Schreibt Lauf-Felder fort (immer mit aktualisiertem `updated_at`). */
async function patchRun(sb: SupabaseClient, runId: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await sb
    .from(TABLE)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", runId);
  if (error) fail("step:patch", error.message);
}

/**
 * Verarbeitet die naechste offene Wiederholung eines Laufs (eine pro Aufruf,
 * client-orchestriert) und schreibt den Fortschritt fort:
 *   decrypt → permute → build → call(+Retry) → parse → run_repetition persistieren
 *   → Lauf-Aggregat (Tokens/Fehlquote) → Status-Uebergang.
 *
 * Resilienz (NFR): eine fehlgeschlagene/ungparsebare Wiederholung wird als
 * `failed` festgehalten, der Lauf laeuft weiter; erst wenn am Ende 0 verwertbar
 * sind → Lauf `failed`. Gibt `null`, wenn der Lauf nicht (mehr) sichtbar ist
 * (Route → 404).
 *
 * Sonderfaelle:
 *   * F3 (Plan-Review): Modellkonfig nicht mehr verfuegbar (geloescht/unsichtbar)
 *     → ganzen Lauf `failed`, statt eine Exception zu werfen.
 *   * F4 (Plan-Review): paralleler Doppelaufruf → unique-Verletzung
 *     `(run_id, rep_index)` wird NICHT propagiert, sondern als „bereits
 *     fortgeschritten" behandelt (aktuellen Fortschritt neu lesen).
 */
export async function processNextRepetition(
  sb: SupabaseClient,
  userId: string,
  runId: string,
): Promise<RunProgress | null> {
  const { data, error } = await sb.from(TABLE).select(STEP_COLUMNS).eq("id", runId).maybeSingle();
  if (error) fail("step:read", error.message);
  if (!data) return null;
  const run = toStepState(data);

  // Terminal → idempotent den aktuellen Stand zurueckgeben.
  if (run.status === "completed" || run.status === "failed") {
    return {
      status: run.status,
      completedReps: await countReps(sb, runId),
      totalReps: run.repetitionCount,
      failedCount: run.failedCount,
      promptTokens: run.promptTokens,
      completionTokens: run.completionTokens,
    };
  }

  // pending → running (erster Schritt).
  if (run.status === "pending") {
    await patchRun(sb, runId, { status: "running" });
  }

  const completedReps = await countReps(sb, runId);

  // Alle Wiederholungen geschrieben → Lauf finalisieren.
  if (completedReps >= run.repetitionCount) {
    const finalStatus: RunStatus = run.failedCount >= run.repetitionCount ? "failed" : "completed";
    await patchRun(sb, runId, { status: finalStatus });
    return {
      status: finalStatus,
      completedReps,
      totalReps: run.repetitionCount,
      failedCount: run.failedCount,
      promptTokens: run.promptTokens,
      completionTokens: run.completionTokens,
    };
  }

  // F3: ohne Modellkonfig kann kein Call erfolgen → ganzer Lauf failed.
  if (!run.modelConfigId) {
    await patchRun(sb, runId, { status: "failed" });
    return {
      status: "failed",
      completedReps,
      totalReps: run.repetitionCount,
      failedCount: run.failedCount,
      promptTokens: run.promptTokens,
      completionTokens: run.completionTokens,
    };
  }
  const target = await getDecryptedTarget(sb, run.modelConfigId);
  if (!target) {
    await patchRun(sb, runId, { status: "failed" });
    return {
      status: "failed",
      completedReps,
      totalReps: run.repetitionCount,
      failedCount: run.failedCount,
      promptTokens: run.promptTokens,
      completionTokens: run.completionTokens,
    };
  }

  // Naechste Wiederholung: permutieren → Messages bauen → Call.
  const repIndex = completedReps + 1;
  const seed = seedFrom(runId, repIndex);
  // v1: OEJTS permutiert immer (FR-012, `permute: true`). Die Generalisierung auf
  // permute:false folgt mit einem zweiten Instrument.
  const { ordered, order } = permuteItems(OEJTS.items, seed);
  const expectedIds = ordered.map((it) => it.id);
  const messages = buildOejtsMessages(run.personaPromptSnapshot, ordered);

  let repStatus: RepetitionStatus = "failed";
  let rawResponse: string | null = null;
  let itemValues: ItemValue[] | null = null;
  let repPrompt: number | null = null;
  let repCompletion: number | null = null;
  let repError: string | null = null;

  try {
    const completion = await chatCompletion({
      baseUrl: target.baseUrl,
      apiKey: target.apiKey,
      model: target.modelName,
      messages,
      jsonMode: true,
    });
    rawResponse = completion.content;
    repPrompt = completion.promptTokens;
    repCompletion = completion.completionTokens;
    const parsed = parseOejtsResponse(completion.content, expectedIds);
    itemValues = parsed.values;
    if (parsed.okCount === 0) {
      repError = "no parseable item values in response";
    } else {
      repStatus = "ok";
    }
  } catch (err) {
    repError = err instanceof Error ? err.message : "completion failed";
  }

  // Wiederholung persistieren; F4: unique-Verletzung tolerieren (Doppelaufruf).
  const { error: insErr } = await sb.from("run_repetitions").insert({
    run_id: runId,
    rep_index: repIndex,
    item_order: order,
    raw_response: rawResponse,
    item_values: itemValues,
    status: repStatus,
    error: repError,
    prompt_tokens: repPrompt,
    completion_tokens: repCompletion,
  });
  if (insErr) {
    if (insErr.code === "23505") {
      // Parallel bereits geschrieben → aktuellen Fortschritt neu lesen.
      const { data: cur } = await sb.from(TABLE).select(STEP_COLUMNS).eq("id", runId).maybeSingle();
      if (!cur) return null;
      const c = toStepState(cur);
      return {
        status: c.status,
        completedReps: await countReps(sb, runId),
        totalReps: c.repetitionCount,
        failedCount: c.failedCount,
        promptTokens: c.promptTokens,
        completionTokens: c.completionTokens,
      };
    }
    fail("step:insert", insErr.message);
  }

  // Lauf-Aggregat fortschreiben: Fehlquote nach Status; Token-Summen zaehlen
  // ALLE real verbrauchten Tokens (auch fehlgeschlagene Wiederholungen, die
  // dennoch eine Antwort + usage lieferten) — sonst wird der Verbrauch (FR-015)
  // untertrieben. Fehlt usage, ist der Beitrag 0.
  const newFailedCount = run.failedCount + (repStatus === "ok" ? 0 : 1);
  const newPromptTokens = run.promptTokens + (repPrompt ?? 0);
  const newCompletionTokens = run.completionTokens + (repCompletion ?? 0);
  await patchRun(sb, runId, {
    failed_count: newFailedCount,
    prompt_tokens: newPromptTokens,
    completion_tokens: newCompletionTokens,
  });

  return {
    status: "running",
    completedReps: repIndex,
    totalReps: run.repetitionCount,
    failedCount: newFailedCount,
    promptTokens: newPromptTokens,
    completionTokens: newCompletionTokens,
  };
}
