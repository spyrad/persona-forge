/**
 * Reine, deterministische Funktionen fuer den OEJTS-Lauf (S-04):
 *   - permuteItems:        seedbare Item-Permutation (FR-012), reproduzierbar.
 *   - buildOejtsMessages:  System-Prompt (Persona) + User-Prompt (Items + JSON-Auftrag).
 *   - parseOejtsResponse:  strukturierte JSON-Antwort + robuster Freitext-Fallback (FR-013).
 *
 * Bewusst frei von I/O und env-Zugriff (kein `astro:env/server`), damit unter dem
 * Node-Vitest-Setup unit-testbar — analog `crypto.ts` / `persona-compile.ts`.
 */
import type { InstrumentItem, ItemValue } from "@/types";

/** Chat-Message-Form (OpenAI-kompatibel). */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Deterministischer 32-bit-PRNG (mulberry32) — gleicher Seed → gleiche Folge. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Permutiert die Items deterministisch (Fisher-Yates mit seedbarem PRNG).
 * `order` enthaelt die Original-Indizes in neuer Reihenfolge (Reproduktions-Artefakt).
 */
export function permuteItems(items: InstrumentItem[], seed: number): { ordered: InstrumentItem[]; order: number[] } {
  const order = items.map((_, i) => i);
  const rand = mulberry32(seed);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { ordered: order.map((i) => items[i]), order };
}

/**
 * Baut die Chat-Messages fuer eine Wiederholung: System = Persona-Prompt,
 * User = OEJTS-Instruktion + (permutierte) Items + Aufforderung zu striktem JSON.
 * Die Item-Id wird je Zeile mitgegeben, damit das Parsing ueber die Id (nicht die
 * Position) zurueckmappt.
 *
 * Baseline (leerer System-Prompt): die System-Message wird KOMPLETT weggelassen
 * statt leer gesendet — manche OpenAI-kompatible Provider lehnen leere
 * System-Messages ab; Weglassen ist ueberall wohldefiniert.
 */
export function buildOejtsMessages(systemPrompt: string, orderedItems: InstrumentItem[]): ChatMessage[] {
  const lines = orderedItems.map((it) => `${it.id}: 1 = "${it.left}"  …  5 = "${it.right}"`).join("\n");

  const user = [
    "You are taking a personality questionnaire. For each item below you are given two opposing",
    "statements connected by a 1–5 scale. Choose where you fall: 1 = fully the left statement,",
    "3 = balanced, 5 = fully the right statement. Answer every item with a whole number 1–5.",
    "",
    "Items:",
    lines,
    "",
    "Respond with ONLY a JSON object of this exact shape, no prose, no markdown:",
    '{"answers": [{"id": "Q1", "value": 3}, {"id": "Q2", "value": 5}, ...]}',
    "Include every item id exactly once.",
  ].join("\n");

  const messages: ChatMessage[] = [];
  if (systemPrompt.trim() !== "") messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: user });
  return messages;
}

/** Validiert einen rohen Wert zu einer Ganzzahl 1–5 oder null. */
function coerceScale(raw: unknown): number | null {
  const n = typeof raw === "string" ? Number(raw.trim()) : typeof raw === "number" ? raw : NaN;
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  return r >= 1 && r <= 5 ? r : null;
}

/** Extrahiert ein id→value-Map aus geparstem JSON (mehrere tolerierte Formen). */
function valuesFromJson(parsed: unknown): Map<string, number | null> {
  const map = new Map<string, number | null>();
  const pushPair = (id: unknown, value: unknown) => {
    if (typeof id === "string") map.set(id.trim().toUpperCase(), coerceScale(value));
  };
  if (Array.isArray(parsed)) {
    // [{id, value}, …]
    for (const el of parsed)
      if (el && typeof el === "object")
        pushPair((el as Record<string, unknown>).id, (el as Record<string, unknown>).value);
  } else if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.answers)) {
      for (const el of obj.answers)
        if (el && typeof el === "object")
          pushPair((el as Record<string, unknown>).id, (el as Record<string, unknown>).value);
    } else {
      // { "Q1": 3, "Q2": 5, … }
      for (const [k, v] of Object.entries(obj)) pushPair(k, v);
    }
  }
  return map;
}

/** Versucht, JSON aus der Roh-Antwort zu extrahieren (Codefences/Zusatztext tolerant). */
function tryParseJson(raw: string): unknown {
  const candidates: string[] = [];
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  if (fence) candidates.push(fence[1]);
  candidates.push(raw);
  // erstes balanciertes { … } oder [ … ]
  const braceStart = raw.search(/[{[]/);
  if (braceStart >= 0) {
    const braceEnd = Math.max(raw.lastIndexOf("}"), raw.lastIndexOf("]"));
    if (braceEnd > braceStart) candidates.push(raw.slice(braceStart, braceEnd + 1));
  }
  for (const c of candidates) {
    try {
      return JSON.parse(c.trim());
    } catch {
      // naechsten Kandidaten versuchen
    }
  }
  return null;
}

/**
 * Parst die Roh-Antwort zu einem Wert je erwarteter Item-Id. Zuerst JSON, sonst
 * ein Freitext-Fallback (Heuristik je Id, z. B. "Q12: 3" / "Q12 = 4" / "12) 3").
 * `okCount` = Anzahl erfolgreich geparster Items.
 */
export function parseOejtsResponse(raw: string, expectedIds: string[]): { values: ItemValue[]; okCount: number } {
  const fromJson = tryParseJson(raw);
  const jsonMap = fromJson ? valuesFromJson(fromJson) : new Map<string, number | null>();

  const values: ItemValue[] = expectedIds.map((id) => {
    const key = id.toUpperCase();
    let value = jsonMap.get(key) ?? null;

    // Freitext-Fallback fuer dieses Item, wenn JSON nichts Brauchbares lieferte.
    if (value == null) {
      const re = new RegExp(`\\b${id}\\b\\s*[:=).\\-]?\\s*([1-5])(?![0-9])`, "i");
      const m = raw.match(re);
      if (m) value = coerceScale(m[1]);
    }

    return value == null ? { id, value: null, status: "unparsed" } : { id, value, status: "ok" };
  });

  const okCount = values.filter((v) => v.status === "ok").length;
  return { values, okCount };
}
