import { describe, expect, it } from "vitest";
import { evaluatePrice, quantile, verdictFor, type Comp } from "../priceCheck";

const comps = (prices: number[], mileage: number | null = null): Comp[] =>
  prices.map((price) => ({ price, mileage, year: 2020 }));

describe("quantile", () => {
  it("interpolates", () => {
    expect(quantile([10, 20, 30, 40], 0.5)).toBe(25);
    expect(quantile([10, 20, 30, 40], 0)).toBe(10);
    expect(quantile([10, 20, 30, 40], 1)).toBe(40);
    expect(quantile([5], 0.9)).toBe(5);
  });
});

describe("verdictFor", () => {
  it("buckets the percentage difference from the median", () => {
    expect(verdictFor(-0.2)).toBe("great");
    expect(verdictFor(-0.05)).toBe("good");
    expect(verdictFor(0)).toBe("fair");
    expect(verdictFor(0.1)).toBe("high");
    expect(verdictFor(0.3)).toBe("over");
  });
});

describe("evaluatePrice", () => {
  it("returns null without enough comparable cars", () => {
    expect(evaluatePrice(20000, comps([19000, 21000]))).toBeNull();
  });
  it("rates against the median", () => {
    const r = evaluatePrice(17000, comps([19000, 20000, 21000, 22000, 20000]))!;
    expect(r.median).toBe(20000);
    expect(r.count).toBe(5);
    expect(r.verdict).toBe("great");
    expect(r.diffPct).toBeCloseTo(-0.15);
  });
  it("prefers comps with similar mileage when there are enough", () => {
    const pool: Comp[] = [
      { price: 30000, mileage: 20000, year: 2020 },
      { price: 31000, mileage: 22000, year: 2020 },
      { price: 29000, mileage: 25000, year: 2020 },
      { price: 15000, mileage: 120000, year: 2020 },
      { price: 14000, mileage: 130000, year: 2020 },
    ];
    const r = evaluatePrice(30000, pool, { mileage: 22000 })!;
    expect(r.basis).toBe("mileage");
    expect(r.count).toBe(3);
    expect(r.median).toBe(30000);
  });
  it("falls back to all comps when too few match the mileage", () => {
    const r = evaluatePrice(20000, comps([19000, 20000, 21000], 50000), { mileage: 200000 })!;
    expect(r.basis).toBe("model");
  });
  it("ignores invalid prices", () => {
    expect(evaluatePrice(0, comps([1, 2, 3]))).toBeNull();
  });
});

import { summarizeComps } from "../priceCheck";

describe("summarizeComps", () => {
  it("returns median and interquartile range", () => {
    const s = summarizeComps(comps([10000, 20000, 30000, 40000, 50000]))!;
    expect(s.median).toBe(30000);
    expect(s.low).toBe(20000);
    expect(s.high).toBe(40000);
    expect(s.count).toBe(5);
  });
  it("needs a minimum number of comps", () => {
    expect(summarizeComps(comps([10000, 20000]))).toBeNull();
  });
});
