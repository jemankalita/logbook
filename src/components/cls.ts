/**
 * Shared class strings so every page looks the same (safe to import from server components).
 * Interactive elements list the exact properties they transition — never `transition-all`.
 */
const field =
  "w-full rounded-lg border border-line bg-panel-2/70 text-sm text-fg placeholder:text-faint outline-none transition-[border-color,box-shadow,background-color] duration-150 hover:border-line-strong focus:border-accent/70 focus:bg-panel-2 focus:ring-[3px] focus:ring-accent/15";
const button =
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-sm font-medium select-none transition-[background-color,border-color,color,transform,box-shadow,opacity] duration-150 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50";

export const cls = {
  card: "rounded-xl border border-line bg-panel shadow-card",
  /** Add to a card that is itself a link / button. */
  cardHover: "transition-[border-color,background-color] duration-150 hover:border-line-strong hover:bg-panel-2/60",
  input: `${field} h-9 px-3`,
  /** Square one-character field (emoji pickers). Separate because `w-full` in `input` would win over a width override. */
  inputEmoji: `${field.replace("w-full ", "")} h-9 w-12 shrink-0 px-0 text-center text-base`,
  textarea: `${field} px-3 py-2 leading-relaxed`,
  select: `${field} h-9 px-2.5`,
  btn: `${button} h-9 border border-line bg-panel-2 px-3 text-fg shadow-raised hover:border-line-strong hover:bg-panel-3`,
  btnPrimary: `${button} h-9 bg-fg px-3.5 text-bg shadow-raised hover:bg-fg/85`,
  btnGhost: `${button} h-8 px-2 font-normal text-muted hover:bg-panel-2 hover:text-fg`,
  btnDanger: `${button} h-9 border border-danger/30 px-3 text-danger hover:border-danger/50 hover:bg-danger/10`,
  label: "mb-1.5 block text-xs font-medium text-muted",
  chip: "inline-flex items-center gap-1 rounded-md border border-line bg-panel-2 px-1.5 py-0.5 text-[11px] font-medium leading-4 text-muted",
  h1: "font-display text-[2rem] leading-[1.1] tracking-[-0.01em] text-fg md:text-[2.5rem]",
  /** Small caps label above a title or a group. */
  eyebrow: "text-[11px] font-medium uppercase tracking-[0.08em] text-faint",
  /** Section title inside a card. */
  h2: "text-[13px] font-medium text-muted",
  /** Dashed placeholder for "nothing here yet". */
  empty: "rounded-xl border border-dashed border-line-strong/70 px-6 py-12 text-center text-sm text-muted",
  kbd: "inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-line bg-panel-2 px-1 text-[10px] font-medium text-muted shadow-[inset_0_-1px_0_rgb(0_0_0/0.35)]",
  /** Track of a segmented control. */
  segment: "inline-flex rounded-lg border border-line bg-panel p-0.5 text-[13px]",
} as const;
