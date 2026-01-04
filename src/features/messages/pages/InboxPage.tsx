// src/features/messages/pages/InboxPage.tsx
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../../lib/supabase";
import { fetchAuthUser } from "../../../lib/auth";

type InquiryRow = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  message: string;
  created_at: string;
  listings?: {
    id: string;
    make: string;
    model: string;
    year: number | null;
    price: number | string;
  } | null;
};

function formatDateTime(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export function InboxPage() {
  const { data: user, isLoading: isAuthLoading } = useQuery({
    queryKey: ["auth-user"],
    queryFn: fetchAuthUser,
    staleTime: 1000 * 30,
  });

  const userId = user?.id ?? null;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["inquiries", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inquiries")
        .select("id, listing_id, buyer_id, seller_id, message, created_at, listings(id, make, model, year, price)")
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as InquiryRow[];
    },
    staleTime: 1000 * 10,
  });

  if (isAuthLoading) {
    return <div className="min-h-screen bg-slate-950 text-white p-6">Loading…</div>;
  }

  if (!userId) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6">
        <div className="text-slate-200">Please sign in to view your inbox.</div>
        <Link to="/" className="text-blue-400 hover:underline">Go home</Link>
      </div>
    );
  }

  if (isLoading) {
    return <div className="min-h-screen bg-slate-950 text-white p-6">Loading inbox…</div>;
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6">
        <div className="text-red-300">Failed to load inbox: {(error as any)?.message ?? "Unknown error"}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold">Inbox</h1>
        <p className="text-slate-400 mt-1">
          Messages you sent and received about listings.
        </p>

        <div className="mt-6 space-y-3">
          {(data ?? []).length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 text-slate-300">
              No messages yet.
            </div>
          ) : (
            (data ?? []).map((m) => {
              const listing = m.listings;
              const isSeller = m.seller_id === userId;
              const role = isSeller ? "Buyer inquiry" : "To seller";
              const title = listing
                ? `${listing.make} ${listing.model}${listing.year ? ` (${listing.year})` : ""}`
                : "Listing";
              return (
                <div key={m.id} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="text-sm text-slate-400">{role}</div>
                      <div className="text-lg font-semibold">{title}</div>
                      <div className="text-xs text-slate-500 mt-1">{formatDateTime(m.created_at)}</div>
                    </div>
                    <Link
                      to={`/listings/${m.listing_id}`}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm"
                    >
                      View listing
                    </Link>
                  </div>

                  <div className="mt-3 text-slate-200 whitespace-pre-line">
                    {m.message}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
