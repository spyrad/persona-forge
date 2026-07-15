/**
 * Dashboard-Summary (Mission Control, Phase 1): buendelt die Kennzahlen der
 * Einstiegsseite aus wenigen gebatchten Abfragen — je Quelle einzeln ausfallbar.
 *
 * Kapselung (Muster `buildModelProfiles`): der reine Kern `buildDashboardSummary`
 * bekommt die Quellen injiziert (unit-testbar ohne Modul-Mocks, Plan-Entscheidung
 * „reiner Kern + DI"); `getDashboardSummary` verdrahtet die echten Services.
 *
 * Teilausfall (Spec-Randfall „Fehlerfaelle"): die Quellen laufen parallel via
 * Promise.allSettled — faellt eine aus, traegt ihre Sektion `error: true` und der
 * Rest rendert. Der Fehler-Hook loggt per `console.error`, was im deployten
 * Worker via captureConsoleIntegration als Sentry-Issue sichtbar wird (gleicher
 * Weg wie `serviceErrorResponse`; bewusst kein Sentry-Import im Service).
 *
 * Runs-/Personas-Kennzahlen als Count-Query (`head: true`) + limit-1 statt
 * Volllast (Plan-Entscheidung): konstant billig, waechst nicht mit fremden
 * globalen Laeufen; der Scope bleibt „sichtbare Zeilen" wie auf den Zielseiten.
 */
import { getAllModelProfiles } from "@/lib/services/model-profiles";
import type { createClient } from "@/lib/supabase";
import type {
  DashboardModelEntry,
  DashboardRunStats,
  DashboardSource,
  DashboardSummary,
  ModelConfigView,
  ModelProfileSection,
  ModelProfileView,
  Run,
} from "@/types";

type SupabaseClient = NonNullable<ReturnType<typeof createClient>>;

/** Wirft einen echten Error (only-throw-error); der Teilausfall-Kern faengt ihn je Quelle. */
function fail(action: string, message: string): never {
  throw new Error(`dashboard ${action} failed: ${message}`);
}

// ─── Reiner Kern (unit-testbar, kein I/O) ────────────────────────────────────

/** Quellen des reinen Kerns — Tests reichen Fakes herein, der Wrapper die echten Services. */
export interface DashboardSources {
  loadProfiles: () => Promise<ModelProfileView[]>;
  loadConfigs: () => Promise<ModelConfigView[]>;
  loadPersonaCount: () => Promise<number>;
  loadRunStats: () => Promise<DashboardRunStats>;
  /** Fehler-Hook je Quelle; Default loggt via console.error (→ Sentry im Worker). */
  onSourceError?: (source: keyof DashboardSummary, err: unknown) => void;
}

/**
 * Profile + Configs → Modell-Eintraege: profilierte zuerst (juengste Aktivitaet
 * vorn — das Hero kappt spaeter auf die zuletzt aktiven), danach unprofilierte
 * (konfigurierte `modelName`s ohne Profil, dedupliziert) alphabetisch.
 */
export function buildModelEntries(profiles: ModelProfileView[], configs: ModelConfigView[]): DashboardModelEntry[] {
  const profiled = profiles
    .map((p) => {
      const oejts = p.sections.find((s): s is Extract<ModelProfileSection, { kind: "oejts" }> => s.kind === "oejts");
      return {
        modelName: p.meta.modelName,
        profiled: true,
        modalType: oejts?.aggregate.modalType ?? null,
        typeConsistency: oejts?.aggregate.typeConsistency ?? null,
        usableReps: p.sections.reduce((sum, s) => sum + s.usableReps, 0),
        runCount: p.meta.runCount,
        lastRunAt: p.meta.lastRunAt,
      };
    })
    .sort((a, b) => (b.lastRunAt ?? "").localeCompare(a.lastRunAt ?? ""));

  const profiledNames = new Set(profiles.map((p) => p.meta.modelName));
  const unprofiled = [...new Set(configs.map((c) => c.modelName))]
    .filter((name) => !profiledNames.has(name))
    .sort((a, b) => a.localeCompare(b))
    .map((modelName) => ({
      modelName,
      profiled: false,
      modalType: null,
      typeConsistency: null,
      usableReps: 0,
      runCount: 0,
      lastRunAt: null,
    }));

  return [...profiled, ...unprofiled];
}

/** Buendelt die Quellen zum Summary — jede Quelle faellt einzeln aus (allSettled). */
export async function buildDashboardSummary(sources: DashboardSources): Promise<DashboardSummary> {
  const onSourceError =
    sources.onSourceError ??
    ((source: keyof DashboardSummary, err: unknown) => {
      // eslint-disable-next-line no-console -- bewusstes serverseitiges Audit-Log (→ Sentry via captureConsole)
      console.error(`[dashboard:${source}]`, err);
    });

  const toSource = <T>(result: PromiseSettledResult<T>, name: keyof DashboardSummary): DashboardSource<T> => {
    if (result.status === "fulfilled") return { error: false, data: result.value };
    onSourceError(name, result.reason);
    return { error: true, data: null };
  };

  const [models, personas, runs] = await Promise.allSettled([
    // Profile + Configs gehoeren fachlich zusammen (eine Modell-Sektion) — faellt
    // eine der beiden Queries aus, ist die ganze Sektion ERR.
    Promise.all([sources.loadProfiles(), sources.loadConfigs()]).then(([profiles, configs]) =>
      buildModelEntries(profiles, configs),
    ),
    sources.loadPersonaCount().then((count) => ({ count })),
    sources.loadRunStats(),
  ]);

  return {
    models: toSource(models, "models"),
    personas: toSource(personas, "personas"),
    runs: toSource(runs, "runs"),
  };
}

// ─── Query-Wrapper (duenn; RLS-gescoped ueber den hereingereichten Client) ────

/** Sichtbare Personas zaehlen — Count-Query statt Volllast (kein Zeilen-Transfer). */
async function countPersonas(sb: SupabaseClient): Promise<number> {
  const { count, error } = await sb.from("personas").select("id", { count: "exact", head: true });
  if (error) fail("personas count", error.message);
  return count ?? 0;
}

/** Sichtbare Laeufe zaehlen + juengsten Lauf holen — Count-Query + limit 1. */
async function loadRunStats(sb: SupabaseClient): Promise<DashboardRunStats> {
  const { count, error } = await sb.from("runs").select("id", { count: "exact", head: true });
  if (error) fail("runs count", error.message);
  const { data, error: latestErr } = await sb
    .from("runs")
    .select("created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<Pick<Run, "created_at">>();
  if (latestErr) fail("runs latest", latestErr.message);
  return { count: count ?? 0, lastRunAt: data?.created_at ?? null };
}

/** Laedt den SSR-Snapshot des Dashboards (RLS-gescoped ueber den hereingereichten Client). */
export async function getDashboardSummary(sb: SupabaseClient): Promise<DashboardSummary> {
  // Dynamisch statt statisch: model-configs zieht transitiv `astro:env/server`
  // (encryption-key), das es im Vitest-Node-Env nicht gibt — ein statischer Import
  // braeche die Unit-Tests des reinen Kerns. Zur SSR-Laufzeit identisch.
  const { listModelConfigs } = await import("@/lib/services/model-configs");
  return buildDashboardSummary({
    loadProfiles: () => getAllModelProfiles(sb),
    loadConfigs: () => listModelConfigs(sb),
    loadPersonaCount: () => countPersonas(sb),
    loadRunStats: () => loadRunStats(sb),
  });
}
