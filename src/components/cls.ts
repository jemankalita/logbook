/** Shared class strings so every page looks the same (safe to import from server components). */
export const cls = {
  card: "rounded-2xl border border-line bg-panel",
  input:
    "h-9 w-full rounded-lg border border-line bg-panel-2 px-3 text-sm text-fg placeholder:text-muted/70 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30",
  textarea:
    "w-full rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm text-fg placeholder:text-muted/70 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30",
  select:
    "h-9 rounded-lg border border-line bg-panel-2 px-2 text-sm text-fg outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30",
  btn: "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line bg-panel-2 px-3 text-sm font-medium text-fg transition hover:bg-line active:scale-[0.98] disabled:opacity-60",
  btnPrimary:
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60",
  btnGhost:
    "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-2 text-sm text-muted transition hover:bg-panel-2 hover:text-fg disabled:opacity-60",
  btnDanger:
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-danger/40 px-3 text-sm font-medium text-danger transition hover:bg-danger/10 disabled:opacity-60",
  label: "mb-1 block text-xs font-medium text-muted",
  chip: "inline-flex items-center gap-1 rounded-full border border-line bg-panel-2 px-2 py-0.5 text-xs text-muted",
  h1: "text-2xl font-semibold md:text-3xl",
} as const;
