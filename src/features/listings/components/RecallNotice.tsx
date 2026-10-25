import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertIcon, ShieldCheckIcon } from "../../../components/icons";
import { fetchRecalls, nhtsaRecallLookupUrl } from "../../../lib/vehicle";

type Props = { make: string; model: string; year: number | null; vin?: string | null };

export function RecallNotice({ make, model, year, vin }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["recalls", make.toLowerCase(), model.toLowerCase(), year],
    enabled: year !== null,
    staleTime: Infinity,
    retry: 1,
    queryFn: () => fetchRecalls(make, model, year as number),
  });

  if (year === null || isError) return null;
  if (isLoading) return <div className="card h-20 animate-pulse bg-surface-2" aria-hidden="true" />;

  const recalls = data ?? [];
  const label = `${year} ${make} ${model}`;
  const lookup = (
    <a
      href={nhtsaRecallLookupUrl(vin)}
      target="_blank"
      rel="noopener noreferrer"
      className="font-semibold text-link hover:underline"
    >
      Check {vin ? "this VIN" : "a VIN"} on NHTSA.gov
    </a>
  );

  if (recalls.length === 0) {
    return (
      <section className="card flex gap-3 p-5" aria-label="Safety recalls">
        <ShieldCheckIcon className="mt-0.5 shrink-0 text-success" />
        <div className="text-sm">
          <h2 className="font-semibold">No recall campaigns on record</h2>
          <p className="mt-1 text-muted">
            NHTSA lists no recall campaigns for the {label}. {lookup} to confirm for this exact car.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="card border-warn/40 p-5" aria-label="Safety recalls">
      <div className="flex gap-3">
        <AlertIcon className="mt-0.5 shrink-0 text-warn" />
        <div className="min-w-0 text-sm">
          <h2 className="font-semibold">
            {recalls.length} recall {recalls.length === 1 ? "campaign" : "campaigns"} for this model year
          </h2>
          <p className="mt-1 text-muted">
            NHTSA lists these for the {label}. Whether this particular car is affected, or already repaired,
            depends on its VIN. {lookup}.
          </p>
          <button type="button" className="mt-2 font-semibold text-link hover:underline" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Hide details" : "Show details"}
          </button>
          {expanded ? (
            <ul className="mt-3 space-y-3">
              {recalls.map((r) => (
                <li key={r.campaign} className="rounded-lg bg-surface-2 p-3">
                  <div className="font-medium">{r.component}</div>
                  <div className="text-xs text-subtle">Campaign {r.campaign} · reported {r.reportedOn}</div>
                  <p className="mt-1 text-muted">{r.summary.length > 280 ? `${r.summary.slice(0, 280)}…` : r.summary}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  );
}
