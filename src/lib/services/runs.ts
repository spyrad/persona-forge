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
import { STEADFASTNESS_ID } from "@/lib/instruments/steadfastness";
import { chatCompletion } from "@/lib/llm/openai-compatible";
import { isBaselineRun } from "@/lib/runs/baseline";
import { aggregateRun } from "@/lib/runs/oejts-aggregate";
import { buildOejtsMessages, parseOejtsResponse, permuteItems } from "@/lib/runs/oejts-run";
import { aggregateSteadfastness } from "@/lib/runs/steadfastness-aggregate";
import { summarizeTiming } from "@/lib/runs/run-timing";
import { summarizeFailures } from "@/lib/runs/run-failures";
import {
  buildGeneratorMessages,
  parseFactList,
  buildSubjectMessages,
  parseSubjectResponse,
  buildPersuaderMessages,
  strategyForRound,
  applyTurn,
} from "@/lib/runs/steadfastness-run";
import { getDecryptedTarget } from "@/lib/services/model-configs";
import type { createClient } from "@/lib/supabase";
import type {
  CreateRunInput,
  ItemValue,
  Persona,
  RepetitionStatus,
  Run,
  RunProgress,
  RunRepetition,
  RunResultView,
  RunStatus,
  RunView,
  SteadfastnessExperiment,
  SteadfastnessScenario,
  SteadfastnessTurn,
  Visibility,
} from "@/types";

type SupabaseClient = NonNullable<ReturnType<typeof createClient>>;

const TABLE = "runs";

/**
 * Spalten der View-Projektion (inkl. owner_id fuer `isOwn`) + eingebetteter
 * Wiederholungs-Count. `persona_prompt_snapshot` dient NUR der server-seitigen
 * `isBaseline`-Berechnung — die View traegt den Boolean, nie den Snapshot.
 */
const VIEW_COLUMNS =
  "id, owner_id, persona_id, model_config_id, persona_prompt_snapshot, instrument_id, repetition_count, status, prompt_tokens, completion_tokens, failed_count, visibility, created_at, updated_at, finished_at, kind, run_repetitions(count)";

type RunViewRow = Pick<
  Run,
  | "id"
  | "owner_id"
  | "persona_id"
  | "model_config_id"
  | "persona_prompt_snapshot"
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
  | "kind"
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
    kind: row.kind,
    isBaseline: isBaselineRun(row.persona_id, row.persona_prompt_snapshot),
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
 * `personaId: null` = Baseline-Lauf: keine Persona-Aufloesung, Snapshot `""`
 * (Semantik: `isBaselineRun` in `@/lib/runs/baseline`).
 */
