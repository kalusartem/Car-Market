import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "../../../lib/supabase";

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
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["my-listings"],
    queryFn: async () => {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const uid = userRes.user?.id;
      if (!uid) throw new Error("You must be logged in.");

      const { data, error } = await supabase
        .from("listings")
        .select("id, make, model, year, price, mileage, is_active, created_at")
        .eq("seller_id", uid)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as Listing[];
    },
  });

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">My Listings</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage your vehicles and edit details/photos.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700"
            onClick={() => refetch()}
          >
            Refresh
          </button>
          <Link
            to="/sell"
            className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500"
          >
            Create listing
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-6 text-slate-400">Loading…</div>
      ) : error ? (
        <div className="mt-6 text-red-300">
          {(error as any)?.message ?? "Failed to load listings."}
        </div>
      ) : !data?.length ? (
        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <div className="text-slate-200 font-medium">No listings yet</div>
          <div className="text-sm text-slate-400 mt-1">
            Create your first listing to start selling.
          </div>
          <Link
            to="/sell"
            className="inline-block mt-4 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500"
          >
            Create listing
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.map((l) => (
            <div
              key={l.id}
              className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">
                    {l.year} {l.make} {l.model}
                  </div>
                  <div className="text-sm text-slate-400 mt-1">
                    {formatPrice(l.price)} • {l.mileage.toLocaleString()} mi
                  </div>
                </div>

                <span
                  className={`text-xs px-2 py-1 rounded-lg ${
                    l.is_active
                      ? "bg-emerald-600/20 text-emerald-200 border border-emerald-700/50"
                      : "bg-slate-800 text-slate-300 border border-slate-700"
                  }`}
                >
                  {l.is_active ? "Active" : "Hidden"}
                </span>
              </div>

              <div className="mt-4 flex gap-2">
                <Link
                  to={`/listings/${l.id}`}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700"
                >
                  View
                </Link>
                <Link
                  to={`/listings/${l.id}/edit`}
                  className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500"
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
