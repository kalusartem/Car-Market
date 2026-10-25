// Self-hosted server for Car Market: serves the built SPA from dist/ and runs the same
// SEO handlers as the Cloudflare Pages Functions in functions/ (listing and make/model
// pages, sitemap.xml, robots.txt). Plain Node, no runtime dependencies.
//
//   npm run build:all && npm start
//
// Environment:
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY   read at runtime for the SEO routes
//   SITE_URL   public origin, e.g. https://car-market.duckdns.org (used for canonical
//              URLs and the sitemap; recommended behind a reverse proxy)
//   PORT (8787), HOST (127.0.0.1), DIST_DIR (./dist)

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { onRequestGet as listingPage } from "../functions/listings/[id]";
import { onRequestGet as carsPage } from "../functions/cars/[[path]]";
import { onRequestGet as sitemap } from "../functions/sitemap.xml";
import { onRequestGet as robots } from "../functions/robots.txt";
import type { Ctx, Env } from "../functions/_lib";

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? "127.0.0.1";
const DIST = path.resolve(process.env.DIST_DIR ?? "dist");
const SITE_URL = process.env.SITE_URL?.replace(/\/$/, "");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".map": "application/json",
};

async function readStatic(urlPath: string): Promise<Response | null> {
  let rel: string;
  try {
    rel = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (rel.includes("\0")) return null;
  const file = path.join(DIST, path.normalize(rel));
  if (file !== DIST && !file.startsWith(DIST + path.sep)) return null; // no path traversal

  try {
    const target = (await stat(file)).isDirectory() ? path.join(file, "index.html") : file;
    const body = await readFile(target);
    const ext = path.extname(target).toLowerCase();
    const cache = target.includes(`${path.sep}assets${path.sep}`)
      ? "public, max-age=31536000, immutable" // Vite fingerprints everything under assets/
      : ext === ".html"
        ? "no-cache"
        : "public, max-age=3600";
    return new Response(body, {
      headers: { "content-type": MIME[ext] ?? "application/octet-stream", "cache-control": cache },
    });
  } catch {
    return null;
  }
}

const env: Env = {
  ASSETS: {
    async fetch(input) {
      const url = input instanceof Request ? new URL(input.url) : new URL(String(input));
      return (await readStatic(url.pathname)) ?? new Response("Not found", { status: 404 });
    },
  },
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
};

function originOf(req: IncomingMessage) {
  if (SITE_URL) return SITE_URL;
  const proto = String(req.headers["x-forwarded-proto"] ?? "http").split(",")[0];
  const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? `localhost:${PORT}`).split(",")[0];
  return `${proto}://${host}`;
}

async function route(req: IncomingMessage): Promise<Response> {
  const method = req.method ?? "GET";
  if (method !== "GET" && method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
  }

  const url = new URL(req.url ?? "/", originOf(req));
  const request = new Request(url, { method: "GET" });
  const ctx = (params: Ctx["params"] = {}): Ctx => ({ request, env, params });
  const p = url.pathname;

  if (p === "/healthz") return new Response("ok");
  if (p === "/robots.txt") return robots(ctx());
  if (p === "/sitemap.xml") return sitemap(ctx());

  const listing = /^\/listings\/([^/]+)\/?$/.exec(p);
  if (listing) return listingPage(ctx({ id: listing[1] }));

  const cars = /^\/cars\/(.+?)\/?$/.exec(p);
  if (cars) return carsPage(ctx({ path: cars[1].split("/") }));

  const asset = await readStatic(p);
  if (asset) return asset;
  // A missing file with an extension is a real 404; anything else is a client-side route.
  if (/\.[a-z0-9]+$/i.test(p)) return new Response("Not found", { status: 404 });
  return (await readStatic("/index.html")) ?? new Response("Build missing: run npm run build", { status: 500 });
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  try {
    const response = await route(req);
    const headers: Record<string, string> = { "x-content-type-options": "nosniff" };
    response.headers.forEach((value, key) => (headers[key] = value));
    res.writeHead(response.status, headers);
    if (req.method === "HEAD") res.end();
    else res.end(Buffer.from(await response.arrayBuffer()));
  } catch (err) {
    console.error(`${req.method} ${req.url}`, err);
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end("Internal server error");
  }
}

createServer((req, res) => void handle(req, res)).listen(PORT, HOST, () => {
  console.log(`Car Market listening on http://${HOST}:${PORT} (dist: ${DIST}${SITE_URL ? `, site: ${SITE_URL}` : ""})`);
});
