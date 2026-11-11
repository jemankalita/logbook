import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { cls } from "@/components/cls";
import { OppForm } from "@/components/opportunities/opp-ui";
import { diffDays, formatDay, today as getToday } from "@/lib/dates";
import { countdownLabel, listOpportunities, OPP_STATUS_LABELS, OPP_STATUSES, type Opportunity, type OppStatus } from "@/lib/queries/opportunities";
import { moveOpportunity } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Opportunities · Logbook" };

const BOARD: OppStatus[] = ["inbox", "interested", "applying", "submitted", "interview", "result"];

function Countdown({ deadline, today, status }: { deadline: string | null; today: string; status: OppStatus }) {
  if (!deadline) return null;
  const days = diffDays(deadline, today);
  const urgent = days <= 3 && !["submitted", "result", "closed"].includes(status);
  return (
    <span className={`tabular text-xs ${urgent ? "font-medium text-danger" : "text-muted"}`} title={formatDay(deadline)}>
      {formatDay(deadline, { month: "short", day: "numeric" })} · {countdownLabel(days)}
    </span>
  );
}

function Card({ opp, today }: { opp: Opportunity; today: string }) {
  const i = OPP_STATUSES.indexOf(opp.status);
  const prev = OPP_STATUSES[i - 1];
  const next = OPP_STATUSES[i + 1];
  return (
    <li className="rounded-xl border border-line bg-panel-2/60 p-3">
      <Link href={`/opportunities/${opp.id}`} className="block text-sm font-medium hover:underline">
        {opp.name}
      </Link>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        {opp.type ? <span className={cls.chip}>{opp.type}</span> : null}
        <Countdown deadline={opp.deadline} today={today} status={opp.status} />
      </div>
      {opp.nextAction ? <p className="mt-1.5 text-xs text-fg/80">→ {opp.nextAction}</p> : null}
      <div className="mt-2 flex items-center gap-1">
        {prev ? (
          <form action={moveOpportunity.bind(null, opp.id, prev)}>
            <button type="submit" className={cls.btnGhost} aria-label={`Move to ${OPP_STATUS_LABELS[prev]}`} title={OPP_STATUS_LABELS[prev]}>
              <ChevronLeft className="size-3.5" aria-hidden />
            </button>
          </form>
        ) : null}
        {next ? (
          <form action={moveOpportunity.bind(null, opp.id, next)}>
            <button type="submit" className={cls.btnGhost} aria-label={`Move to ${OPP_STATUS_LABELS[next]}`} title={OPP_STATUS_LABELS[next]}>
              <ChevronRight className="size-3.5" aria-hidden />
            </button>
          </form>
        ) : null}
        {opp.link ? (
          <a href={opp.link} target="_blank" rel="noopener noreferrer" className={`${cls.btnGhost} ml-auto`} aria-label="Open link">
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
    <div className="mx-auto flex max-w-[90rem] flex-col gap-5">
      <h1 className={cls.h1}>Opportunities</h1>
      <section className={`${cls.card} p-4`}>
        <OppForm compact />
      </section>

      <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        <div className="grid min-w-[60rem] grid-cols-6 gap-3">
          {BOARD.map((status) => {
            const col = all.filter((o) => o.status === status);
            return (
              <section key={status} className={`${cls.card} p-2`} aria-label={OPP_STATUS_LABELS[status]}>
                <h2 className="mb-2 flex items-center justify-between px-1 text-sm font-medium">
                  {OPP_STATUS_LABELS[status]}
                  <span className="tabular text-xs text-muted">{col.length}</span>
                </h2>
                <ul className="flex flex-col gap-2">
                  {col.map((o) => (
                    <Card key={o.id} opp={o} today={today} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>

      {closed.length ? (
        <details className={`${cls.card} p-4`}>
          <summary className="cursor-pointer text-sm text-muted">Closed ({closed.length})</summary>
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
