import { Link } from "react-router-dom";
import { useAuthUser } from "../../../lib/auth";
import { CarIcon, HeartIcon, MailIcon } from "../../../components/icons";
import { PageHeader, PageMessage } from "../../../components/PageHeader";
import { SecuritySettings } from "../SecuritySettings";

const SHORTCUTS = [
  { to: "/account/listings", label: "My listings", text: "Edit prices, photos and status", Icon: CarIcon },
  { to: "/messages", label: "Messages", text: "Conversations with buyers and sellers", Icon: MailIcon },
  { to: "/favorites", label: "Saved cars", text: "Cars you've hearted", Icon: HeartIcon },
];

const PROVIDER_NAMES: Record<string, string> = { github: "GitHub", google: "Google", email: "email" };

export function AccountPage() {
  const { data: user, isLoading } = useAuthUser();

  if (isLoading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="card h-28 animate-pulse bg-surface-2" aria-hidden="true" />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <PageHeader title="Account" />
        <PageMessage>
          You're not signed in.{" "}
          <Link to="/login?next=%2Faccount" className="font-semibold text-link hover:underline">
            Sign in
          </Link>
        </PageMessage>
      </main>
    );
  }

  const name: string | undefined = user.user_metadata?.full_name ?? user.user_metadata?.user_name;
  const avatar: string | undefined = user.user_metadata?.avatar_url;
  const providers = (user.app_metadata?.providers as string[] | undefined) ?? [];
  const initial = (name ?? user.email ?? "?").charAt(0).toUpperCase();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <PageHeader title="Account" />

      <section className="card mt-6 flex items-center gap-4 p-5" aria-label="Profile">
        {avatar ? (
          <img src={avatar} alt="" referrerPolicy="no-referrer" className="h-14 w-14 rounded-full border border-line object-cover" />
        ) : (
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-xl font-bold text-link">
            {initial}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{name ?? user.email}</p>
          {name && user.email ? <p className="truncate text-sm text-muted">{user.email}</p> : null}
          {providers.length ? (
            <p className="mt-1 text-xs text-subtle">
              Signed in with {providers.map((p) => PROVIDER_NAMES[p] ?? p).join(" and ")}
            </p>
          ) : null}
        </div>
      </section>

      <ul className="mt-4 grid gap-3 sm:grid-cols-3">
        {SHORTCUTS.map(({ to, label, text, Icon }) => (
          <li key={to}>
            <Link to={to} className="card flex h-full flex-col p-4 transition hover:-translate-y-0.5 hover:shadow-pop">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-link">
                <Icon size={18} />
              </span>
              <span className="mt-3 font-semibold">{label}</span>
              <span className="mt-0.5 text-sm text-muted">{text}</span>
            </Link>
          </li>
        ))}
      </ul>

      <SecuritySettings />
    </main>
  );
}
