/**
 * Daten-Seeding fuer die E2E-Schicht (Model Compare 5.2).
 *
 * Ein echter Baseline-Lauf wuerde N LLM-Calls ausloesen — nicht-deterministisch,
 * teuer, im Browser nicht abwartbar. Deshalb schreibt der Test die Baseline-Daten
 * direkt in die lokale DB (Muster `src/test/integration/fixtures.ts`: Repetitions
 * per Client-Insert statt ueber `processNextRepetition`). Alles danach —
 * Aggregation, RLS-Scoping, Routing, Rendering — bleibt echt; genau dort sitzt
 * das Risiko, das der Test schuetzt.
 *
 * Bewusst NICHT ueber die Service-Schicht: `createModelConfig` verschluesselt den
 * Key ueber `astro:env/server`, das im Playwright-Node-Prozess nicht existiert.
 * Der Key wird hier nie benutzt (kein Lauf-Pfad) → Platzhalter-Ciphertext.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { OEJTS } from "@/lib/instruments/oejts";
import type { Instrument } from "@/types";

/** Was ein Seed angelegt hat — Eingabe fuer den Cleanup. */
export interface SeededModel {
  modelName: string;
  configId: string;
  runIds: string[];
}

/**
 * Zieht die `id` aus einem `insert().select("id").single()`-Ergebnis.
 *
 * Bewusst ueber `unknown`: der untypisierte supabase-js-Client (kein generiertes
 * `Database`-Generic) behauptet typseitig „error ist nie gesetzt, data nie null" —
 * echte Fehler kaemen dann stumm als `undefined` durch, und die Runtime-Pruefungen
 * flaggt `no-unnecessary-condition`. Hier wird das Ergebnis einmal ehrlich
 * geweitet und geprueft.
 */
function unwrapId(result: { data: unknown; error: unknown }, what: string): string {
  if (result.error) {
    const message = (result.error as { message?: string }).message ?? JSON.stringify(result.error);
    throw new Error(`Seed: ${what}-Insert schlug fehl: ${message}`);
  }
  const id = (result.data as { id?: string } | null)?.id;
  if (!id) throw new Error(`Seed: ${what}-Insert lieferte keine id.`);
  return id;
}

/** Volle Item-Werte des Instruments (alle Items) — eine „verwertbare" Repetition. */
function fullItemValues(instrument: Instrument, value: number) {
  return instrument.items.map((item) => ({ id: item.id, value, status: "ok" as const }));
}

/**
 * Legt eine Modellkonfig + `runs` abgeschlossene Baseline-Laeufe mit je
 * `repsPerRun` verwertbaren Repetitions an.
 *
 * Baseline heisst: `persona_id null` UND leerer Prompt-Snapshot (die Abgrenzung
 * zu „Persona nachtraeglich geloescht", Lektion L1) — genau die Zeilen, die der
 * model-profiles-Service poolt. `answerValue` steuert die Antworten und damit den
 * abgeleiteten Typ; zwei Modelle mit verschiedenen Werten sind im Vergleich
 * unterscheidbar. `instrument`/`kind` steuern das Test-Instrument — Default OEJTS
 * (rueckwaertskompatibel); fuer HEXACO `instrument: HEXACO, kind: "hexaco"`.
 */
export async function seedBaselineModel(
  sb: SupabaseClient,
  modelName: string,
  {
    runs = 1,
    repsPerRun = 5,
    answerValue = 2,
    instrument = OEJTS,
    kind = "oejts",
  }: {
    runs?: number;
    repsPerRun?: number;
    answerValue?: number;
    instrument?: Instrument;
    kind?: string;
  } = {},
): Promise<SeededModel> {
  const configId = unwrapId(
    await sb
      .from("model_configs")
      .insert({
        label: `E2E ${modelName}`,
        base_url: "https://api.example.com/v1",
        model_name: modelName,
        key_ciphertext: "e2e-placeholder-ciphertext",
        key_iv: "e2e-placeholder-iv",
        key_version: 1,
      })
      .select("id")
      .single(),
    "model_configs",
  );

  const runIds: string[] = [];
  for (let r = 0; r < runs; r++) {
    const runId = unwrapId(
      await sb
        .from("runs")
        .insert({
          visibility: "private",
          persona_id: null,
          model_config_id: configId,
          persona_prompt_snapshot: "", // leer = Baseline (nicht „Persona geloescht")
          instrument_id: instrument.id,
          kind,
          repetition_count: repsPerRun,
          status: "completed",
        })
        .select("id")
        .single(),
      "runs",
    );

    const repetitions = Array.from({ length: repsPerRun }, (_, i) => ({
      run_id: runId,
      rep_index: i + 1,
      item_order: instrument.items.map((_, idx) => idx),
      raw_response: "{}",
      item_values: fullItemValues(instrument, answerValue),
      status: "ok",
    }));
    const { error: repError } = await sb.from("run_repetitions").insert(repetitions);
    if (repError) throw new Error(`Seed: run_repetitions-Insert schlug fehl: ${repError.message}`);

    runIds.push(runId);
  }

  return { modelName, configId, runIds };
}

/**
 * Raeumt die geseedeten Zeilen wieder ab (Laeufe zuerst — `run_repetitions`
 * haengt per Cascade daran). Laeuft im `finally` des Tests, damit ein roter Test
 * keine Karteileichen hinterlaesst, die den naechsten Lauf verfaelschen.
 */
export async function cleanupSeeded(sb: SupabaseClient, models: SeededModel[]): Promise<void> {
  for (const model of models) {
    if (model.runIds.length > 0) await sb.from("runs").delete().in("id", model.runIds);
    await sb.from("model_configs").delete().eq("id", model.configId);
  }
}
