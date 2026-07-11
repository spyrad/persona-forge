/**
 * Domänen-Fixtures für Integration-Tests. Bauen echte Zeilen über die
 * Service-Schicht (bzw. direkten Client-Insert, wo nötig) mit einem
 * authentifizierten Account.
 *
 * Repetitions werden bewusst DIREKT per Client eingefügt statt über
 * `processNextRepetition` — letzteres würde einen echten LLM-Call auslösen. Die
 * insert-Policy `run_repetitions_insert_via_run` erlaubt dem Run-Owner genau das.
 */
import { OEJTS } from "@/lib/instruments/oejts";
import { createModelConfig } from "@/lib/services/model-configs";
import { createPersona, updatePersonaVisibility } from "@/lib/services/personas";
import { createRun, updateRunVisibility } from "@/lib/services/runs";
import type { ItemValue, ModelConfigView, PersonaView, RunView, Visibility } from "@/types";
import type { TestAccount } from "./accounts";

/** Legt eine Persona an und schaltet sie bei Bedarf auf privat (Default-Insert ist global). */
export async function makePersona(account: TestAccount, visibility: Visibility): Promise<PersonaView> {
  const persona = await createPersona(account.client, account.userId, {
    sourceKind: "freeform",
    name: `RLS-Fixture ${visibility}`,
    description: "Integration-Test-Persona",
    tags: ["itest"],
    systemPrompt: "Du bist eine Test-Persona.",
  });
  if (visibility === "private") {
    const updated = await updatePersonaVisibility(account.client, account.userId, persona.id, "private");
    if (!updated) throw new Error("makePersona: Toggle auf privat schlug fehl");
    return updated;
  }
  return persona;
}

/** Legt eine Modellkonfig mit gegebenem (Sentinel-)Key an; Metadaten per Overrides variierbar. */
export async function makeModelConfig(
  account: TestAccount,
  apiKey = "sk-rls-fixture",
  overrides: Partial<{ label: string; baseUrl: string; modelName: string }> = {},
): Promise<ModelConfigView> {
  return createModelConfig(account.client, {
    label: overrides.label ?? "RLS-Fixture-Model",
    baseUrl: overrides.baseUrl ?? "https://api.example.com/v1",
    modelName: overrides.modelName ?? "test-model",
    apiKey,
  });
}

/**
 * Legt einen Lauf an (mit eigener Persona + Modellkonfig des Accounts), schaltet
 * ihn bei Bedarf auf privat, fügt eine Repetition direkt ein und setzt den Lauf
 * auf `completed` — so liest `getRunResult` den `run_repetitions`-Child-Pfad.
 */
export async function makeCompletedRun(
  account: TestAccount,
  personaId: string | null, // null = Baseline-Lauf (ohne Persona)
  modelConfigId: string,
  visibility: Visibility,
): Promise<RunView> {
  const run = await createRun(account.client, account.userId, {
    kind: "oejts",
    personaId,
    modelConfigId,
    instrumentId: OEJTS.id,
    repetitionCount: 1,
  });
  if (!run) throw new Error("makeCompletedRun: createRun lieferte null (Persona/Modellkonfig nicht sichtbar?)");

  if (visibility === "private") {
    const updated = await updateRunVisibility(account.client, account.userId, run.id, "private");
    if (!updated) throw new Error("makeCompletedRun: Toggle auf privat schlug fehl");
  }

  const { error: repError } = await account.client.from("run_repetitions").insert({
    run_id: run.id,
    rep_index: 1,
    item_order: [0],
    raw_response: "{}",
    item_values: [],
    status: "ok",
  });
  if (repError) throw new Error(`makeCompletedRun: Repetition-Insert schlug fehl: ${repError.message}`);

  const { error: statusError } = await account.client.from("runs").update({ status: "completed" }).eq("id", run.id);
  if (statusError) throw new Error(`makeCompletedRun: Status-Update schlug fehl: ${statusError.message}`);

  return run;
}

/** Volle OEJTS-Item-Werte (alle 32 Items) mit gegebenem Skalenwert — eine „verwertbare" Repetition. */
function fullItemValues(value = 3): ItemValue[] {
  return OEJTS.items.map((it) => ({ id: it.id, value, status: "ok" }));
}

