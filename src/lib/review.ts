import { supabase } from "./supabase";
import type { ReviewStatus } from "../types/car";

/** Lets the admin know a listing is waiting for approval (POST /api/listings/notify, see functions/_notify.ts).
 *  Fire-and-forget: the listing is saved either way, and the server sends at most one email per submission. */
export async function requestReviewEmail(listingId: string) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return;
  fetch("/api/listings/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ id: listingId }),
    keepalive: true,
  }).catch(() => {});
}

/** Admin only (the listings_review trigger ignores status changes from anyone else). */
export async function reviewListing(id: string, status: Exclude<ReviewStatus, "pending">, note?: string | null) {
  const { data, error } = await supabase
    .from("listings")
    .update({ status, review_note: note?.trim() || null, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .select("status");
  if (error) throw error;
  if (data?.[0]?.status !== status) throw new Error("Only admins can review listings.");
}

/** Asks for a rejection reason; null means the admin cancelled. */
export function askRejectReason() {
  return window.prompt("Why is this listing rejected? The seller sees this note.");
}
