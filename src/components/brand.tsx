/**
 * The Logbook mark: a bound book with ruled lines and a green "showed up today" dot.
 * Same drawing as the installed-app icon (see logbook-mark.tsx), as a crisp inline SVG.
 */
export function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--panel-2)" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" fill="none" stroke="rgb(255 255 255 / 0.08)" />
      <rect x="8" y="6.5" width="15" height="19" rx="2.5" fill="var(--accent)" />
      <rect x="10.6" y="6.5" width="1" height="19" fill="rgb(0 0 0 / 0.25)" />
      <rect x="13.6" y="11.5" width="6.6" height="1.4" rx="0.7" fill="#fff" />
      <rect x="13.6" y="14.8" width="5.2" height="1.4" rx="0.7" fill="#fff" />
      <rect x="13.6" y="18.1" width="3.8" height="1.4" rx="0.7" fill="#fff" />
      <circle cx="23.5" cy="24" r="4.2" fill="var(--success)" stroke="var(--panel-2)" strokeWidth="1.6" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark />
      <span className="font-display text-[1.35rem] leading-none tracking-[-0.01em]">Logbook</span>
    </span>
  );
}
