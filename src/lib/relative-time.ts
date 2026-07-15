/**
 * Relative Zeitangabe fuer SSR-Kennzahlen ("just now", "5 min ago", "3 h ago",
 * "12 d ago"). `nowMs` wird vom Aufrufer injiziert (Server-Zeitpunkt des
 * Renders) — pur und damit ohne Zeit-Mocks testbar. Unparsebare Zeitpunkte
 * ergeben "unknown", kuenftige (Uhren-Drift) fallen auf "just now" zurueck.
 */
export function formatRelativeTime(iso: string, nowMs: number): string {
  const thenMs = Date.parse(iso);
  if (Number.isNaN(thenMs)) return "unknown";
  const diffMin = Math.floor((nowMs - thenMs) / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${String(diffMin)} min ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${String(diffHours)} h ago`;
  return `${String(Math.floor(diffHours / 24))} d ago`;
}
