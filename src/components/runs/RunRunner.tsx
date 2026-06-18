import { useRef, useState } from "react";
import { AlertCircle, Ban, CheckCircle2, CircleDashed, Hash, Loader2, Play, Trash2, XCircle } from "lucide-react";
import { ServerError } from "@/components/auth/ServerError";
import { Button } from "@/components/ui/button";
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
    label: "Wartet",
    className: "border-white/20 bg-white/10 text-blue-100/70",
    icon: <CircleDashed className="size-3" />,
  },
  running: {
    label: "Läuft",
    className: "border-amber-400/30 bg-amber-500/20 text-amber-200",
    icon: <Loader2 className="size-3 animate-spin" />,
  },
  completed: {
    label: "Fertig",
    className: "border-emerald-500/30 bg-emerald-900/30 text-emerald-200",
    icon: <CheckCircle2 className="size-3" />,
  },
  failed: {
    label: "Fehlgeschlagen",
    className: "border-red-500/30 bg-red-900/30 text-red-300",
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
  "w-full appearance-none rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white transition-colors focus:ring-2 focus:ring-purple-400 focus:outline-none";

export default function RunRunner({ initialRuns, personas, modelConfigs, loadError = false }: Props) {
  const [runs, setRuns] = useState<RunView[]>(initialRuns);
  const [personaId, setPersonaId] = useState<string>(personas[0]?.id ?? "");
  const [modelConfigId, setModelConfigId] = useState<string>(modelConfigs[0]?.id ?? "");
  const [reps, setReps] = useState<number>(DEFAULT_REPS);
  const [formError, setFormError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(
    loadError ? "Couldn't load runs. Please reload." : null,
  );
  const [starting, setStarting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Aktiver Step-Loop: welcher Lauf gerade getrieben wird + sein Live-Fortschritt.
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [progress, setProgress] = useState<RunProgress | null>(null);

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
      setRuns((await res.json()) as RunView[]);
    } else {
      setServerError("Couldn't load runs. Please reload.");
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
    const next = (await res.json()) as RunProgress;
    if (isCancelled()) return;
    setProgress(next);
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
      setFormError("Persona und Modellkonfiguration wählen.");
      return;
    }
    if (!Number.isInteger(reps) || reps < MIN_REPS || reps > MAX_REPS) {
      setFormError(`Wiederholungen müssen zwischen ${String(MIN_REPS)} und ${String(MAX_REPS)} liegen.`);
      return;
    }
    setStarting(true);
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ personaId, modelConfigId, instrumentId: "oejts-1.2", repetitionCount: reps }),
      });
      if (res.status === 401) {
        redirectToSignin();
        return;
      }
      if (!res.ok) {
        setServerError(messageFromPayload(await res.json().catch(() => null)));
        return;
      }
      const view = (await res.json()) as RunView;
      setRuns((prev) => [view, ...prev]);
      cancelledRef.current = false;
      setActiveRunId(view.id);
      setProgress({ status: view.status, completedReps: 0, totalReps: view.repetitionCount, failedCount: 0 });
      void runStep(view.id);
    } catch {
      setServerError("Network error — please try again.");
    } finally {
      setStarting(false);
    }
  }

  /** Loescht einen Lauf. Ist es der aktive, wird zuerst der Loop gestoppt (Abbruch). */
  async function remove(id: string) {
    if (id === activeRunId) {
      stopLoop();
      setProgress(null);
    } else if (!window.confirm("Diesen Lauf löschen?")) {
      return;
    }
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

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    void start();
  }

  return (
    <div className="space-y-8">
      {/* Start-Formular */}
      <form
        onSubmit={handleSubmit}
        noValidate
        className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl"
      >
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Play className="size-4" />
          Neuer Lauf
        </h2>

        {canRun ? null : (
          <p className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-900/20 px-3 py-2 text-sm text-amber-200">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>
              Ein Lauf braucht mindestens eine{" "}
              <a href="/personas" className="underline hover:text-white">
                Persona
              </a>{" "}
              und eine{" "}
              <a href="/models" className="underline hover:text-white">
                Modellkonfiguration
              </a>
              .
            </span>
          </p>
        )}

        <div>
          <label htmlFor="personaId" className="mb-1 block text-sm text-blue-100/80">
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
              <option key={p.id} value={p.id} className="bg-slate-900">
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="modelConfigId" className="mb-1 block text-sm text-blue-100/80">
            Modellkonfiguration
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
              <option key={c.id} value={c.id} className="bg-slate-900">
                {c.label} ({c.modelName})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="reps" className="mb-1 block text-sm text-blue-100/80">
            Wiederholungen{" "}
            <span className="text-blue-100/40">
              ({MIN_REPS}–{MAX_REPS})
            </span>
          </label>
          <div className="relative">
            <span className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/40">
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
                setReps(e.target.valueAsNumber);
              }}
              className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 pl-10 text-white transition-colors focus:ring-2 focus:ring-purple-400 focus:outline-none"
            />
          </div>
        </div>

        {formError ? (
          <p className="flex items-center gap-1 text-xs text-red-300">
            <AlertCircle className="size-3" />
            {formError}
          </p>
        ) : null}
        <ServerError message={serverError} />

        <Button
          type="submit"
          disabled={!canRun || isRunning || starting}
          className="bg-purple-600 text-white hover:bg-purple-500"
        >
          {isRunning ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          {starting ? "Starte…" : isRunning ? "Lauf aktiv…" : "Lauf starten"}
        </Button>
      </form>

      {/* Live-Fortschritt des aktiven Laufs */}
      {isRunning && progress ? (
        <section className="space-y-3 rounded-2xl border border-amber-400/30 bg-amber-950/20 p-6 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Loader2 className="size-4 animate-spin" />
              Lauf läuft…
            </h2>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={busyId === activeRunId}
              onClick={() => {
                void remove(activeRunId);
              }}
            >
              <Ban className="size-3.5" />
              Abbrechen
            </Button>
          </div>
          <p className="text-sm text-blue-100/80">
            {progress.completedReps} von {progress.totalReps} Wiederholungen
            {progress.failedCount > 0 ? ` · ${String(progress.failedCount)} fehlgeschlagen` : ""}
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-purple-500 transition-all"
              style={{
                width: `${String(progress.totalReps > 0 ? Math.round((progress.completedReps / progress.totalReps) * 100) : 0)}%`,
              }}
            />
          </div>
        </section>
      ) : null}

      {/* Lauf-Liste */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Deine Läufe</h2>
        {runs.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-blue-100/50">
            Noch kein Lauf gestartet.
          </p>
        ) : (
          <ul className="space-y-3">
            {runs.map((run) => (
              <li
                key={run.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={run.status} />
                    <span className="text-sm text-blue-100/60">
                      {run.completedReps}/{run.repetitionCount} Wiederholungen
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-blue-100/50">
                    Fehlquote: {failureRate(run.failedCount, run.repetitionCount)} · Tokens: {run.promptTokens} ein /{" "}
                    {run.completionTokens} aus
                  </p>
                </div>
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
                    Löschen
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
