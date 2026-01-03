import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../../lib/supabase";
import { ListingForm } from "../components/ListingForm";
import type { ListingRow } from "../components/ListingForm";
import { fetchAuthUser } from "../../../lib/auth";

async function fetchListing(id: string) {
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as ListingRow;
}

export function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // 1) Load auth user FIRST and wait for it
  const {
    data: user,
    isLoading: isAuthLoading,
    isError: isAuthError,
    error: authError,
  } = useQuery({
    queryKey: ["auth-user"],
    queryFn: fetchAuthUser,
    staleTime: 1000 * 30,
  });

  const userId = user?.id ?? null;

  // 2) Then load the listing (only after we have a user)
  const {
    data: listing,
    isLoading: isListingLoading,
    isError: isListingError,
    error: listingError,
  } = useQuery({
    queryKey: ["listing-edit", id],
    queryFn: () => fetchListing(id!),
    enabled: !!id && !!userId,
  });

  if (!id) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6">
        <div className="text-red-300">Missing listing id.</div>
        <Link to="/listings" className="text-blue-400 hover:underline">
          Back to listings
        </Link>
      </div>
    );
  }

  // Auth loading / error states
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6">
        Loading session…
      </div>
    );
  }

  if (isAuthError) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6">
        <div className="text-red-300">
          Auth error: {(authError as any)?.message ?? "Unknown error"}
        </div>
        <Link to="/listings" className="text-blue-400 hover:underline">
          Back to listings
        </Link>
      </div>
    );
  }

  // Require login for edit page
  if (!userId) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6">
        <div className="text-slate-300">
          You need to be logged in to edit listings.
        </div>
        <Link to="/listings" className="text-blue-400 hover:underline">
          Back to listings
        </Link>
      </div>
    );
  }

  // Listing loading / error states
  if (isListingLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6">
        Loading listing…
      </div>
    );
  }

  if (isListingError) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6">
        <div className="text-red-300">
          Failed to load listing:{" "}
          {(listingError as any)?.message ?? "Unknown error"}
        </div>
        <Link to="/listings" className="text-blue-400 hover:underline">
          Back to listings
        </Link>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6">
        <div className="text-red-300">Listing not found.</div>
        <Link to="/listings" className="text-blue-400 hover:underline">
          Back to listings
        </Link>
      </div>
    );
  }

  // Ownership guard
  if (listing.seller_id !== userId) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6">
        <div className="text-red-300">
          You don’t have permission to edit this listing.
        </div>
        <Link to={`/listings/${id}`} className="text-blue-400 hover:underline">
          View listing
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-4xl mx-auto px-6 pt-8">
        <Link
          to={`/listings/${id}`}
          className="text-slate-300 hover:text-white"
        >
          ← Back to listing
        </Link>

        <button
          className="ml-4 text-sm text-slate-300 hover:text-white"
          onClick={() => navigate("/listings")}
        >
          Browse
        </button>
      </div>

      <ListingForm
        mode="edit"
        listingId={id}
        initial={listing}
        showImages
        onSaved={() => {
          // optional: toast later
        }}
      />
    </div>
  );
}
