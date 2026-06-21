import type { APIRoute } from "astro";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { json, jsonError, serviceErrorResponse, validationError } from "@/lib/api-responses";
import { deletePersona, updatePersonaVisibility } from "@/lib/services/personas";

export const prerender = false;

const idSchema = z.uuid();

const visibilitySchema = z.object({ visibility: z.enum(["private", "global"]) });

// Kein PUT/Inhalts-Edit: Persona-INHALT ist unveraenderlich (FR-008) — eine
// Aenderung entsteht nur als Kopie via POST /api/personas/[id]/duplicate.
// PATCH aendert ausschliesslich die Sichtbarkeit (Metadaten, S-07).
export const PATCH: APIRoute = async (context) => {
  const auth = await requireUser(context);
  if ("response" in auth) return auth.response;

  const id = idSchema.safeParse(context.params.id);
  if (!id.success) return jsonError("Invalid persona id.", 400);

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonError("Invalid request body — expected JSON.", 400);
  }

  const result = visibilitySchema.safeParse(body);
  if (!result.success) return validationError(result.error);

  try {
    const view = await updatePersonaVisibility(auth.supabase, auth.userId, id.data, result.data.visibility);
    if (!view) return jsonError("Persona not found.", 404);
    return json(view);
  } catch (err) {
    return serviceErrorResponse("personas:update-visibility", err);
  }
};

/** Loescht eine Persona (RLS: nur die eigene; globale/fremde id → 404). */
export const DELETE: APIRoute = async (context) => {
  const auth = await requireUser(context);
  if ("response" in auth) return auth.response;

  const id = idSchema.safeParse(context.params.id);
  if (!id.success) return jsonError("Invalid persona id.", 400);

  try {
    const deleted = await deletePersona(auth.supabase, id.data);
    if (!deleted) return jsonError("Persona not found.", 404);
    return json({ ok: true });
  } catch (err) {
    return serviceErrorResponse("personas:delete", err);
  }
};
