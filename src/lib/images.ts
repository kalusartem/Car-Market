import type { Listing } from "../types/car";
import { sortedImages } from "./format";
import { supabase } from "./supabase";

export function imageUrl(bucket: string, path: string) {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export function coverUrl(l: Pick<Listing, "listing_images">) {
  const first = sortedImages(l)[0];
  return first ? imageUrl(first.bucket, first.path) : null;
}
