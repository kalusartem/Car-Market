import { describe, expect, it } from "vitest";
import { haversineMiles, nameLikePattern, slugify, unslugify, formatPrice, timeAgo } from "../format";

describe("format helpers", () => {
  it("formats prices and tolerates numeric strings", () => {
    expect(formatPrice(18500)).toBe("$18,500");
    expect(formatPrice("78000")).toBe("$78,000");
    expect(formatPrice(null)).toBe("—");
    expect(formatPrice(undefined)).toBe("—");
    expect(formatPrice("abc")).toBe("—");
  });
  it("slugifies and reverses names", () => {
    expect(slugify("Mercedes-Benz")).toBe("mercedes-benz");
    expect(slugify("Land Cruiser")).toBe("land-cruiser");
    expect(unslugify("land-cruiser")).toBe("Land Cruiser");
  });
  it("builds a hyphen/space-insensitive, wildcard-safe like pattern", () => {
    expect(nameLikePattern("Mercedes Benz")).toBe("Mercedes_Benz");
    expect(nameLikePattern("Mercedes-Benz")).toBe("Mercedes_Benz");
    expect(nameLikePattern("100%")).toBe("100\\%");
  });
  it("computes great-circle distance", () => {
    const nyc = { lat: 40.7128, lng: -74.006 };
    const la = { lat: 34.0522, lng: -118.2437 };
    expect(haversineMiles(nyc, la)).toBeGreaterThan(2400);
    expect(haversineMiles(nyc, la)).toBeLessThan(2500);
    expect(haversineMiles(nyc, nyc)).toBeCloseTo(0);
  });
  it("describes listing age", () => {
    const now = new Date("2026-10-25T12:00:00Z").getTime();
    expect(timeAgo("2026-10-25T01:00:00Z", now)).toBe("Today");
    expect(timeAgo("2026-10-24T01:00:00Z", now)).toBe("Yesterday");
    expect(timeAgo("2026-10-15T00:00:00Z", now)).toBe("10 days ago");
  });
});