export async function createRun(sb: SupabaseClient, userId: string, input: CreateRunInput): Promise<RunView | null> {
  // Persona RLS-gescoped lesen (eigene oder globale) → Snapshot. Baseline
  // (personaId null) ueberspringt die Aufloesung; Snapshot bleibt leer.
  let snapshot = "";
  if (input.personaId !== null) {
    const { data: persona, error: pErr } = await sb
      .from("personas")
      .select("system_prompt")
      .eq("id", input.personaId)
      .maybeSingle();
    if (pErr) fail("create:persona", pErr.message);
    if (!persona) return null;
    // Getippter Cast launtert das `any` des untypisierten Supabase-Clients
    // (gleiches Muster wie `duplicatePersona`), sonst meldet eslint eine
    // "unsafe assignment" beim Aufbau von `base` unten.
    const personaRow = persona as Pick<Persona, "system_prompt">;
    snapshot = personaRow.system_prompt;
  }

  // Modellkonfig-Sichtbarkeit pruefen (RLS: nur eigene).
  const { data: model, error: mErr } = await sb
    .from("model_configs")
    .select("id")
    .eq("id", input.modelConfigId)
    .maybeSingle();
  if (mErr) fail("create:model", mErr.message);
  if (!model) return null;

  // Gemeinsame Insert-Felder.
  const base = {
    persona_id: input.personaId,
    model_config_id: input.modelConfigId,
    persona_prompt_snapshot: snapshot,
    repetition_count: input.repetitionCount,
    visibility: "global" as const,
  };

  let insert: Record<string, unknown>;
  if (input.kind === "steadfastness") {
    // Gegenspieler-Modell muss ebenfalls sichtbar/eigen sein.
    const { data: adv, error: aErr } = await sb
      .from("model_configs")
      .select("id")
      .eq("id", input.adversaryModelConfigId)
      .maybeSingle();
    if (aErr) fail("create:adversary", aErr.message);
    if (!adv) return null;
    insert = {
      ...base,
      kind: "steadfastness",
      instrument_id: STEADFASTNESS_ID,
      adversary_model_config_id: input.adversaryModelConfigId,
      max_rounds: input.maxRounds,
    };
  } else {
    insert = { ...base, kind: "oejts", instrument_id: input.instrumentId };
  }

  const { data, error } = await sb.from(TABLE).insert(insert).select(VIEW_COLUMNS).single();
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
    return {
      run,
      aggregate: null,
      steadfastness: null,
      state: "unfinished",
      timing: summarizeTiming(run.createdAt, run.finishedAt, []),
      failures: [],
    };
  }

  // `kind` kommt bereits aus getRun (RunView.kind, VIEW_COLUMNS) — keine zweite Query nötig.
  if (run.kind === "steadfastness") {
    const { data, error } = await sb
      .from("run_repetitions")
      .select("experiment, duration_ms, status, error")
      .eq("run_id", id);
    if (error) fail("result:reps", error.message);
    const rows = data as {
      experiment: SteadfastnessExperiment | null;
      duration_ms: number | null;
      status: RepetitionStatus;
      error: string | null;
    }[];
    const timing = summarizeTiming(
      run.createdAt,
      run.finishedAt,
      rows.map((r) => r.duration_ms),
    );
    const failures = summarizeFailures(rows.map((r) => ({ status: r.status, error: r.error })));
    // Verwertbar = fertig gemessene (status ok + experiment.done).
    const experiments = rows.map((r) => r.experiment).filter((e): e is SteadfastnessExperiment => e?.done ?? false);
    const steadfastness = aggregateSteadfastness(experiments);
    const state = steadfastness.usableCount === 0 ? "empty" : "ready";
    return { run, aggregate: null, steadfastness, state, timing, failures };
  }

  // ── OEJTS-Pfad (unveraendert, nur steadfastness:null ergaenzt) ──
  const { data, error } = await sb
    .from("run_repetitions")
    .select("item_values, duration_ms, status, error")
    .eq("run_id", id);
  if (error) fail("result:reps", error.message);
  const rows = data as Pick<RunRepetition, "item_values" | "duration_ms" | "status" | "error">[];
  const reps = rows.map(toRepForScoring);
  const timing = summarizeTiming(
    run.createdAt,
    run.finishedAt,
    rows.map((r) => r.duration_ms),
  );
  const failures = summarizeFailures(rows.map((r) => ({ status: r.status, error: r.error })));

  const aggregate = aggregateRun(reps, OEJTS);
  return {
    run,
    aggregate,
    steadfastness: null,
    state: aggregate.usableReps === 0 ? "empty" : "ready",
    timing,
    failures,
  };
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

