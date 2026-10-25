import { useQuery } from "@tanstack/react-query";
import { fetchComps } from "../../lib/comps";
import { evaluatePrice } from "../../lib/priceCheck";

export function usePriceCheck(args: {
  make: string;
  model: string;
  year: number | null;
  price: number;
  mileage: number | null;
  excludeId?: string;
  enabled?: boolean;
}) {
  const { make, model, year, price, mileage, excludeId, enabled = true } = args;
  const comps = useQuery({
    queryKey: ["comps", make.toLowerCase(), model.toLowerCase(), year, excludeId ?? null],
    enabled: enabled && !!make && !!model && year !== null,
    staleTime: 60_000,
    queryFn: () => fetchComps({ make, model, year: year as number, excludeId }),
  });
  const result = comps.data ? evaluatePrice(price, comps.data, { mileage }) : null;
  return { result, isLoading: comps.isLoading, hasData: !!comps.data };
}
