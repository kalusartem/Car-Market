import { CURRENT_YEAR, MIN_YEAR } from "../../lib/specs";

export type SortKey =
  | "newest"
  | "price_asc"
  | "price_desc"
  | "mileage_asc"
  | "year_desc"
  | "distance";

export const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "newest", label: "Newest listed" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "mileage_asc", label: "Mileage: low to high" },
  { value: "year_desc", label: "Year: newest first" },
  { value: "distance", label: "Distance: nearest" },
];

export interface Filters {
  q: string;
  make: string;
  model: string;
  yearMin: number | null;
  yearMax: number | null;
  priceMin: number | null;
  priceMax: number | null;
  mileageMax: number | null;
  bodyType: string[];
  fuel: string[];
  transmission: string[];
  drivetrain: string[];
  zip: string;
  radius: number; // miles, 0 = anywhere
  sort: SortKey;
  page: number;
}

export const DEFAULT_FILTERS: Filters = {
  q: "",
  make: "",
  model: "",
  yearMin: null,
  yearMax: null,
  priceMin: null,
  priceMax: null,
  mileageMax: null,
  bodyType: [],
  fuel: [],
  transmission: [],
  drivetrain: [],
  zip: "",
  radius: 0,
  sort: "newest",
  page: 1,
};

const SORT_KEYS = new Set<string>(SORT_OPTIONS.map((o) => o.value));

function num(value: string | null, min: number, max: number): number | null {
  if (value === null || value.trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function list(value: string | null): string[] {
  return value ? value.split(",").map((s) => s.trim()).filter(Boolean) : [];
}

export function parseFilters(
  params: URLSearchParams,
  fromPath: { make?: string; model?: string } = {},
): Filters {
  const sortParam = params.get("sort") ?? "newest";
  return {
    q: params.get("q") ?? "",
    make: fromPath.make ?? params.get("make") ?? "",
    model: fromPath.model ?? params.get("model") ?? "",
    yearMin: num(params.get("yearMin"), MIN_YEAR, CURRENT_YEAR + 1),
    yearMax: num(params.get("yearMax"), MIN_YEAR, CURRENT_YEAR + 1),
    priceMin: num(params.get("priceMin"), 0, 10_000_000),
    // `maxPrice` is the pre-redesign parameter name; old links keep working.
    priceMax: num(params.get("priceMax") ?? params.get("maxPrice"), 0, 10_000_000),
    mileageMax: num(params.get("mileageMax"), 0, 1_000_000),
    bodyType: list(params.get("body")),
    fuel: list(params.get("fuel")),
    transmission: list(params.get("trans")),
    drivetrain: list(params.get("drive")),
    zip: (params.get("zip") ?? "").trim(),
    radius: num(params.get("radius"), 0, 500) ?? 0,
    sort: SORT_KEYS.has(sortParam) ? (sortParam as SortKey) : "newest",
    page: num(params.get("page"), 1, 1_000_000) ?? 1,
  };
}

export function filtersToParams(f: Filters): URLSearchParams {
  const p = new URLSearchParams();
  const set = (key: string, value: string | number | null | undefined) => {
    if (value !== null && value !== undefined && value !== "") p.set(key, String(value));
  };
  set("q", f.q.trim());
  set("make", f.make);
  set("model", f.model);
  set("yearMin", f.yearMin);
  set("yearMax", f.yearMax);
  set("priceMin", f.priceMin);
  set("priceMax", f.priceMax);
  set("mileageMax", f.mileageMax);
  if (f.bodyType.length) p.set("body", f.bodyType.join(","));
  if (f.fuel.length) p.set("fuel", f.fuel.join(","));
  if (f.transmission.length) p.set("trans", f.transmission.join(","));
  if (f.drivetrain.length) p.set("drive", f.drivetrain.join(","));
  set("zip", f.zip);
  if (f.radius > 0) p.set("radius", String(f.radius));
  if (f.sort !== "newest") p.set("sort", f.sort);
  if (f.page > 1) p.set("page", String(f.page));
  return p;
}

export interface FilterChip {
  key: string;
  label: string;
  patch: Partial<Filters>;
}

/** One removable chip per active filter, for the "applied filters" row. */
export function activeChips(f: Filters): FilterChip[] {
  const chips: FilterChip[] = [];
  const money = (n: number) => `$${n.toLocaleString("en-US")}`;

  if (f.q.trim()) chips.push({ key: "q", label: `“${f.q.trim()}”`, patch: { q: "" } });
  if (f.make) chips.push({ key: "make", label: f.make, patch: { make: "", model: "" } });
  if (f.model) chips.push({ key: "model", label: f.model, patch: { model: "" } });
  if (f.yearMin || f.yearMax) {
    chips.push({
      key: "year",
      label: `${f.yearMin ?? "Any"}–${f.yearMax ?? "Any"}`,
      patch: { yearMin: null, yearMax: null },
    });
  }
  if (f.priceMin !== null || f.priceMax !== null) {
    chips.push({
      key: "price",
      label:
        f.priceMin !== null && f.priceMax !== null
          ? `${money(f.priceMin)}–${money(f.priceMax)}`
          : f.priceMax !== null
            ? `Under ${money(f.priceMax)}`
            : `Over ${money(f.priceMin as number)}`,
      patch: { priceMin: null, priceMax: null },
    });
  }
  if (f.mileageMax !== null) {
    chips.push({
      key: "mileage",
      label: `Under ${f.mileageMax.toLocaleString("en-US")} mi`,
      patch: { mileageMax: null },
    });
  }
  for (const [key, values] of [
    ["bodyType", f.bodyType],
    ["fuel", f.fuel],
    ["transmission", f.transmission],
    ["drivetrain", f.drivetrain],
  ] as const) {
    for (const v of values) {
      chips.push({
        key: `${key}:${v}`,
        label: v,
        patch: { [key]: values.filter((x) => x !== v) } as Partial<Filters>,
      });
    }
  }
  if (f.zip && f.radius > 0) {
    chips.push({
      key: "radius",
      label: `${f.radius} mi of ${f.zip}`,
      patch: { radius: 0 },
    });
  }
  return chips;
}

export function toggleInList(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}
