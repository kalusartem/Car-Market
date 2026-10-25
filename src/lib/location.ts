export type LatLng = { lat: number; lng: number };

export interface ZipInfo extends LatLng {
  city: string;
  state: string;
}

type ZippopotamResponse = {
  places?: Array<{ latitude: string; longitude: string; "place name": string; "state abbreviation": string }>;
};

const cache = new Map<string, ZipInfo | null>();

/**
 * Resolve a US ZIP to coordinates, city and state using Zippopotam.us (no key).
 * Results are cached for the session; returns null if the ZIP is unknown or the call fails.
 */
export async function lookupZip(zip: string): Promise<ZipInfo | null> {
  const clean = zip.trim().slice(0, 5);
  if (!/^\d{5}$/.test(clean)) return null;
  if (cache.has(clean)) return cache.get(clean) ?? null;

  try {
    const res = await fetch(`https://api.zippopotam.us/us/${clean}`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      if (res.status === 404) cache.set(clean, null);
      return null;
    }
    const json = (await res.json()) as ZippopotamResponse;
    const place = json.places?.[0];
    const lat = Number(place?.latitude);
    const lng = Number(place?.longitude);
    if (!place || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      cache.set(clean, null);
      return null;
    }
    const info: ZipInfo = {
      lat,
      lng,
      city: place["place name"],
      state: place["state abbreviation"],
    };
    cache.set(clean, info);
    return info;
  } catch {
    return null;
  }
}

export async function geocodeZip(zip: string): Promise<LatLng | null> {
  const info = await lookupZip(zip);
  return info ? { lat: info.lat, lng: info.lng } : null;
}
