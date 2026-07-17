import { z } from "zod";

// `personaId` ist nullable (null = Baseline-Lauf ohne Persona), aber bewusst
// NICHT optional — der Client muss die Baseline-Entscheidung explizit senden,
// ein fehlendes Feld bleibt ein Validierungsfehler.
const oejts = z.object({
  kind: z.literal("oejts").default("oejts"),
  personaId: z.uuid().nullable(),
  modelConfigId: z.uuid(),
  instrumentId: z.string().trim().min(1).max(120).default("oejts-1.2"),
  repetitionCount: z.number().int().min(1).max(25),
});

// Strukturgleich zu OEJTS, aber `kind` OHNE default: nur ein explizites
// kind:"hexaco" trifft diesen Zweig — ein fehlendes kind bleibt OEJTS (Kompat).
const hexaco = z.object({
  kind: z.literal("hexaco"),
  personaId: z.uuid().nullable(),
  modelConfigId: z.uuid(),
  instrumentId: z.string().trim().min(1).max(120).default("hexaco-ipip-60"),
  repetitionCount: z.number().int().min(1).max(25),
});

const steadfastness = z.object({
  kind: z.literal("steadfastness"),
  personaId: z.uuid().nullable(),
  modelConfigId: z.uuid(),
  adversaryModelConfigId: z.uuid(),
  repetitionCount: z.number().int().min(1).max(25),
  maxRounds: z.number().int().min(1).max(50),
});

/**
 * Diskriminiert über `kind`. OEJTS ist der Default (fehlt `kind`, greift der
 * OEJTS-Zweig) — rückwärtskompatibel zum bestehenden Client.
 */
export const createSchema = z.union([steadfastness, hexaco, oejts]);
