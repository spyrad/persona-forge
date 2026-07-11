import { useRef, useState } from "react";
import {
  AlertCircle,
  Ban,
  BarChart3,
  CheckCircle2,
  CircleDashed,
  GitCompare,
  Globe,
  Hash,
  Loader2,
  Lock,
  Play,
  Trash2,
  XCircle,
} from "lucide-react";
import { ServerError } from "@/components/auth/ServerError";
import { Button } from "@/components/ui/button";
import { runProgressSchema, runViewArraySchema, runViewSchema } from "@/lib/runs/run-schemas";
import { formatDateTime, formatDuration } from "@/lib/runs/run-timing";
import { cn } from "@/lib/utils";
import type { ModelConfigView, PersonaView, RunProgress, RunStatus, RunView } from "@/types";

interface Props {
  initialRuns: RunView[];
  personas: PersonaView[];
  modelConfigs: ModelConfigView[];
  /** Server-seitiger Initial-Load fehlgeschlagen → Banner statt stumm leerer Liste. */
  loadError?: boolean;
}

const MIN_REPS = 1;
const MAX_REPS = 25;
const DEFAULT_REPS = 5;
const MIN_ROUNDS = 1;
const MAX_ROUNDS = 50;
const DEFAULT_ROUNDS = 12;
type RunKind = "oejts" | "steadfastness";

/**
 * Navigations-Side-Effect bei 401. Bewusst auf Modul-Ebene (nicht in der
 * Komponente): das Setzen von `window.location.href` ist eine Mutation eines
 * globalen Werts, die der React-Compiler innerhalb von Komponenten/Hooks
 * verbietet (`react-hooks/immutability`). Als freie Modul-Funktion bleibt sie
 * ein gewoehnlicher Funktionsaufruf (Muster aus PersonaCatalog).
 */
function redirectToSignin() {
  window.location.href = "/auth/signin";
}

/**
 * Navigiert zur Vergleichsseite (S-08). Wie `redirectToSignin` bewusst auf
 * Modul-Ebene: das Setzen von `window.location.href` ist eine Mutation eines
 * globalen Werts, die der React-Compiler innerhalb von Komponenten/Hooks
 * verbietet (`react-hooks/immutability`).
 */
function navigateToCompare(a: string, b: string) {
  window.location.href = `/runs/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`;
}

/** Liest eine API-Fehler-Antwort ({ error: string | zod-flattenError }) zu Text. */
function messageFromPayload(payload: unknown): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const err: unknown = payload.error;
    if (typeof err === "string") return err;
    if (err && typeof err === "object") {
      const fe = err as { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
      const parts: string[] = [];
      if (fe.formErrors?.length) parts.push(...fe.formErrors);
      for (const [field, msgs] of Object.entries(fe.fieldErrors ?? {})) {
        if (msgs.length) parts.push(`${field}: ${msgs.join(", ")}`);
      }
      if (parts.length) return parts.join(" · ");
    }
  }
  return "Something went wrong. Please try again.";
}

const STATUS_META: Record<RunStatus, { label: string; className: string; icon: React.ReactNode }> = {
  pending: {
    label: "Pending",
    className: "border-border bg-muted text-muted-foreground",
    icon: <CircleDashed className="size-3" />,
  },
  running: {
    label: "Running",
    className: "border-chart-2/40 bg-chart-2/10 text-chart-2",
    icon: <Loader2 className="size-3 animate-spin" />,
  },
  completed: {
    label: "Completed",
    className: "border-success/30 bg-success/10 text-success",
    icon: <CheckCircle2 className="size-3" />,
  },
  failed: {
    label: "Failed",
    className: "border-destructive/30 bg-destructive/10 text-destructive",
    icon: <XCircle className="size-3" />,
  },
};

function StatusBadge({ status }: { status: RunStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        meta.className,
      )}
    >
      {meta.icon}
      {meta.label}
    </span>
  );
}

/** Fehlquote als Prozenttext (`failed/total`). */
function failureRate(failed: number, total: number): string {
  if (total <= 0) return "—";
  const pct = Math.round((failed / total) * 100);
  return `${String(failed)}/${String(total)} (${String(pct)} %)`;
}

