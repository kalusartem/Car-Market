import { slugify } from "../src/lib/format";
import { escapeHtml as x } from "../src/lib/listingSeo";
import { rest, type Ctx } from "./_lib";

type Row = { id: string; make: string; model: string; created_at: string | null };

const PAGE = 1000; // PostgREST's default max rows per request
const MAX_PAGES = 20; // up to 20,000 listings; split into a sitemap index beyond that

export const onRequestGet = async ({ request, env }: Ctx) => {
  const origin = new URL(request.url).origin;

  const rows: Row[] = [];
  for (let i = 0; i < MAX_PAGES; i++) {
    const page = await rest<Row[]>(
      env,
      "listings?is_active=eq.true&select=id,make,model,created_at&order=created_at.desc",
      { range: [i * PAGE, i * PAGE + PAGE - 1] },
    );
    if (!page) break;
    rows.push(...page);
    if (page.length < PAGE) break;
  }

  const urls: Array<{ loc: string; lastmod?: string }> = [
    { loc: `${origin}/` },
    { loc: `${origin}/listings` },
    { loc: `${origin}/price-check` },
  ];

  const seenMake = new Set<string>();
  const seenModel = new Set<string>();
  for (const r of rows) {
    const make = slugify(r.make);
    const model = slugify(r.model);
    if (make && !seenMake.has(make)) {
      seenMake.add(make);
      urls.push({ loc: `${origin}/cars/${make}` });
    }
    if (make && model && !seenModel.has(`${make}/${model}`)) {
      seenModel.add(`${make}/${model}`);
      urls.push({ loc: `${origin}/cars/${make}/${model}` });
    }
  }
  for (const r of rows) {
    urls.push({ loc: `${origin}/listings/${r.id}`, lastmod: r.created_at?.slice(0, 10) });
  }

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map((u) => `<url><loc>${x(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`)
      .join("\n") +
    `\n</urlset>\n`;

  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
};
