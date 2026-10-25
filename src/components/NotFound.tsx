import { Link } from "react-router-dom";
import { usePageMeta } from "../hooks/usePageMeta";

export function NotFound() {
  usePageMeta({ title: "Page not found", noindex: true });
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <p className="text-sm font-semibold text-link">404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">This page took a wrong turn</h1>
      <p className="mt-2 text-muted">The page you’re looking for doesn’t exist or has moved.</p>
      <div className="mt-6 flex justify-center gap-3">
        <Link to="/" className="btn-primary">Go home</Link>
        <Link to="/listings" className="btn-secondary">Browse cars</Link>
      </div>
    </div>
  );
}
