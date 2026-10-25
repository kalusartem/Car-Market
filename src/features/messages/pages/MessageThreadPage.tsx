import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { useAuthUser } from "../../../lib/auth";
import { errorMessage } from "../../../lib/errors";
import { formatPrice } from "../../../lib/format";
import { ChevronLeftIcon } from "../../../components/icons";
import { PageMessage } from "../../../components/PageHeader";

type InquiryRow = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  /** Added by migration 20261026000000; absent before it runs and null on older rows. */
  sender_id?: string | null;
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
  const { listingId, buyerId } = useParams<{ listingId: string; buyerId: string }>();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const { data: user, isLoading: authLoading } = useAuthUser();
  const userId = user?.id ?? null;

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

  const { data: messages, isLoading, isError, error } = useQuery({
    queryKey: ["thread", listingId, buyerId, userId],
    enabled: !!listingId && !!buyerId && !!userId,
    queryFn: async () => {
      // "*" so this works whether or not the sender_id column exists yet.
      const { data, error } = await supabase
        .from("inquiries")
        .select("*")
        .eq("listing_id", listingId!)
        .eq("buyer_id", buyerId!)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as InquiryRow[];
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages?.length]);

  const send = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Please sign in to send messages.");
      if (!listingId || !buyerId) throw new Error("Missing thread params.");
      if (!listing) throw new Error("Listing not loaded yet.");
      const trimmed = text.trim();
      if (!trimmed) throw new Error("Type a message.");

      // sender_id defaults to auth.uid() in the database.
      const { error } = await supabase.from("inquiries").insert({
        listing_id: listingId,
        buyer_id: buyerId,
        seller_id: listing.seller_id,
        message: trimmed,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setText("");
      await qc.invalidateQueries({ queryKey: ["thread", listingId, buyerId, userId] });
      await qc.invalidateQueries({ queryKey: ["inbox", userId] });
    },
  });

  if (authLoading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="card h-[60vh] animate-pulse bg-surface-2" aria-hidden="true" />
      </main>
    );
  }

  if (!userId) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <PageMessage>
          <Link to="/login?next=%2Fmessages" className="font-semibold text-link hover:underline">
            Sign in
          </Link>{" "}
          to view messages.
        </PageMessage>
      </main>
    );
  }

  const title = listing ? `${listing.year ?? ""} ${listing.make} ${listing.model}`.trim() : "Conversation";
  const otherParty = userId === listing?.seller_id ? "Buyer" : "Seller";

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link to="/messages" className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-fg">
        <ChevronLeftIcon size={16} /> All messages
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {listing ? <p className="mt-1 text-sm text-muted">{formatPrice(listing.price)}</p> : null}
        </div>
        {listingId ? (
          <Link to={`/listings/${listingId}`} className="btn-secondary">
            View listing
          </Link>
        ) : null}
      </div>

      <div className="card mt-5 flex h-[60vh] flex-col overflow-y-auto p-4" aria-live="polite">
        {isLoading ? (
          <p className="m-auto text-muted">Loading…</p>
        ) : isError ? (
          <p className="m-auto text-danger">{errorMessage(error, "Failed to load conversation.")}</p>
        ) : (messages?.length ?? 0) === 0 ? (
          <p className="m-auto text-muted">No messages yet.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {messages!.map((m) => {
              // Rows from before sender_id existed don't say who wrote them, so they render neutrally.
              const sender = m.sender_id ?? null;
              const mine = sender !== null && sender === userId;
              const known = sender !== null;
              return (
                <li
                  key={m.id}
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                    mine ? "ml-auto rounded-br-md bg-accent text-accent-fg" : "mr-auto rounded-bl-md bg-surface-2"
                  }`}
                >
                  {known && !mine ? <p className="text-xs font-semibold text-subtle">{otherParty}</p> : null}
                  <p className="whitespace-pre-line text-sm">{m.message}</p>
                  <p className={`mt-1 text-[11px] ${mine ? "text-accent-fg/75" : "text-subtle"}`}>
                    {new Date(m.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="mt-3 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send.mutate();
        }}
      >
        <label htmlFor="reply" className="sr-only">
          Message
        </label>
        <textarea
          id="reply"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send.mutate();
            }
          }}
          rows={2}
          maxLength={2000}
          className="input max-h-40 min-h-12 flex-1 resize-y"
          placeholder="Write a message… (Enter to send, Shift+Enter for a new line)"
          disabled={send.isPending}
        />
        <button type="submit" className="btn-primary h-12 px-5" disabled={send.isPending || !text.trim()}>
          {send.isPending ? "Sending…" : "Send"}
        </button>
      </form>

      {send.isError ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {errorMessage(send.error, "Could not send.")}
        </p>
      ) : null}
    </main>
  );
}
