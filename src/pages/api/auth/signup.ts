import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { safeAuthError } from "@/lib/auth-errors";

export const prerender = false;

const signupSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export const POST: APIRoute = async (context) => {
  let form: FormData;
  try {
    form = await context.request.formData();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body — expected form data." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const result = signupSchema.safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });

  if (!result.success) {
    return new Response(JSON.stringify({ error: z.flattenError(result.error) }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { email, password } = result.data;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/signup?error=${encodeURIComponent("Supabase is not configured")}`);
  }
  const origin = new URL(context.request.url).origin;
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    const message = safeAuthError(error, "Could not create account.");
    return context.redirect(`/auth/signup?error=${encodeURIComponent(message)}`);
  }

  return context.redirect("/auth/confirm-email");
};
