/**
 * Reine Timing-Helfer für den Run-Flow (kein I/O, Node-unit-testbar):
 *   - summarizeTiming: Rep-Dauern + Timestamps → aggregierte RunTiming-Kennzahlen.
 *   - formatDuration/formatDateTime: deutsche Anzeige (ms/s/min bzw. Datum+Zeit).
 */

/** Aggregierte Zeit-Kennzahlen eines Laufs (client-sicher). */
export interface RunTiming {
  /** Ausführungs-Start = runs.created_at (ISO). */
  executedAt: string;
  /** runs.finished_at (ISO) oder null, solange nicht terminal. */
  finishedAt: string | null;
  /** Wall-Clock finishedAt − executedAt in ms; null ohne finishedAt. */
  wallClockMs: number | null;
  /** Summe der gemessenen Wiederholungs-Dauern (echte Modell-Zeit). */
  modelMs: number;
  /** Anzahl Wiederholungen mit gemessener Dauer. */
  repCount: number;
  /** modelMs / repCount (gerundet) oder null. */
  avgMs: number | null;
  minMs: number | null;
  maxMs: number | null;
}

/** Aggregiert Rep-Dauern + Timestamps zu RunTiming (null-Dauern werden ignoriert). */
export function summarizeTiming(
  createdAt: string,
  finishedAt: string | null,
  repDurations: (number | null)[],
): RunTiming {
  const valid = repDurations.filter((d): d is number => typeof d === "number" && Number.isFinite(d));
  const modelMs = valid.reduce((sum, d) => sum + d, 0);
  const repCount = valid.length;
  const wallClockMs = finishedAt ? Math.max(0, Date.parse(finishedAt) - Date.parse(createdAt)) : null;
  return {
    executedAt: createdAt,
    finishedAt,
    wallClockMs,
    modelMs,
    repCount,
    avgMs: repCount > 0 ? Math.round(modelMs / repCount) : null,
    minMs: repCount > 0 ? Math.min(...valid) : null,
    maxMs: repCount > 0 ? Math.max(...valid) : null,
  };
}

/** Millisekunden → deutsche Kurzform: „300 ms" / „3,2 s" / „33 s" / „3 m 05 s". */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return `${String(Math.round(ms))} ms`;
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) {
    // Unter 10 s eine Nachkommastelle (feiner), darüber ganze Sekunden.
    if (ms < 10000) {
      const oneDecimal = (Math.round(ms / 100) / 10).toString().replace(".", ",");
      return `${oneDecimal} s`;
    }
    return `${String(totalSec)} s`;
  }
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m)} m ${String(s).padStart(2, "0")} s`;
}

/** ISO-Timestamp → „01.07.2026 22:15" (de-DE, Europe/Berlin). */
export function formatDateTime(iso: string): string {
  const formatted = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
  // de-DE liefert „01.07.2026, 22:15" — das Komma für die Kurzform entfernen.
  return formatted.replace(", ", " ");
}
