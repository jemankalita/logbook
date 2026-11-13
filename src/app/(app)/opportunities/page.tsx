import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { cls } from "@/components/cls";
import { OppForm } from "@/components/opportunities/opp-ui";
import { diffDays, formatDay, today as getToday } from "@/lib/dates";
import { countdownLabel, listOpportunities, OPP_STATUS_LABELS, OPP_STATUSES, type Opportunity, type OppStatus } from "@/lib/queries/opportunities";
import { moveOpportunity } from "./actions";
import { PageHeader } from "@/components/page-ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Opportunities · Logbook" };

const BOARD: OppStatus[] = ["inbox", "interested", "applying", "submitted", "interview", "result"];

/** One quiet dot per stage, cold → warm as an application moves along. */
const STAGE_DOT: Record<OppStatus, string> = {
  inbox: "bg-faint",
  interested: "bg-muted",
  applying: "bg-accent",
  submitted: "bg-accent",
  interview: "bg-warn",
  result: "bg-success",
  closed: "bg-faint",
};

const moveBtn = "grid size-7 place-items-center rounded-md text-faint transition-colors duration-150 hover:bg-panel-3 hover:text-fg";

function Countdown({ deadline, today, status }: { deadline: string | null; today: string; status: OppStatus }) {
  if (!deadline) return null;
  const days = diffDays(deadline, today);
  const urgent = days <= 3 && !["submitted", "result", "closed"].includes(status);
  return (
    <span className={`tabular text-xs ${urgent ? "font-medium text-danger" : days < 0 ? "text-faint" : "text-muted"}`} title={formatDay(deadline)}>
      {formatDay(deadline, { month: "short", day: "numeric" })} · {countdownLabel(days)}
    </span>
  );
}

function Card({ opp, today }: { opp: Opportunity; today: string }) {
  const i = OPP_STATUSES.indexOf(opp.status);
  const prev = OPP_STATUSES[i - 1];
  const next = OPP_STATUSES[i + 1];
  return (
    <li className="group rounded-lg border border-line bg-panel p-3 shadow-card transition-[border-color] duration-150 hover:border-line-strong">
      <Link href={`/opportunities/${opp.id}`} className="block text-sm font-medium leading-snug transition-colors duration-150 hover:text-accent">
        {opp.name}
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        {opp.type ? <span className={cls.chip}>{opp.type}</span> : null}
        <Countdown deadline={opp.deadline} today={today} status={opp.status} />
      </div>
      {opp.nextAction ? (
        <p className="mt-2 flex gap-1.5 border-t border-line pt-2 text-xs leading-relaxed text-fg/80">
          <ArrowRight className="mt-0.5 size-3 shrink-0 text-faint" aria-hidden />
          {opp.nextAction}
        </p>
      ) : null}
      <div className="-mx-1 -mb-1 mt-2 flex items-center gap-0.5">
        {prev ? (
          <form action={moveOpportunity.bind(null, opp.id, prev)}>
            <button type="submit" className={moveBtn} aria-label={`Move to ${OPP_STATUS_LABELS[prev]}`} title={OPP_STATUS_LABELS[prev]}>
              <ChevronLeft className="size-3.5" aria-hidden />
            </button>
          </form>
        ) : null}
        {next ? (
          <form action={moveOpportunity.bind(null, opp.id, next)}>
            <button type="submit" className={moveBtn} aria-label={`Move to ${OPP_STATUS_LABELS[next]}`} title={OPP_STATUS_LABELS[next]}>
              <ChevronRight className="size-3.5" aria-hidden />
            </button>
          </form>
        ) : null}
        {opp.link ? (
          <a href={opp.link} target="_blank" rel="noopener noreferrer" className={`${moveBtn} ml-auto`} aria-label="Open link">
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        ) : null}
      </div>
    </li>
  );
}

export default async function OpportunitiesPage() {
  const today = getToday();
  const all = await listOpportunities();
  const closed = all.filter((o) => o.status === "closed");

  return (
    <div className="rise mx-auto flex max-w-[90rem] flex-col gap-5">
      <PageHeader eyebrow="Goals" title="Opportunities" meta={`${all.length - closed.length} open`} description="Internships, fellowships, hackathons and programs — from first spotted to final result." />
      <section className={`${cls.card} p-5`}>
        <OppForm compact />
      </section>

      <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        <div className="grid min-w-[60rem] grid-cols-6 gap-3">
          {BOARD.map((status) => {
            const col = all.filter((o) => o.status === status);
            return (
              <section key={status} className="flex flex-col rounded-xl border border-line bg-panel/40 p-2" aria-label={OPP_STATUS_LABELS[status]}>
                <h2 className="mb-2 flex h-7 items-center gap-2 px-1.5 text-[13px] font-medium text-muted">
                  <span className={`size-1.5 rounded-full ${STAGE_DOT[status]}`} aria-hidden />
                  {OPP_STATUS_LABELS[status]}
                  <span className="tabular ml-auto text-xs text-faint">{col.length}</span>
                </h2>
                <ul className="flex flex-col gap-2">
                  {col.map((o) => (
                    <Card key={o.id} opp={o} today={today} />
                  ))}
                </ul>
                {col.length === 0 ? <p className="rounded-lg border border-dashed border-line px-2 py-6 text-center text-xs text-faint">Empty</p> : null}
              </section>
            );
          })}
        </div>
      </div>

      {closed.length ? (
        <details className={`${cls.card} p-4`}>
          <summary className="cursor-pointer text-[13px] font-medium text-muted transition-colors duration-150 hover:text-fg">Closed <span className="tabular font-normal text-faint">{closed.length}</span></summary>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {closed.map((o) => (
              <Card key={o.id} opp={o} today={today} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
