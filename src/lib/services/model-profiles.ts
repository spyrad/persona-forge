/**
 * Modell-Profile (Model Compare, Phase 2): aggregiert die abgeschlossenen
 * BASELINE-Laeufe (`isBaselineRun`) je kanonischem `modelName` zu einem Profil —
 * gepoolte verwertbare Wiederholungen je Instrument, plus Meta-Infos.
 *
 * Kapselung (Spec-Risiko Performance): Aufrufer sehen nur `listModelProfiles`/
 * `getModelProfiles`; die Aggregation selbst ist der reine, unit-testbare Kern
 * `buildModelProfiles` (kein DB-Zugriff). Ein spaeterer Umstieg auf DB-seitige
 * Aggregation aendert nur die Wrapper.
 *
 * Scoping-Regeln (Discovery/Spec):
 *   - Gruppierung ueber die EIGENEN `model_configs` (RLS: strikt owner-only);
 *     die runs-Query filtert serverseitig auf deren ids — fremde globale Laeufe
 *     und Laeufe mit geloeschter Config (FK null) sind damit per Konstruktion
 *     ausgeschlossen ("kein aufloesbarer modelName").
 *   - Nur `status completed`; Baseline via `isBaselineRun` (einzige Quelle).
 *   - Nicht-Baseline-Laeufe (inkl. "Persona geloescht") werden je Modell als
 *     `excludedPersonaRuns` gezaehlt, fliessen aber nie ein.
 *   - Reps werden BATCH-geladen (eine in-Klausel ueber alle Run-Ids) — keine
 *     Per-Lauf-Ladeschleife (N+1).
 */
import { OEJTS } from "@/lib/instruments/oejts";
import { isBaselineRun } from "@/lib/runs/baseline";
import { aggregateRun } from "@/lib/runs/oejts-aggregate";
import { aggregateSteadfastness } from "@/lib/runs/steadfastness-aggregate";
import type { createClient } from "@/lib/supabase";
import type {
  ItemValue,
  ModelProfileListItem,
  ModelProfileSection,
  ModelProfileView,
  Run,
  SteadfastnessExperiment,
} from "@/types";

type SupabaseClient = NonNullable<ReturnType<typeof createClient>>;

/** Wirft einen echten Error (only-throw-error); Rohtext mappt die Route auf eine sichere Meldung. */
function fail(action: string, message: string): never {
  throw new Error(`model-profiles ${action} failed: ${message}`);
}

// ─── Zeilenformen der drei Queries (nur benoetigte Spalten) ───────────────────

/** Eigene Modellkonfig — Aufloesung `id → modelName` + Meta (Label, Provider-Host). */
export interface ProfileConfigRow {
  id: string;
  label: string;
  base_url: string;
  model_name: string;
}

/** Abgeschlossener Lauf auf einer eigenen Konfig (serverseitig vorgefiltert). */
export type ProfileRunRow = Pick<
  Run,
  "id" | "persona_id" | "model_config_id" | "persona_prompt_snapshot" | "kind" | "created_at" | "finished_at"
>;

/** Repetition eines Baseline-Laufs — traegt je nach `kind` item_values ODER experiment. */
export interface ProfileRepRow {
  run_id: string;
  item_values: ItemValue[] | null;
  experiment: SteadfastnessExperiment | null;
}

// ─── Reiner Kern (unit-testbar, kein I/O) ────────────────────────────────────

/** Hostname einer base_url (Provider-Streuung); unparsebare URLs fallen auf den Rohwert zurueck. */
function providerHost(baseUrl: string): string {
  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl;
  }
}

/**
 * Verdichtet Configs + abgeschlossene Laeufe + Baseline-Reps zu Profilen je
 * `modelName` (sortiert alphabetisch; Sektionen in fester Instrument-Reihenfolge).
 * `runs` MUESSEN bereits auf eigene Configs + `status completed` gefiltert sein
 * (leisten die Wrapper serverseitig); `reps` nur zu Baseline-Laeufen.
 */
