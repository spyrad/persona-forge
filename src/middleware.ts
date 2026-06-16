import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";

const PROTECTED_ROUTES = ["/dashboard", "/models"];

export const onRequest = defineMiddleware(async (context, next) => {
  const isProtected = PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route));

  // Oeffentliche Routen brauchen keinen Auth-Roundtrip: user bleibt null,
  // kein Supabase-Netzwerkaufruf fuer /, /auth/* oder statische Assets.
  if (!isProtected) {
    context.locals.user = null;
    return next();
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (supabase) {
    // getUser() ist ein externer Netzwerk-Call — bei Supabase-Ausfall nicht den
    // Request mit 500 abbrechen, sondern user=null lassen und unten sauber auf
    // /auth/signin redirecten (F4).
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      context.locals.user = user ?? null;
    } catch (err) {
      // eslint-disable-next-line no-console -- bewusstes serverseitiges Audit-Log
      console.error("[auth] middleware getUser failed", err);
      context.locals.user = null;
    }
  } else {
    context.locals.user = null;
  }

  if (!context.locals.user) {
    return context.redirect("/auth/signin");
  }

  return next();
});
