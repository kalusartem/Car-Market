import { formatPrice } from "../../../lib/format";
import { VERDICT_COPY, type PriceCheckResult } from "../../../lib/priceCheck";
import { usePriceCheck } from "../usePriceCheck";

const TONE_CLASS = {
  success: "bg-success-bg text-success",
  neutral: "bg-surface-3 text-fg",
  warn: "bg-warn-bg text-warn",
  danger: "bg-danger-bg text-danger",
} as const;

export function VerdictBadge({ result }: { result: PriceCheckResult }) {
  const v = VERDICT_COPY[result.verdict];
  return <span className={`badge ${TONE_CLASS[v.tone]}`}>{v.label}</span>;
}

/** Where the price sits between the lowest and highest comparable asking prices. */
function RangeBar({ price, result }: { price: number; result: PriceCheckResult }) {
  const span = Math.max(1, result.high - result.low);
  const min = result.low - span * 0.5;
  const max = result.high + span * 0.5;
  const pct = (n: number) => `${Math.min(100, Math.max(0, ((n - min) / (max - min)) * 100))}%`;
  return (
    <div className="mt-4" aria-hidden="true">
      <div className="relative h-2 rounded-full bg-surface-3">
        <div
          className="absolute h-2 rounded-full bg-success/40"
          style={{ left: pct(result.low), width: `calc(${pct(result.high)} - ${pct(result.low)})` }}
        />
        <div
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-accent shadow-card"
          style={{ left: pct(price) }}
        />
      </div>
      <div className="mt-2 flex justify-between text-xs text-subtle">
        <span>{formatPrice(result.low)}</span>
        <span>typical range</span>
        <span>{formatPrice(result.high)}</span>
      </div>
    </div>
  );
}

export function PriceCheckCard(props: {
  make: string;
  model: string;
  year: number | null;
  price: number;
  mileage: number | null;
  excludeId?: string;
}) {
  const { result, isLoading, hasData } = usePriceCheck(props);

  return (
    <section className="card p-5" aria-labelledby="price-check-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="price-check-title" className="font-semibold">Price check</h2>
        {result ? <VerdictBadge result={result} /> : null}
      </div>

      {isLoading ? (
        <p className="mt-3 text-sm text-subtle">Comparing with similar cars…</p>
      ) : result ? (
        <>
          <p className="mt-3 text-sm text-muted">
            {formatPrice(props.price)} is{" "}
            <strong className="text-fg">
              {Math.abs(Math.round(result.diffPct * 100))}% {result.diffPct < 0 ? "below" : "above"}
            </strong>{" "}
            the median of {formatPrice(result.median)}.
          </p>
          <RangeBar price={props.price} result={result} />
          <p className="mt-3 text-xs text-subtle">
            Based on {result.count} similar {props.make} {props.model} listings on Car Market (model years ±2
            {result.basis === "mileage" ? ", similar mileage" : ""}). Asking prices, not sale prices.
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm text-subtle">
          {hasData
            ? "Not enough similar listings yet to rate this price. The check appears once at least three comparable cars are listed."
            : "Price comparison is unavailable right now."}
        </p>
      )}
    </section>
  );
}
