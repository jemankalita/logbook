import Link from "next/link";
import { ArrowLeft, ArrowUpRight, type LucideIcon } from "lucide-react";
import { cls } from "./cls";

/** Title block at the top of every page: optional eyebrow, serif title, description, actions on the right. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Small text shown next to the title (a count, a status). */
  meta?: React.ReactNode;
}) {
  return (
    <header className="rise flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        {eyebrow ? <p className={`${cls.eyebrow} mb-2`}>{eyebrow}</p> : null}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className={`${cls.h1} break-words`}>{title}</h1>
          {meta ? <span className="tabular text-sm text-muted">{meta}</span> : null}
        </div>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={`${cls.btnGhost} -ml-2 self-start`}>
      <ArrowLeft className="size-4" aria-hidden /> {children}
    </Link>
  );
}

/** Header row of a card: quiet title on the left, a count or a link on the right. */
export function CardHeader({ title, count, href, linkLabel, action }: { title: React.ReactNode; count?: number; href?: string; linkLabel?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex min-h-6 items-center justify-between gap-3">
      <h2 className={cls.h2}>
        {title}
        {count !== undefined ? <span className="tabular ml-2 font-normal text-faint">{count}</span> : null}
      </h2>
      {action}
      {href ? (
        <Link href={href} className="group -mr-1 inline-flex items-center gap-0.5 rounded-md px-1 text-xs text-faint transition-colors duration-150 hover:text-fg">
          {linkLabel}
          <ArrowUpRight className="size-3.5 transition-transform duration-150 group-hover:-translate-y-px group-hover:translate-x-px" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

/** "Nothing here yet" — an icon, one line of what this is, and the next step. */
export function EmptyState({ icon: Icon, title, children, action }: { icon?: LucideIcon; title: React.ReactNode; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className={`${cls.empty} flex flex-col items-center`}>
      {Icon ? (
        <span className="mb-4 grid size-10 place-items-center rounded-xl border border-line bg-panel-2 text-muted shadow-raised">
          <Icon className="size-[18px]" aria-hidden />
        </span>
      ) : null}
      <p className="font-medium text-fg">{title}</p>
      {children ? <p className="mt-1.5 max-w-md leading-relaxed">{children}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className={cls.kbd}>{children}</kbd>;
}

/** A thin progress bar (tasks done today, steps done on a goal). */
export function Progress({ value, max, label }: { value: number; max: number; label: string }) {
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className="h-1 overflow-hidden rounded-full bg-panel-3" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      <div className="h-full origin-left rounded-full bg-success transition-transform duration-500 ease-out" style={{ transform: `scaleX(${ratio})` }} />
    </div>
  );
}