/** Terminal-Übergang eines Laufs: setzt Status UND finished_at (genau einmal). */
async function finalize(sb: SupabaseClient, runId: string, status: "completed" | "failed"): Promise<void> {
  await patchRun(sb, runId, { status, finished_at: new Date().toISOString() });
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
  // Kind-Dispatch: eine schlanke Vorab-Abfrage entscheidet den Pfad.
  const { data: kindRow, error: kindErr } = await sb.from(TABLE).select("kind").eq("id", runId).maybeSingle();
  if (kindErr) fail("step:kind", kindErr.message);
  if (!kindRow) return null;
  if (kindRow.kind === "steadfastness") {
    return stepSteadfastness(sb, runId);
  }
  // ── ab hier UNVERAENDERT der bestehende OEJTS-Pfad ──
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
      lastRepDurationMs: null,
      lastRepError: null,
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
    await finalize(sb, runId, finalStatus);
    return {
      status: finalStatus,
      completedReps,
      totalReps: run.repetitionCount,
      failedCount: run.failedCount,
      promptTokens: run.promptTokens,
      completionTokens: run.completionTokens,
      lastRepDurationMs: null,
      lastRepError: null,
    };
  }

  // F3: ohne Modellkonfig kann kein Call erfolgen → ganzer Lauf failed.
  if (!run.modelConfigId) {
    await finalize(sb, runId, "failed");
    return {
      status: "failed",
      completedReps,
      totalReps: run.repetitionCount,
      failedCount: run.failedCount,
      promptTokens: run.promptTokens,
      completionTokens: run.completionTokens,
      lastRepDurationMs: null,
      lastRepError: null,
    };
  }
  const target = await getDecryptedTarget(sb, run.modelConfigId);
  if (!target) {
    await finalize(sb, runId, "failed");
    return {
      status: "failed",
      completedReps,
      totalReps: run.repetitionCount,
      failedCount: run.failedCount,
      promptTokens: run.promptTokens,
      completionTokens: run.completionTokens,
      lastRepDurationMs: null,
      lastRepError: null,
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
  const repStartedAt = performance.now();

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
  const repDurationMs = Math.round(performance.now() - repStartedAt);

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
    duration_ms: repDurationMs,
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
        lastRepDurationMs: null,
        lastRepError: null,
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
    lastRepDurationMs: repDurationMs,
    lastRepError: repError,
  };
}

// ─── Orchestrierung: Standhaftigkeit (zweiter Test-Typ) ──────────────────────

/** Lauf-Felder, die ein Steadfastness-Schritt braucht. */
const STEADFAST_COLUMNS =
  "id, model_config_id, adversary_model_config_id, persona_prompt_snapshot, repetition_count, max_rounds, scenarios_snapshot, status, prompt_tokens, completion_tokens, failed_count";

/** Baut das terminale/fortlaufende RunProgress-Objekt für Steadfastness. */
function steadfastProgress(
  status: RunStatus,
  completed: number,
  total: number,
  failed: number,
  prompt: number,
  completion: number,
  live: {
    phase: "generating" | "experimenting" | null;
    currentScenario: number | null;
    currentRound: number | null;
    lastStrategy: string | null;
    lastRepError: string | null;
  } = {
    phase: null,
    currentScenario: null,
    currentRound: null,
    lastStrategy: null,
    lastRepError: null,
  },
): RunProgress {
  return {
    status,
    completedReps: completed,
    totalReps: total,
    failedCount: failed,
    promptTokens: prompt,
    completionTokens: completion,
    lastRepDurationMs: null,
    lastRepError: live.lastRepError,
    phase: live.phase,
    currentScenario: live.currentScenario,
    totalScenarios: total,
    currentRound: live.currentRound,
    lastStrategy: live.lastStrategy,
  };
}

/**
 * Ein Schritt eines Standhaftigkeits-Laufs (Ansatz A: eine Runde pro Aufruf).
 *   pending → running + N Fakten generieren (scenarios_snapshot).
 *   laufendes Experiment (rep status 'pending') → genau eine Runde fahren.
 *   kein laufendes, nächster Fakt offen → neues Experiment + Eröffnung.
 *   alle Experimente terminal → Lauf finalisieren.
 * ≤ 2 LLM-Calls pro Aufruf. Resilienz: ein LLM-Fehler markiert nur DIESES Experiment
 * failed; der Lauf failed erst, wenn alle Experimente failed sind. Generierung
 * scheitert → ganzer Lauf failed (ohne Szenarien kein Weiter).
 */
