import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { fetchAuthUser } from "../../../lib/auth";
import { errorMessage } from "../../../lib/errors";

type Listing = {
  id: string;
  make: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  is_active: boolean | null;
  created_at: string;
};

function formatPrice(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function MyListingsPage() {
  const { data: user, isLoading: authLoading } = useQuery({
    queryKey: ["auth-user"],
    queryFn: fetchAuthUser,
    staleTime: 1000 * 30,
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["my-listings", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("id, make, model, year, price, mileage, is_active, created_at")
        .eq("seller_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as Listing[];
    },
  });

  if (authLoading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8 text-subtle">Loading…</div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8 text-muted">
        You must be logged in to view your listings.
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">My Listings</h1>
          <p className="text-sm text-subtle mt-1">
            Manage your vehicles and edit details/photos.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            className="px-3 py-2 rounded-lg bg-surface-2 hover:bg-surface-3"
            onClick={() => refetch()}
          >
            Refresh
          </button>
          <Link
            to="/sell"
            className="px-3 py-2 rounded-lg bg-accent hover:bg-accent-hover text-accent-fg"
          >
            Create listing
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-6 text-subtle">Loading…</div>
      ) : error ? (
        <div className="mt-6 text-danger">
          {errorMessage(error, "Failed to load listings.")}
        </div>
      ) : !data?.length ? (
        <div className="mt-6 rounded-2xl border border-line bg-surface p-6">
          <div className="text-fg font-medium">No listings yet</div>
          <div className="text-sm text-subtle mt-1">
            Create your first listing to start selling.
          </div>
          <Link
            to="/sell"
            className="inline-block mt-4 px-3 py-2 rounded-lg bg-accent hover:bg-accent-hover text-accent-fg"
          >
            Create listing
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.map((l) => (
            <div
              key={l.id}
              className="rounded-2xl border border-line bg-surface p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">
                    {l.year} {l.make} {l.model}
                  </div>
                  <div className="text-sm text-subtle mt-1">
                    {formatPrice(l.price)} • {l.mileage.toLocaleString()} mi
                  </div>
                </div>

                <span
                  className={`text-xs px-2 py-1 rounded-lg ${
                    l.is_active
                      ? "bg-success-bg text-success border border-success/30"
                      : "bg-surface-2 text-muted border border-line-strong"
                  }`}
                >
                  {l.is_active ? "Active" : "Hidden"}
                </span>
              </div>

              <div className="mt-4 flex gap-2">
                <Link
                  to={`/listings/${l.id}`}
                  className="px-3 py-2 rounded-lg bg-surface-2 hover:bg-surface-3"
                >
                  View
                </Link>
                <Link
                  to={`/listings/${l.id}/edit`}
                  className="px-3 py-2 rounded-lg bg-accent hover:bg-accent-hover text-accent-fg"
                >
                  Edit
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
