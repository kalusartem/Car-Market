export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="cm-logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2563eb" />
          <stop offset="1" stopColor="#10b981" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#cm-logo-g)" />
      <path
        d="M13 38v-6.5l4.6-9.5h28.8l4.6 9.5V38"
        fill="none"
        stroke="#fff"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 38h44v6a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2v-1H20v1a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2z"
        fill="#fff"
      />
      <circle cx="21" cy="31" r="2.4" fill="#fff" />
      <circle cx="43" cy="31" r="2.4" fill="#fff" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark />
      <span className="text-lg font-extrabold tracking-tight text-fg">
        Car<span className="text-accent">Market</span>
      </span>
    </span>
  );
}
