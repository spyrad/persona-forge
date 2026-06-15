import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { safeAuthError } from "@/lib/auth-errors";

export const prerender = false;

const CONFIRM_FAILED = "Email confirmation failed — please try signing in or request a new link.";

// E-Mail-Bestaetigung (PKCE): Supabase leitet nach dem Verify auf
// `${origin}/auth/callback?code=...` (origin via emailRedirectTo in signup.ts).
// Hier wird der Code gegen eine Session getauscht; der SSR-Client setzt die
// Auth-Cookies ueber den setAll-Adapter. Danach Redirect ins Dashboard.
export const GET: APIRoute = async (context) => {
  const params = context.url.searchParams;

  // Bei fehlgeschlagenem Verify haengt Supabase error/error_description an
  // (statt code) — zuerst pruefen, damit der echte Grund nicht stillschweigend
  // als "Missing confirmation code" verloren geht (F5). Rohtext nur loggen.
  const errorCode = params.get("error");
  const errorDescription = params.get("error_description");
  if (errorCode || errorDescription) {
    // eslint-disable-next-line no-console -- bewusstes serverseitiges Audit-Log
    console.error("[auth] callback provider error", errorCode, errorDescription);
    return context.redirect(`/auth/signin?error=${encodeURIComponent(CONFIRM_FAILED)}`);
  }

  const code = params.get("code");
  if (!code) {
    return context.redirect(`/auth/signin?error=${encodeURIComponent("Missing confirmation code")}`);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/signin?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const message = safeAuthError(error, CONFIRM_FAILED);
    return context.redirect(`/auth/signin?error=${encodeURIComponent(message)}`);
  }

  return context.redirect("/dashboard");
};
