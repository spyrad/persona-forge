/**
 * Extrahiert die Modell-IDs aus einer OpenAI-kompatiblen `/models`-Antwort
 * (`{ data: [{ id: "gpt-4o", … }, …] }`). Bewusst tolerant: unbekannte Formen,
 * fehlendes `data`-Array oder Einträge ohne String-`id` ergeben eine leere Liste
 * — die UI fällt dann sauber auf Freitext zurück. Dedupliziert + alphabetisch sortiert.
 */
export function extractModelIds(payload: unknown): string[] {
  const data = (payload as { data?: unknown } | null | undefined)?.data;
  if (!Array.isArray(data)) return [];
  const ids = new Set<string>();
  for (const entry of data) {
    if (entry && typeof entry === "object") {
      const id = (entry as { id?: unknown }).id;
      if (typeof id === "string" && id.trim()) ids.add(id);
    }
  }
  return [...ids].sort();
}
