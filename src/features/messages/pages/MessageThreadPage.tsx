import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { errorMessage } from "../../../lib/errors";

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
      <div className="min-h-screen bg-bg text-fg p-6">
        Please sign in to view messages.
      </div>
    );
  }

  const title = listing
    ? `${listing.make} ${listing.model}${listing.year ? ` (${listing.year})` : ""}`
    : "Conversation";

  return (
    <div className="min-h-screen bg-bg text-fg">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link to="/messages" className="text-muted hover:text-fg">
              ← Back to inbox
            </Link>
            <div className="mt-2 text-xl font-semibold">{title}</div>
            {listing?.price ? (
              <div className="text-sm text-subtle mt-1">
                ${Number(listing.price).toLocaleString()}
              </div>
            ) : null}
          </div>
          {listingId ? (
            <Link
              to={`/listings/${listingId}`}
              className="px-4 py-2 rounded-lg bg-surface-2 hover:bg-surface-3"
            >
              View listing
            </Link>
          ) : null}
        </div>

        <div className="mt-6 rounded-2xl border border-line bg-surface p-4 h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="text-muted p-3">Loading…</div>
          ) : isError ? (
            <div className="text-danger p-3">
              {errorMessage(error, "Failed to load thread")}
            </div>
          ) : (messages?.length ?? 0) === 0 ? (
            <div className="text-muted p-3">No messages yet.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {messages!.map((m) => {
                const isMine = userId === m.buyer_id ? true : userId === m.seller_id;

return (
                  <div
                    key={m.id}
                    className={`max-w-[80%] rounded-2xl px-4 py-3 border ${
                      isMine
                        ? "ml-auto bg-accent-soft border-accent/30"
                        : "mr-auto bg-surface-2 border-line"
                    }`}
                  >
                    <div className="text-sm text-fg whitespace-pre-line">
                      {m.message}
                    </div>
                    <div className="text-xs text-subtle mt-2">
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
            className="flex-1 min-h-[48px] max-h-[120px] rounded-xl border border-line bg-surface p-3 text-fg outline-none focus:border-line-strong"
            placeholder="Write a message…"
            disabled={send.isPending}
          />
          <button
            className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-accent-fg disabled:opacity-50"
            onClick={() => send.mutate()}
            disabled={send.isPending}
          >
            {send.isPending ? "Sending…" : "Send"}
          </button>
        </div>

        {send.isError ? (
          <div className="mt-3 text-warn">
            {errorMessage(send.error, "Could not send")}
          </div>
        ) : null}
      </div>
    </div>
  );
}
