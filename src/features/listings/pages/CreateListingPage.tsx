import { useNavigate, Link } from "react-router-dom";
import { ListingForm } from "../components/ListingForm";

export function CreateListingPage() {
  const navigate = useNavigate();

  return (
    <div>
      <div className="mx-auto max-w-4xl px-4 pt-8 sm:px-6">
        <Link to="/listings" className="text-sm font-medium text-muted hover:text-fg">
          ← Back to listings
        </Link>
      </div>

      <ListingForm
        mode="create"
        onCreated={(id) => navigate(`/listings/${id}`)}
      />
    </div>
  );
}
