import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const prerender = false;

// E-Mail-Bestaetigung (PKCE): Supabase leitet nach dem Verify auf
// `${origin}/auth/callback?code=...` (origin via emailRedirectTo in signup.ts).
// Hier wird der Code gegen eine Session getauscht; der SSR-Client setzt die
// Auth-Cookies ueber den setAll-Adapter. Danach Redirect ins Dashboard.
export const GET: APIRoute = async (context) => {
  const code = context.url.searchParams.get("code");

  if (!code) {
    return context.redirect(`/auth/signin?error=${encodeURIComponent("Missing confirmation code")}`);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/signin?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return context.redirect(`/auth/signin?error=${encodeURIComponent(error.message)}`);
  }

  return context.redirect("/dashboard");
};
