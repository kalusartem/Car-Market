import type { Listing } from "../types/car";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatPrice(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? usd.format(n) : "—";
}

export function formatMileage(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toLocaleString("en-US")} mi` : "—";
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

export function timeAgo(value: string | null | undefined, now = Date.now()) {
  if (!value) return "";
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return "";
  const days = Math.floor((now - t) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mo ago`;
  return `${Math.floor(months / 12)} yr ago`;
}

export function listingTitle(l: Pick<Listing, "year" | "make" | "model" | "trim">) {
  return [l.year, l.make, l.model, l.trim].filter(Boolean).join(" ");
}

export function listingLocation(l: Pick<Listing, "city" | "state" | "zip_code">) {
  if (l.city && l.state) return `${l.city}, ${l.state}`;
  return l.zip_code ?? null;
}

export function sortedImages(l: Pick<Listing, "listing_images">) {
  return (l.listing_images ?? [])
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

/** Great-circle distance in miles. */
export function haversineMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const R = 3958.8;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function unslugify(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Escape a user string for use inside a PostgREST ilike pattern. */
export function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

/** Case-insensitive exact-name pattern that treats space and hyphen alike
 *  ("Mercedes Benz" matches "Mercedes-Benz"). */
export function nameLikePattern(name: string) {
  return escapeLike(name.trim()).replace(/[\s-]+/g, "_");
}
