import { Link } from "react-router-dom";
import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-3 text-sm text-muted">
            A marketplace for buying and selling used cars from private sellers.
          </p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm">
          <Link to="/listings" className="text-muted hover:text-fg">Browse cars</Link>
          <Link to="/sell" className="text-muted hover:text-fg">Sell your car</Link>
          <Link to="/price-check" className="text-muted hover:text-fg">Price check</Link>
          <Link to="/favorites" className="text-muted hover:text-fg">Saved cars</Link>
          <Link to="/terms" className="text-muted hover:text-fg">Terms</Link>
          <Link to="/privacy" className="text-muted hover:text-fg">Privacy</Link>
        </nav>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-7xl px-4 py-4 text-xs text-subtle sm:px-6">
          © {new Date().getFullYear()} Car Market. Vehicle makes, models, VIN decoding and recall data from the
          U.S. NHTSA. Price checks compare asking prices on this site only.
        </p>
      </div>
    </footer>
  );
}
