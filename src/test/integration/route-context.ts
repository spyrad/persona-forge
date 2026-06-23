/**
 * Minimaler In-Process-`APIContext` für Route-Level-Tests.
 *
 * Die Route-Handler hängen nur an wenigen Context-Feldern (`request`, `cookies`,
 * `params`, `redirect`) und am virtuellen `astro:env/server` — letzteres ist in
 * der Integration-Config bereits auf einen process.env-Stub aliast. Damit lässt
 * sich ein Handler direkt importieren und in-process aufrufen, OHNE laufenden
 * Dev-Server und OHNE die schwerere Astro-Container-API (vom Plan als
 * In-Process-Fallback ausdrücklich erlaubt).
 */
import { createServerClient } from "@supabase/ssr";
import type { APIContext } from "astro";
import type { TestAccount } from "./accounts";

interface MockContextOpts {
  method?: string;
  url?: string;
  /** Roher Cookie-Header (für eine echte Session); fehlt → unauthentifiziert. */
  cookie?: string;
  json?: unknown;
  form?: FormData;
  params?: Record<string, string | undefined>;
}

export function makeApiContext(opts: MockContextOpts = {}): APIContext {
  const headers = new Headers();
  if (opts.cookie) headers.set("Cookie", opts.cookie);

  let body: BodyInit | undefined;
  if (opts.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(opts.json);
  } else if (opts.form) {
    body = opts.form;
  }

  const request = new Request(opts.url ?? "http://localhost/api/test", {
    method: opts.method ?? "GET",
    headers,
    body,
  });

  // Cookie-Store: createClient liest Cookies aus dem Request-Header (getAll),
  // `set` wird nur beim Session-Refresh aufgerufen — hier ein No-Op.
  const cookies = {
    get: () => undefined,
    getAll: () => [],
    has: () => false,
    set: () => {
      /* no-op: kein Session-Refresh im Test */
    },
    delete: () => {
      /* no-op */
    },
  };

  const context = {
    request,
    cookies,
    params: opts.params ?? {},
    url: new URL(request.url),
    redirect: (location: string, status?: number) =>
      new Response(null, { status: status ?? 302, headers: { Location: location } }),
  };
  return context as unknown as APIContext;
}

/**
 * Baut einen Cookie-Header mit der echten Session eines TestAccounts, sodass
 * `requireUser(context)` den User auflöst (`createClient` liest die Cookies aus
 * dem Request-`Cookie`-Header via `parseCookieHeader`, NICHT aus dem
 * cookies-Adapter). Die Cookies werden von `@supabase/ssr` selbst erzeugt — so
 * trifft das exakt erwartete, ggf. gechunkte Format. Damit lässt sich ein
 * auth-gated Handler (z. B. test-connection) authentifiziert in-process aufrufen.
 */
export async function authedCookieHeader(account: TestAccount): Promise<string> {
  const {
    data: { session },
  } = await account.client.auth.getSession();
  if (!session) throw new Error("authedCookieHeader: TestAccount hat keine Session");

  const requireEnv = (name: string): string => {
    const value = process.env[name];
    if (!value) throw new Error(`authedCookieHeader: ${name} fehlt (siehe setup.ts).`);
    return value;
  };

  const jar = new Map<string, string>();
  const ssr = createServerClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_KEY"), {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => jar.set(name, value));
      },
    },
  });
  await ssr.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });

  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}
