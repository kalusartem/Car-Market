import type { ReactNode } from "react";

type Props = { title: string; subtitle?: ReactNode; actions?: ReactNode };

/** Title row shared by the signed-in pages (saved cars, my listings, messages, account). */
export function PageHeader({ title, subtitle, actions }: Props) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function PageMessage({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "danger" }) {
  return (
    <div className={`card mt-6 p-8 text-center ${tone === "danger" ? "text-danger" : "text-muted"}`}>{children}</div>
  );
}
