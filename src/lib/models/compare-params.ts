/**
 * Param-Parsing des Modell-Vergleichs (Model Compare Phase 4): reine, unit-
 * testbare Funktion — die Route (`models/compare.astro`) ruft sie auf, BEVOR
 * irgendetwas geladen wird (Workers-CPU-Härtung, Review-Entscheidung).
 *
 * Regeln (Spec + Plan 4.3):
 *   - Multi-Param `?m=a&m=b…`; Werte werden getrimmt, leere/überlange fliegen raus
 *   - Duplikate werden dedupliziert (Reihenfolge des ersten Auftretens bleibt)
 *   - Grenzen: 2–4 Modelle; >4 → `tooMany` (Route lädt dann NICHTS),
 *     `modelNames` trägt defensiv die ersten 4 (Kappung, falls doch geladen wird)
 */

export const COMPARE_MIN = 2;
export const COMPARE_MAX = 4;

/** Gleiche Obergrenze wie die Profil-Route für einen einzelnen Modellnamen. */
const MAX_NAME_LENGTH = 200;

export type CompareParams =
  | { state: "missing"; modelNames: [] }
  | { state: "tooFew"; modelNames: string[] }
  | { state: "tooMany"; modelNames: string[] }
  | { state: "ready"; modelNames: string[] };

/** Verdichtet die rohen `?m=`-Werte zu einem Zustand + bereinigter Namensliste. */
export function parseCompareParams(rawValues: string[]): CompareParams {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const raw of rawValues) {
    const name = raw.trim();
    if (name === "" || name.length > MAX_NAME_LENGTH) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }

  if (names.length === 0) return { state: "missing", modelNames: [] };
  if (names.length < COMPARE_MIN) return { state: "tooFew", modelNames: names };
  if (names.length > COMPARE_MAX) return { state: "tooMany", modelNames: names.slice(0, COMPARE_MAX) };
  return { state: "ready", modelNames: names };
}
