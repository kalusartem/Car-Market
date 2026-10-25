// Vehicle data from NHTSA's public APIs (free, no API key, CORS enabled):
//   vPIC     https://vpic.nhtsa.dot.gov/api/       makes, models, VIN decoding
//   Recalls  https://api.nhtsa.gov/recalls/         recall campaigns by make/model/year
// vPIC is a government service with occasional slow periods, so every call has a
// timeout and results are cached in localStorage; callers fall back to free text.

import { BODY_TYPES, DRIVETRAINS, FUEL_TYPES, TRANSMISSIONS } from "./specs";

const VPIC = "https://vpic.nhtsa.dot.gov/api/vehicles";
const RECALLS = "https://api.nhtsa.gov/recalls/recallsByVehicle";
const DAY = 86_400_000;

// ---------- fetch + cache ----------

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`NHTSA request failed (${res.status})`);
  return (await res.json()) as T;
}

async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>) {
  const storageKey = `nhtsa:${key}`;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const hit = JSON.parse(raw) as { t: number; v: T };
      if (Date.now() - hit.t < ttlMs) return hit.v;
    }
  } catch {
    // unreadable cache entry: refetch
  }
  const value = await load();
  try {
    localStorage.setItem(storageKey, JSON.stringify({ t: Date.now(), v: value }));
  } catch {
    // quota or blocked storage: skip caching
  }
  return value;
}

// ---------- makes ----------

export const POPULAR_MAKES = [
  "Acura", "Audi", "BMW", "Buick", "Cadillac", "Chevrolet", "Chrysler", "Dodge",
  "Fiat", "Ford", "Genesis", "GMC", "Honda", "Hyundai", "Infiniti", "Jaguar",
  "Jeep", "Kia", "Land Rover", "Lexus", "Lincoln", "Mazda", "Mercedes-Benz",
  "MINI", "Mitsubishi", "Nissan", "Porsche", "Ram", "Rivian", "Subaru",
  "Tesla", "Toyota", "Volkswagen", "Volvo",
];

const KEEP_UPPER = new Set(["BMW", "GMC", "RAM", "MG", "AMC", "MINI", "DS", "BYD", "FAW", "SSC"]);
const SPECIAL_CASE: Record<string, string> = { MCLAREN: "McLaren", DELOREAN: "DeLorean" };

