// Best-effort per-IP rate limit for the Pages Functions, kept in the edge cache (caches.default) so it needs no
// KV/Durable Object binding: a fixed window counter per IP, stored as "count.windowEnd" under a synthetic URL on
// the site's own host. The cache is per data centre and may evict entries early, so this slows down abuse rather
// than guaranteeing a hard cap. Where the Cache API is missing (the Node server in server/, tests) it's a no-op.

export interface Limit {
  /** Key prefix, e.g. "contact". */
  name: string;
  /** Allowed hits per window. */
  max: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

/** The subset of the Workers Cache API used here. */
export interface EdgeCache {
  match(url: string): Promise<Response | undefined>;
  put(url: string, response: Response): Promise<void>;
}

export function edgeCache(): EdgeCache | null {
  try {
    const c = (globalThis as { caches?: { default?: EdgeCache } }).caches;
    return c?.default ?? null;
  } catch {
    return null;
  }
}

const keyUrl = (request: Request, name: string, ip: string) =>
  new URL(`/__ratelimit/${name}/${encodeURIComponent(ip)}`, request.url).toString();

async function read(cache: EdgeCache, url: string, now: number, windowMs: number) {
  let raw = "";
  try {
    raw = (await (await cache.match(url))?.text()) ?? "";
  } catch {
    /* treat as empty */
  }
  const [n, end] = raw.split(".").map(Number);
  return end > now ? { n: n || 0, end } : { n: 0, end: now + windowMs };
}

/**
 * Counts one hit for the caller's IP (CF-Connecting-IP) and says whether it's within the limit. Hits over the
 * limit aren't counted and a hit never moves the window's end. Always allows when there is no IP or no cache.
 */
export async function hitRateLimit(
  request: Request,
  limit: Limit,
  { cache = edgeCache(), now = Date.now() }: { cache?: EdgeCache | null; now?: number } = {},
): Promise<{ ok: boolean; retryAfter: number }> {
  const ip = request.headers.get("cf-connecting-ip")?.trim();
  if (!cache || !ip) return { ok: true, retryAfter: 0 };
  const url = keyUrl(request, limit.name, ip);
  const c = await read(cache, url, now, limit.windowMs);
  const retryAfter = Math.max(1, Math.ceil((c.end - now) / 1000));
  if (c.n >= limit.max) return { ok: false, retryAfter };
  try {
    await cache.put(url, new Response(`${c.n + 1}.${c.end}`, { headers: { "cache-control": `max-age=${retryAfter}` } }));
  } catch {
    /* best effort */
  }
  return { ok: true, retryAfter };
}
