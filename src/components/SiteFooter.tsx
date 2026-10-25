import { Link } from "react-router-dom";
import { GitHubIcon, LinkedInIcon } from "./BrandIcons";
import { Logo } from "./Logo";

const AUTHOR_LINKS = [
  { label: "GitHub", href: "https://github.com/kalusartem", Icon: GitHubIcon },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/artemkalus", Icon: LinkedInIcon },
];

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
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 md:flex-row md:items-center md:justify-between">
          <p className="max-w-2xl text-xs text-subtle">
            © {new Date().getFullYear()} Car Market. Vehicle makes, models, VIN decoding and recall data from the
            U.S. NHTSA. Price checks compare asking prices on this site only.
          </p>
          <div className="flex shrink-0 items-center gap-3 text-sm text-muted">
            <span>
              Built by{" "}
              <a href="https://full-stack-portfolio-2.pages.dev/" target="_blank" rel="noreferrer" className="font-semibold text-fg hover:underline">
                Artem Kalus
              </a>
            </span>
            {AUTHOR_LINKS.map(({ label, href, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={`Artem Kalus on ${label} (opens in new tab)`}
                title={label}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line-strong bg-surface text-muted transition hover:bg-surface-2 hover:text-fg"
              >
                <Icon size={17} />
              </a>
            ))}
            <a
              href="https://github.com/kalusartem/Car-Market"
              target="_blank"
              rel="noreferrer"
              className="btn-secondary h-9 px-3"
            >
              <GitHubIcon size={16} /> Source
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