export function buildModelProfiles(
  configs: ProfileConfigRow[],
  runs: ProfileRunRow[],
  reps: ProfileRepRow[],
): ModelProfileView[] {
  const configById = new Map(configs.map((c) => [c.id, c]));
  const repsByRun = new Map<string, ProfileRepRow[]>();
  for (const rep of reps) {
    const list = repsByRun.get(rep.run_id) ?? [];
    list.push(rep);
    repsByRun.set(rep.run_id, list);
  }

  // Laeufe je modelName einsortieren (unaufloesbare sind serverseitig schon draussen).
  const byModel = new Map<string, { baseline: ProfileRunRow[]; excluded: number }>();
  for (const run of runs) {
    const config = run.model_config_id ? configById.get(run.model_config_id) : undefined;
    if (!config) continue; // defensiv — Wrapper filtern bereits
    const bucket = byModel.get(config.model_name) ?? { baseline: [], excluded: 0 };
    if (isBaselineRun(run.persona_id, run.persona_prompt_snapshot)) bucket.baseline.push(run);
    else bucket.excluded += 1;
    byModel.set(config.model_name, bucket);
  }

  const profiles: ModelProfileView[] = [];
  for (const [modelName, { baseline, excluded }] of byModel) {
    // Modelle ohne Baseline-Laeufe erscheinen nicht (Spec: nicht waehlbar).
    if (baseline.length === 0) continue;

    // Meta: beteiligte Configs + Zeitraum der eingeflossenen Laeufe.
    const usedConfigs = new Map<string, ProfileConfigRow>();
    for (const run of baseline) {
      const c = run.model_config_id ? configById.get(run.model_config_id) : undefined;
      if (c) usedConfigs.set(c.id, c);
    }
    const timestamps = baseline.map((r) => r.created_at).sort();
    const finished = baseline.map((r) => r.finished_at ?? r.created_at).sort();

    // Sektionen: gepoolte Reps je Instrument (Pooling = je Rep gleiches Gewicht).
    const sections: ModelProfileSection[] = [];
    const oejtsRuns = baseline.filter((r) => r.kind === "oejts");
    if (oejtsRuns.length > 0) {
      const pooled = oejtsRuns.flatMap((r) => repsByRun.get(r.id) ?? []);
      const aggregate = aggregateRun(pooled, OEJTS);
      sections.push({ kind: "oejts", runCount: oejtsRuns.length, usableReps: aggregate.usableReps, aggregate });
    }
    const steadfastRuns = baseline.filter((r) => r.kind === "steadfastness");
    if (steadfastRuns.length > 0) {
      const experiments = steadfastRuns
        .flatMap((r) => repsByRun.get(r.id) ?? [])
        .map((rep) => rep.experiment)
        .filter((e): e is SteadfastnessExperiment => e?.done ?? false);
      const aggregate = aggregateSteadfastness(experiments);
      sections.push({
        kind: "steadfastness",
        runCount: steadfastRuns.length,
        usableReps: aggregate.usableCount,
        aggregate,
      });
    }

    profiles.push({
      meta: {
        modelName,
        configLabels: [...usedConfigs.values()].map((c) => c.label).sort(),
        providerHosts: [...new Set([...usedConfigs.values()].map((c) => providerHost(c.base_url)))].sort(),
        runCount: baseline.length,
        excludedPersonaRuns: excluded,
        firstRunAt: timestamps[0] ?? null,
        lastRunAt: finished[finished.length - 1] ?? null,
      },
      sections,
    });
  }

  return profiles.sort((a, b) => a.meta.modelName.localeCompare(b.meta.modelName));
}

// ─── Query-Wrapper (duenn; RLS-gescoped ueber den hereingereichten Client) ────

/** Laedt Configs, abgeschlossene Laeufe darauf und die Reps der Baseline-Laeufe (eine Batch-Query). */
async function loadProfiles(sb: SupabaseClient, modelNames?: string[]): Promise<ModelProfileView[]> {
  const { data: configData, error: cErr } = await sb.from("model_configs").select("id, label, base_url, model_name");
  if (cErr) fail("configs", cErr.message);
  let configs = configData as ProfileConfigRow[];
  if (modelNames) configs = configs.filter((c) => modelNames.includes(c.model_name));
  if (configs.length === 0) return [];

  const { data: runData, error: rErr } = await sb
    .from("runs")
    .select("id, persona_id, model_config_id, persona_prompt_snapshot, kind, created_at, finished_at")
    .eq("status", "completed")
    .in(
      "model_config_id",
      configs.map((c) => c.id),
    );
  if (rErr) fail("runs", rErr.message);
  const runs = runData as ProfileRunRow[];

  const baselineIds = runs.filter((r) => isBaselineRun(r.persona_id, r.persona_prompt_snapshot)).map((r) => r.id);
  let reps: ProfileRepRow[] = [];
  if (baselineIds.length > 0) {
    // EINE Batch-Query ueber alle Baseline-Laeufe — bewusst keine Per-Lauf-Schleife.
    const { data: repData, error: pErr } = await sb
      .from("run_repetitions")
      .select("run_id, item_values, experiment")
      .in("run_id", baselineIds);
    if (pErr) fail("reps", pErr.message);
    reps = repData;
  }

  return buildModelProfiles(configs, runs, reps);
}

/** Modelle mit mind. 1 abgeschlossenen Baseline-Lauf — fuer Auswahl-Flaechen. */
export async function listModelProfiles(sb: SupabaseClient): Promise<ModelProfileListItem[]> {
  const profiles = await loadProfiles(sb);
  return profiles.map((p) => ({
    modelName: p.meta.modelName,
    runCount: p.meta.runCount,
    usableReps: p.sections.reduce((sum, s) => sum + s.usableReps, 0),
    instruments: p.sections.map((s) => s.kind),
  }));
}

/** Volle Profile fuer die angefragten Modellnamen (exakter Match; unbekannte Namen fehlen im Ergebnis). */
export async function getModelProfiles(sb: SupabaseClient, modelNames: string[]): Promise<ModelProfileView[]> {
  if (modelNames.length === 0) return [];
  return loadProfiles(sb, modelNames);
}

/**
 * Alle Profile des Nutzers (jedes Modell mit mind. 1 Baseline-Lauf) — fuer das
 * Dashboard, das Typ/Stabilitaet/lastRunAt braucht (die Listen-Sicht traegt sie
 * nicht). Bewusst akzeptiert: laedt die Configs intern erneut, auch wenn der
 * Aufrufer sie separat haelt (Plan-Entscheidung Dashboard Mission Control).
 */
export async function getAllModelProfiles(sb: SupabaseClient): Promise<ModelProfileView[]> {
  return loadProfiles(sb);
}
