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
import type { APIContext } from "astro";

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
