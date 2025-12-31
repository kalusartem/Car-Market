import { FeaturedListings } from "./features/listings/components/FeaturedListings";

function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* Navigation Placeholder */}
      <nav className="border-b border-slate-800 p-4">
        <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
          NEXUS
        </h1>
      </nav>

      <main>
        <FeaturedListings />
      </main>
    </div>
  );
}

export default App;
