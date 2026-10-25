import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { usePageMeta } from "../../../hooks/usePageMeta";
import { useMakes, useModels } from "../../../hooks/useVehicleData";
import { useExtendedSpecs } from "../../../lib/features";
import { useFavorites } from "../../favorites/useFavorites";
import type { Listing } from "../../../types/car";
import { fetchLatest } from "../api";
import { ListingCard, ListingCardSkeleton } from "../components/ListingCard";
import { filtersToParams, DEFAULT_FILTERS } from "../filters";
import { CarIcon, PinIcon, SearchIcon, ShieldCheckIcon, GaugeIcon } from "../../../components/icons";

const PRICE_OPTIONS = [5_000, 10_000, 15_000, 20_000, 30_000, 50_000, 75_000, 100_000];
const ZIP_KEY = "lastZip";

function readZip() {
  try {
    return localStorage.getItem(ZIP_KEY) ?? "";
  } catch {
    return "";
  }
}

function HeroSearch() {
  const navigate = useNavigate();
  const { makes, isLoading, failed } = useMakes();
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [zip, setZip] = useState(readZip);
  const { models } = useModels(make);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const z = zip.trim();
    try {
      if (z) localStorage.setItem(ZIP_KEY, z);
    } catch {
      // not essential
    }
    const params = filtersToParams({
      ...DEFAULT_FILTERS,
      make,
      model,
      priceMax: maxPrice ? Number(maxPrice) : null,
      zip: z,
      radius: z ? 50 : 0,
      sort: z ? "distance" : "newest",
    });
    navigate(`/listings?${params}`);
  };

  return (
    <form
      onSubmit={submit}
      className="card mt-8 grid gap-3 p-3 shadow-pop sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_8rem_auto]"
      aria-label="Search cars"
    >
      {failed ? (
        <input className="input h-11" placeholder="Make" aria-label="Make" value={make} onChange={(e) => setMake(e.target.value)} />
      ) : (
        <select
          className="input h-11"
          aria-label="Make"
          value={make}
          disabled={isLoading}
          onChange={(e) => {
            setMake(e.target.value);
            setModel("");
          }}
        >
          <option value="">{isLoading ? "Loading makes…" : "Any make"}</option>
          <optgroup label="Popular">
            {makes.popular.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </optgroup>
          {makes.all.length ? (
            <optgroup label="All makes">
              {makes.all.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </optgroup>
          ) : null}
        </select>
      )}

      {models.length ? (
        <select className="input h-11" aria-label="Model" value={model} disabled={!make} onChange={(e) => setModel(e.target.value)}>
          <option value="">{make ? "Any model" : "Choose a make first"}</option>
          {models.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      ) : (
        <input className="input h-11" placeholder={make ? "Model" : "Choose a make first"} aria-label="Model" disabled={!make} value={model} onChange={(e) => setModel(e.target.value)} />
      )}

      <select className="input h-11" aria-label="Maximum price" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)}>
        <option value="">Any price</option>
        {PRICE_OPTIONS.map((p) => (
          <option key={p} value={p}>
            Up to ${p.toLocaleString("en-US")}
          </option>
        ))}
      </select>

      <input
        className="input h-11"
        inputMode="numeric"
        maxLength={5}
        placeholder="ZIP"
        aria-label="ZIP code"
        value={zip}
        onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))}
      />

      <button type="submit" className="btn-primary h-11 px-6 sm:col-span-2 lg:col-span-1">
        <SearchIcon size={18} />
        Search
      </button>
    </form>
  );
}

type RowProps = {
  title: string;
  rows: Listing[];
  loading: boolean;
  more?: boolean;
  favorites: ReturnType<typeof useFavorites>;
};

function Row({ title, rows, loading, more, favorites }: RowProps) {
  return (
    <section className="mx-auto max-w-7xl px-4 pt-12 sm:px-6">
      <div className="mb-5 flex items-end justify-between">
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        {more ? (
          <Link to="/listings" className="text-sm font-semibold text-link hover:underline">
            View all →
          </Link>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 3 }, (_, i) => <ListingCardSkeleton key={i} />)
          : rows.map((l) => (
              <ListingCard key={l.id} listing={l} saved={favorites.isSaved(l.id)} onToggleSave={favorites.toggle} />
            ))}
      </div>
    </section>
  );
}

