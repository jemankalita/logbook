import type { LucideIcon } from "lucide-react";
import { cls } from "./cls";
import { NumberTicker } from "./motion-ui";

interface StatProps {
  label: string;
  /** Numbers count up on first view; strings render as-is. */
  value: string | number;
  /** Small word after the number ("days"). */
  unit?: string;
  hint?: string;
  icon?: LucideIcon;
  /** Colour of the icon — use sparingly, for the one stat that's a live signal. */
  tone?: "default" | "success" | "warn" | "accent";
}

const TONE: Record<NonNullable<StatProps["tone"]>, string> = {
  default: "text-faint",
  success: "text-success",
  warn: "text-warn",
  accent: "text-accent",
};

/** The figure itself, without a surface — for stat strips inside a card. */
export function Stat({ label, value, unit, hint, icon: Icon, tone = "default" }: StatProps) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-xs text-muted">
        {Icon ? <Icon className={`size-3.5 shrink-0 ${TONE[tone]}`} aria-hidden /> : null}
        <span className="truncate">{label}</span>
      </p>
      <p className="tabular mt-1.5 flex items-baseline gap-1.5 text-[1.75rem] font-medium leading-none tracking-[-0.03em]">
        {typeof value === "number" ? <NumberTicker value={value} /> : value}
        {unit ? <span className="text-sm font-normal tracking-normal text-faint">{unit}</span> : null}
      </p>
      {hint ? <p className="mt-1.5 truncate text-xs text-faint">{hint}</p> : null}
    </div>
  );
}

export function StatTile(props: StatProps) {
  return (
    <div className={`${cls.card} p-4`}>
      <Stat {...props} />
    </div>
  );
}
