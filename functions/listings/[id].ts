import type { Listing } from "../../src/types/car";
import { listingJsonLd, seoDescription, seoPlace, seoTitle, escapeHtml as a } from "../../src/lib/listingSeo";
import { loadShell, publicImageUrl, renderShell, rest, staticBody, type Ctx } from "../_lib";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const onRequestGet = async ({ request, params, env }: Ctx) => {
  const id = String(params.id);
  const origin = new URL(request.url).origin;
  const shell = await loadShell(env, request);
  if (!UUID.test(id)) return shell;

  const rows = await rest<Listing[]>(
    env,
    `listings?id=eq.${id}&select=*,listing_images(bucket,path,position)&limit=1`,
  );
  // null = lookup failed (outage, missing config): serve the app and let it handle it.
  if (rows === null) return shell;

  const canonical = `${origin}/listings/${id}`;
  const l = rows[0];
  if (!l) {
    return renderShell(
      shell,
      {
        title: "Listing not found | Car Market",
        description: "This listing may have been sold or removed.",
        canonical,
        noindex: true,
      },
      404,
    );
  }

  const images = (l.listing_images ?? [])
    .slice()
    .sort((x, y) => (x.position ?? 0) - (y.position ?? 0))
    .map((i) => publicImageUrl(env, i.bucket, i.path))
    .filter((u): u is string => !!u);

  const title = seoTitle(l);
  const price = Number(l.price);
  const place = seoPlace(l);
  const specs: Array<[string, string | null | undefined]> = [
    ["Mileage", l.mileage != null ? `${Number(l.mileage).toLocaleString("en-US")} mi` : null],
    ["Transmission", l.transmission],
    ["Fuel", l.fuel_type],
    ["Body type", l.body_type],
    ["Drivetrain", l.drivetrain],
    ["Exterior", l.exterior_color],
    ["VIN", l.vin],
  ];

  const bodyHtml = staticBody(
    `<h1>${a(title)}</h1>` +
      `<p>${Number.isFinite(price) ? `$${price.toLocaleString("en-US")}` : ""}${place ? ` · ${a(place)}` : ""}</p>` +
      (images[0] ? `<img src="${a(images[0])}" alt="${a(title)}" width="640" style="max-width:100%;height:auto">` : "") +
      `<ul>${specs
        .filter(([, v]) => v)
        .map(([k, v]) => `<li>${a(k)}: ${a(String(v))}</li>`)
        .join("")}</ul>` +
      (l.description ? `<p>${a(l.description)}</p>` : "") +
      `<p><a href="/listings">Browse all cars</a></p>`,
  );

  return renderShell(
    shell,
    {
      title: `${title} – ${Number.isFinite(price) ? `$${price.toLocaleString("en-US")}` : ""} | Car Market`,
      description: seoDescription(l),
      canonical,
      image: images[0] ?? null,
      jsonLd: listingJsonLd(l, canonical, images.slice(0, 5)),
      noindex: l.is_active === false,
      bodyHtml,
      ogType: "product",
    },
    200,
  );
};
