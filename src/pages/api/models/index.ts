import type { APIRoute } from "astro";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { json, jsonError, serviceErrorResponse, validationError } from "@/lib/api-responses";
import { isPublicHttpsUrl } from "@/lib/url-guard";
import { createModelConfig, listModelConfigs } from "@/lib/services/model-configs";

export const prerender = false;

const createSchema = z.object({
  label: z.string().trim().min(1).max(120),
  baseUrl: z.url().refine(isPublicHttpsUrl, { message: "base_url must be a public https URL." }),
  modelName: z.string().trim().min(1).max(200),
  apiKey: z.string().min(1).max(512),
});

/** Liste der eigenen Konfigs (ohne Key-Material). */
export const GET: APIRoute = async (context) => {
  const auth = await requireUser(context);
  if ("response" in auth) return auth.response;
  try {
    const configs = await listModelConfigs(auth.supabase);
    return json(configs);
  } catch (err) {
    return serviceErrorResponse("models:list", err);
  }
};

/** Legt eine Konfig an; Response enthaelt nie den Key. */
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
    const view = await createModelConfig(auth.supabase, result.data);
    return json(view, 201);
  } catch (err) {
    return serviceErrorResponse("models:create", err);
  }
};
