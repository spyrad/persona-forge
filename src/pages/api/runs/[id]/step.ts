import type { APIRoute } from "astro";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { json, jsonError, serviceErrorResponse } from "@/lib/api-responses";
import { processNextRepetition } from "@/lib/services/runs";

export const prerender = false;

const idSchema = z.uuid();

/**
 * Orchestrierungs-Schritt: verarbeitet GENAU EINE offene Wiederholung des Laufs
 * (client-getrieben — der Client ruft wiederholt, bis `status` terminal ist) und
 * liefert den Fortschritt. Lauf nicht sichtbar → 404.
 */
export const POST: APIRoute = async (context) => {
  const auth = await requireUser(context);
  if ("response" in auth) return auth.response;

  const id = idSchema.safeParse(context.params.id);
  if (!id.success) return jsonError("Invalid run id.", 400);

  try {
    const progress = await processNextRepetition(auth.supabase, auth.userId, id.data);
    if (!progress) return jsonError("Run not found.", 404);
    return json(progress);
  } catch (err) {
    return serviceErrorResponse("runs:step", err);
  }
};
