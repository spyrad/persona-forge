import { z } from "zod";

const oejts = z.object({
  kind: z.literal("oejts").default("oejts"),
  personaId: z.uuid(),
  modelConfigId: z.uuid(),
  instrumentId: z.string().trim().min(1).max(120).default("oejts-1.2"),
  repetitionCount: z.number().int().min(1).max(25),
});

const steadfastness = z.object({
  kind: z.literal("steadfastness"),
  personaId: z.uuid(),
  modelConfigId: z.uuid(),
  adversaryModelConfigId: z.uuid(),
  repetitionCount: z.number().int().min(1).max(25),
  maxRounds: z.number().int().min(1).max(50),
});

/**
 * Diskriminiert über `kind`. OEJTS ist der Default (fehlt `kind`, greift der
 * OEJTS-Zweig) — rückwärtskompatibel zum bestehenden Client.
 */
export const createSchema = z.union([steadfastness, oejts]);
