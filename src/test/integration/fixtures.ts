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
import type { ModelConfigView, PersonaView, RunView, Visibility } from "@/types";
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

/** Legt eine Modellkonfig mit gegebenem (Sentinel-)Key an. */
export async function makeModelConfig(account: TestAccount, apiKey = "sk-rls-fixture"): Promise<ModelConfigView> {
  return createModelConfig(account.client, {
    label: "RLS-Fixture-Model",
    baseUrl: "https://api.example.com/v1",
    modelName: "test-model",
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
  personaId: string,
  modelConfigId: string,
  visibility: Visibility,
): Promise<RunView> {
  const run = await createRun(account.client, account.userId, {
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

/** Prüft per zweitem Client, ob eine Zeile (noch) existiert — DB-Gegenprobe nach geblockten Mutationen. */
export async function rowExists(account: TestAccount, table: string, id: string): Promise<boolean> {
  const { data, error } = await account.client.from(table).select("id").eq("id", id).maybeSingle();
  if (error) throw new Error(`rowExists(${table}): ${error.message}`);
  return data !== null;
}
