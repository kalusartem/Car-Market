import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { SecuritySettings } from "../SecuritySettings";

async function fetchUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user ?? null;
}

export function AccountPage() {
  const { data: user, isLoading } = useQuery({
    queryKey: ["auth-user"],
    queryFn: fetchUser,
    staleTime: 1000 * 30,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg text-fg p-6">Loading…</div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-bg text-fg p-6">
        <h1 className="text-2xl font-semibold">Account</h1>
        <p className="text-subtle mt-2">You’re not signed in.</p>
        <Link
          to="/"
          className="text-link hover:underline mt-4 inline-block"
        >
          Go home
        </Link>
      </div>
    );
  }

  const email = user.email ?? "—";
  const name =
    user.user_metadata?.full_name ?? user.user_metadata?.user_name ?? "—";

  return (
    <div className="min-h-screen bg-bg text-fg">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold">My account</h1>

        <div className="mt-6 rounded-2xl border border-line bg-surface p-6">
          <div className="text-sm text-subtle">Name</div>
          <div className="mt-1">{name}</div>

          <div className="text-sm text-subtle mt-4">Email</div>
          <div className="mt-1">{email}</div>

          <div className="text-sm text-subtle mt-4">User ID</div>
          <div className="mt-1 break-all text-muted">{user.id}</div>

          <div className="mt-6 flex gap-3 flex-wrap">
            <Link
              to="/sell"
              className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-accent-fg"
            >
              Create listing
            </Link>
            <Link
              to="/favorites"
              className="px-4 py-2 rounded-lg bg-surface-2 hover:bg-surface-3"
            >
              Saved cars
            </Link>
          </div>
        </div>

        <SecuritySettings />
      </div>
    </div>
  );
}
