import { CarListing } from "../../../types/car";

interface ListingCardProps {
  car: CarListing;
}

export function ListingCard({ car }: ListingCardProps) {
  return (
    <div className="group bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 hover:border-blue-500/50 transition-all duration-300 shadow-lg">
      {/* Image Placeholder */}
      <div className="aspect-[16/9] bg-slate-700 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent" />
        <span className="absolute bottom-3 left-3 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">
          {car.year}
        </span>
      </div>

      <div className="p-5">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
            {car.make} {car.model}
          </h3>
          <p className="text-xl font-black text-emerald-400">
            ${car.price.toLocaleString()}
          </p>
        </div>

        <div className="flex gap-3 text-slate-400 text-sm mb-4">
          <span>{car.mileage.toLocaleString()} miles</span>
          <span>•</span>
          <span>{car.transmission}</span>
        </div>

        <button className="w-full bg-slate-700 hover:bg-blue-600 text-white font-semibold py-2 rounded-lg transition-colors">
          View Details
        </button>
      </div>
    </div>
  );
}
