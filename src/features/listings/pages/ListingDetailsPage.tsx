import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "../../../lib/supabase";
import { fetchIsAdmin } from "../../../lib/admin";
import { ContactSellerModal } from "../components/ContactSellerModal";

type ListingImage = {
  bucket: string;
  path: string;
  position: number;
};

type ListingRow = {
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
  location: string | null;
  created_at: string | null;
  listing_images?: ListingImage[] | null;
};

async function fetchListing(id: string) {
  const { data, error } = await supabase
    .from("listings")
    .select("*, listing_images(bucket, path, position)")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as ListingRow;
}

function publicUrl(bucket: string, path: string) {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

function formatMileage(mileage: any) {
  if (typeof mileage === "number") return `${mileage.toLocaleString()} mi`;
  if (mileage === null || mileage === undefined) return "—";
  const n = Number(mileage);
  return Number.isFinite(n) ? `${n.toLocaleString()} mi` : String(mileage);
}

function formatDate(date: any) {
  if (!date) return "—";
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

export function ListingDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const listingId = id ?? null;

  const qc = useQueryClient();

  // ✅ ALL HOOKS AT TOP (no hooks after early returns)
  const [notice, setNotice] = useState<string | null>(null);
  const [isContactOpen, setIsContactOpen] = useState(false);

  const {
    data: row,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["listing", listingId],
    queryFn: () => fetchListing(listingId!),
    enabled: !!listingId,
  });

  const { data: userId } = useQuery({
    queryKey: ["auth-user-id"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) return null;
      return data?.user?.id ?? null;
    },
    staleTime: 30_000,
  });

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", userId],
    queryFn: () => fetchIsAdmin(userId ?? null),
    enabled: !!userId,
    staleTime: 60_000,
  });

  const { data: isFav } = useQuery({
    queryKey: ["favorite", userId, listingId],
    enabled: !!userId && !!listingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("favorites")
        .select("id")
        .eq("user_id", userId!)
        .eq("listing_id", listingId!)
        .maybeSingle();
      if (error) throw error;
      return !!data?.id;
    },
    staleTime: 10_000,
  });

  const toggleFavorite = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Please sign in to save favorites.");
      if (!listingId) throw new Error("Missing listing id.");

      if (isFav) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", userId)
          .eq("listing_id", listingId);
        if (error) throw error;
        return false;
      }

      const { error } = await supabase
        .from("favorites")
        .insert({ user_id: userId, listing_id: listingId });
      if (error) throw error;
      return true;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["favorite", userId, listingId] });
      await qc.invalidateQueries({ queryKey: ["favorites"] });
    },
    onError: (e: any) => {
      setNotice(e?.message ?? "Could not update favorites.");
    },
  });

  // ✅ EARLY RETURNS AFTER ALL HOOKS
  if (!listingId) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6">
        Missing listing id.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6">
        Loading listing…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6">
        <div className="text-red-300">
          Failed to load listing: {(error as any)?.message ?? "Unknown error"}
        </div>
        <Link to="/listings" className="text-blue-400 hover:underline">
          Back to listings
        </Link>
      </div>
    );
  }

  if (!row) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6">
        Listing not found.{" "}
        <Link to="/listings" className="text-blue-400 hover:underline">
          Back to listings
        </Link>
      </div>
    );
  }

  // ✅ NOT A HOOK: safe to compute after early returns
  const images = (row.listing_images ?? [])
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  const cover = images[0];
  const coverUrl = cover ? publicUrl(cover.bucket, cover.path) : null;

  const canEdit = !!userId && (userId === row.seller_id || !!isAdmin);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <Link to="/listings" className="text-slate-300 hover:text-white">
          ← Back to listings
        </Link>

        {/* Notice banner */}
        {notice ? (
          <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-amber-200 flex items-center justify-between gap-4">
            <span>{notice}</span>
            <button
              className="text-amber-200 hover:text-white underline"
              onClick={() => setNotice(null)}
              type="button"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-semibold">
                {row.make} {row.model} {row.year ? `(${row.year})` : ""}
              </h1>
              <p className="text-slate-400 mt-1 text-sm">
                Posted: {formatDate(row.created_at)}
              </p>
            </div>

            <div className="text-2xl font-bold">
              ${Number(row.price).toLocaleString()}
            </div>
          </div>

          {/* Cover */}
          <div className="mt-6">
            {coverUrl ? (
              <img
                src={coverUrl}
                alt={`${row.make} ${row.model} cover`}
                className="w-full h-80 object-cover rounded-xl border border-slate-800"
              />
            ) : (
              <div className="w-full h-80 rounded-xl border border-slate-800 bg-slate-950/40 flex items-center justify-center text-slate-500">
                No images available
              </div>
            )}
          </div>

          {/* Gallery */}
          {images.length > 1 ? (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {images.slice(1).map((img, idx) => {
                const url = publicUrl(img.bucket, img.path);
                return (
                  <img
                    key={`${img.path}-${idx}`}
                    src={url}
                    alt={`${row.make} ${row.model} ${idx + 2}`}
                    className="w-full h-40 object-cover rounded-xl border border-slate-800"
                    loading="lazy"
                  />
                );
              })}
            </div>
          ) : null}

          {/* Specs */}
          <div className="mt-6 grid sm:grid-cols-2 gap-4">
            <Spec label="Mileage" value={formatMileage(row.mileage)} />
            <Spec label="Transmission" value={row.transmission ?? "—"} />
            <Spec label="Fuel" value={row.fuel_type ?? "—"} />
            <Spec label="Location" value={row.location ?? "—"} />
          </div>

          {/* Description */}
          <div className="mt-6">
            <h2 className="font-semibold">Description</h2>
            <p className="text-slate-300 mt-2 whitespace-pre-line">
              {row.description ?? "No description provided."}
            </p>
          </div>

          {/* CTAs */}
          <div className="mt-6 flex gap-3 flex-wrap">
            <button
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
              disabled={toggleFavorite.isPending}
              onClick={() => {
                setNotice(null);
                if (!userId) {
                  setNotice("Please sign in to save favorites.");
                  return;
                }
                toggleFavorite.mutate();
              }}
              type="button"
            >
              {isFav ? "Saved ❤️" : "Save"}
            </button>

            <button
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700"
              onClick={() => {
                setNotice(null);
                if (!userId) {
                  setNotice("Please sign in to contact sellers.");
                  return;
                }
                if (userId === row.seller_id) {
                  setNotice("You can’t contact yourself.");
                  return;
                }
                setIsContactOpen(true);
              }}
              type="button"
            >
              Contact seller
            </button>

            {canEdit ? (
              <Link
                to={`/listings/${row.id}/edit`}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700"
              >
                Edit
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <ContactSellerModal
        open={isContactOpen}
        onClose={() => setIsContactOpen(false)}
        listingId={row.id}
        sellerId={row.seller_id}
      />
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-slate-100 mt-1">{value}</div>
    </div>
  );
}
