import type { APIRoute } from "astro";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { json, jsonError, serviceErrorResponse, validationError } from "@/lib/api-responses";
import { createPersona, listPersonas } from "@/lib/services/personas";

export const prerender = false;

const baseFields = {
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).default(""),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
};

/** §§1–4 Pflicht (mind. ein Eintrag), §5/§6 optional. */
const structuredFieldsSchema = z.object({
  coreThinking: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
  voice: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
  decisionFilters: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
  risks: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
  exampleDialog: z.string().trim().max(4000).optional(),
  usage: z.string().trim().max(2000).optional(),
});

// Diskriminiert ueber sourceKind: 'freeform' liefert den Prompt direkt,
// 'structured' liefert die Felder (Server kompiliert den Prompt).
const createSchema = z.discriminatedUnion("sourceKind", [
  z.object({ sourceKind: z.literal("freeform"), ...baseFields, systemPrompt: z.string().trim().min(1).max(20000) }),
  z.object({ sourceKind: z.literal("structured"), ...baseFields, structuredFields: structuredFieldsSchema }),
]);

/** Liste der sichtbaren Personas (eigene + globale). */
export const GET: APIRoute = async (context) => {
  const auth = await requireUser(context);
  if ("response" in auth) return auth.response;
  try {
    const personas = await listPersonas(auth.supabase, auth.userId);
    return json(personas);
  } catch (err) {
    return serviceErrorResponse("personas:list", err);
  }
};

/** Legt eine Persona an (Freitext). */
export const POST: APIRoute = async (context) => {
  const auth = await requireUser(context);
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonError("Invalid request body — expected JSON.", 400);
  }

  const result = createSchema.safeParse(body);
  if (!result.success) return validationError(result.error);

  try {
    const view = await createPersona(auth.supabase, auth.userId, result.data);
    return json(view, 201);
  } catch (err) {
    return serviceErrorResponse("personas:create", err);
  }
};
