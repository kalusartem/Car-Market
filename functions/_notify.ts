// POST /api/listings/notify — the browser calls it right after a seller submits or edits a listing, and it
// emails the admin that the listing is waiting for approval (same flow as HomeFinder). Runs as a Pages
// Function (functions/api/listings/notify.ts) and on the self-hosted server (server/index.ts).
//
// carmarket.claim_review_notification only returns the listing once per submission, and only to its seller,
// so the endpoint can't be replayed to send more mail. Without SMTP settings the notice is only logged.

import type { Listing } from "../src/types/car";
import { formatMileage, formatPrice, listingTitle } from "../src/lib/format";
import { supabaseConfig, type Env } from "./_lib";
import { sendMail, smtpConfigured, type Connect } from "./_mail";

const DEFAULT_NOTIFY_TO = "kalusartem@gmail.com";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ClaimedListing = Listing & { submitted_at: string | null };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });

export async function notifyListingReview(request: Request, env: Env, connect: Connect): Promise<Response> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const { id } = (await request.json().catch(() => ({}))) as { id?: unknown };
  if (!token || typeof id !== "string" || !UUID.test(id)) return json({ error: "Bad request" }, 400);

  const cfg = supabaseConfig(env);
  if (!cfg) return json({ error: "Not configured" }, 503);
  // Every call runs as the signed-in seller, so RLS and the claim function decide what they may touch.
  const asUser = { apikey: cfg.key, Authorization: `Bearer ${token}`, "Accept-Profile": "carmarket" };

  const claim = await fetch(`${cfg.url}/rest/v1/rpc/claim_review_notification`, {
    method: "POST",
    headers: { ...asUser, "Content-Profile": "carmarket", "Content-Type": "application/json" },
    body: JSON.stringify({ p_listing_id: id }),
  }).catch(() => null);
  if (!claim?.ok) return json({ error: "Not allowed" }, 403);
  const row = ((await claim.json()) as ClaimedListing[])[0];
  if (!row) return json({ ok: true, sent: false });

  if (!smtpConfigured(env)) {
    console.warn(`[notify] listing ${row.id} pending, logged only — SMTP not configured`);
    return json({ ok: true, sent: false });
  }

  const [user, photos] = await Promise.all([
    fetch(`${cfg.url}/auth/v1/user`, { headers: asUser })
      .then((r) => (r.ok ? (r.json() as Promise<{ email?: string }>) : null))
      .catch(() => null),
    fetch(`${cfg.url}/rest/v1/listing_images?listing_id=eq.${id}&select=id`, { headers: asUser })
      .then((r) => (r.ok ? (r.json() as Promise<unknown[]>) : []))
      .catch(() => []),
  ]);

  const origin = new URL(request.url).origin;
  const title = listingTitle(row);
  const place = row.city && row.state ? `${row.city}, ${row.state} ${row.zip_code ?? ""}`.trim() : row.zip_code;
  // A different subject for resubmits, so Gmail doesn't fold them into the original "new listing" thread.
  const edited =
    !!row.created_at && !!row.submitted_at && new Date(row.submitted_at).getTime() - new Date(row.created_at).getTime() > 60_000;
  try {
    await sendMail(env, connect, {
      to: env.NOTIFY_TO?.trim() || DEFAULT_NOTIFY_TO,
      subject: `Car Market: ${edited ? "updated listing" : "listing"} waiting for approval — ${title}`,
      text: [
        `A ${title} was ${edited ? "edited and resubmitted" : "submitted"} and is waiting for your approval.`,
        "",
        `${formatPrice(row.price)} · ${formatMileage(row.mileage)} · ${row.fuel_type} · ${row.transmission} · ${photos.length} photo(s)`,
        ...(row.vin ? [`VIN: ${row.vin}`] : []),
        ...(place ? [`Location: ${place}`] : []),
        `Submitted by: ${user?.email ?? row.seller_id}`,
        "",
        `Preview: ${origin}/listings/${row.id}`,
        `Approve or reject: ${origin}/admin`,
      ].join("\n"),
    });
    return json({ ok: true, sent: true });
  } catch (e) {
    console.error("[notify] email failed:", e);
    return json({ ok: true, sent: false });
  }
}
