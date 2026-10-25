import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../../lib/supabase";
import { useAuthUser } from "../../../lib/auth";
import { errorMessage } from "../../../lib/errors";
import { formatPrice, timeAgo } from "../../../lib/format";
import { coverUrl } from "../../../lib/images";
import { ImageIcon } from "../../../components/icons";
import { PageHeader, PageMessage } from "../../../components/PageHeader";
import { ResizedImage } from "../../../components/ResizedImage";
import type { Listing } from "../../../types/car";

type ListingMini = Pick<Listing, "id" | "make" | "model" | "year" | "price" | "listing_images">;

type InquiryRow = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  message: string;
  created_at: string;
  // inquiries.listing_id is a many-to-one FK, so PostgREST embeds a single object (null if hidden/deleted).
  listings: ListingMini | null;
};

type Thread = {
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  last_message: string;
  last_at: string;
  count: number;
  listing: ListingMini | null;
};

function Thumb({ listing }: { listing: ListingMini | null }) {
  const full = listing ? coverUrl(listing) : null;
  const thumb = listing ? coverUrl(listing, 240) : null;
  return (
    <span className="block h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-surface-3">
      {full && thumb ? (
        <ResizedImage src={thumb} fallback={full} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-subtle">
          <ImageIcon size={22} />
        </span>
      )}
    </span>
  );
}

export function InboxPage() {
  const { data: user, isLoading: authLoading } = useAuthUser();
  const userId = user?.id ?? null;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["inbox", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inquiries")
        .select(
          "id, listing_id, buyer_id, seller_id, message, created_at, listings(id, make, model, year, price, listing_images(bucket, path, position))",
        )
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as InquiryRow[];
    },
  });

  // Group into threads by (listing_id + buyer_id); rows arrive newest first.
  const threadsMap = new Map<string, Thread>();
  for (const msg of data ?? []) {
    const key = `${msg.listing_id}::${msg.buyer_id}`;
    const existing = threadsMap.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    threadsMap.set(key, {
      listing_id: msg.listing_id,
      buyer_id: msg.buyer_id,
      seller_id: msg.seller_id,
      last_message: msg.message,
      last_at: msg.created_at,
      count: 1,
      listing: msg.listings,
    });
  }
  const threads = Array.from(threadsMap.values());

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Messages"
        subtitle={threads.length ? `${threads.length} ${threads.length === 1 ? "conversation" : "conversations"}` : undefined}
        actions={
          <Link to="/listings" className="btn-secondary">
            Browse cars
          </Link>
        }
      />

      {authLoading || (userId && isLoading) ? (
        <div className="mt-6 grid gap-3" aria-hidden="true">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="card h-24 animate-pulse bg-surface-2" />
          ))}
        </div>
      ) : !userId ? (
        <PageMessage>
          <Link to="/login?next=%2Fmessages" className="font-semibold text-link hover:underline">
            Sign in
          </Link>{" "}
          to view your messages.
        </PageMessage>
      ) : isError ? (
        <PageMessage tone="danger">{errorMessage(error, "Failed to load messages.")}</PageMessage>
      ) : threads.length === 0 ? (
        <PageMessage>
          No messages yet. Use <span className="font-semibold text-fg">Message seller</span> on any listing to start a
          conversation.
        </PageMessage>
      ) : (
        <ul className="mt-6 grid gap-3">
          {threads.map((t) => {
            const title = t.listing
              ? `${t.listing.year ?? ""} ${t.listing.make} ${t.listing.model}`.trim()
              : "Listing no longer available";
            const selling = t.seller_id === userId;

            return (
              <li key={`${t.listing_id}-${t.buyer_id}`}>
                <Link
                  to={`/messages/${t.listing_id}/${t.buyer_id}`}
                  className="card flex items-center gap-4 p-3 transition hover:bg-surface-2 sm:p-4"
                >
                  <Thumb listing={t.listing} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{title}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted">
                          {t.listing ? <span className="font-semibold text-fg">{formatPrice(t.listing.price)}</span> : null}
                          <span className={`badge ${selling ? "bg-accent-soft text-link" : "bg-surface-2 text-muted"}`}>
                            {selling ? "Selling" : "Buying"}
                          </span>
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-subtle" title={new Date(t.last_at).toLocaleString()}>
                        {timeAgo(t.last_at)}
                      </span>
                    </div>
                    <p className="mt-2 truncate text-sm text-muted">
                      {t.last_message}
                      {t.count > 1 ? <span className="text-subtle"> · {t.count} messages</span> : null}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
