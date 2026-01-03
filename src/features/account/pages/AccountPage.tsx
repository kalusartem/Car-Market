import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "../../../lib/supabase";

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
      <div className="min-h-screen bg-slate-950 text-white p-6">Loading…</div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6">
        <h1 className="text-2xl font-semibold">Account</h1>
        <p className="text-slate-400 mt-2">You’re not signed in.</p>
        <Link
          to="/"
          className="text-blue-400 hover:underline mt-4 inline-block"
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
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold">My account</h1>

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <div className="text-sm text-slate-400">Name</div>
          <div className="mt-1">{name}</div>

          <div className="text-sm text-slate-400 mt-4">Email</div>
          <div className="mt-1">{email}</div>

          <div className="text-sm text-slate-400 mt-4">User ID</div>
          <div className="mt-1 break-all text-slate-300">{user.id}</div>

          <div className="mt-6 flex gap-3 flex-wrap">
            <Link
              to="/sell"
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500"
            >
              Create listing
            </Link>
            <Link
              to="/favorites"
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700"
            >
              Saved cars
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
