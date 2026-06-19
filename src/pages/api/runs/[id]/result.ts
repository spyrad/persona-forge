import type { APIRoute } from "astro";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { json, jsonError, serviceErrorResponse } from "@/lib/api-responses";
import { getRunResult } from "@/lib/services/runs";

export const prerender = false;

const idSchema = z.uuid();

/**
 * Liefert das aggregierte Ergebnis eines Laufs (Verteilung je Achse + Typ-Stabilitaet,
 * on-the-fly aus den Rohantworten berechnet). RLS-gescoped — nicht sichtbar → 404.
 */
export const GET: APIRoute = async (context) => {
  const auth = await requireUser(context);
  if ("response" in auth) return auth.response;

  const id = idSchema.safeParse(context.params.id);
  if (!id.success) return jsonError("Invalid run id.", 400);

  try {
    const result = await getRunResult(auth.supabase, auth.userId, id.data);
    if (!result) return jsonError("Run not found.", 404);
    return json(result);
  } catch (err) {
    return serviceErrorResponse("runs:result", err);
  }
};