async function stepSteadfastness(sb: SupabaseClient, runId: string): Promise<RunProgress | null> {
  const { data, error } = await sb.from(TABLE).select(STEADFAST_COLUMNS).eq("id", runId).maybeSingle();
  if (error) fail("steadfast:read", error.message);
  if (!data) return null;
  const run = data as {
    model_config_id: string | null;
    adversary_model_config_id: string | null;
    persona_prompt_snapshot: string;
    repetition_count: number;
    max_rounds: number | null;
    scenarios_snapshot: SteadfastnessScenario[] | null;
    status: RunStatus;
    prompt_tokens: number;
    completion_tokens: number;
    failed_count: number;
  };
  const total = run.repetition_count;
  const maxRounds = run.max_rounds ?? 12;

  // Terminal → idempotent.
  if (run.status === "completed" || run.status === "failed") {
    const done = await countReps(sb, runId);
    return steadfastProgress(run.status, done, total, run.failed_count, run.prompt_tokens, run.completion_tokens);
  }

  // Modelle auflösen (Prüfling + Gegenspieler). Fehlt eins → Lauf failed.
  if (!run.model_config_id || !run.adversary_model_config_id) {
    await finalize(sb, runId, "failed");
    return steadfastProgress("failed", 0, total, run.failed_count, run.prompt_tokens, run.completion_tokens);
  }
  const subjectTarget = await getDecryptedTarget(sb, run.model_config_id);
  const adversaryTarget = await getDecryptedTarget(sb, run.adversary_model_config_id);
  if (!subjectTarget || !adversaryTarget) {
    await finalize(sb, runId, "failed");
    return steadfastProgress("failed", 0, total, run.failed_count, run.prompt_tokens, run.completion_tokens);
  }

  // pending → running + Szenarien generieren (einmalig).
  let scenarios = run.scenarios_snapshot;
  if (run.status === "pending" || !scenarios) {
    await patchRun(sb, runId, { status: "running" });
    try {
      const gen = await chatCompletion({
        baseUrl: adversaryTarget.baseUrl,
        apiKey: adversaryTarget.apiKey,
        model: adversaryTarget.modelName,
        messages: buildGeneratorMessages(total),
        jsonMode: true,
      });
      scenarios = parseFactList(gen.content).slice(0, total);
      await patchRun(sb, runId, {
        scenarios_snapshot: scenarios,
        prompt_tokens: run.prompt_tokens + (gen.promptTokens ?? 0),
        completion_tokens: run.completion_tokens + (gen.completionTokens ?? 0),
      });
    } catch (err) {
      await finalize(sb, runId, "failed");
      const msg = err instanceof Error ? err.message : "generation failed";
      return steadfastProgress("failed", 0, total, run.failed_count, run.prompt_tokens, run.completion_tokens, {
        phase: "generating",
        currentScenario: null,
        currentRound: null,
        lastStrategy: null,
        lastRepError: msg,
      });
    }
    if (scenarios.length === 0) {
      await finalize(sb, runId, "failed");
      return steadfastProgress("failed", 0, total, run.failed_count, run.prompt_tokens, run.completion_tokens, {
        phase: "generating",
        currentScenario: null,
        currentRound: null,
        lastStrategy: null,
        lastRepError: "no scenarios generated",
      });
    }
    // scenarios_snapshot ist jetzt gesetzt; nächster Step beginnt Experiment 1.
    return steadfastProgress("running", 0, total, run.failed_count, run.prompt_tokens + 0, run.completion_tokens + 0, {
      phase: "experimenting",
      currentScenario: 1,
      currentRound: 0,
      lastStrategy: null,
      lastRepError: null,
    });
  }

  // Aktuelle Reps lesen (Fortschritt + laufendes Experiment).
  const { data: repRows, error: repErr } = await sb
    .from("run_repetitions")
    .select("rep_index, status, error, experiment")
    .eq("run_id", runId)
    .order("rep_index", { ascending: true });
  if (repErr) fail("steadfast:reps", repErr.message);
  const reps = repRows as {
    rep_index: number;
    status: RepetitionStatus;
    error: string | null;
    experiment: SteadfastnessExperiment | null;
  }[];

  // terminalCount = fertig gemessene/gescheiterte Reps (pending = laufendes Experiment zählt NICHT).
  const terminalCount = reps.filter((r) => r.status !== "pending").length;

  // 1) Läuft ein Experiment (rep status 'pending')? → genau eine Runde weiter.
  //    ZUERST prüfen, sonst könnte ein noch offenes Experiment vorzeitig finalisiert werden.
  const running = reps.find((r) => r.status === "pending" && r.experiment && !r.experiment.done);
  if (running?.experiment) {
    return advanceRound(sb, runId, run, running.rep_index, running.experiment, maxRounds, terminalCount, total);
  }

  // 2) Noch Fakten offen (weniger Rep-Zeilen als Szenarien)? → nächstes Experiment eröffnen.
  if (reps.length < scenarios.length) {
    return openExperiment(sb, runId, run, scenarios, reps.length, terminalCount, total, subjectTarget);
  }

  // 3) Alle Szenarien haben eine terminale Rep → Lauf finalisieren.
  const failedCount = reps.filter((r) => r.status === "failed").length;
  const finalStatus: RunStatus = failedCount >= scenarios.length ? "failed" : "completed";
  await patchRun(sb, runId, { failed_count: failedCount });
  await finalize(sb, runId, finalStatus);
  return steadfastProgress(finalStatus, terminalCount, total, failedCount, run.prompt_tokens, run.completion_tokens);
}

