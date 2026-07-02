/**
 * Reiner Aggregations-Helfer für Lauf-Fehler (kein I/O, Node-unit-testbar):
 * gruppiert die fehlgeschlagenen Wiederholungen eines Laufs nach ihrem
 * Fehlertext, damit die UI statt einer bloßen Fehlquote-Zahl die konkreten
 * Gründe (mit Häufigkeit) zeigen kann.
 */
import type { RepetitionStatus } from "@/types";

/** Ein aggregierter Fehler: eindeutiger Text + Häufigkeit über die Wiederholungen. */
export interface RunFailureSummary {
  message: string;
  count: number;
}

/** Fallback, wenn ein Fehlschlag keinen (brauchbaren) Fehlertext trägt. */
const UNKNOWN = "Unbekannter Fehler";

/**
 * Gruppiert fehlgeschlagene Wiederholungen nach Fehlertext → {message, count}[],
 * sortiert nach count absteigend (bei Gleichstand alphabetisch → deterministisch).
 * Nur `status: 'failed'` zählt; fehlender/leerer Text → `UNKNOWN`.
 */
export function summarizeFailures(reps: { status: RepetitionStatus; error: string | null }[]): RunFailureSummary[] {
  const counts = new Map<string, number>();
  for (const rep of reps) {
    if (rep.status !== "failed") continue;
    const trimmed = rep.error?.trim() ?? "";
    const message = trimmed.length > 0 ? trimmed : UNKNOWN;
    counts.set(message, (counts.get(message) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([message, count]) => ({ message, count }))
    .sort((a, b) => b.count - a.count || a.message.localeCompare(b.message));
}
