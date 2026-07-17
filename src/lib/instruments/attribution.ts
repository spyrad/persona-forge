/**
 * Attribution je item-basiertem Test-Typ, aus den Instrument-Definitionen (2.4).
 * `steadfastness` hat kein externes Instrument (LLM-generierte Szenarien) und
 * erscheint hier bewusst nicht. Eine Stelle, an der Aufrufer (Profil, Vergleich,
 * Dashboard) die richtige Attribution je Test-Typ beziehen.
 */
import { HEXACO } from "@/lib/instruments/hexaco";
import { OEJTS } from "@/lib/instruments/oejts";
import type { InstrumentAttribution } from "@/types";

export const ATTRIBUTION_BY_KIND: Record<"oejts" | "hexaco", InstrumentAttribution> = {
  oejts: OEJTS.attribution,
  hexaco: HEXACO.attribution,
};
