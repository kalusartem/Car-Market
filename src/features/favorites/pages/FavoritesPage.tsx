// src/features/favorites/pages/FavoritesPage.tsx
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { errorMessage } from "../../../lib/errors";

type ListingImage = {
  bucket: string;
  path: string;
  position: number;
};

type ListingRow = {
  id: string;
  make: string;
  model: string;
  year: number | null;
  price: number | string;
  mileage: number | null;
  created_at: string | null;
  listing_images?: ListingImage[] | null;
};

type FavoriteRow = {
  id: string;
  listing_id: string;
  created_at: string;
  listings: ListingRow;
};

function publicUrl(bucket: string, path: string) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

async function fetchFavorites() {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  if (!userRes?.user)
    throw new Error("You must be logged in to view favorites.");

  const userId = userRes.user.id;

  // Requires a favorites table:
  // favorites: id, user_id, listing_id, created_at
  // with FK listing_id -> listings.id
  // and FK/relationship from favorites -> listings
  const { data, error } = await supabase
    .from("favorites")
    .select(
      `
      id,
      listing_id,
      created_at,
      listings (
        id,
        make,
        model,
        year,
        price,
        mileage,
        created_at,
        listing_images ( bucket, path, position )
      )
    `,
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  // Supabase returns nested listings object; cast for TS convenience
  return (data ?? []) as unknown as FavoriteRow[];
}

export function FavoritesPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["favorites"],
    queryFn: fetchFavorites,
    staleTime: 1000 * 20,
  });

  return (
    <div className="min-h-screen bg-bg text-fg">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Saved Cars</h1>
            <p className="text-subtle text-sm mt-1">
              Your favorite listings in one place.
            </p>
          </div>

          <Link
            to="/listings"
            className="px-3 py-2 rounded-lg bg-surface-2 hover:bg-surface-3 text-sm"
          >
            Browse
          </Link>
        </div>

        {isLoading ? (
          <div className="mt-6 text-muted">Loading favorites…</div>
        ) : isError ? (
          <div className="mt-6 text-danger">
            {errorMessage(error, "Failed to load favorites.")}
          </div>
        ) : (data?.length ?? 0) === 0 ? (
          <div className="mt-6 rounded-2xl border border-line bg-surface p-8 text-muted">
            No favorites yet. Go to{" "}
            <Link to="/listings" className="text-link hover:underline">
              Browse
            </Link>{" "}
            and tap the heart to save cars.
          </div>
        ) : (
          <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(data ?? []).map((fav) => {
              const row = fav.listings;
              const images = (row.listing_images ?? [])
                .slice()
                .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
              const cover = images[0];
              const coverUrl = cover
                ? publicUrl(cover.bucket, cover.path)
                : null;

              return (
                <Link
                  key={fav.id}
                  to={`/listings/${row.id}`}
                  className="rounded-2xl border border-line bg-surface p-4 hover:border-line-strong transition"
                >
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt={`${row.make} ${row.model}`}
                      className="w-full h-40 object-cover rounded-xl border border-line mb-3"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-40 rounded-xl border border-line bg-surface-2 mb-3 flex items-center justify-center text-subtle">
                      No image
                    </div>
                  )}

                  <div className="font-semibold">
                    {row.make} {row.model}
                  </div>

                  <div className="text-muted mt-1">
                    ${Number(row.price).toLocaleString()}
                  </div>

                  <div className="text-xs text-subtle mt-2">
                    {row.year ?? "—"} •{" "}
                    {typeof row.mileage === "number"
                      ? `${row.mileage.toLocaleString()} mi`
                      : (row.mileage ?? "—")}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
