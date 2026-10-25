// Pure helpers shared by the React app and the Cloudflare Pages Functions that
// pre-render <head> tags for crawlers (functions/). Keep this file free of
// browser, React and Supabase imports.

import type { Listing } from "../types/car";

export function seoTitle(l: Pick<Listing, "year" | "make" | "model" | "trim">) {
  return [l.year, l.make, l.model, l.trim].filter(Boolean).join(" ");
}

export function seoPlace(l: Pick<Listing, "city" | "state" | "zip_code">) {
  if (l.city && l.state) return `${l.city}, ${l.state}`;
  return l.zip_code ?? "";
}

export function seoDescription(
  l: Pick<Listing, "year" | "make" | "model" | "trim" | "price" | "mileage" | "transmission" | "fuel_type" | "city" | "state" | "zip_code">,
) {
  const price = Number(l.price);
  const parts = [
    `${seoTitle(l)} for sale`,
    Number.isFinite(price) ? `$${price.toLocaleString("en-US")}` : "",
    l.mileage != null ? `${Number(l.mileage).toLocaleString("en-US")} miles` : "",
    l.transmission ?? "",
    l.fuel_type ?? "",
    seoPlace(l),
  ].filter(Boolean);
  return `${parts.join(" · ")}. View photos, specs and message the seller on Car Market.`;
}

export function listingJsonLd(
  l: Listing,
  url: string,
  images: string[],
): Record<string, unknown> {
  const price = Number(l.price);
  return {
    "@context": "https://schema.org",
    "@type": "Car",
    name: seoTitle(l),
    url,
    brand: { "@type": "Brand", name: l.make },
    model: l.model,
    ...(l.year ? { vehicleModelDate: String(l.year) } : {}),
    ...(l.mileage != null
      ? { mileageFromOdometer: { "@type": "QuantitativeValue", value: l.mileage, unitCode: "SMI" } }
      : {}),
    ...(l.fuel_type ? { fuelType: l.fuel_type } : {}),
    ...(l.transmission ? { vehicleTransmission: l.transmission } : {}),
    ...(l.body_type ? { bodyType: l.body_type } : {}),
    ...(l.drivetrain ? { driveWheelConfiguration: l.drivetrain } : {}),
    ...(l.exterior_color ? { color: l.exterior_color } : {}),
    ...(l.vin ? { vehicleIdentificationNumber: l.vin } : {}),
    ...(images.length ? { image: images } : {}),
    ...(l.description ? { description: l.description.slice(0, 500) } : {}),
    offers: {
      "@type": "Offer",
      url,
      price: Number.isFinite(price) ? price : undefined,
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/UsedCondition",
    },
  };
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
