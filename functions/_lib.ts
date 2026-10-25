// Shared helpers for the Cloudflare Pages Functions in this folder.
//
// The app is a client-rendered SPA, so crawlers (and link previews) that don't run
// JavaScript would see an empty page. These functions fetch the data for a few
// public routes at the edge and return the same index.html with real <title>,
// description, canonical, Open Graph, JSON-LD and a plain-HTML summary inside #root
// (React replaces it as soon as the app boots, so people see the normal UI).
//
// Runtime config (Cloudflare Pages → Settings → Variables): the same
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY used for the build are read here, or
// SUPABASE_URL / SUPABASE_ANON_KEY if you prefer separate names. If neither is set,
// every route falls back to the plain SPA shell.

import { escapeHtml } from "../src/lib/listingSeo";

export interface Env {
  ASSETS: { fetch(input: Request | string | URL): Promise<Response> };
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

export interface Ctx {
  request: Request;
  env: Env;
  params: Record<string, string | string[]>;
}

export function supabaseConfig(env: Env) {
  const url = (env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
  const key = env.SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY ?? "";
  return url && key ? { url, key } : null;
}

/** Query the `carmarket` schema through PostgREST. Returns null on any failure. */
export async function rest<T>(
  env: Env,
  path: string,
  opts: { range?: [number, number] } = {},
): Promise<T | null> {
  const cfg = supabaseConfig(env);
  if (!cfg) return null;
  try {
    const headers: Record<string, string> = {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      "Accept-Profile": "carmarket",
    };
    if (opts.range) {
      headers.Range = `${opts.range[0]}-${opts.range[1]}`;
      headers["Range-Unit"] = "items";
    }
    const res = await fetch(`${cfg.url}/rest/v1/${path}`, { headers });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function publicImageUrl(env: Env, bucket: string, path: string) {
  const cfg = supabaseConfig(env);
  if (!cfg) return null;
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${cfg.url}/storage/v1/object/public/${bucket}/${encoded}`;
}

export function loadShell(env: Env, request: Request) {
  return env.ASSETS.fetch(new URL("/", request.url));
}

export interface PageMeta {
  title: string;
  description: string;
  canonical: string;
  image?: string | null;
  jsonLd?: Record<string, unknown> | null;
  noindex?: boolean;
  /** Trusted, already-escaped HTML placed inside #root for non-JS crawlers. */
  bodyHtml?: string;
  ogType?: string;
}

const a = escapeHtml;

export function renderShell(shell: Response, meta: PageMeta, status = 200) {
  const tags = [
    `<meta name="description" content="${a(meta.description)}">`,
    `<link rel="canonical" href="${a(meta.canonical)}">`,
    meta.noindex ? `<meta name="robots" content="noindex">` : "",
    `<meta property="og:site_name" content="Car Market">`,
    `<meta property="og:type" content="${a(meta.ogType ?? "website")}">`,
    `<meta property="og:title" content="${a(meta.title)}">`,
    `<meta property="og:description" content="${a(meta.description)}">`,
    `<meta property="og:url" content="${a(meta.canonical)}">`,
    meta.image ? `<meta property="og:image" content="${a(meta.image)}">` : "",
    `<meta name="twitter:card" content="${meta.image ? "summary_large_image" : "summary"}">`,
    // "<" is escaped so listing text can never close the script element.
    meta.jsonLd
      ? `<script type="application/ld+json">${JSON.stringify(meta.jsonLd).replace(/</g, "\\u003c")}</script>`
      : "",
  ].join("\n");

  return new HTMLRewriter()
    .on("title", { element: (el) => void el.setInnerContent(meta.title) })
    .on('meta[name="description"]', { element: (el) => void el.remove() })
    .on('meta[property^="og:"]', { element: (el) => void el.remove() })
    .on('meta[name="twitter:card"]', { element: (el) => void el.remove() })
    .on("head", { element: (el) => void el.append(tags, { html: true }) })
    .on("div#root", {
      element: (el) => {
        if (meta.bodyHtml) el.setInnerContent(meta.bodyHtml, { html: true });
      },
    })
    .transform(
      new Response(shell.body, {
        status,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "public, max-age=60, s-maxage=300",
        },
      }),
    );
}

export const staticBody = (inner: string) =>
  `<main style="max-width:48rem;margin:0 auto;padding:1.5rem 1rem;font-family:system-ui,sans-serif;line-height:1.5">${inner}</main>`;
