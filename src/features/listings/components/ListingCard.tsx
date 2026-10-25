import { Link } from "react-router-dom";
import type { Listing } from "../../../types/car";
import {
  coverUrl as getCoverUrl,
} from "../../../lib/images";
import {
  formatMileage,
  formatPrice,
  listingLocation,
  timeAgo,
} from "../../../lib/format";
import { HeartIcon, ImageIcon, PinIcon } from "../../../components/icons";
import { ResizedImage } from "../../../components/ResizedImage";

type Props = {
  listing: Listing;
  saved: boolean;
  onToggleSave: (id: string) => void;
  /** Miles from the searched ZIP, when a radius search is active. */
  distance?: number;
};

export function ListingCard({ listing: l, saved, onToggleSave, distance }: Props) {
  const cover = getCoverUrl(l);
  const thumb = getCoverUrl(l, 800);
  const place = listingLocation(l);
  const title = `${l.year ?? ""} ${l.make} ${l.model}`.trim();

  return (
    <article className="card group relative overflow-hidden transition hover:-translate-y-0.5 hover:shadow-pop">
      <Link
        to={`/listings/${l.id}`}
        className="block focus-visible:outline-offset-[-2px]"
        aria-label={`${title}, ${formatPrice(l.price)}`}
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-surface-3">
          {cover && thumb ? (
            <ResizedImage
              src={thumb}
              fallback={cover}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-subtle">
              <ImageIcon size={36} />
            </div>
          )}
          {l.is_featured ? (
            <span className="badge absolute left-3 top-3 bg-accent text-accent-fg shadow-card">
              Featured
            </span>
          ) : null}
        </div>

        <div className="p-4">
          <div className="text-xl font-extrabold tracking-tight">{formatPrice(l.price)}</div>
          <h3 className="mt-0.5 truncate font-semibold">{title}</h3>
          {l.trim ? <p className="truncate text-sm text-subtle">{l.trim}</p> : null}

          <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-muted">
            <span>{formatMileage(l.mileage)}</span>
            {l.transmission ? (
              <>
                <span aria-hidden="true" className="text-line-strong">•</span>
                <span>{l.transmission}</span>
              </>
            ) : null}
            {l.fuel_type ? (
              <>
                <span aria-hidden="true" className="text-line-strong">•</span>
                <span>{l.fuel_type}</span>
              </>
            ) : null}
          </p>

          <p className="mt-3 flex items-center justify-between gap-2 text-xs text-subtle">
            <span className="inline-flex min-w-0 items-center gap-1">
              {place || distance !== undefined ? <PinIcon size={14} /> : null}
              <span className="truncate">
                {distance !== undefined
                  ? `${Math.round(distance)} mi away${place ? ` · ${place}` : ""}`
                  : (place ?? "")}
              </span>
            </span>
            <span className="shrink-0">{timeAgo(l.created_at)}</span>
          </p>
        </div>
      </Link>

      <button
        type="button"
        onClick={() => onToggleSave(l.id)}
        aria-pressed={saved}
        aria-label={saved ? `Remove ${title} from saved cars` : `Save ${title}`}
        className={`absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface/90 shadow-card backdrop-blur transition hover:scale-105 ${
          saved ? "text-danger-solid" : "text-muted hover:text-fg"
        }`}
      >
        <HeartIcon size={18} filled={saved} />
      </button>
    </article>
  );
}

export function ListingCardSkeleton() {
  return (
    <div className="card overflow-hidden" aria-hidden="true">
      <div className="aspect-[4/3] animate-pulse bg-surface-3" />
      <div className="space-y-2 p-4">
        <div className="h-6 w-1/3 animate-pulse rounded bg-surface-3" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-surface-2" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-surface-2" />
      </div>
    </div>
  );
}
