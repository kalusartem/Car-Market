import { listingReviewEnabled } from "./features";
import { nameLikePattern } from "./format";
import type { Comp } from "./priceCheck";
import { supabase } from "./supabase";

export async function fetchComps(args: {
  make: string;
  model: string;
  year: number;
  excludeId?: string;
}): Promise<Comp[]> {
  const { make, model, year, excludeId } = args;
  let q = supabase
    .from("listings")
    .select("price, mileage, year")
    .eq("is_active", true)
    .ilike("make", nameLikePattern(make))
    .ilike("model", nameLikePattern(model))
    .gte("year", year - 2)
    .lte("year", year + 2)
    .limit(200);
  if (excludeId) q = q.neq("id", excludeId);
  if (await listingReviewEnabled()) q = q.eq("status", "approved");

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    price: Number(r.price),
    mileage: r.mileage == null ? null : Number(r.mileage),
    year: r.year == null ? null : Number(r.year),
  }));
}
