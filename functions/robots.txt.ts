import type { Ctx } from "./_lib";

export const onRequestGet = ({ request }: Ctx) => {
  const origin = new URL(request.url).origin;
  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /login",
    "Disallow: /sell",
    "Disallow: /favorites",
    "Disallow: /messages",
    "Disallow: /account",
    "Disallow: /sellers/",
    "Disallow: /listings/*/edit",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
};
