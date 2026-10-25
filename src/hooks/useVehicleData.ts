import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { buildMakeLists, fetchMakes, fetchModels, type MakeLists } from "../lib/vehicle";

const EMPTY: MakeLists = { popular: [], all: [] };

/** Makes from NHTSA vPIC, falling back to the `brands` table if vPIC is unreachable. */
export function useMakes() {
  const q = useQuery({
    queryKey: ["vehicle", "makes"],
    staleTime: Infinity,
    retry: 1,
    queryFn: async (): Promise<MakeLists> => {
      try {
        return await fetchMakes();
      } catch {
        const { data } = await supabase.from("brands").select("name");
        const names = (data ?? []).map((r: { name: string }) => r.name);
        if (names.length) return buildMakeLists(names);
        throw new Error("No make list available");
      }
    },
  });
  return { makes: q.data ?? EMPTY, isLoading: q.isLoading, failed: q.isError };
}

/** Models for a make (optionally narrowed to a model year), with the same DB fallback. */
export function useModels(make: string, year?: number) {
  const q = useQuery({
    queryKey: ["vehicle", "models", make.toLowerCase(), year ?? null],
    enabled: make.trim().length > 0,
    staleTime: Infinity,
    retry: 1,
    queryFn: async (): Promise<string[]> => {
      try {
        const models = await fetchModels(make, year);
        if (models.length) return models;
      } catch {
        // fall through to the database catalog
      }
      const { data: brand } = await supabase
        .from("brands")
        .select("id")
        .ilike("name", make.trim())
        .maybeSingle();
      if (!brand) return [];
      const { data } = await supabase
        .from("models")
        .select("name")
        .eq("brand_id", brand.id)
        .order("name");
      return (data ?? []).map((r: { name: string }) => r.name);
    },
  });
  return { models: q.data ?? [], isLoading: q.isFetching && make.trim().length > 0 };
}
