/**
 * Baseline-Erkennung — die EINZIGE Quelle dieser Semantik (Lektion L1):
 *
 *   - Baseline-Lauf:        `persona_id null` UND leerer Prompt-Snapshot —
 *                           der Lauf wurde bewusst ohne Persona gestartet.
 *   - "Persona geloescht":  `persona_id null`, aber Snapshot GEFUELLT — der
 *                           Lauf lief mit Persona-Prompt (FK `on delete set null`).
 *
 * Nimmt explizite Parameter statt einer Row-Shape, damit Server-Code (snake_case-
 * Rows) und Views (camelCase) denselben Helper nutzen koennen. Profil-Filter
 * (model-profiles) und Anzeige-Fallbacks MUESSEN hierueber gehen — nie die
 * Bedingung inline nachbauen.
 */
export function isBaselineRun(personaId: string | null, personaPromptSnapshot: string): boolean {
  return personaId === null && personaPromptSnapshot.trim() === "";
}
