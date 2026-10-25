import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { AccountMenu } from "./AccountMenu";
import { MenuIcon, XIcon } from "./icons";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

const LINKS: Array<[string, string]> = [
  ["/listings", "Browse"],
  ["/price-check", "Price check"],
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg"}`;

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link to="/" aria-label="Car Market home" onClick={() => setOpen(false)}>
            <Logo />
          </Link>
          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            {LINKS.map(([to, label]) => (
              <NavLink key={to} to={to} className={linkClass}>
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/sell" className="btn-primary hidden h-10 sm:inline-flex">
            Sell your car
          </Link>
          <ThemeToggle />
          <AccountMenu />
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line-strong bg-surface text-muted md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <XIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {open ? (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-line bg-surface px-4 py-3 md:hidden">
          <div className="grid gap-1">
            {[...LINKS, ["/sell", "Sell your car"] as [string, string]].map(([to, label]) => (
              <NavLink key={to} to={to} className={linkClass} onClick={() => setOpen(false)}>
                {label}
              </NavLink>
            ))}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