/**
 * Fügt eine Repetition DIREKT per Client ein (umgeht `processNextRepetition` →
 * kein LLM-Call). `ok`-Reps tragen volle Item-Werte (zählen als `usableReps`),
 * `failed`-Reps tragen `item_values: null` + Fehlertext.
 */
async function insertRepetition(
  account: TestAccount,
  runId: string,
  repIndex: number,
  status: "ok" | "failed",
): Promise<void> {
  const { error } = await account.client.from("run_repetitions").insert({
    run_id: runId,
    rep_index: repIndex,
    item_order: OEJTS.items.map((_, i) => i),
    raw_response: status === "ok" ? "{}" : null,
    item_values: status === "ok" ? fullItemValues() : null,
    status,
    error: status === "failed" ? "itest: simulierter Fehlschlag" : null,
  });
  if (error) throw new Error(`insertRepetition(${repIndex}): ${error.message}`);
}

/** Legt einen Lauf an und lässt ihn `pending` (0 Repetitions) — Ausgangslage für Abort/Result-Tests. */
export async function makePendingRun(
  account: TestAccount,
  personaId: string | null, // null = Baseline-Lauf (ohne Persona)
  modelConfigId: string,
  repetitionCount = 3,
): Promise<RunView> {
  const run = await createRun(account.client, account.userId, {
    kind: "oejts",
    personaId,
    modelConfigId,
    instrumentId: OEJTS.id,
    repetitionCount,
  });
  if (!run) throw new Error("makePendingRun: createRun lieferte null (Persona/Modellkonfig nicht sichtbar?)");
  return run;
}

/**
 * Legt einen `running` Lauf an und schreibt `writtenReps` `ok`-Repetitions direkt
 * ein (rep_index 1..writtenReps, gap-frei). Mit `writtenReps=0` bleibt der Lauf
 * `running` ohne Repetition — die Ausgangslage für den 23505-Nebenläufigkeitstest.
 */
export async function makeRunningRun(
  account: TestAccount,
  personaId: string,
  modelConfigId: string,
  writtenReps = 1,
  totalReps = 3,
): Promise<RunView> {
  const run = await makePendingRun(account, personaId, modelConfigId, totalReps);
  for (let i = 1; i <= writtenReps; i++) await insertRepetition(account, run.id, i, "ok");
  const { error } = await account.client.from("runs").update({ status: "running" }).eq("id", run.id);
  if (error) throw new Error(`makeRunningRun: Status-Update schlug fehl: ${error.message}`);
  return run;
}

/**
 * Legt einen terminalen Lauf mit `okReps` erfolgreichen + `failedReps`
 * fehlgeschlagenen Repetitions an. Status & `failed_count` folgen der
 * Service-Logik: `completed` sobald ≥1 ok, sonst `failed`.
 */
export async function makeFailedRun(
  account: TestAccount,
  personaId: string | null, // null = Baseline-Lauf (ohne Persona)
  modelConfigId: string,
  okReps: number,
  failedReps: number,
): Promise<RunView> {
  const run = await makePendingRun(account, personaId, modelConfigId, okReps + failedReps);
  let idx = 1;
  for (let i = 0; i < okReps; i++) await insertRepetition(account, run.id, idx++, "ok");
  for (let i = 0; i < failedReps; i++) await insertRepetition(account, run.id, idx++, "failed");
  const { error } = await account.client
    .from("runs")
    .update({ status: okReps > 0 ? "completed" : "failed", failed_count: failedReps })
    .eq("id", run.id);
  if (error) throw new Error(`makeFailedRun: Status-Update schlug fehl: ${error.message}`);
  return run;
}

/** Prüft per zweitem Client, ob eine Zeile (noch) existiert — DB-Gegenprobe nach geblockten Mutationen. */
export async function rowExists(account: TestAccount, table: string, id: string): Promise<boolean> {
  const { data, error } = await account.client.from(table).select("id").eq("id", id).maybeSingle();
  if (error) throw new Error(`rowExists(${table}): ${error.message}`);
  return data !== null;
}
