import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { usePageMeta } from "../../../hooks/usePageMeta";
import { useMakes, useModels } from "../../../hooks/useVehicleData";
import { fetchComps } from "../../../lib/comps";
import { formatPrice, slugify } from "../../../lib/format";
import { evaluatePrice, summarizeComps, VERDICT_COPY } from "../../../lib/priceCheck";
import { CURRENT_YEAR, MIN_YEAR } from "../../../lib/specs";

const TONE = {
  success: "bg-success-bg text-success",
  neutral: "bg-surface-3 text-fg",
  warn: "bg-warn-bg text-warn",
  danger: "bg-danger-bg text-danger",
} as const;

export function PriceCheckPage() {
  usePageMeta({
    title: "Price check – is this car priced right?",
    description:
      "Compare an asking price with similar used cars listed on Car Market. Enter the year, make, model, mileage and price.",
    canonicalPath: "/price-check",
  });

  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [mileage, setMileage] = useState("");
  const [price, setPrice] = useState("");
  const [submitted, setSubmitted] = useState<null | { make: string; model: string; year: number; mileage: number | null; price: number | null }>(null);

  const { makes, isLoading, failed } = useMakes();
  const yearNum = Number(year);
  const yearOk = Number.isInteger(yearNum) && yearNum >= MIN_YEAR && yearNum <= CURRENT_YEAR + 1;
  const { models } = useModels(make, yearOk ? yearNum : undefined);

  const comps = useQuery({
    queryKey: ["price-check", submitted],
    enabled: !!submitted,
    queryFn: () => fetchComps({ make: submitted!.make, model: submitted!.model, year: submitted!.year }),
  });

  const outcome = useMemo(() => {
    if (!submitted || !comps.data) return null;
    const opts = { mileage: submitted.mileage };
    return {
      summary: summarizeComps(comps.data, opts),
      rated: submitted.price ? evaluatePrice(submitted.price, comps.data, opts) : null,
    };
  }, [submitted, comps.data]);

  const canSubmit = make.trim() && model.trim() && yearOk;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Price check</h1>
      <p className="mt-2 text-muted">
        See how an asking price compares with similar cars listed on Car Market (same make and model, model years
        within two). Useful whether you’re buying or about to list your own.
      </p>

      <form
        className="card mt-6 grid gap-4 p-5 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSubmit) return;
          setSubmitted({
            make: make.trim(),
            model: model.trim(),
            year: yearNum,
            mileage: mileage ? Number(mileage) : null,
            price: price ? Number(price) : null,
          });
        }}
      >
        <label className="block">
          <span className="mb-1 block text-sm text-muted">Year</span>
          <input className="input" inputMode="numeric" placeholder={String(CURRENT_YEAR - 5)} value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} required />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-muted">Make</span>
          {failed ? (
            <input className="input" value={make} onChange={(e) => setMake(e.target.value)} required />
          ) : (
            <select className="input" value={make} disabled={isLoading} onChange={(e) => { setMake(e.target.value); setModel(""); }} required>
              <option value="">{isLoading ? "Loading…" : "Select make"}</option>
              <optgroup label="Popular">{makes.popular.map((m) => <option key={m}>{m}</option>)}</optgroup>
              {makes.all.length ? <optgroup label="All makes">{makes.all.map((m) => <option key={m}>{m}</option>)}</optgroup> : null}
            </select>
          )}
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-muted">Model</span>
          {models.length ? (
            <select className="input" value={model} disabled={!make} onChange={(e) => setModel(e.target.value)} required>
              <option value="">{make ? "Select model" : "Choose a make first"}</option>
              {models.map((m) => <option key={m}>{m}</option>)}
            </select>
          ) : (
            <input className="input" value={model} disabled={!make} placeholder={make ? "Model" : "Choose a make first"} onChange={(e) => setModel(e.target.value)} required />
          )}
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-muted">Mileage (optional)</span>
          <input className="input" inputMode="numeric" placeholder="e.g. 60000" value={mileage} onChange={(e) => setMileage(e.target.value.replace(/\D/g, ""))} />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm text-muted">Asking price (optional)</span>
          <input className="input" inputMode="numeric" placeholder="e.g. 18500" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} />
        </label>
        <div className="sm:col-span-2">
          <button type="submit" className="btn-primary" disabled={!canSubmit || comps.isFetching}>
            {comps.isFetching ? "Checking…" : "Check price"}
          </button>
        </div>
      </form>

      {submitted ? (
        <section className="card mt-6 p-5" aria-live="polite">
          {comps.isError ? (
            <p role="alert" className="text-danger">Couldn’t load comparable listings. Try again in a moment.</p>
          ) : comps.isLoading ? (
            <p className="text-subtle">Comparing with similar cars…</p>
          ) : outcome?.summary ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">{submitted.year} {submitted.make} {submitted.model}</h2>
                {outcome.rated ? (
                  <span className={`badge ${TONE[VERDICT_COPY[outcome.rated.verdict].tone]}`}>{VERDICT_COPY[outcome.rated.verdict].label}</span>
                ) : null}
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
                {[["Typical low", outcome.summary.low], ["Median", outcome.summary.median], ["Typical high", outcome.summary.high]].map(([k, v]) => (
                  <div key={k as string} className="rounded-xl bg-surface-2 p-3">
                    <dt className="text-xs text-subtle">{k as string}</dt>
                    <dd className="mt-0.5 text-lg font-bold">{formatPrice(v as number)}</dd>
                  </div>
                ))}
              </dl>
              {outcome.rated && submitted.price ? (
                <p className="mt-4 text-muted">
                  {formatPrice(submitted.price)} is <strong className="text-fg">{Math.abs(Math.round(outcome.rated.diffPct * 100))}% {outcome.rated.diffPct < 0 ? "below" : "above"}</strong> the median.
                </p>
              ) : null}
              <p className="mt-3 text-xs text-subtle">
                Based on {outcome.summary.count} listings{outcome.summary.basis === "mileage" ? " with similar mileage" : ""}. Asking prices, not sale prices.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to={`/cars/${slugify(submitted.make)}/${slugify(submitted.model)}`} className="btn-secondary">See similar listings</Link>
                <Link to="/sell" className="btn-primary">List your car</Link>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold">Not enough data yet</h2>
              <p className="mt-1 text-muted">
                Fewer than three comparable {submitted.make} {submitted.model} cars are listed, so any number we showed would be a guess.
              </p>
              <div className="mt-4"><Link to="/sell" className="btn-primary">List your car</Link></div>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
