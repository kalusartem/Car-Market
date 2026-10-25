import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { usePageMeta } from "../../../hooks/usePageMeta";
import { useFavorites } from "../../favorites/useFavorites";
import { useExtendedSpecs } from "../../../lib/features";
import { slugify, unslugify } from "../../../lib/format";
import { SlidersIcon, XIcon } from "../../../components/icons";
import { fetchListings, PAGE_SIZE } from "../api";
import {
  activeChips,
  filtersToParams,
  parseFilters,
  SORT_OPTIONS,
  type Filters,
} from "../filters";
import { FilterPanel } from "../components/FilterPanel";
import { ListingCard, ListingCardSkeleton } from "../components/ListingCard";

export function ListingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { make: makeSlug, model: modelSlug } = useParams<{ make?: string; model?: string }>();
  const extended = useExtendedSpecs();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const pathMake = makeSlug ? unslugify(makeSlug) : undefined;
  const pathModel = modelSlug ? unslugify(modelSlug) : undefined;
  const fromPath = !!pathMake;

  const filters = useMemo(
    () => parseFilters(searchParams, { make: pathMake, model: pathModel }),
    [searchParams, pathMake, pathModel],
  );

  const update = useCallback(
    (patch: Partial<Filters>) => {
      const next: Filters = { ...filters, ...patch, page: patch.page ?? 1 };
      const params = filtersToParams(next);
      // Landing pages like /cars/toyota/camry hand over to /listings once refined.
      if (fromPath) navigate(`/listings?${params}`);
      else setSearchParams(params, { replace: patch.page === undefined });
    },
    [filters, fromPath, navigate, setSearchParams],
  );

  const clear = () => navigate("/listings");

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["listings", filters, extended],
    queryFn: () => fetchListings(filters, extended),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const total = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
  const favorites = useFavorites(ids);
  const chips = activeChips(filters);

  const heading = filters.make
    ? filters.model
      ? `Used ${filters.make} ${filters.model} for sale`
      : `Used ${filters.make} cars for sale`
    : "Used cars for sale";

  const onlyMakeModel =
    chips.every((c) => c.key === "make" || c.key === "model") && filters.page === 1 && filters.sort === "newest";
  const canonicalPath = filters.make
    ? `/cars/${slugify(filters.make)}${filters.model ? `/${slugify(filters.model)}` : ""}`
    : "/listings";

  usePageMeta({
    title: heading,
    description: `${heading}${total ? ` – ${total} listing${total === 1 ? "" : "s"}` : ""} from private sellers. Filter by price, mileage, year and distance.`,
    canonicalPath: onlyMakeModel ? canonicalPath : undefined,
    noindex: !onlyMakeModel,
  });

  // Keep the page at the top when paging, and lock body scroll behind the drawer.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [filters.page]);
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const panel = (
    <FilterPanel
      filters={filters}
      onChange={update}
      onClear={() => {
        clear();
        setDrawerOpen(false);
      }}
      zipProblem={data?.zipNotFound}
    />
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {fromPath ? (
        <nav aria-label="Breadcrumb" className="mb-3 text-sm text-subtle">
          <Link to="/listings" className="hover:text-fg hover:underline">
            All cars
          </Link>
          {filters.make ? (
            <>
              <span className="mx-1.5">/</span>
              {filters.model ? (
                <Link to={`/cars/${slugify(filters.make)}`} className="hover:text-fg hover:underline">
                  {filters.make}
                </Link>
              ) : (
                <span className="text-fg">{filters.make}</span>
              )}
            </>
          ) : null}
          {filters.model ? (
            <>
              <span className="mx-1.5">/</span>
              <span className="text-fg">{filters.model}</span>
            </>
          ) : null}
        </nav>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[17.5rem_1fr]">
        <aside className="hidden lg:block" aria-label="Filters">
          <div className="card sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto p-4">{panel}</div>
        </aside>

        <section aria-live="polite">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{heading}</h1>
              <p className="mt-1 text-sm text-subtle">
                {isLoading
                  ? "Loading…"
                  : `${total.toLocaleString("en-US")} ${total === 1 ? "car" : "cars"}`}
                {isFetching && !isLoading ? " · updating…" : ""}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-secondary lg:hidden"
                onClick={() => setDrawerOpen(true)}
              >
                <SlidersIcon size={16} />
                Filters{chips.length ? ` (${chips.length})` : ""}
              </button>
              <label className="flex items-center gap-2 text-sm text-muted">
                <span className="sr-only sm:not-sr-only">Sort</span>
                <select
                  className="input w-auto"
                  value={filters.sort}
                  onChange={(e) => update({ sort: e.target.value as Filters["sort"] })}
                >
                  {SORT_OPTIONS.filter(
                    (o) => o.value !== "distance" || (filters.zip && filters.radius > 0),
                  ).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {chips.length ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {chips.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => update(c.patch)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 py-1 text-sm text-fg transition hover:bg-surface-2"
                  aria-label={`Remove filter ${c.label}`}
                >
                  {c.label}
                  <XIcon size={14} />
                </button>
              ))}
              <button type="button" className="text-sm text-link hover:underline" onClick={clear}>
                Clear all
              </button>
            </div>
          ) : null}

          <div className="mt-5">
            {isError ? (
              <div role="alert" className="rounded-xl border border-danger/30 bg-danger-bg p-4 text-danger">
                Couldn’t load listings: {error instanceof Error ? error.message : "Unknown error"}
              </div>
            ) : isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }, (_, i) => (
                  <ListingCardSkeleton key={i} />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <div className="card p-10 text-center">
                <h2 className="text-lg font-semibold">No cars match these filters</h2>
                <p className="mt-1 text-muted">Try removing a filter or widening the search area.</p>
                {chips.length ? (
                  <button type="button" className="btn-primary mt-4" onClick={clear}>
                    Clear all filters
                  </button>
                ) : null}
              </div>
            ) : (
              <div
                className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${isFetching ? "opacity-70 transition" : ""}`}
              >
                {rows.map((l) => (
                  <ListingCard
                    key={l.id}
                    listing={l}
                    saved={favorites.isSaved(l.id)}
                    onToggleSave={favorites.toggle}
                    distance={data?.distances[l.id]}
                  />
                ))}
              </div>
            )}
          </div>

          {totalPages > 1 ? (
            <nav aria-label="Pagination" className="mt-8 flex items-center justify-between">
              <button
                type="button"
                className="btn-secondary"
                disabled={filters.page <= 1}
                onClick={() => update({ page: filters.page - 1 })}
              >
                Previous
              </button>
              <span className="text-sm text-muted">
                Page {filters.page} of {totalPages}
              </span>
              <button
                type="button"
                className="btn-secondary"
                disabled={filters.page >= totalPages}
                onClick={() => update({ page: filters.page + 1 })}
              >
                Next
              </button>
            </nav>
          ) : null}
        </section>
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="absolute inset-0 bg-overlay" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-2xl border-t border-line bg-surface shadow-pop">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="font-semibold">Filters</h2>
              <button type="button" className="btn-ghost -mr-2 px-2" onClick={() => setDrawerOpen(false)} aria-label="Close filters">
                <XIcon />
              </button>
            </div>
            <div className="overflow-y-auto p-4">{panel}</div>
            <div className="border-t border-line p-3">
              <button type="button" className="btn-primary w-full" onClick={() => setDrawerOpen(false)}>
                Show {total.toLocaleString("en-US")} {total === 1 ? "car" : "cars"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
