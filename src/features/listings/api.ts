import { listingReviewEnabled } from "../../lib/features";
import { geocodeZip } from "../../lib/location";
import { haversineMiles, nameLikePattern } from "../../lib/format";
import { supabase } from "../../lib/supabase";
import type { Listing } from "../../types/car";
import type { Filters, SortKey } from "./filters";

export const PAGE_SIZE = 24;
/** Radius search pulls candidates inside a bounding box and ranks them here. */
const RADIUS_CANDIDATE_CAP = 500;

/** Sellers and admins can also read pending / rejected listings; the marketplace shows approved ones only. */
const baseQuery = (reviewed: boolean) => {
  const q = supabase
    .from("listings")
    .select("*, listing_images(bucket, path, position)", { count: "exact" })
    .eq("is_active", true);
  return reviewed ? q.eq("status", "approved") : q;
};

type ListingQuery = ReturnType<typeof baseQuery>;

/** Strip characters that have meaning inside a PostgREST `or(...)` filter value. */
function searchWord(word: string) {
  return word.replace(/[,()*%_\\]/g, "").trim();
}

function applyFilters(q: ListingQuery, f: Filters, extended: boolean): ListingQuery {
  for (const raw of f.q.split(/\s+/)) {
    const w = searchWord(raw);
    if (!w) continue;
    const cols = extended ? ["make", "model", "trim"] : ["make", "model"];
    q = q.or(cols.map((c) => `${c}.ilike.%${w}%`).join(","));
  }
  if (f.make) q = q.ilike("make", nameLikePattern(f.make));
  if (f.model) q = q.ilike("model", nameLikePattern(f.model));
  if (f.yearMin !== null) q = q.gte("year", f.yearMin);
  if (f.yearMax !== null) q = q.lte("year", f.yearMax);
  if (f.priceMin !== null) q = q.gte("price", f.priceMin);
  if (f.priceMax !== null) q = q.lte("price", f.priceMax);
  if (f.mileageMax !== null) q = q.lte("mileage", f.mileageMax);
  if (f.fuel.length) q = q.in("fuel_type", f.fuel);
  if (f.transmission.length) q = q.in("transmission", f.transmission);
  if (extended) {
    if (f.bodyType.length) q = q.in("body_type", f.bodyType);
    if (f.drivetrain.length) q = q.in("drivetrain", f.drivetrain);
  }
  return q;
}

function applySort(q: ListingQuery, sort: SortKey): ListingQuery {
  switch (sort) {
    case "price_asc":
      return q.order("price", { ascending: true });
    case "price_desc":
      return q.order("price", { ascending: false });
    case "mileage_asc":
      return q.order("mileage", { ascending: true, nullsFirst: false });
    case "year_desc":
      return q.order("year", { ascending: false, nullsFirst: false }).order("price");
    default:
      return q.order("created_at", { ascending: false });
  }
}

export interface ListingsResult {
  rows: Listing[];
  count: number;
  /** Miles from the searched ZIP, keyed by listing id (radius searches only). */
  distances: Record<string, number>;
  /** The ZIP could not be located, so the radius was ignored. */
  zipNotFound: boolean;
}

export async function fetchListings(
  f: Filters,
  extended: boolean,
): Promise<ListingsResult> {
  let zipNotFound = false;
  const reviewed = await listingReviewEnabled();

  if (f.zip && f.radius > 0) {
    const origin = await geocodeZip(f.zip);
    if (!origin) {
      zipNotFound = true;
    } else {
      const dLat = f.radius / 69;
      const dLng = f.radius / (69 * Math.max(0.1, Math.cos((origin.lat * Math.PI) / 180)));

      const q = applyFilters(baseQuery(reviewed), f, extended)
        .gte("lat", origin.lat - dLat)
        .lte("lat", origin.lat + dLat)
        .gte("lng", origin.lng - dLng)
        .lte("lng", origin.lng + dLng)
        .limit(RADIUS_CANDIDATE_CAP);
      const { data, error } = await q;
      if (error) throw error;

      const distances: Record<string, number> = {};
      const within = ((data ?? []) as Listing[]).filter((l) => {
        if (l.lat == null || l.lng == null) return false;
        const d = haversineMiles(origin, { lat: l.lat, lng: l.lng });
        distances[l.id] = d;
        return d <= f.radius;
      });

      const by: Record<SortKey, (a: Listing, b: Listing) => number> = {
        newest: (a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""),
        price_asc: (a, b) => Number(a.price) - Number(b.price),
        price_desc: (a, b) => Number(b.price) - Number(a.price),
        mileage_asc: (a, b) => (a.mileage ?? Infinity) - (b.mileage ?? Infinity),
        year_desc: (a, b) => (b.year ?? 0) - (a.year ?? 0),
        distance: (a, b) => distances[a.id] - distances[b.id],
      };
      within.sort(by[f.sort]);

      const start = (f.page - 1) * PAGE_SIZE;
      return {
        rows: within.slice(start, start + PAGE_SIZE),
        count: within.length,
        distances,
        zipNotFound,
      };
    }
  }

  const from = (f.page - 1) * PAGE_SIZE;
  const sort = f.sort === "distance" ? "newest" : f.sort;
  const { data, error, count } = await applySort(applyFilters(baseQuery(reviewed), f, extended), sort).range(
    from,
    from + PAGE_SIZE - 1,
  );
  if (error) throw error;
  return { rows: (data ?? []) as Listing[], count: count ?? 0, distances: {}, zipNotFound };
}

export async function fetchLatest(limit: number, featuredOnly: boolean): Promise<Listing[]> {
  let q = supabase
    .from("listings")
    .select("*, listing_images(bucket, path, position)")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (featuredOnly) q = q.eq("is_featured", true);
  if (await listingReviewEnabled()) q = q.eq("status", "approved");
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Listing[];
}

/** Number of active listings (head-only count, no rows). */
export async function fetchActiveCount(): Promise<number> {
  let q = supabase.from("listings").select("id", { count: "exact", head: true }).eq("is_active", true);
  if (await listingReviewEnabled()) q = q.eq("status", "approved");
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

export async function fetchSimilar(l: Listing, limit = 4): Promise<Listing[]> {
  // Same make first; pad with the same price band if there aren't enough.
  const reviewed = await listingReviewEnabled();
  const active = () => {
    const q = supabase.from("listings").select("*, listing_images(bucket, path, position)").eq("is_active", true);
    return reviewed ? q.eq("status", "approved") : q;
  };
  const { data: sameMake } = await active()
    .ilike("make", nameLikePattern(l.make))
    .neq("id", l.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  const picked = (sameMake ?? []) as Listing[];
  if (picked.length >= limit) return picked;

  const price = Number(l.price);
  if (!Number.isFinite(price)) return picked;
  const { data: nearby } = await active()
    .gte("price", price * 0.75)
    .lte("price", price * 1.25)
    .neq("id", l.id)
    .limit(limit * 2);
  const have = new Set(picked.map((p) => p.id));
  for (const n of (nearby ?? []) as Listing[]) {
    if (picked.length >= limit) break;
    if (!have.has(n.id)) picked.push(n);
  }
  return picked;
}
