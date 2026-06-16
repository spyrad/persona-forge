/**
 * Auth-Gate fuer JSON-API-Routes.
 *
 * Die Middleware loest `context.locals.user` NUR fuer PROTECTED_ROUTES auf und
 * redirectet Unauthentifizierte — fuer `fetch`-basierte API-Routes ungeeignet.
 * Darum resolven die Model-API-Routes den User selbst und antworten mit
 * 401-JSON statt Redirect. RLS bleibt zusaetzlich Defense-in-depth.
 */
import type { APIContext } from "astro";
import { createClient } from "@/lib/supabase";
import { jsonError } from "@/lib/api-responses";

type SupabaseClient = NonNullable<ReturnType<typeof createClient>>;

type RequireUserResult = { supabase: SupabaseClient; userId: string } | { response: Response };

/**
 * Liefert den authentifizierten Supabase-Client + User-ID — oder eine fertige
 * Fehler-Response (503 ohne Config, 401 ohne Session), die die Route direkt
 * zurueckgibt.
 */
export async function requireUser(context: APIContext): Promise<RequireUserResult> {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return { response: jsonError("Service unavailable.", 503) };
  }
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { response: jsonError("Unauthorized.", 401) };
    }
    return { supabase, userId: user.id };
  } catch (err) {
    // eslint-disable-next-line no-console -- bewusstes serverseitiges Audit-Log
    console.error("[api:auth] getUser failed", err);
    return { response: jsonError("Service unavailable.", 503) };
  }
}