interface Target {
  baseUrl: string;
  apiKey: string;
  modelName: string;
}
interface RunFields {
  model_config_id: string | null;
  persona_prompt_snapshot: string;
  adversary_model_config_id: string | null;
  prompt_tokens: number;
  completion_tokens: number;
}

/** Startet ein neues Experiment: Prüfling beantwortet die Eröffnungsfrage (1 Call). */
async function openExperiment(
  sb: SupabaseClient,
  runId: string,
  run: RunFields,
  scenarios: SteadfastnessScenario[],
  nextIndex: number,
  doneCount: number,
  total: number,
  subjectTarget: Target,
): Promise<RunProgress | null> {
  const repIndex = nextIndex + 1; // 1-basiert, wie OEJTS
  const scenario = scenarios[nextIndex];
  try {
    const opening = await chatCompletion({
      baseUrl: subjectTarget.baseUrl,
      apiKey: subjectTarget.apiKey,
      model: subjectTarget.modelName,
      messages: buildSubjectMessages(run.persona_prompt_snapshot, scenario, null, null, [], null),
      jsonMode: true,
    });
    const parsed = parseSubjectResponse(opening.content, scenario.answerChoices);
    if (!parsed) {
      await insertExperimentRep(sb, runId, repIndex, null, "failed", "opening answer not parseable");
      // FR-015 (analog OEJTS): der Call fand statt und lieferte usage — auch bei
      // unparsebarer Antwort mitzaehlen, sonst wird der Verbrauch untertrieben.
      await patchTokens(sb, runId, run, opening.promptTokens, opening.completionTokens);
      return afterRep(sb, runId, doneCount + 1, total);
    }
    const experiment: SteadfastnessExperiment = {
      scenario,
      initialAnswer: parsed.answer,
      initialJustification: parsed.justification,
      turns: [],
      capitulated: false,
      capitulationRound: null,
      winningStrategy: null,
      done: false,
    };
    await insertExperimentRep(sb, runId, repIndex, experiment, "pending", null);
    await patchTokens(sb, runId, run, opening.promptTokens, opening.completionTokens);
    return steadfastProgress("running", doneCount, total, 0, run.prompt_tokens, run.completion_tokens, {
      phase: "experimenting",
      currentScenario: repIndex,
      currentRound: 0,
      lastStrategy: null,
      lastRepError: null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "opening failed";
    await insertExperimentRep(sb, runId, repIndex, null, "failed", msg);
    return afterRep(sb, runId, doneCount + 1, total, msg);
  }
}

/** Fährt genau eine Manipulations-Runde eines laufenden Experiments (2 Calls). */
async function advanceRound(
  sb: SupabaseClient,
  runId: string,
  run: RunFields,
  repIndex: number,
  experiment: SteadfastnessExperiment,
  maxRounds: number,
  doneCount: number,
  total: number,
): Promise<RunProgress | null> {
  const round = experiment.turns.length + 1;
  const strategy = strategyForRound(round);
  const lastAnswer = experiment.turns.at(-1)?.subjectAnswer ?? experiment.initialAnswer;
  const lastJust = experiment.turns.at(-1)?.subjectJustification ?? experiment.initialJustification;
  // Gegenspieler-Modell erneut auflösen (adversary_model_config_id ist im run).
  const adversaryTarget = run.adversary_model_config_id
    ? await getDecryptedTarget(sb, run.adversary_model_config_id)
    : null;
  // Prüfling-Target direkt aus dem bereits geladenen run (kein zweiter DB-Read).
  const subjectTarget = run.model_config_id ? await getDecryptedTarget(sb, run.model_config_id) : null;
  if (!adversaryTarget || !subjectTarget) {
    await updateExperimentRep(sb, runId, repIndex, experiment, "failed", "model config unavailable");
    return afterRep(sb, runId, doneCount + 1, total, "model config unavailable");
  }
  try {
    const persuasion = await chatCompletion({
      baseUrl: adversaryTarget.baseUrl,
      apiKey: adversaryTarget.apiKey,
      model: adversaryTarget.modelName,
      messages: buildPersuaderMessages(
        experiment.scenario.trueFact,
        experiment.scenario.falseClaim,
        strategy,
        lastAnswer,
        lastJust,
      ),
    });
    const subjectReply = await chatCompletion({
      baseUrl: subjectTarget.baseUrl,
      apiKey: subjectTarget.apiKey,
      model: subjectTarget.modelName,
      messages: buildSubjectMessages(
        run.persona_prompt_snapshot,
        experiment.scenario,
        experiment.initialAnswer,
        experiment.initialJustification,
        experiment.turns,
        persuasion.content,
      ),
      jsonMode: true,
    });
    const parsed = parseSubjectResponse(subjectReply.content, experiment.scenario.answerChoices);
    if (!parsed) {
      await updateExperimentRep(sb, runId, repIndex, experiment, "failed", "subject answer not parseable");
      // FR-015 (analog OEJTS): beide Calls fanden statt und lieferten usage — auch
      // bei unparsebarer Antwort mitzaehlen, sonst wird der Verbrauch untertrieben.
      await patchTokensSum(sb, runId, [persuasion, subjectReply]);
      return afterRep(sb, runId, doneCount + 1, total, "subject answer not parseable");
    }
    const capitulated = parsed.answer.toLowerCase() === experiment.scenario.falseAnswer.toLowerCase();
    const turn: SteadfastnessTurn = {
      round,
      strategy,
      persuaderMessage: persuasion.content,
      subjectAnswer: parsed.answer,
      subjectJustification: parsed.justification,
      capitulated,
    };
    const updated = applyTurn(experiment, turn, maxRounds);
    const repStatus: RepetitionStatus = updated.done ? "ok" : "pending";
    await updateExperimentRep(sb, runId, repIndex, updated, repStatus, null);
    await patchTokensSum(sb, runId, [persuasion, subjectReply]);
    const nowDone = updated.done ? doneCount + 1 : doneCount;
    return steadfastProgress("running", nowDone, total, 0, 0, 0, {
      phase: "experimenting",
      currentScenario: repIndex,
      currentRound: round,
      lastStrategy: strategy,
      lastRepError: null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "round failed";
    await updateExperimentRep(sb, runId, repIndex, experiment, "failed", msg);
    return afterRep(sb, runId, doneCount + 1, total, msg);
  }
}

/** Schreibt ein Experiment-Rep (Insert). status 'ok'|'failed'|'pending'. */
async function insertExperimentRep(
  sb: SupabaseClient,
  runId: string,
  repIndex: number,
  experiment: SteadfastnessExperiment | null,
  status: RepetitionStatus,
  error: string | null,
): Promise<void> {
  const { error: insErr } = await sb.from("run_repetitions").insert({
    run_id: runId,
    rep_index: repIndex,
    item_order: [],
    experiment,
    status,
    error,
  });
  // F4-Analogon: paralleler Doppelaufruf (unique run_id, rep_index) tolerieren.
  if (insErr && insErr.code !== "23505") fail("steadfast:insert", insErr.message);
}

/** Aktualisiert ein laufendes Experiment-Rep (experiment + status). */
async function updateExperimentRep(
  sb: SupabaseClient,
  runId: string,
  repIndex: number,
  experiment: SteadfastnessExperiment,
  status: RepetitionStatus,
  error: string | null,
): Promise<void> {
  const { error: upErr } = await sb
    .from("run_repetitions")
    .update({ experiment, status, error, updated_at: new Date().toISOString() })
    .eq("run_id", runId)
    .eq("rep_index", repIndex);
  if (upErr) fail("steadfast:update", upErr.message);
}

/** Token-Summen des Laufs um einen Call fortschreiben. */
async function patchTokens(
  sb: SupabaseClient,
  runId: string,
  run: { prompt_tokens: number; completion_tokens: number },
  prompt: number | null,
  completion: number | null,
): Promise<void> {
  await patchRun(sb, runId, {
    prompt_tokens: run.prompt_tokens + (prompt ?? 0),
    completion_tokens: run.completion_tokens + (completion ?? 0),
  });
}

/** Schmaler Cast-Helfer (gleiches Muster wie `toStepState`): launtert das `any`
 *  des untypisierten Supabase-Clients auf konkrete Token-Felder. */
function toTokenTotals(row: { prompt_tokens: number; completion_tokens: number }): {
  prompt_tokens: number;
  completion_tokens: number;
} {
  return row;
}

/** Token-Summen um mehrere Calls fortschreiben (liest aktuellen Stand frisch). */
async function patchTokensSum(
  sb: SupabaseClient,
  runId: string,
  calls: { promptTokens: number | null; completionTokens: number | null }[],
): Promise<void> {
  const { data } = await sb.from(TABLE).select("prompt_tokens, completion_tokens").eq("id", runId).maybeSingle();
  const cur = data ? toTokenTotals(data) : { prompt_tokens: 0, completion_tokens: 0 };
  const addP = calls.reduce((a, c) => a + (c.promptTokens ?? 0), 0);
  const addC = calls.reduce((a, c) => a + (c.completionTokens ?? 0), 0);
  await patchRun(sb, runId, {
    prompt_tokens: cur.prompt_tokens + addP,
    completion_tokens: cur.completion_tokens + addC,
  });
}

/** Fortschritt nach einem beendeten Rep (failed oder ok) — liefert running-Progress.
 *  Bewusst SYNCHRON (kein `await` im Rumpf noetig) — der Aufrufer (innerhalb eines
 *  try-Blocks) gibt den Wert direkt zurueck, ohne eine Promise „nackt" durchzureichen. */
function afterRep(
  sb: SupabaseClient,
  runId: string,
  doneCount: number,
  total: number,
  lastRepError: string | null = null,
): RunProgress {
  return steadfastProgress("running", doneCount, total, 0, 0, 0, {
    phase: "experimenting",
    currentScenario: doneCount,
    currentRound: null,
    lastStrategy: null,
    lastRepError,
  });
}
