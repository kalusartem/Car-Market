// "Price check" compares an asking price with similar active listings on Car Market
// (same make + model, model year within ±2). It is only as good as the inventory, so
// it stays silent until there are enough comparable cars.

export type Verdict = "great" | "good" | "fair" | "high" | "over";

export interface Comp {
  price: number;
  mileage: number | null;
  year: number | null;
}

export interface PriceCheckResult {
  count: number;
  median: number;
  low: number; // 25th percentile
  high: number; // 75th percentile
  diffPct: number; // (price - median) / median
  verdict: Verdict;
  basis: "mileage" | "model";
}

export const MIN_COMPS = 3;

export function median(sorted: number[]) {
  return quantile(sorted, 0.5);
}

/** Linear-interpolated quantile of an ascending array. */
export function quantile(sorted: number[], q: number) {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function verdictFor(diffPct: number): Verdict {
  if (diffPct <= -0.1) return "great";
  if (diffPct <= -0.03) return "good";
  if (diffPct <= 0.05) return "fair";
  if (diffPct <= 0.15) return "high";
  return "over";
}

export type CompSummary = Omit<PriceCheckResult, "diffPct" | "verdict">;

/** Median and typical (interquartile) range of comparable asking prices. */
export function summarizeComps(
  comps: Comp[],
  opts: { mileage?: number | null; minComps?: number } = {},
): CompSummary | null {
  const minComps = opts.minComps ?? MIN_COMPS;
  const valid = comps.filter((c) => Number.isFinite(c.price) && c.price > 0);

  let pool = valid;
  let basis: CompSummary["basis"] = "model";
  const m = opts.mileage;
  if (typeof m === "number" && m > 0) {
    const similar = valid.filter(
      (c) => c.mileage != null && c.mileage >= m * 0.6 && c.mileage <= m * 1.4,
    );
    if (similar.length >= minComps) {
      pool = similar;
      basis = "mileage";
    }
  }
  if (pool.length < minComps) return null;

  const prices = pool.map((c) => c.price).sort((a, b) => a - b);
  return {
    count: pool.length,
    median: median(prices),
    low: quantile(prices, 0.25),
    high: quantile(prices, 0.75),
    basis,
  };
}

export function evaluatePrice(
  price: number,
  comps: Comp[],
  opts: { mileage?: number | null; minComps?: number } = {},
): PriceCheckResult | null {
  if (!Number.isFinite(price) || price <= 0) return null;
  const summary = summarizeComps(comps, opts);
  if (!summary) return null;
  const diffPct = (price - summary.median) / summary.median;
  return { ...summary, diffPct, verdict: verdictFor(diffPct) };
}

export const VERDICT_COPY: Record<
  Verdict,
  { label: string; tone: "success" | "neutral" | "warn" | "danger" }
> = {
  great: { label: "Great price", tone: "success" },
  good: { label: "Good price", tone: "success" },
  fair: { label: "Fair price", tone: "neutral" },
  high: { label: "Above market", tone: "warn" },
  over: { label: "Well above market", tone: "danger" },
};