const selectClass =
  "w-full appearance-none rounded-lg border border-border bg-input px-3 py-2 text-foreground transition-colors focus:ring-2 focus-visible:ring-ring focus:outline-none";

export default function RunRunner({ initialRuns, personas, modelConfigs, loadError = false }: Props) {
  const [runs, setRuns] = useState<RunView[]>(initialRuns);
  const [personaId, setPersonaId] = useState<string>(personas[0]?.id ?? "");
  const [modelConfigId, setModelConfigId] = useState<string>(modelConfigs[0]?.id ?? "");
  const [reps, setReps] = useState<number>(DEFAULT_REPS);
  const [kind, setKind] = useState<RunKind>("oejts");
  // `?? ??`-Ketten ueber zwei Index-Zugriffe hinweg flaggt `no-unnecessary-condition`
  // (ohne `noUncheckedIndexedAccess` gilt `modelConfigs[i]` als nie `undefined`) —
  // deshalb hier als Ternary statt als Chain (deckt trotzdem `modelConfigs.length <= 1` ab).
  const [adversaryId, setAdversaryId] = useState<string>(
    modelConfigs.length > 1 ? modelConfigs[1].id : (modelConfigs[0]?.id ?? ""),
  );
  const [maxRounds, setMaxRounds] = useState<number>(DEFAULT_ROUNDS);
  const [formError, setFormError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(
    loadError ? "Couldn't load the run list. Please reload." : null,
  );
  const [starting, setStarting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Vergleichs-Auswahl (S-08): geordnete Liste von max. zwei Lauf-IDs. Die
  // "verwertbar"-Garantie liegt bewusst auf der Vergleichsseite — hier wird nur
  // an `status === "completed"` festgemacht (RunView traegt kein usableReps).
  const [compareIds, setCompareIds] = useState<string[]>([]);

  /** Schaltet einen Lauf in der Vergleichs-Auswahl an/aus (Cap 2). */
  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return prev;
      return [...prev, id];
    });
  }

  // Aktiver Step-Loop: welcher Lauf gerade getrieben wird + sein Live-Fortschritt.
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [progress, setProgress] = useState<RunProgress | null>(null);

  // Live-Modell-Zeit: Summe der lastRepDurationMs über die Steps dieses Laufs.
  const [modelMsSoFar, setModelMsSoFar] = useState<number>(0);
  const [lastRepMs, setLastRepMs] = useState<number | null>(null);
  // Letzter nicht-null Rep-Fehler (sticky bis zum nächsten Lauf-Start).
  const [lastRepError, setLastRepError] = useState<string | null>(null);

  // Loop-Steuerung ueber Refs (kein Render-State): `cancelled` stoppt die
  // Verkettung nach Abbruch/Fehler, `timer` haelt das ausstehende setTimeout.
  const cancelledRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const canRun = personas.length > 0 && modelConfigs.length > 0;
  const isRunning = activeRunId !== null;

  // Ueber eine Funktion lesen (nicht `cancelledRef.current` direkt): nach einem
  // `await` haelt das TS-Flow-Narrowing den Ref-Wert sonst faelschlich auf
  // `false`, was `no-unnecessary-condition` als „immer falsy" flaggt.
  function isCancelled() {
    return cancelledRef.current;
  }

  function clearTimer() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  async function refetch() {
    const res = await fetch("/api/runs", { headers: { Accept: "application/json" } });
    if (res.status === 401) {
      redirectToSignin();
      return;
    }
    if (res.ok) {
      const parsed = runViewArraySchema.safeParse(await res.json().catch(() => null));
      if (!parsed.success) {
        setServerError("Couldn't load the run list. Please reload.");
        return;
      }
      const fresh = parsed.data;
      setRuns(fresh);
      // Geloeschte/verschwundene Laeufe aus der Vergleichs-Auswahl entfernen.
      setCompareIds((prev) => prev.filter((id) => fresh.some((r) => r.id === id)));
    } else {
      setServerError("Couldn't load the run list. Please reload.");
    }
  }

  /** Verarbeitet GENAU EINE Wiederholung und verkettet sich selbst bis terminal. */
  async function runStep(runId: string) {
    if (isCancelled()) return;
    let res: Response;
    try {
      res = await fetch(`/api/runs/${runId}/step`, { method: "POST", headers: { Accept: "application/json" } });
    } catch {
      setServerError("Network error — please try again.");
      stopLoop();
      return;
    }
    if (isCancelled()) return;
    if (res.status === 401) {
      redirectToSignin();
      return;
    }
    if (!res.ok) {
      setServerError(messageFromPayload(await res.json().catch(() => null)));
      stopLoop();
      await refetch();
      return;
    }
    const parsed = runProgressSchema.safeParse(await res.json().catch(() => null));
    if (isCancelled()) return;
    if (!parsed.success) {
      setServerError("Unexpected server response.");
      stopLoop();
      await refetch();
      return;
    }
    const next = parsed.data;
    setProgress(next);
    const d = next.lastRepDurationMs;
    if (d != null) {
      setLastRepMs(d);
      setModelMsSoFar((prev) => prev + d);
    }
    if (next.lastRepError != null) {
      setLastRepError(next.lastRepError);
    }
    if (next.status === "completed" || next.status === "failed") {
      stopLoop();
      await refetch();
      return;
    }
    // Weiter mit der naechsten Wiederholung — Verkettung via setTimeout (kein
    // setInterval): erst nach Rueckkehr des Calls den naechsten Schritt planen.
    timerRef.current = window.setTimeout(() => {
      void runStep(runId);
    }, 0);
  }

  function stopLoop() {
    cancelledRef.current = true;
    clearTimer();
    setActiveRunId(null);
  }

  async function start() {
    setFormError(null);
    setServerError(null);
    if (!personaId || !modelConfigId) {
      setFormError("Select a persona and a model configuration.");
      return;
    }
    if (!Number.isInteger(reps) || reps < MIN_REPS || reps > MAX_REPS) {
      setFormError(`Repetitions must be between ${String(MIN_REPS)} and ${String(MAX_REPS)}.`);
      return;
    }
    if (kind === "steadfastness") {
      if (!adversaryId) {
        setFormError("Select an adversary model.");
        return;
      }
      if (!Number.isInteger(maxRounds) || maxRounds < MIN_ROUNDS || maxRounds > MAX_ROUNDS) {
        setFormError(`Rounds must be between ${String(MIN_ROUNDS)} and ${String(MAX_ROUNDS)}.`);
        return;
      }
    }
    setStarting(true);
    try {
      const body =
        kind === "steadfastness"
          ? { kind, personaId, modelConfigId, adversaryModelConfigId: adversaryId, repetitionCount: reps, maxRounds }
          : { kind, personaId, modelConfigId, instrumentId: "oejts-1.2", repetitionCount: reps };
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        redirectToSignin();
        return;
      }
      if (!res.ok) {
        setServerError(messageFromPayload(await res.json().catch(() => null)));
        return;
      }
      const parsed = runViewSchema.safeParse(await res.json());
      if (!parsed.success) {
        setServerError("Unexpected server response.");
        return;
      }
      const view = parsed.data;
      setRuns((prev) => [view, ...prev]);
      cancelledRef.current = false;
      setActiveRunId(view.id);
      setModelMsSoFar(0);
      setLastRepMs(null);
      setLastRepError(null);
      setProgress({
        status: view.status,
        completedReps: 0,
        totalReps: view.repetitionCount,
        failedCount: 0,
        promptTokens: 0,
        completionTokens: 0,
        lastRepDurationMs: null,
        lastRepError: null,
        phase: null,
        currentScenario: null,
        totalScenarios: view.repetitionCount,
        currentRound: null,
        lastStrategy: null,
      });
      void runStep(view.id);
    } catch {
      setServerError("Network error — please try again.");
    } finally {
      setStarting(false);
    }
  }

  /** Schickt den harten DELETE (Lauf + alle run_repetitions via cascade) und laedt die Liste neu. */
  async function deleteRunRequest(id: string) {
    setBusyId(id);
    setServerError(null);
    try {
      const res = await fetch(`/api/runs/${id}`, { method: "DELETE", headers: { Accept: "application/json" } });
      if (res.status === 401) {
        redirectToSignin();
        return;
      }
      await refetch();
    } catch {
      setServerError("Network error — please try again.");
    } finally {
      setBusyId(null);
    }
  }

  /**
   * Bricht den aktiven Lauf ab: stoppt den Loop und loescht den Lauf hart
   * (FR-014). Da dabei alle bereits erhobenen Messdaten unwiderruflich
   * verworfen werden, zuerst bestaetigen lassen.
   */
  async function cancelActive() {
    if (activeRunId === null) return;
    if (!window.confirm("Cancel this run? All measurement data collected so far will be lost.")) return;
    const id = activeRunId;
    stopLoop();
    setProgress(null);
    await deleteRunRequest(id);
  }

  /** Loescht einen abgeschlossenen/fehlgeschlagenen Lauf (mit Bestaetigung). */
  async function remove(id: string) {
    if (!window.confirm("Delete this run?")) return;
    await deleteRunRequest(id);
  }

  /** Schaltet die Sichtbarkeit eines eigenen Laufs um (privat ↔ global, S-07). */
  async function setVisibility(run: RunView) {
    const next = run.visibility === "global" ? "private" : "global";
    setBusyId(run.id);
    setServerError(null);
    try {
      const res = await fetch(`/api/runs/${run.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ visibility: next }),
      });
      if (res.status === 401) {
        redirectToSignin();
        return;
      }
      if (!res.ok) {
        setServerError(messageFromPayload(await res.json().catch(() => null)));
        return;
      }
      await refetch();
    } catch {
      setServerError("Network error — please try again.");
    } finally {
      setBusyId(null);
    }
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    void start();
  }

  return (
    <div className="space-y-8">
      {/* Start-Formular */}
      <form onSubmit={handleSubmit} noValidate className="border-border bg-card space-y-4 rounded-2xl border p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Play className="size-4" />
          New run
        </h2>

        {canRun ? null : (
          <p className="border-chart-2/40 bg-chart-2/10 text-chart-2 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>
              A run needs at least one{" "}
              <a href="/personas" className="hover:text-foreground underline">
                persona
              </a>{" "}
              and one{" "}
              <a href="/models" className="hover:text-foreground underline">
                model configuration
              </a>
              .
            </span>
          </p>
        )}

        <div>
          <label htmlFor="kind" className="text-muted-foreground mb-1 block text-sm">
            Test type
          </label>
          <select
            id="kind"
            value={kind}
            disabled={!canRun || isRunning}
            onChange={(e) => {
              setKind(e.target.value as RunKind);
            }}
            className={selectClass}
          >
            <option value="oejts" className="bg-muted">
              Personality (OEJTS)
            </option>
            <option value="steadfastness" className="bg-muted">
              Steadfastness
            </option>
          </select>
        </div>

        <div>
          <label htmlFor="personaId" className="text-muted-foreground mb-1 block text-sm">
            Persona
          </label>
          <select
            id="personaId"
            value={personaId}
            disabled={!canRun || isRunning}
            onChange={(e) => {
              setPersonaId(e.target.value);
            }}
            className={selectClass}
          >
            {personas.map((p) => (
              <option key={p.id} value={p.id} className="bg-muted">
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="modelConfigId" className="text-muted-foreground mb-1 block text-sm">
            Model configuration
          </label>
          <select
            id="modelConfigId"
            value={modelConfigId}
            disabled={!canRun || isRunning}
            onChange={(e) => {
              setModelConfigId(e.target.value);
            }}
            className={selectClass}
          >
            {modelConfigs.map((c) => (
              <option key={c.id} value={c.id} className="bg-muted">
                {c.label} ({c.modelName})
              </option>
            ))}
          </select>
        </div>

        {kind === "steadfastness" ? (
          <>
            <div>
              <label htmlFor="adversaryId" className="text-muted-foreground mb-1 block text-sm">
                Adversary model (manipulator + generator)
              </label>
              <select
                id="adversaryId"
                value={adversaryId}
                disabled={!canRun || isRunning}
                onChange={(e) => {
                  setAdversaryId(e.target.value);
                }}
                className={selectClass}
              >
                {modelConfigs.map((c) => (
                  <option key={c.id} value={c.id} className="bg-muted">
                    {c.label} ({c.modelName})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="maxRounds" className="text-muted-foreground mb-1 block text-sm">
                Max. rounds per fact{" "}
                <span className="text-muted-foreground">
                  ({MIN_ROUNDS}–{MAX_ROUNDS})
                </span>
              </label>
              <input
                id="maxRounds"
                type="number"
                min={MIN_ROUNDS}
                max={MAX_ROUNDS}
                value={maxRounds}
                disabled={!canRun || isRunning}
                onChange={(e) => {
                  const v = e.target.valueAsNumber;
                  setMaxRounds(Number.isNaN(v) ? MIN_ROUNDS : v);
                }}
                className="border-border bg-input text-foreground focus-visible:ring-ring w-full rounded-lg border px-3 py-2 transition-colors focus:ring-2 focus:outline-none"
              />
            </div>
          </>
        ) : null}

        <div>
          <label htmlFor="reps" className="text-muted-foreground mb-1 block text-sm">
            {kind === "steadfastness" ? "Facts" : "Repetitions"}{" "}
            <span className="text-muted-foreground">
              ({MIN_REPS}–{MAX_REPS})
            </span>
          </label>
          <div className="relative">
            <span className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2">
              <Hash className="size-4" />
            </span>
            <input
              id="reps"
              type="number"
              min={MIN_REPS}
              max={MAX_REPS}
              value={reps}
              disabled={!canRun || isRunning}
              onChange={(e) => {
                // Geleertes Feld liefert NaN — auf MIN_REPS klemmen, damit der
                // kontrollierte Input nie value={NaN} rendert.
                const v = e.target.valueAsNumber;
                setReps(Number.isNaN(v) ? MIN_REPS : v);
              }}
              className="border-border bg-input text-foreground focus-visible:ring-ring w-full rounded-lg border px-3 py-2 pl-10 transition-colors focus:ring-2 focus:outline-none"
            />
          </div>
        </div>

        {formError ? (
          <p className="text-destructive flex items-center gap-1 text-xs">
            <AlertCircle className="size-3" />
            {formError}
          </p>
        ) : null}
        <ServerError message={serverError} />

        <Button type="submit" disabled={!canRun || isRunning || starting}>
          {isRunning ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          {starting ? "Starting…" : isRunning ? "Run active…" : "Start run"}
        </Button>
      </form>

      {/* Live-Fortschritt des aktiven Laufs */}
      {isRunning && progress ? (
        <section className="border-chart-2/40 bg-chart-2/10 space-y-3 rounded-2xl border p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Loader2 className="size-4 animate-spin" />
              Run in progress…
            </h2>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={busyId === activeRunId}
              onClick={() => {
                void cancelActive();
              }}
            >
              <Ban className="size-3.5" />
              Cancel
            </Button>
          </div>
          <p className="text-muted-foreground text-sm tabular-nums">
            {progress.completedReps} of {progress.totalReps} repetitions
            {progress.failedCount > 0 ? ` · ${String(progress.failedCount)} failed` : ""}
          </p>
          {progress.phase === "generating" ? (
            <p className="text-muted-foreground text-xs tabular-nums">Generating scenarios…</p>
          ) : progress.phase === "experimenting" && progress.currentScenario != null ? (
            <p className="text-muted-foreground text-xs tabular-nums">
              Fact {progress.currentScenario}/{progress.totalScenarios ?? progress.totalReps}
              {progress.currentRound ? ` · round ${progress.currentRound}` : ""}
              {progress.lastStrategy ? ` · strategy: ${progress.lastStrategy}` : ""}
            </p>
          ) : null}
          <p className="text-muted-foreground text-xs tabular-nums">
            Tokens: {progress.promptTokens} in / {progress.completionTokens} out
          </p>
          {lastRepMs != null ? (
            <p className="text-muted-foreground text-xs tabular-nums">
              Last repetition {formatDuration(lastRepMs)} · total model time {formatDuration(modelMsSoFar)}
            </p>
          ) : null}
          {lastRepError != null ? <p className="text-destructive text-xs">Last error: {lastRepError}</p> : null}
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full transition-all"
              style={{
                width: `${String(progress.totalReps > 0 ? Math.round((progress.completedReps / progress.totalReps) * 100) : 0)}%`,
              }}
            />
          </div>
        </section>
      ) : null}

      {/* Lauf-Liste */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Your runs</h2>
        {runs.length === 0 ? (
          <p className="border-border bg-card text-muted-foreground rounded-2xl border px-4 py-6 text-center text-sm">
            No runs yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {runs.map((run) => (
              <li
                key={run.id}
                className="border-border bg-card flex flex-wrap items-start justify-between gap-3 rounded-2xl border p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={run.status} />
                    <span className="border-border bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
                      {run.kind === "steadfastness" ? "Steadfastness" : "OEJTS"}
                    </span>
                    {run.visibility === "global" ? (
                      <span className="border-primary/30 bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
                        <Globe className="size-3" />
                        Global
                      </span>
                    ) : run.isOwn ? (
                      <span className="border-border bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
                        <Lock className="size-3" />
                        Private
                      </span>
                    ) : null}
                    <span className="text-muted-foreground text-sm tabular-nums">
                      {run.completedReps}/{run.repetitionCount} repetitions
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs tabular-nums">
                    Executed: {formatDateTime(run.createdAt)} · Failure rate:{" "}
                    {failureRate(run.failedCount, run.repetitionCount)} · Tokens: {run.promptTokens} in /{" "}
                    {run.completionTokens} out
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Vergleichs-Haken (S-08): nur abgeschlossene, nicht-aktive
                      Laeufe; max. zwei. Gesperrt, sobald zwei andere gewaehlt sind. */}
                  {run.status === "completed" && run.id !== activeRunId ? (
                    <label
                      className="border-border bg-muted hover:bg-accent inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors has-disabled:cursor-not-allowed has-disabled:opacity-40"
                      title="Select for comparison (max. 2)"
                    >
                      <input
                        type="checkbox"
                        checked={compareIds.includes(run.id)}
                        disabled={compareIds.length >= 2 && !compareIds.includes(run.id)}
                        onChange={() => {
                          toggleCompare(run.id);
                        }}
                        className="accent-primary size-3.5"
                      />
                      <GitCompare className="size-3.5" />
                      Compare
                    </label>
                  ) : null}
                  {/* Ergebnis-Detailansicht (Verteilung je Achse). Bei noch nicht
                      abgeschlossenen Laeufen zeigt die Seite einen Hinweis. */}
                  {run.id !== activeRunId ? (
                    <a
                      href={`/runs/${run.id}`}
                      className="border-border bg-muted hover:bg-accent inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors"
                    >
                      <BarChart3 className="size-3.5" />
                      Result
                    </a>
                  ) : null}
                  {/* Sichtbarkeits-Toggle nur fuer eigene, nicht-aktive Laeufe. */}
                  {run.isOwn && run.id !== activeRunId ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busyId === run.id}
                      title={
                        run.visibility === "global"
                          ? "Set to private (only you can see it)"
                          : "Set to global (visible org-wide)"
                      }
                      onClick={() => {
                        void setVisibility(run);
                      }}
                      className="border-border bg-muted text-foreground hover:bg-accent"
                    >
                      {run.visibility === "global" ? <Lock className="size-3.5" /> : <Globe className="size-3.5" />}
                      {run.visibility === "global" ? "Private" : "Global"}
                    </Button>
                  ) : null}
                  {/* Aktiver Lauf wird ueber das Fortschritts-Panel abgebrochen (kein doppelter Button). */}
                  {run.isOwn && run.id !== activeRunId ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={busyId === run.id}
                      onClick={() => {
                        void remove(run.id);
                      }}
                    >
                      <Trash2 className="size-3.5" />
                      Delete
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Sticky Vergleichs-Leiste (S-08): erscheint ab einer Auswahl, der
          "Vergleichen"-Button aktiviert sich bei genau zwei Laeufen. */}
      {compareIds.length > 0 ? (
        <div className="border-primary/30 bg-muted sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3">
          <span className="text-muted-foreground text-sm">
            {compareIds.length === 2
              ? "Two runs selected — ready to compare."
              : "One run selected — select a second one to compare."}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setCompareIds([]);
              }}
              className="border-border bg-muted text-foreground hover:bg-accent"
            >
              Clear selection
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={compareIds.length !== 2}
              onClick={() => {
                const [a, b] = compareIds;
                if (a && b) navigateToCompare(a, b);
              }}
            >
              <GitCompare className="size-3.5" />
              Compare
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
