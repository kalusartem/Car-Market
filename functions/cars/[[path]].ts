import { nameLikePattern, slugify, unslugify } from "../../src/lib/format";
import { escapeHtml as a } from "../../src/lib/listingSeo";
import { loadShell, renderShell, rest, staticBody, type Ctx } from "../_lib";

type Row = { id: string; make: string; model: string; year: number | null; price: number | string; mileage: number | null };

// /cars/:make and /cars/:make/:model — crawlable landing pages with a list of cars.
export const onRequestGet = async ({ request, params, env }: Ctx) => {
  const origin = new URL(request.url).origin;
  const shell = await loadShell(env, request);

  const parts = (Array.isArray(params.path) ? params.path : [params.path]).filter(Boolean) as string[];
  if (parts.length < 1 || parts.length > 2 || parts.some((p) => !/^[a-z0-9-]+$/i.test(p))) return shell;
  const [makeSlug, modelSlug] = parts;

  const filters =
    `make=ilike.${encodeURIComponent(nameLikePattern(unslugify(makeSlug)))}` +
    (modelSlug ? `&model=ilike.${encodeURIComponent(nameLikePattern(unslugify(modelSlug)))}` : "");
  const rows = await rest<Row[]>(
    env,
    `listings?is_active=eq.true&${filters}&select=id,make,model,year,price,mileage&order=created_at.desc&limit=24`,
  );
  if (rows === null) return shell;

  // Prefer the real casing from the data ("Mercedes-Benz") over the unslugified URL.
  const make = rows[0]?.make ?? unslugify(makeSlug);
  const model = modelSlug ? (rows[0]?.model ?? unslugify(modelSlug)) : "";
  const name = [make, model].filter(Boolean).join(" ");
  const canonical = `${origin}/cars/${slugify(make)}${model ? `/${slugify(model)}` : ""}`;

  const items = rows
    .map((r) => {
      const label = [r.year, r.make, r.model].filter(Boolean).join(" ");
      const price = Number(r.price);
      return `<li><a href="/listings/${a(r.id)}">${a(label)}</a>${Number.isFinite(price) ? ` – $${price.toLocaleString("en-US")}` : ""}</li>`;
    })
    .join("");

  return renderShell(shell, {
    title: `Used ${name} for sale | Car Market`,
    description: rows.length
      ? `${rows.length === 1 ? "1 used" : `${rows.length}${rows.length === 24 ? "+" : ""} used`} ${name} ${rows.length === 1 ? "listing" : "listings"} from private sellers. Compare prices, mileage and photos on Car Market.`
      : `Browse used ${name} listings from private sellers on Car Market.`,
    canonical,
    noindex: rows.length === 0,
    bodyHtml: staticBody(
      `<h1>Used ${a(name)} for sale</h1>${items ? `<ul>${items}</ul>` : "<p>No listings right now.</p>"}<p><a href="/listings">Browse all cars</a></p>`,
    ),
  });
};
