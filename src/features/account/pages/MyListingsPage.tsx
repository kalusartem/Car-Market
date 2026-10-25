import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { useAuthUser } from "../../../lib/auth";
import { errorMessage } from "../../../lib/errors";
import { formatMileage, formatPrice, timeAgo } from "../../../lib/format";
import { coverUrl } from "../../../lib/images";
import { ImageIcon } from "../../../components/icons";
import { PageHeader, PageMessage } from "../../../components/PageHeader";
import { ResizedImage } from "../../../components/ResizedImage";
import type { Listing } from "../../../types/car";

type MyListing = Pick<
  Listing,
  "id" | "make" | "model" | "year" | "price" | "mileage" | "is_active" | "created_at" | "listing_images"
>;

function Cover({ listing }: { listing: MyListing }) {
  const full = coverUrl(listing);
  const thumb = coverUrl(listing, 320);
  return (
    <div className="aspect-[4/3] w-32 shrink-0 overflow-hidden rounded-xl bg-surface-3 sm:w-40">
      {full && thumb ? (
        <ResizedImage src={thumb} fallback={full} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-subtle">
          <ImageIcon size={28} />
        </div>
      )}
    </div>
  );
}

export function MyListingsPage() {
  const { data: user, isLoading: authLoading } = useAuthUser();

  const { data, isLoading, error } = useQuery({
    queryKey: ["my-listings", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("id, make, model, year, price, mileage, is_active, created_at, listing_images(bucket, path, position)")
        .eq("seller_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as MyListing[];
    },
  });

  const activeCount = (data ?? []).filter((l) => l.is_active).length;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <PageHeader
        title="My listings"
        subtitle={data?.length ? `${activeCount} active of ${data.length}` : "Manage your cars, photos and prices."}
        actions={
          <Link to="/sell" className="btn-primary">
            Sell a car
          </Link>
        }
      />

      {authLoading || isLoading ? (
        <div className="mt-6 grid gap-3" aria-hidden="true">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="card h-36 animate-pulse bg-surface-2" />
          ))}
        </div>
      ) : !user ? (
        <PageMessage>You must be signed in to view your listings.</PageMessage>
      ) : error ? (
        <PageMessage tone="danger">{errorMessage(error, "Failed to load listings.")}</PageMessage>
      ) : !data?.length ? (
        <PageMessage>
          <p className="font-semibold text-fg">No listings yet</p>
          <p className="mt-1">Enter your VIN and we fill in the details. It's free to list.</p>
          <Link to="/sell" className="btn-primary mt-5">
            Sell your car
          </Link>
        </PageMessage>
      ) : (
        <ul className="mt-6 grid gap-3">
          {data.map((l) => (
            <li key={l.id} className="card flex items-center gap-4 p-3 sm:p-4">
              <Link to={`/listings/${l.id}`} tabIndex={-1} aria-hidden="true">
                <Cover listing={l} />
              </Link>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/listings/${l.id}`} className="truncate text-lg font-semibold hover:underline">
                    {`${l.year ?? ""} ${l.make} ${l.model}`.trim()}
                  </Link>
                  <span className={`badge ${l.is_active ? "bg-success-bg text-success" : "bg-surface-2 text-muted"}`}>
                    {l.is_active ? "Active" : "Hidden"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">
                  <span className="font-semibold text-fg">{formatPrice(l.price)}</span>
                  <span aria-hidden="true" className="mx-2 text-line-strong">•</span>
                  {formatMileage(l.mileage)}
                </p>
                {l.created_at ? <p className="mt-1 text-xs text-subtle">Listed {timeAgo(l.created_at).toLowerCase()}</p> : null}
              </div>

              <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                <Link to={`/listings/${l.id}/edit`} className="btn-secondary">
                  Edit
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
