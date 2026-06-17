import type { APIRoute } from "astro";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { json, jsonError, serviceErrorResponse, validationError } from "@/lib/api-responses";
import { createPersona, listPersonas } from "@/lib/services/personas";

export const prerender = false;

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).default(""),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  systemPrompt: z.string().trim().min(1).max(20000),
});

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
