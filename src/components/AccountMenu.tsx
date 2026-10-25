import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuthUser } from "../lib/auth";
import { UserIcon } from "./icons";

const ITEMS: Array<[string, string]> = [
  ["/favorites", "Saved cars"],
  ["/messages", "Messages"],
  ["/account/listings", "My listings"],
  ["/account", "Account & security"],
];

export function AccountMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: user } = useAuthUser();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) {
    return (
      <Link to="/login" className="btn-secondary h-10">
        Sign in
      </Link>
    );
  }

  const label = user.email ?? user.user_metadata?.user_name ?? "Account";

  const signOut = async () => {
    await supabase.auth.signOut();
    await qc.invalidateQueries();
    setOpen(false);
    navigate("/");
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line-strong bg-surface text-muted transition hover:bg-surface-2 hover:text-fg"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        title={label}
      >
        <UserIcon />
      </button>

      {open ? (
        <div role="menu" className="absolute right-0 z-[60] mt-2 w-60 overflow-hidden rounded-xl border border-line bg-surface shadow-pop">
          <div className="border-b border-line px-3 py-2 text-xs text-subtle">
            Signed in as <span className="block truncate font-medium text-fg">{label}</span>
          </div>
          {ITEMS.map(([to, text]) => (
            <Link key={to} role="menuitem" to={to} className="block px-3 py-2 text-sm hover:bg-surface-2" onClick={() => setOpen(false)}>
              {text}
            </Link>
          ))}
          <button type="button" role="menuitem" className="w-full border-t border-line px-3 py-2 text-left text-sm text-danger hover:bg-surface-2" onClick={signOut}>
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