export function HomePage() {
  const extended = useExtendedSpecs();

  usePageMeta({
    title: "Car Market – Buy and sell used cars from private sellers",
    description:
      "Browse used cars by make, model, price and distance. List your car for free, decode its VIN in one step, and see how your price compares to similar listings.",
    canonicalPath: "/",
  });

  const featured = useQuery({
    queryKey: ["home", "featured"],
    queryFn: () => fetchLatest(6, true),
    staleTime: 30_000,
  });
  const latest = useQuery({
    queryKey: ["home", "latest"],
    queryFn: () => fetchLatest(8, false),
    staleTime: 30_000,
  });

  const featuredRows = featured.data ?? [];
  // Don't repeat featured cars in the "just listed" row.
  const featuredIds = new Set(featuredRows.map((r) => r.id));
  const latestRows = (latest.data ?? []).filter((r) => !featuredIds.has(r.id)).slice(0, 6);
  const shown = [...featuredRows, ...latestRows];
  const favorites = useFavorites(shown.map((r) => r.id));

  // Quick links that only use columns every deployment has, plus body types once available.
  const quickLinks: Array<{ label: string; to: string }> = [
    { label: "Under $10k", to: "/listings?priceMax=10000" },
    { label: "Under $20k", to: "/listings?priceMax=20000" },
    { label: "Electric", to: "/listings?fuel=Electric" },
    { label: "Hybrid", to: "/listings?fuel=Hybrid" },
    ...(extended
      ? [
          { label: "SUVs", to: "/listings?body=SUV" },
          { label: "Trucks", to: "/listings?body=Truck" },
          { label: "Sedans", to: "/listings?body=Sedan" },
        ]
      : []),
  ];

  // Scroll to top on arrival from other pages.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  return (
    <main>
      <section className="border-b border-line bg-gradient-to-b from-accent-soft to-bg">
        <div className="mx-auto max-w-7xl px-4 pb-12 pt-12 sm:px-6 sm:pb-16 sm:pt-16">
          <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
            Find your next car. <span className="text-accent">Straight from the owner.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted">
            Browse private-seller listings by make, model, price and distance. Listing your own car is free —
            decode the VIN, add photos, and see how your price compares.
          </p>
          <HeroSearch />
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="text-sm text-subtle">Popular:</span>
            {quickLinks.map((q) => (
              <Link
                key={q.label}
                to={q.to}
                className="rounded-full border border-line-strong bg-surface px-3 py-1 text-sm text-muted transition hover:bg-surface-2 hover:text-fg"
              >
                {q.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {featuredRows.length > 0 ? (
        <Row title="Featured cars" rows={featuredRows} loading={false} favorites={favorites} />
      ) : null}
      <Row
        title={featuredRows.length ? "Just listed" : "Latest listings"}
        rows={latestRows}
        loading={latest.isLoading}
        more
        favorites={favorites}
      />
      {!latest.isLoading && shown.length === 0 ? (
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="card p-10 text-center text-muted">No listings yet — be the first to list a car.</div>
        </div>
      ) : null}

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: <CarIcon size={22} />, title: "List in minutes", text: "Enter your VIN and we fill in the year, make, model, trim and specs from NHTSA data." },
            { icon: <GaugeIcon size={22} />, title: "Know your price", text: "See how your asking price compares with similar cars listed on Car Market before you post." },
            { icon: <ShieldCheckIcon size={22} />, title: "Buy with context", text: "Every listing shows open recall campaigns for that model year and a link to check the exact VIN." },
          ].map((f) => (
            <div key={f.title} className="card p-5">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-link">{f.icon}</div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted">{f.text}</p>
            </div>
          ))}
        </div>

        <div className="card mt-6 flex flex-col items-start justify-between gap-4 bg-accent p-6 text-accent-fg sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-bold">Selling a car?</h2>
            <p className="mt-1 text-sm opacity-90">Free to list. No dealer fees. Messages go straight to your inbox.</p>
          </div>
          <Link to="/sell" className="btn inline-flex bg-white text-[#1d4ed8] hover:bg-white/90">
            <PinIcon size={16} />
            Sell your car
          </Link>
        </div>
      </section>
    </main>
  );
}
