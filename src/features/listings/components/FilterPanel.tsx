import { useEffect, useState } from "react";
import { useMakes, useModels } from "../../../hooks/useVehicleData";
import { useExtendedSpecs } from "../../../lib/features";
import {
  BODY_TYPES,
  CURRENT_YEAR,
  DRIVETRAINS,
  FUEL_TYPES,
  MIN_YEAR,
  TRANSMISSIONS,
} from "../../../lib/specs";
import { toggleInList, type Filters } from "../filters";

type Props = {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onClear: () => void;
  /** The ZIP couldn't be found, so the radius has no effect. */
  zipProblem?: boolean;
};

const MILEAGE_OPTIONS = [25_000, 50_000, 75_000, 100_000, 150_000];
const RADIUS_OPTIONS = [10, 25, 50, 100, 250];

/** Numeric input that applies after a short pause, so typing doesn't refetch per keystroke. */
function NumberField({
  label,
  value,
  onCommit,
  placeholder,
  min,
  max,
}: {
  label: string;
  value: number | null;
  onCommit: (n: number | null) => void;
  placeholder: string;
  min?: number;
  max?: number;
}) {
  const [text, setText] = useState(value === null ? "" : String(value));

  useEffect(() => {
    setText(value === null ? "" : String(value));
  }, [value]);

  useEffect(() => {
    const n = text.trim() === "" ? null : Number(text);
    if (n !== null && !Number.isFinite(n)) return;
    if (n === value) return;
    const t = setTimeout(() => onCommit(n), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <label className="block min-w-0 flex-1">
      <span className="sr-only">{label}</span>
      <input
        className="input"
        inputMode="numeric"
        placeholder={placeholder}
        aria-label={label}
        min={min}
        max={max}
        value={text}
        onChange={(e) => setText(e.target.value.replace(/[^\d]/g, ""))}
      />
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={title} className="border-t border-line pt-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">{title}</h3>
      {children}
    </div>
  );
}

function ChipGroup({
  options,
  selected,
  onToggle,
}: {
  options: readonly string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(o)}
            className={`rounded-full border px-3 py-1 text-sm transition ${
              on
                ? "border-accent bg-accent-soft font-semibold text-link"
                : "border-line-strong bg-surface text-muted hover:bg-surface-2"
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

export function FilterPanel({ filters, onChange, onClear, zipProblem }: Props) {
  const extended = useExtendedSpecs();
  const { makes, isLoading: makesLoading, failed: makesFailed } = useMakes();
  const { models, isLoading: modelsLoading } = useModels(filters.make);

  const makeKnown =
    !filters.make || [...makes.popular, ...makes.all].some((m) => m.toLowerCase() === filters.make.toLowerCase());

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="f-q" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-subtle">
          Search
        </label>
        <input
          id="f-q"
          className="input"
          placeholder="e.g. Camry, Civic Si…"
          defaultValue={filters.q}
          key={filters.q}
          onKeyDown={(e) => {
            if (e.key === "Enter") onChange({ q: e.currentTarget.value });
          }}
          onBlur={(e) => {
            if (e.target.value !== filters.q) onChange({ q: e.target.value });
          }}
        />
      </div>

      <Section title="Make & model">
        <div className="space-y-2">
          {makesFailed ? (
            <input
              className="input"
              placeholder="Make"
              aria-label="Make"
              defaultValue={filters.make}
              onBlur={(e) => onChange({ make: e.target.value.trim(), model: "" })}
            />
          ) : (
            <select
              className="input"
              aria-label="Make"
              value={filters.make}
              disabled={makesLoading}
              onChange={(e) => onChange({ make: e.target.value, model: "" })}
            >
              <option value="">{makesLoading ? "Loading makes…" : "Any make"}</option>
              {!makeKnown ? <option value={filters.make}>{filters.make}</option> : null}
              <optgroup label="Popular">
                {makes.popular.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </optgroup>
              {makes.all.length ? (
                <optgroup label="All makes">
                  {makes.all.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          )}

          {models.length > 0 || modelsLoading ? (
            <select
              className="input"
              aria-label="Model"
              value={filters.model}
              disabled={!filters.make || modelsLoading}
              onChange={(e) => onChange({ model: e.target.value })}
            >
              <option value="">
                {!filters.make ? "Choose a make first" : modelsLoading ? "Loading models…" : "Any model"}
              </option>
              {filters.model && !models.some((m) => m.toLowerCase() === filters.model.toLowerCase()) ? (
                <option value={filters.model}>{filters.model}</option>
              ) : null}
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="input"
              placeholder={filters.make ? "Model" : "Choose a make first"}
              aria-label="Model"
              disabled={!filters.make}
              defaultValue={filters.model}
              key={filters.make + filters.model}
              onBlur={(e) => onChange({ model: e.target.value.trim() })}
            />
          )}
        </div>
      </Section>

      <Section title="Price">
        <div className="flex items-center gap-2">
          <NumberField label="Minimum price" placeholder="Min $" value={filters.priceMin} onCommit={(n) => onChange({ priceMin: n })} />
          <span className="text-subtle">–</span>
          <NumberField label="Maximum price" placeholder="Max $" value={filters.priceMax} onCommit={(n) => onChange({ priceMax: n })} />
        </div>
      </Section>

      <Section title="Year">
        <div className="flex items-center gap-2">
          <NumberField label="Earliest year" placeholder={String(MIN_YEAR)} value={filters.yearMin} min={MIN_YEAR} max={CURRENT_YEAR + 1} onCommit={(n) => onChange({ yearMin: n })} />
          <span className="text-subtle">–</span>
          <NumberField label="Latest year" placeholder={String(CURRENT_YEAR)} value={filters.yearMax} min={MIN_YEAR} max={CURRENT_YEAR + 1} onCommit={(n) => onChange({ yearMax: n })} />
        </div>
      </Section>

      <Section title="Mileage">
        <select
          className="input"
          aria-label="Maximum mileage"
          value={filters.mileageMax ?? ""}
          onChange={(e) => onChange({ mileageMax: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">Any mileage</option>
          {MILEAGE_OPTIONS.map((m) => (
            <option key={m} value={m}>
              Under {m.toLocaleString("en-US")} mi
            </option>
          ))}
        </select>
      </Section>

      {extended ? (
        <Section title="Body type">
          <ChipGroup options={BODY_TYPES} selected={filters.bodyType} onToggle={(v) => onChange({ bodyType: toggleInList(filters.bodyType, v) })} />
        </Section>
      ) : null}

      <Section title="Fuel">
        <ChipGroup options={FUEL_TYPES} selected={filters.fuel} onToggle={(v) => onChange({ fuel: toggleInList(filters.fuel, v) })} />
      </Section>

      <Section title="Transmission">
        <ChipGroup options={TRANSMISSIONS} selected={filters.transmission} onToggle={(v) => onChange({ transmission: toggleInList(filters.transmission, v) })} />
      </Section>

      {extended ? (
        <Section title="Drivetrain">
          <ChipGroup options={DRIVETRAINS} selected={filters.drivetrain} onToggle={(v) => onChange({ drivetrain: toggleInList(filters.drivetrain, v) })} />
        </Section>
      ) : null}

      <Section title="Location">
        <div className="flex gap-2">
          <input
            className="input w-28"
            inputMode="numeric"
            maxLength={5}
            placeholder="ZIP"
            aria-label="ZIP code"
            defaultValue={filters.zip}
            key={filters.zip}
            onKeyDown={(e) => {
              if (e.key === "Enter") onChange({ zip: e.currentTarget.value.trim() });
            }}
            onBlur={(e) => {
              if (e.target.value.trim() !== filters.zip) onChange({ zip: e.target.value.trim() });
            }}
          />
          <select
            className="input"
            aria-label="Search radius"
            value={filters.radius}
            onChange={(e) => {
              const radius = Number(e.target.value);
              onChange({ radius, sort: radius > 0 ? "distance" : filters.sort === "distance" ? "newest" : filters.sort });
            }}
          >
            <option value={0}>Anywhere</option>
            {RADIUS_OPTIONS.map((r) => (
              <option key={r} value={r}>
                Within {r} mi
              </option>
            ))}
          </select>
        </div>
        {filters.radius > 0 && !filters.zip ? (
          <p className="mt-2 text-xs text-subtle">Enter a ZIP code to search by distance.</p>
        ) : null}
        {zipProblem ? (
          <p className="mt-2 text-xs text-warn">We couldn’t find that ZIP, so distance is ignored.</p>
        ) : null}
      </Section>

      <button type="button" className="btn-ghost w-full" onClick={onClear}>
        Clear all filters
      </button>
    </div>
  );
}