/** vPIC returns makes in ALL CAPS ("TOYOTA", "MERCEDES-BENZ"). */
export function prettyMake(raw: string) {
  const name = raw.trim();
  if (!name) return name;
  if (name !== name.toUpperCase()) return name; // already mixed case
  if (KEEP_UPPER.has(name)) return name;
  if (SPECIAL_CASE[name]) return SPECIAL_CASE[name];
  return name
    .toLowerCase()
    .replace(/(^|[\s-])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

// vPIC also lists coachbuilders, kit-car shops and one-off builders. Hide the ones that
// are obviously not consumer brands from the "All makes" list.
const NOISE =
  /\b(inc|llc|ltd|corp|corporation|company|co|coach|coachworks|coach builders|custom|customs|equipment|manufacturing|specialty vehicles|production group|bus|kit|reproduction|motorcars|hot rods|studios|design group|automotive group|services)\b|[\d&!()]/i;

export function isNoiseMake(name: string) {
  return NOISE.test(name);
}

export interface MakeLists {
  popular: string[];
  all: string[];
}

export function buildMakeLists(apiMakes: string[]): MakeLists {
  const byKey = new Map<string, string>();
  for (const m of [...POPULAR_MAKES, ...apiMakes.map(prettyMake).filter((m) => !isNoiseMake(m))]) {
    const key = m.toLowerCase().replace(/[\s-]+/g, "");
    if (m && !byKey.has(key)) byKey.set(key, m);
  }
  const popularKeys = new Set(
    POPULAR_MAKES.map((m) => m.toLowerCase().replace(/[\s-]+/g, "")),
  );
  const popular: string[] = [];
  const all: string[] = [];
  for (const [key, name] of byKey) (popularKeys.has(key) ? popular : all).push(name);
  popular.sort((a, b) => a.localeCompare(b));
  all.sort((a, b) => a.localeCompare(b));
  return { popular, all };
}

type MakesResponse = { Results: Array<{ MakeName: string }> };

export function fetchMakes(): Promise<MakeLists> {
  // Passenger cars and MPVs/SUVs only. vPIC's "truck" type is mostly heavy-duty and
  // body-builder makes (fire engines, street sweepers); pickups from the usual brands
  // are already listed under these types.
  return cached("makes:v2", 30 * DAY, async () => {
    const types = ["car", "multipurpose"];
    const lists = await Promise.all(
      types.map((t) =>
        getJson<MakesResponse>(`${VPIC}/GetMakesForVehicleType/${t}?format=json`),
      ),
    );
    return buildMakeLists(lists.flatMap((l) => l.Results.map((r) => r.MakeName)));
  });
}

// ---------- models ----------

type ModelsResponse = { Results: Array<{ Model_Name: string }> };

export function fetchModels(make: string, year?: number): Promise<string[]> {
  const m = make.trim();
  if (!m) return Promise.resolve([]);
  const key = `models:v1:${m.toLowerCase()}:${year ?? "all"}`;
  return cached(key, 30 * DAY, async () => {
    const url = year
      ? `${VPIC}/GetModelsForMakeYear/make/${encodeURIComponent(m)}/modelyear/${year}?format=json`
      : `${VPIC}/GetModelsForMake/${encodeURIComponent(m)}?format=json`;
    const json = await getJson<ModelsResponse>(url);
    const names = new Set(json.Results.map((r) => r.Model_Name.trim()).filter(Boolean));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  });
}

// ---------- VIN ----------

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;
const TRANSLIT: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

export function normalizeVin(input: string) {
  return input.replace(/\s+/g, "").toUpperCase();
}

/** 17 characters, no I, O or Q. */
export function isValidVinFormat(vin: string) {
  return VIN_RE.test(vin);
}

/** North American check digit (position 9). Other markets don't always use it. */
export function hasValidCheckDigit(vin: string) {
  if (!isValidVinFormat(vin)) return false;
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const c = vin[i];
    const v = /\d/.test(c) ? Number(c) : TRANSLIT[c];
    sum += v * WEIGHTS[i];
  }
  const rem = sum % 11;
  return vin[8] === (rem === 10 ? "X" : String(rem));
}

type Pick<T extends readonly string[]> = T[number];

export function mapBodyClass(bodyClass: string): Pick<typeof BODY_TYPES> | "" {
  const s = bodyClass.toLowerCase();
  if (!s) return "";
  if (s.includes("convertible") || s.includes("roadster") || s.includes("cabriolet")) return "Convertible";
  if (s.includes("sedan")) return "Sedan";
  if (s.includes("coupe")) return "Coupe";
  if (s.includes("hatchback")) return "Hatchback";
  if (s.includes("wagon")) return "Wagon";
  if (s.includes("sport utility") || s.includes("crossover") || s.includes("suv") || s.includes("multi-purpose")) return "SUV";
  if (s.includes("pickup") || s.includes("truck")) return "Truck";
  if (s.includes("van")) return "Van";
  return "";
}

export function mapDriveType(driveType: string): Pick<typeof DRIVETRAINS> | "" {
  const s = driveType.toLowerCase();
  if (s.includes("awd") || s.includes("all-wheel")) return "AWD";
  if (s.includes("4wd") || s.includes("4-wheel") || s.includes("4x4")) return "4WD";
  if (s.includes("fwd") || s.includes("front-wheel")) return "FWD";
  if (s.includes("rwd") || s.includes("rear-wheel")) return "RWD";
  return ""; // "4x2" is ambiguous between FWD and RWD
}

export function mapFuel(
  primary: string,
  secondary: string,
  electrification: string,
): Pick<typeof FUEL_TYPES> | "" {
  const p = primary.toLowerCase();
  const e = electrification.toLowerCase();
  if (e.includes("hev") || e.includes("hybrid") || secondary.toLowerCase().includes("electric")) {
    if (!p.includes("electric") || e.includes("hev")) return "Hybrid";
  }
  if (e.includes("bev") || p === "electric") return "Electric";
  if (p.includes("diesel")) return "Diesel";
  if (p.includes("gasoline") || p.includes("flex") || p.includes("e85")) return "Gasoline";
  return "";
}

export function mapTransmission(style: string): Pick<typeof TRANSMISSIONS> | "" {
  const s = style.toLowerCase();
  if (s.includes("cvt") || s.includes("continuously")) return "CVT";
  if (s.includes("dual") || s.includes("dct")) return "DCT";
  if (s.includes("manual")) return "Manual";
  if (s.includes("automatic")) return "Automatic";
  return "";
}

export interface VinDecoded {
  vin: string;
  year: number | null;
  make: string;
  model: string;
  trim: string;
  bodyType: string;
  drivetrain: string;
  fuelType: string;
  transmission: string;
  engine: string;
  checkDigitOk: boolean;
}

type DecodeResponse = { Results: Array<Record<string, string>> };

export async function decodeVin(rawVin: string): Promise<VinDecoded | null> {
  const vin = normalizeVin(rawVin);
  if (!isValidVinFormat(vin)) return null;
  const json = await cached(`vin:v1:${vin}`, 90 * DAY, () =>
    getJson<DecodeResponse>(`${VPIC}/DecodeVinValues/${vin}?format=json`),
  );
  const r = json.Results?.[0];
  if (!r || !r.Make || !r.ModelYear) return null;

  const cyl = r.EngineCylinders ? `${r.EngineCylinders}-cyl` : "";
  const disp = r.DisplacementL ? `${Number(r.DisplacementL).toFixed(1)}L` : "";
  const year = Number(r.ModelYear);

  return {
    vin,
    year: Number.isFinite(year) ? year : null,
    make: prettyMake(r.Make),
    model: (r.Model ?? "").trim(),
    trim: (r.Trim ?? "").trim(),
    bodyType: mapBodyClass(r.BodyClass ?? ""),
    drivetrain: mapDriveType(r.DriveType ?? ""),
    fuelType: mapFuel(
      r.FuelTypePrimary ?? "",
      r.FuelTypeSecondary ?? "",
      r.ElectrificationLevel ?? "",
    ),
    transmission: mapTransmission(r.TransmissionStyle ?? ""),
    engine: [disp, cyl].filter(Boolean).join(" "),
    checkDigitOk: hasValidCheckDigit(vin),
  };
}

// ---------- recalls ----------

export interface Recall {
  campaign: string;
  component: string;
  summary: string;
  reportedOn: string;
}

type RecallsResponse = {
  Count: number;
  results: Array<{
    NHTSACampaignNumber: string;
    Component: string;
    Summary: string;
    ReportReceivedDate: string;
  }>;
};

export function fetchRecalls(make: string, model: string, year: number): Promise<Recall[]> {
  const key = `recalls:v1:${make}:${model}:${year}`.toLowerCase();
  return cached(key, 7 * DAY, async () => {
    const url = `${RECALLS}?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${year}`;
    const json = await getJson<RecallsResponse>(url);
    return (json.results ?? []).map((r) => ({
      campaign: r.NHTSACampaignNumber,
      component: r.Component,
      summary: r.Summary,
      reportedOn: r.ReportReceivedDate,
    }));
  });
}

export const nhtsaRecallLookupUrl = (vin?: string | null) =>
  vin
    ? `https://www.nhtsa.gov/recalls?vin=${encodeURIComponent(vin)}`
    : "https://www.nhtsa.gov/recalls";
