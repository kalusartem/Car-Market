import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuthUser } from "../../lib/auth";

/** Saved-state + optimistic toggle for the listings currently on screen. */
export function useFavorites(listingIds: string[]) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: user } = useAuthUser();
  const userId = user?.id ?? null;

  const key = useMemo(
    () => ["favorites-for-page", userId, [...listingIds].sort().join("|")] as const,
    [userId, listingIds],
  );

  const { data: saved } = useQuery({
    queryKey: key,
    enabled: !!userId && listingIds.length > 0,
    staleTime: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("favorites")
        .select("listing_id")
        .eq("user_id", userId!)
        .in("listing_id", listingIds);
      if (error) throw error;
      return new Set<string>((data ?? []).map((r: { listing_id: string }) => r.listing_id));
    },
  });

  const mutation = useMutation({
    mutationFn: async (listingId: string) => {
      const isSaved = saved?.has(listingId) ?? false;
      if (isSaved) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", userId!)
          .eq("listing_id", listingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("favorites")
          .insert({ user_id: userId!, listing_id: listingId });
        if (error) throw error;
      }
    },
    onMutate: async (listingId) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Set<string>>(key);
      const next = new Set<string>(prev ?? []);
      if (next.has(listingId)) next.delete(listingId);
      else next.add(listingId);
      qc.setQueryData(key, next);
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["favorites"] });
      qc.invalidateQueries({ queryKey: ["favorite"] });
    },
  });

  return {
    isSaved: (id: string) => saved?.has(id) ?? false,
    toggle: (id: string) => {
      if (!userId) {
        navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
        return;
      }
      mutation.mutate(id);
    },
  };
}
