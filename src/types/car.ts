export interface ListingImage {
  bucket: string;
  path: string;
  position: number;
}

/** A row from carmarket.listings (+ joined images). Spec columns after `transmission`
 *  come from supabase/migrations/20261025000000_listing_specs.sql and may be absent. */
export interface Listing {
  id: string;
  seller_id: string;
  make: string;
  model: string;
  year: number | null;
  price: number | string;
  mileage: number | null;
  fuel_type: string | null;
  transmission: string | null;
  description: string | null;
  is_active: boolean | null;
  is_featured?: boolean | null;
  created_at: string | null;
  zip_code?: string | null;
  lat?: number | null;
  lng?: number | null;

  vin?: string | null;
  trim?: string | null;
  body_type?: string | null;
  drivetrain?: string | null;
  exterior_color?: string | null;
  title_status?: string | null;
  city?: string | null;
  state?: string | null;

  // From supabase/migrations/20261027000000_listing_review.sql; absent before it's applied.
  status?: ReviewStatus | null;
  review_note?: string | null;
  reviewed_at?: string | null;
  submitted_at?: string | null;

  listing_images?: ListingImage[] | null;
}

export type ReviewStatus = "pending" | "approved" | "rejected";
