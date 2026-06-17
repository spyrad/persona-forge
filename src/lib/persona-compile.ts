/**
 * Kompiliert strukturierte Persona-Felder (nach `docs/persona-authoring-spec.md`,
 * §§1–6) deterministisch zu einem Markdown-System-Prompt.
 *
 * Rein und ohne I/O — gleiche Eingabe ergibt identischen Output (deterministisch),
 * damit der gespeicherte `system_prompt` reproduzierbar ist und ein Lauf (S-04)
 * stets nur ein Feld konsumiert. §§1–4 sind Pflicht (mind. ein Eintrag), §5/§6
 * sind optional und werden bei leerem Inhalt weggelassen.
 */
import type { PersonaStructuredFields } from "@/types";

/** Nummerierte Liste (§1 Kerndenken: „N Muster"). */
function numbered(items: string[]): string {
  return items.map((item, i) => `${String(i + 1)}. ${item.trim()}`).join("\n");
}

/** Aufzaehlung (§§2–4). */
function bullets(items: string[]): string {
  return items.map((item) => `- ${item.trim()}`).join("\n");
}

export function compilePersonaPrompt(fields: PersonaStructuredFields): string {
  const blocks: string[] = [
    `## 1. Kerndenken\n${numbered(fields.coreThinking)}`,
    `## 2. Stimme\n${bullets(fields.voice)}`,
    `## 3. Entscheidungsfilter\n${bullets(fields.decisionFilters)}`,
    `## 4. Bekannte Risiken\n${bullets(fields.risks)}`,
  ];

  const exampleDialog = fields.exampleDialog?.trim();
  if (exampleDialog) {
    blocks.push(`## 5. Stimme in Aktion\n${exampleDialog}`);
  }

  const usage = fields.usage?.trim();
  if (usage) {
    blocks.push(`## 6. Nutzung\n${usage}`);
  }

  return blocks.join("\n\n");
}
