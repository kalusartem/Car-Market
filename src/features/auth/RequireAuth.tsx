import { Navigate, useLocation } from "react-router-dom";
import { useAuthUser } from "../../lib/auth";

/** Sends signed-out visitors to /login and brings them back afterwards. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useAuthUser();
  const location = useLocation();

  if (isLoading) {
    return <div className="mx-auto max-w-3xl px-6 py-16 text-center text-subtle">Loading…</div>;
  }
  if (!user) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  return <>{children}</>;
}
