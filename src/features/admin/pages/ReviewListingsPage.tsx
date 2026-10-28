import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchIsAdmin } from "../../../lib/admin";
import { useAuthUser } from "../../../lib/auth";
import { errorMessage } from "../../../lib/errors";
import { useListingReview } from "../../../lib/features";
import { formatMileage, formatPrice, listingLocation, listingTitle, timeAgo } from "../../../lib/format";
import { coverUrl } from "../../../lib/images";
import { askRejectReason, reviewListing } from "../../../lib/review";
import { supabase } from "../../../lib/supabase";
import { ImageIcon } from "../../../components/icons";
import { PageHeader, PageMessage } from "../../../components/PageHeader";
import { ResizedImage } from "../../../components/ResizedImage";
import { usePageMeta } from "../../../hooks/usePageMeta";
import type { Listing, ReviewStatus } from "../../../types/car";

const TABS: Array<[ReviewStatus, string]> = [
  ["pending", "Waiting"],
  ["approved", "Approved"],
  ["rejected", "Rejected"],
];

function Cover({ listing }: { listing: Listing }) {
  const full = coverUrl(listing);
  const thumb = coverUrl(listing, 320);
  return (
    <div className="aspect-[4/3] w-32 shrink-0 overflow-hidden rounded-xl bg-surface-3 sm:w-40">
      {full && thumb ? (
        <ResizedImage src={thumb} fallback={full} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-subtle">
          <ImageIcon size={28} />
        </div>
      )}
    </div>
  );
}

/** Review queue for new and edited listings. RLS and the listings_review trigger let only admins decide. */
export function ReviewListingsPage() {
  usePageMeta({ title: "Review listings", noindex: true });
  const qc = useQueryClient();
  const [tab, setTab] = useState<ReviewStatus>("pending");
  const { data: user } = useAuthUser();
  const review = useListingReview();

  const { data: isAdmin, isLoading: adminLoading } = useQuery({
    queryKey: ["is-admin", user?.id ?? null],
    queryFn: () => fetchIsAdmin(user?.id ?? null),
    enabled: !!user,
    staleTime: 60_000,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["review-queue", tab],
    enabled: !!isAdmin && review,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*, listing_images(bucket, path, position)")
        .eq("status", tab)
        // Oldest first while waiting, newest decisions first after.
        .order(tab === "pending" ? "submitted_at" : "reviewed_at", { ascending: tab === "pending", nullsFirst: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Listing[];
    },
  });

  const decide = useMutation({
    mutationFn: async ({ listing, status }: { listing: Listing; status: "approved" | "rejected" }) => {
      const note = status === "rejected" ? askRejectReason() : null;
      if (status === "rejected" && note === null) return;
      await reviewListing(listing.id, status, note);
      await qc.invalidateQueries({ queryKey: ["review-queue"] });
      await qc.invalidateQueries({ queryKey: ["listing", listing.id] });
    },
  });

  if (adminLoading) return <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6"><PageMessage>Loading…</PageMessage></main>;
  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <PageMessage>Only admins can review listings.</PageMessage>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <PageHeader title="Review listings" subtitle="New and edited listings show in the marketplace once you approve them." />

      <div role="tablist" aria-label="Review status" className="mt-6 inline-flex rounded-xl border border-line bg-surface p-1">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
              tab === key ? "bg-accent text-accent-fg" : "text-muted hover:bg-surface-2 hover:text-fg"
            }`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {decide.isError ? (
        <p role="alert" className="mt-4 text-sm text-danger">{errorMessage(decide.error, "Couldn’t save the decision.")}</p>
      ) : null}

      {!review ? (
        <PageMessage>
          Listing review isn’t set up yet. Run <code>supabase/migrations/20261027000000_listing_review.sql</code> in the
          Supabase SQL editor.
        </PageMessage>
      ) : isLoading ? (
        <div className="mt-6 grid gap-3" aria-hidden="true">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="card h-36 animate-pulse bg-surface-2" />
          ))}
        </div>
      ) : error ? (
        <PageMessage tone="danger">{errorMessage(error, "Failed to load listings.")}</PageMessage>
      ) : !data?.length ? (
        <PageMessage>{tab === "pending" ? "Nothing waiting for review." : "Nothing here yet."}</PageMessage>
      ) : (
        <ul className="mt-6 grid gap-3">
          {data.map((l) => {
            const busy = decide.isPending && decide.variables?.listing.id === l.id;
            const place = listingLocation(l);
            return (
              <li key={l.id} className="card flex flex-wrap items-center gap-4 p-3 sm:flex-nowrap sm:p-4">
                <Link to={`/listings/${l.id}`} tabIndex={-1} aria-hidden="true">
                  <Cover listing={l} />
                </Link>

                <div className="min-w-0 flex-1">
                  <Link to={`/listings/${l.id}`} className="block truncate text-lg font-semibold hover:underline">
                    {listingTitle(l)}
                  </Link>
                  <p className="mt-1 text-sm text-muted">
                    <span className="font-semibold text-fg">{formatPrice(l.price)}</span>
                    <span aria-hidden="true" className="mx-2 text-line-strong">•</span>
                    {formatMileage(l.mileage)}
                    {place ? (
                      <>
                        <span aria-hidden="true" className="mx-2 text-line-strong">•</span>
                        {place}
                      </>
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs text-subtle">
                    {l.vin ? <span className="font-mono">{l.vin} · </span> : null}
                    {(l.listing_images ?? []).length} photo(s) · submitted {timeAgo(l.submitted_at ?? l.created_at).toLowerCase()} by{" "}
                    <Link to={`/sellers/${l.seller_id}`} className="text-link hover:underline">this seller</Link>
                    {l.is_active === false ? " · hidden by seller" : ""}
                  </p>
                  {l.status === "rejected" && l.review_note ? (
                    <p className="mt-1 text-xs text-danger">Reason: {l.review_note}</p>
                  ) : null}
                </div>

                <div className="flex shrink-0 gap-2">
                  {l.status !== "approved" ? (
                    <button type="button" className="btn-primary" disabled={busy} onClick={() => decide.mutate({ listing: l, status: "approved" })}>
                      Approve
                    </button>
                  ) : null}
                  {l.status !== "rejected" ? (
                    <button type="button" className="btn-secondary" disabled={busy} onClick={() => decide.mutate({ listing: l, status: "rejected" })}>
                      Reject
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
