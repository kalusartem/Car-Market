import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";

// Optional database features. The app works against the original schema and lights
// these up once the matching migration in supabase/migrations has been applied.

async function probe(table: string, columns: string) {
  const { error } = await supabase.from(table).select(columns).limit(1);
  return !error;
}

/** vin, trim, body_type, drivetrain, exterior_color, title_status, city, state */
export function useExtendedSpecs() {
  const { data } = useQuery({
    queryKey: ["feature", "extended-specs"],
    queryFn: () =>
      probe("listings", "vin,trim,body_type,drivetrain,exterior_color,title_status,city,state"),
    staleTime: Infinity,
  });
  return data ?? false;
}

/** carmarket.listing_reports */
export function useReportsEnabled() {
  const { data } = useQuery({
    queryKey: ["feature", "reports"],
    queryFn: () => probe("listing_reports", "id"),
    staleTime: Infinity,
  });
  return data ?? false;
}
