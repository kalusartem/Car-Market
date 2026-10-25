import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { usePageMeta } from "../../../hooks/usePageMeta";
import { useAuthUser } from "../../../lib/auth";
import { fetchIsAdmin } from "../../../lib/admin";
import {
  formatDate,
  formatMileage,
  formatPrice,
  listingLocation,
  listingTitle,
  slugify,
  sortedImages,
  timeAgo,
} from "../../../lib/format";
import { imageUrl } from "../../../lib/images";
import { listingJsonLd, seoDescription } from "../../../lib/listingSeo";
import { supabase } from "../../../lib/supabase";
import type { Listing } from "../../../types/car";
import { HeartIcon, PinIcon, ShareIcon, UserIcon } from "../../../components/icons";
import { useFavorites } from "../../favorites/useFavorites";
import { fetchSimilar } from "../api";
import { ContactSellerModal } from "../components/ContactSellerModal";
import { Gallery } from "../components/Gallery";
import { ListingCard } from "../components/ListingCard";
import { PriceCheckCard, VerdictBadge } from "../components/PriceCheckCard";
import { usePriceCheck } from "../usePriceCheck";
import { RecallNotice } from "../components/RecallNotice";
import { ReportListing } from "../components/ReportListing";

async function fetchListing(id: string) {
  const { data, error } = await supabase
    .from("listings")
    .select("*, listing_images(bucket, path, position)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Listing;
}

function Spec({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-3">
      <dt className="text-xs text-subtle">{label}</dt>
      <dd className="mt-0.5 break-words font-medium">{value}</dd>
    </div>
  );
}

export function ListingDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [notice, setNotice] = useState<string | null>(null);
  const [contactOpen, setContactOpen] = useState(false);

  const { data: row, isLoading, isError, error } = useQuery({
    queryKey: ["listing", id],
    queryFn: () => fetchListing(id!),
    enabled: !!id,
  });

  const { data: user } = useAuthUser();
  const userId = user?.id ?? null;

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", userId],
    queryFn: () => fetchIsAdmin(userId),
    enabled: !!userId,
    staleTime: 60_000,
  });

  const favorites = useFavorites(id ? [id] : []);
  const saved = id ? favorites.isSaved(id) : false;

  const similar = useQuery({
    queryKey: ["similar", id],
    queryFn: () => fetchSimilar(row!),
    enabled: !!row,
    staleTime: 60_000,
  });
  const similarFavs = useFavorites((similar.data ?? []).map((s) => s.id));

  const images = useMemo(() => (row ? sortedImages(row) : []), [row]);
  const urls = useMemo(() => images.map((i) => imageUrl(i.bucket, i.path)), [images]);
  const photos = useMemo(
    () =>
      images.map((i) => ({
        full: imageUrl(i.bucket, i.path),
        large: imageUrl(i.bucket, i.path, 1600),
        thumb: imageUrl(i.bucket, i.path, 240),
      })),
    [images],
  );

  const price = row ? Number(row.price) : NaN;
  const verdict = usePriceCheck({
    make: row?.make ?? "",
    model: row?.model ?? "",
    year: row?.year ?? null,
    price,
    mileage: row?.mileage ?? null,
    excludeId: row?.id,
    enabled: !!row && Number.isFinite(price),
  });

  const title = row ? listingTitle(row) : "Listing";
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/listings/${id}`;
  usePageMeta({
    title: row ? `${title} – ${formatPrice(row.price)}` : "Listing",
    description: row ? seoDescription(row) : undefined,
    canonicalPath: `/listings/${id}`,
    image: urls[0] ?? null,
    jsonLd: row ? listingJsonLd(row, url, urls.slice(0, 5)) : null,
    noindex: row ? row.is_active === false : false,
  });

  const share = async () => {
    setNotice(null);
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
        setNotice("Link copied to clipboard.");
      }
    } catch (e) {
      // Closing the native share sheet rejects with AbortError; that's not an error.
      if (!(e instanceof DOMException && e.name === "AbortError")) setNotice("Couldn’t share this link.");
    }
  };

  const contact = () => {
    setNotice(null);
    if (!userId) {
      navigate(`/login?next=${encodeURIComponent(`/listings/${id}`)}`);
      return;
    }
    if (row && userId === row.seller_id) {
      setNotice("This is your own listing.");
      return;
    }
    setContactOpen(true);
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6" aria-busy="true">
        <div className="h-8 w-1/2 animate-pulse rounded bg-surface-3" />
        <div className="mt-6 aspect-[16/10] animate-pulse rounded-2xl bg-surface-3" />
      </div>
    );
  }

  if (isError || !row) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
        <h1 className="text-2xl font-bold">Listing not found</h1>
        <p className="mt-2 text-muted">
          {isError && error instanceof Error && !/0 rows|PGRST116/.test(error.message)
            ? error.message
            : "It may have been sold or removed."}
        </p>
        <Link to="/listings" className="btn-primary mt-6">Browse all cars</Link>
      </div>
    );
  }

  const canEdit = !!userId && (userId === row.seller_id || !!isAdmin);
  const place = listingLocation(row);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:pb-12">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-subtle">
        <Link to="/listings" className="hover:text-fg hover:underline">All cars</Link>
        <span className="mx-1.5">/</span>
        <Link to={`/cars/${slugify(row.make)}`} className="hover:text-fg hover:underline">{row.make}</Link>
        <span className="mx-1.5">/</span>
        <Link to={`/cars/${slugify(row.make)}/${slugify(row.model)}`} className="hover:text-fg hover:underline">{row.model}</Link>
      </nav>

      {row.is_active === false ? (
        <div role="status" className="mb-4 rounded-xl border border-warn/40 bg-warn-bg px-4 py-3 text-sm text-warn">
          This listing is hidden from the marketplace.
        </div>
      ) : null}
      {notice ? (
        <div role="status" className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-line bg-surface px-4 py-3 text-sm">
          <span>{notice}</span>
          <button type="button" className="text-link underline" onClick={() => setNotice(null)}>Dismiss</button>
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-6">
          <header>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-subtle">
              {place ? (
                <span className="inline-flex items-center gap-1"><PinIcon size={14} />{place}</span>
              ) : null}
              <span>Listed {timeAgo(row.created_at).toLowerCase()} · {formatDate(row.created_at)}</span>
            </p>
          </header>

          <Gallery photos={photos} alt={title} />

          <section aria-labelledby="specs-title">
            <h2 id="specs-title" className="mb-3 text-lg font-semibold">Details</h2>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Spec label="Year" value={row.year ? String(row.year) : null} />
              <Spec label="Make" value={row.make} />
              <Spec label="Model" value={row.model} />
              <Spec label="Trim" value={row.trim} />
              <Spec label="Mileage" value={formatMileage(row.mileage)} />
              <Spec label="Body type" value={row.body_type} />
              <Spec label="Drivetrain" value={row.drivetrain} />
              <Spec label="Transmission" value={row.transmission} />
              <Spec label="Fuel" value={row.fuel_type} />
              <Spec label="Exterior" value={row.exterior_color} />
              <Spec label="Title" value={row.title_status} />
              <Spec label="VIN" value={row.vin} />
            </dl>
          </section>

          <section aria-labelledby="desc-title">
            <h2 id="desc-title" className="mb-3 text-lg font-semibold">Seller’s description</h2>
            <p className="whitespace-pre-line text-muted">{row.description || "The seller hasn’t added a description."}</p>
          </section>

          <RecallNotice make={row.make} model={row.model} year={row.year} vin={row.vin} />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start" aria-label="Buy this car">
          <section className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="text-3xl font-extrabold tracking-tight">{formatPrice(row.price)}</div>
              {verdict.result ? <VerdictBadge result={verdict.result} /> : null}
            </div>

            <div className="mt-4 grid gap-2">
              <button type="button" className="btn-primary h-11" onClick={contact}>Message seller</button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  aria-pressed={saved}
                  onClick={() => favorites.toggle(row.id)}
                >
                  <HeartIcon size={16} filled={saved} className={saved ? "text-danger-solid" : ""} />
                  {saved ? "Saved" : "Save"}
                </button>
                <button type="button" className="btn-secondary" onClick={share}>
                  <ShareIcon size={16} />
                  Share
                </button>
              </div>
              {canEdit ? (
                <Link to={`/listings/${row.id}/edit`} className="btn-secondary">Edit listing</Link>
              ) : null}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
              <Link to={`/sellers/${row.seller_id}`} className="inline-flex items-center gap-2 text-sm font-medium hover:underline">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface-3 text-muted"><UserIcon size={16} /></span>
                Private seller
              </Link>
              <ReportListing listingId={row.id} />
            </div>
          </section>

          <PriceCheckCard
            make={row.make}
            model={row.model}
            year={row.year}
            price={price}
            mileage={row.mileage}
            excludeId={row.id}
          />

          <p className="px-1 text-xs text-subtle">
            Stay safe: meet in a public place, never wire money, and verify the VIN and title before you pay.
          </p>
        </aside>
      </div>

      {(similar.data?.length ?? 0) > 0 ? (
        <section className="mt-12" aria-labelledby="similar-title">
          <h2 id="similar-title" className="mb-4 text-xl font-bold tracking-tight">Similar cars</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {similar.data!.map((s) => (
              <ListingCard key={s.id} listing={s} saved={similarFavs.isSaved(s.id)} onToggleSave={similarFavs.toggle} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Mobile: keep the main action in reach */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="text-xl font-extrabold">{formatPrice(row.price)}</div>
        <button type="button" className="btn-primary h-11 flex-1 sm:flex-none sm:px-8" onClick={contact}>Message seller</button>
      </div>

      <ContactSellerModal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        listingId={row.id}
        sellerId={row.seller_id}
      />
    </div>
  );
}
