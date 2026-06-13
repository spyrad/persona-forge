import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";

const signinSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
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

  const result = signinSchema.safeParse({
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
    return context.redirect(`/auth/signin?error=${encodeURIComponent("Supabase is not configured")}`);
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return context.redirect(`/auth/signin?error=${encodeURIComponent(error.message)}`);
  }

  return context.redirect("/dashboard");
};
