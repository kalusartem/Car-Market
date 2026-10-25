// src/features/listings/pages/EditListingPage.tsx
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../../lib/supabase";
import { ListingForm } from "../components/ListingForm";
import type { ListingRow } from "../components/ListingForm";
import { useAuthUser } from "../../../lib/auth";
import { fetchIsAdmin } from "../../../lib/admin";
import { errorMessage } from "../../../lib/errors";

async function fetchListing(id: string) {
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as ListingRow;
}

function Notice({ children, back }: { children: React.ReactNode; back?: { to: string; label: string } }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="text-muted">{children}</div>
      {back ? (
        <Link to={back.to} className="mt-3 inline-block text-link hover:underline">
          {back.label}
        </Link>
      ) : null}
    </div>
  );
}

export function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  const { data: user, isLoading: isAuthLoading } = useAuthUser();
  const userId = user?.id ?? null;

  const { data: isAdmin, isLoading: isAdminLoading } = useQuery({
    queryKey: ["is-admin", userId],
    enabled: !!userId,
    queryFn: () => fetchIsAdmin(userId),
    staleTime: 30_000,
  });

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

  if (!id) return <Notice back={{ to: "/listings", label: "Back to listings" }}>Missing listing id.</Notice>;
  if (isAuthLoading || isListingLoading || isAdminLoading) return <Notice>Loading listing…</Notice>;
  if (isListingError) {
    return (
      <Notice back={{ to: "/listings", label: "Back to listings" }}>
        <span className="text-danger">Failed to load listing: {errorMessage(listingError, "Unknown error")}</span>
      </Notice>
    );
  }
  if (!listing) return <Notice back={{ to: "/listings", label: "Back to listings" }}>Listing not found.</Notice>;

  if (!isAdmin && listing.seller_id !== userId) {
    return (
      <Notice back={{ to: `/listings/${id}`, label: "View listing" }}>
        You don’t have permission to edit this listing.
      </Notice>
    );
  }

  return (
    <div>
      <div className="mx-auto max-w-4xl px-6 pt-8">
        <Link to={`/listings/${id}`} className="text-muted hover:text-fg">
          ← Back to listing
        </Link>
      </div>

      <ListingForm mode="edit" listingId={id} initial={listing} />
    </div>
  );
}
