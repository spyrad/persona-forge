/**
 * zod-Schemas der drei Run-Response-Bodies (C-B, refactor-opportunities).
 *
 * Diese Schemas sind die **Single Source** der client-seitigen Run-Typen:
 * `RunView`/`RunProgress` in `@/types` re-exportieren die hier abgeleiteten
 * `z.infer`-Typen, sodass Schema und Typ nicht driften koennen.
 *
 * **Strictness:** Default-`z.object` (NICHT `.strict()`) — unbekannte Keys
 * werden gestrippt, damit **additive** Server-Felder rueckwaertskompatibel
 * bleiben (kein Banner). Nur Rename/Remove/falscher Typ eines bekannten Feldes
 * faellt durch (`safeParse(...).success === false`). Diese Drift-Semantik ist
 * gewollt; `.strict()` wuerde sie umkehren.
 *
 * Importiert bewusst nichts aus `@/types` (kein Import-Zyklus — `types.ts`
 * importiert von hier). Die `z.enum`-Literale fuer `status`/`visibility` sind
 * eine bewusste lokale Kopie der Werte; ihre Unifizierung mit `RunStatus`/
 * `Visibility` ist C-C und expliziter Non-Goal dieser Change. Ein Compile-Guard
 * in `types.ts` sichert die Kopie gegen stille Drift ab.
 */
import { z } from "zod";

/** Lokale Kopie der `RunStatus`-Werte (vgl. `@/types`; Unifizierung = C-C, Non-Goal). */
const runStatusValues = ["pending", "running", "completed", "failed"] as const;
/** Lokale Kopie der `Visibility`-Werte (vgl. `@/types`; Unifizierung = C-C, Non-Goal). */
const visibilityValues = ["private", "global"] as const;

/** Client-sichere Projektion eines Laufs — Response von `GET`/`POST /api/runs`. */
export const runViewSchema = z.object({
  id: z.string(),
  personaId: z.string().nullable(),
  modelConfigId: z.string().nullable(),
  instrumentId: z.string(),
  repetitionCount: z.number(),
  status: z.enum(runStatusValues),
  promptTokens: z.number(),
  completionTokens: z.number(),
  failedCount: z.number(),
  completedReps: z.number(),
  visibility: z.enum(visibilityValues),
  isOwn: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  finishedAt: z.string().nullable(),
});

/** Liste sichtbarer Laeufe — Response von `GET /api/runs`. */
export const runViewArraySchema = z.array(runViewSchema);

/** Fortschritts-Antwort eines Orchestrierungs-Schritts — Response von `POST /api/runs/[id]/step`. */
export const runProgressSchema = z.object({
  status: z.enum(runStatusValues),
  completedReps: z.number(),
  totalReps: z.number(),
  failedCount: z.number(),
  promptTokens: z.number(),
  completionTokens: z.number(),
  lastRepDurationMs: z.number().nullable(),
  lastRepError: z.string().nullable(),
});

/** Aus dem Schema abgeleiteter Typ (Single Source) — re-exportiert von `@/types`. */
export type RunView = z.infer<typeof runViewSchema>;
/** Aus dem Schema abgeleiteter Typ (Single Source) — re-exportiert von `@/types`. */
export type RunProgress = z.infer<typeof runProgressSchema>;
