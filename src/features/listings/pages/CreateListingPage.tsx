import { useNavigate, Link } from "react-router-dom";
import { ListingForm } from "../components/ListingForm";

export function CreateListingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-4xl mx-auto px-6 pt-8">
        <Link to="/listings" className="text-slate-300 hover:text-white">
          ← Back to listings
        </Link>
      </div>

      <ListingForm
        mode="create"
        onCreated={(id) => navigate(`/listings/${id}/edit`)}
      />
    </div>
  );
}
