import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { usePageMeta } from "../../../hooks/usePageMeta";
import { listingReviewEnabled } from "../../../lib/features";
import { formatDate } from "../../../lib/format";
import { supabase } from "../../../lib/supabase";
import type { Listing } from "../../../types/car";
import { UserIcon } from "../../../components/icons";
import { useFavorites } from "../../favorites/useFavorites";
import { ListingCard } from "../components/ListingCard";

export function SellerPage() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["seller", id],
    enabled: !!id,
    queryFn: async () => {
      let q = supabase
        .from("listings")
        .select("*, listing_images(bucket, path, position)")
        .eq("seller_id", id!)
        .eq("is_active", true);
      if (await listingReviewEnabled()) q = q.eq("status", "approved");
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Listing[];
    },
  });

  const rows = data ?? [];
  const favorites = useFavorites(rows.map((r) => r.id));
  const since = rows.length ? rows[rows.length - 1].created_at : null;

  usePageMeta({ title: "Private seller", noindex: true });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex items-center gap-4">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-surface-3 text-muted">
          <UserIcon size={28} />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Private seller</h1>
          <p className="text-sm text-subtle">
            {isLoading
              ? "Loading…"
              : `${rows.length} active ${rows.length === 1 ? "listing" : "listings"}${since ? ` · listing since ${formatDate(since)}` : ""}`}
          </p>
        </div>
      </div>

      {isError ? (
        <p role="alert" className="mt-6 text-danger">Couldn’t load this seller’s cars.</p>
      ) : rows.length === 0 && !isLoading ? (
        <div className="card mt-6 p-10 text-center text-muted">
          This seller has no active listings. <Link to="/listings" className="text-link underline">Browse all cars</Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((l) => (
            <ListingCard key={l.id} listing={l} saved={favorites.isSaved(l.id)} onToggleSave={favorites.toggle} />
          ))}
        </div>
      )}
    </div>
  );
}
