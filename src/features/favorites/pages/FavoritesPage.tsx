import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { errorMessage } from "../../../lib/errors";
import { PageHeader, PageMessage } from "../../../components/PageHeader";
import { ListingCard, ListingCardSkeleton } from "../../listings/components/ListingCard";
import type { Listing } from "../../../types/car";
import { useFavorites } from "../useFavorites";

type FavoriteRow = {
  id: string;
  listing_id: string;
  created_at: string;
  /** Null when the listing was deleted or hidden (RLS only returns active listings to others). */
  listings: Listing | null;
};

async function fetchFavorites() {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  if (!userRes?.user) throw new Error("You must be logged in to view favorites.");

  const { data, error } = await supabase
    .from("favorites")
    .select("id, listing_id, created_at, listings (*, listing_images ( bucket, path, position ))")
    .eq("user_id", userRes.user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as FavoriteRow[];
}

export function FavoritesPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["favorites"],
    queryFn: fetchFavorites,
    staleTime: 1000 * 20,
  });

  const rows = data ?? [];
  const available = rows.filter((f): f is FavoriteRow & { listings: Listing } => f.listings !== null);
  const unavailable = rows.length - available.length;
  const favorites = useFavorites(available.map((f) => f.listing_id));

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Saved cars"
        subtitle={rows.length ? `${available.length} saved ${available.length === 1 ? "car" : "cars"}` : "Cars you save show up here."}
        actions={
          <Link to="/listings" className="btn-secondary">
            Browse cars
          </Link>
        }
      />

      {isLoading ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <ListingCardSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <PageMessage tone="danger">{errorMessage(error, "Failed to load saved cars.")}</PageMessage>
      ) : available.length === 0 ? (
        <PageMessage>
          No saved cars yet.{" "}
          <Link to="/listings" className="font-semibold text-link hover:underline">
            Browse cars
          </Link>{" "}
          and tap the heart to save one.
        </PageMessage>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {available.map((f) => (
            <ListingCard
              key={f.id}
              listing={f.listings}
              saved={favorites.isSaved(f.listing_id)}
              onToggleSave={favorites.toggle}
            />
          ))}
        </div>
      )}

      {unavailable > 0 ? (
        <p className="mt-6 text-sm text-subtle">
          {unavailable} saved {unavailable === 1 ? "car is" : "cars are"} no longer for sale.
        </p>
      ) : null}
    </main>
  );
}
