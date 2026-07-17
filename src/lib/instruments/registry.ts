/**
 * Schlanke Instrument-Registry: zentrale Aufloesung `instrument_id → Instrument`
 * (Plan hexaco-instrument 1.2). Bewusst minimal — eine ReadonlyMap, kein
 * Plugin-System; neue Instrumente docken als weiterer Map-Eintrag an.
 *
 * Fehlerpfad (Spec-Risiko "falsche Instrument-Zuordnung"): eine unbekannte Id
 * wirft einen definierten, geloggten Fehler — KEIN stiller Fallback auf ein
 * anderes Instrument, damit nie stillschweigend falsche Werte berechnet werden.
 *
 * Steadfastness ist hier bewusst NICHT registriert: der zweite Test-Typ hat
 * keine Item-Liste und laeuft ueber den kind-Dispatch (`runs.ts`), nie ueber
 * die Registry.
 */
import { HEXACO } from "@/lib/instruments/hexaco";
import { OEJTS } from "@/lib/instruments/oejts";
import type { Instrument } from "@/types";

const REGISTRY: ReadonlyMap<string, Instrument> = new Map<string, Instrument>([
  [OEJTS.id, OEJTS],
  [HEXACO.id, HEXACO],
]);

/** Loest eine `instrument_id` zum Instrument auf; unbekannte Id → geloggter Fehler. */
export function getInstrument(id: string): Instrument {
  const instrument = REGISTRY.get(id);
  if (!instrument) {
    // eslint-disable-next-line no-console -- bewusstes serverseitiges Audit-Log (→ Sentry via captureConsole)
    console.error(`[instruments] unknown instrument_id "${id}" — no silent fallback`);
    throw new Error(`unknown instrument_id: ${id}`);
  }
  return instrument;
}
