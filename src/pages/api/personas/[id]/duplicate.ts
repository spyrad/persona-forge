import type { APIRoute } from "astro";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { json, jsonError, serviceErrorResponse } from "@/lib/api-responses";
import { duplicatePersona } from "@/lib/services/personas";

export const prerender = false;

const idSchema = z.uuid();

/**
 * Kopiert eine sichtbare Persona (eigene oder globale) in eine neue, eigene,
 * private Zeile „… (Kopie)". Explizite, benannte Operation statt PUT
 * (Immutabilitaet, FR-008). 404, wenn die Quelle nicht sichtbar ist.
 */
export const POST: APIRoute = async (context) => {
  const auth = await requireUser(context);
  if ("response" in auth) return auth.response;

  const id = idSchema.safeParse(context.params.id);
  if (!id.success) return jsonError("Invalid persona id.", 400);

  try {
    const view = await duplicatePersona(auth.supabase, auth.userId, id.data);
    if (!view) return jsonError("Persona not found.", 404);
    return json(view, 201);
  } catch (err) {
    return serviceErrorResponse("personas:duplicate", err);
  }
};
