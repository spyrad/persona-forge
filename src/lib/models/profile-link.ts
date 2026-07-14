/**
 * Link-Bau zum Modell-Profil (Model Compare Phase 5.1).
 *
 * Modellnamen enthalten `/` und `:` (z.B. `openai/gpt-5.5`) — deshalb Query-Param
 * statt Pfad-Segment (Plan, "Technische Entscheidungen") und konsequentes
 * Encoding an genau einer Stelle, damit Run-Liste, Run-Detail und Modell-Liste
 * nicht auseinanderlaufen.
 */

/** Href auf das Profil eines Modells (`?m=` erwartet den kanonischen `modelName`). */
export function modelProfileHref(modelName: string): string {
  return `/models/profile?m=${encodeURIComponent(modelName)}`;
}
