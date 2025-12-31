import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../../lib/supabase";
import { ListingCard } from "./ListingCard";
import type { CarListing } from "../../../types/car.ts";

export function FeaturedListings() {
  const {
    data: cars,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["featured-listings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(6);

      if (error) throw error;
      return data as CarListing[];
    },
  });

  if (isLoading)
    return (
      <div className="text-center p-20 text-slate-400">
        Loading inventory...
      </div>
    );
  if (error)
    return (
      <div className="text-center p-20 text-red-400">Error loading cars.</div>
    );

  return (
    <section className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white">Featured Inventory</h2>
          <p className="text-slate-400">Hand-picked premium vehicles</p>
        </div>
        <button className="text-blue-400 hover:text-blue-300 font-medium">
          View All →
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {cars?.map(
          (car) => (
            console.log("car", car),
            (<ListingCard key={car.id} car={car} />)
          ),
        )}
      </div>
    </section>
  );
}
