import type { Listing } from "../types/car";
import { sortedImages } from "./format";
import { supabase } from "./supabase";

/**
 * Public URL for a stored image. Pass `width` to get a resized copy from Supabase image
 * transformations (served as WebP to browsers that accept it); omit it for the original.
 */
export function imageUrl(bucket: string, path: string, width?: number) {
  const options = width ? { transform: { width, quality: 75 } } : undefined;
  return supabase.storage.from(bucket).getPublicUrl(path, options).data.publicUrl;
}

export function coverUrl(l: Pick<Listing, "listing_images">, width?: number) {
  const first = sortedImages(l)[0];
  return first ? imageUrl(first.bucket, first.path, width) : null;
}
