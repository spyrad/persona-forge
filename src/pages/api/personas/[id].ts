import type { APIRoute } from "astro";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { json, jsonError, serviceErrorResponse } from "@/lib/api-responses";
import { deletePersona } from "@/lib/services/personas";

export const prerender = false;

const idSchema = z.uuid();

// Kein PUT: Personas sind unveraenderlich (FR-008). Eine Aenderung entsteht nur
// als Kopie via POST /api/personas/[id]/duplicate.

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
