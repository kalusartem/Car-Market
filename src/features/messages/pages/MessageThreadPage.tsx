import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../../lib/supabase";

type InquiryRow = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  message: string;
  created_at: string;
};

type ListingRow = {
  id: string;
  make: string;
  model: string;
  year: number | null;
  price: number | string;
  seller_id: string;
};

export function MessageThreadPage() {
  const { listingId, buyerId } = useParams<{
    listingId: string;
    buyerId: string;
  }>();
  const qc = useQueryClient();

  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const { data: userId } = useQuery({
    queryKey: ["auth-user-id"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data?.user?.id ?? null;
    },
    staleTime: 30_000,
  });

  const { data: listing } = useQuery({
    queryKey: ["listing-mini", listingId],
    enabled: !!listingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("id, make, model, year, price, seller_id")
        .eq("id", listingId!)
        .single();
      if (error) throw error;
      return data as ListingRow;
    },
  });

  const {
    data: messages,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["thread", listingId, buyerId, userId],
    enabled: !!listingId && !!buyerId && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inquiries")
        .select("id, listing_id, buyer_id, seller_id, message, created_at")
        .eq("listing_id", listingId!)
        .eq("buyer_id", buyerId!)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as InquiryRow[];
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  const send = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Please sign in to send messages.");
      if (!listingId || !buyerId) throw new Error("Missing thread params.");
      if (!listing) throw new Error("Listing not loaded yet.");
      const trimmed = text.trim();
      if (!trimmed) throw new Error("Type a message.");

      const payload = {
        listing_id: listingId,
        buyer_id: buyerId,
        seller_id: listing.seller_id,
        message: trimmed,
      };

      const { error } = await supabase.from("inquiries").insert(payload);
      if (error) throw error;
      return true;
    },
    onSuccess: async () => {
      setText("");
      await qc.invalidateQueries({
        queryKey: ["thread", listingId, buyerId, userId],
      });
      await qc.invalidateQueries({ queryKey: ["inbox", userId] });
    },
  });

  if (!userId) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6">
        Please sign in to view messages.
      </div>
    );
  }

  const title = listing
    ? `${listing.make} ${listing.model}${listing.year ? ` (${listing.year})` : ""}`
    : "Conversation";

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link to="/messages" className="text-slate-300 hover:text-white">
              ← Back to inbox
            </Link>
            <div className="mt-2 text-xl font-semibold">{title}</div>
            {listing?.price ? (
              <div className="text-sm text-slate-400 mt-1">
                ${Number(listing.price).toLocaleString()}
              </div>
            ) : null}
          </div>
          {listingId ? (
            <Link
              to={`/listings/${listingId}`}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700"
            >
              View listing
            </Link>
          ) : null}
        </div>

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-4 h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="text-slate-300 p-3">Loading…</div>
          ) : isError ? (
            <div className="text-red-300 p-3">
              {(error as any)?.message ?? "Failed to load thread"}
            </div>
          ) : (messages?.length ?? 0) === 0 ? (
            <div className="text-slate-300 p-3">No messages yet.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {messages!.map((m) => {
                const mine =
                  m.buyer_id === userId ? true : m.seller_id === userId;
                // Determine sender by matching auth uid to buyer/seller
                const isMine =
                  (m.buyer_id === userId && buyerId === userId) ||
                  m.seller_id === userId;

                return (
                  <div
                    key={m.id}
                    className={`max-w-[80%] rounded-2xl px-4 py-3 border ${
                      isMine
                        ? "ml-auto bg-blue-600/20 border-blue-500/30"
                        : "mr-auto bg-slate-950/30 border-slate-800"
                    }`}
                  >
                    <div className="text-sm text-slate-100 whitespace-pre-line">
                      {m.message}
                    </div>
                    <div className="text-xs text-slate-400 mt-2">
                      {new Date(m.created_at).toLocaleString()}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="flex-1 min-h-[48px] max-h-[120px] rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-slate-100 outline-none focus:border-slate-600"
            placeholder="Write a message…"
            disabled={send.isPending}
          />
          <button
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
            onClick={() => send.mutate()}
            disabled={send.isPending}
          >
            {send.isPending ? "Sending…" : "Send"}
          </button>
        </div>

        {send.isError ? (
          <div className="mt-3 text-amber-200">
            {(send.error as any)?.message ?? "Could not send"}
          </div>
        ) : null}
      </div>
    </div>
  );
}
