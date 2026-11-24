import Link from "next/link";
import { ArrowRight, CheckCircle2, ClipboardCheck, Flame } from "lucide-react";
import type { Day } from "@/lib/dates";
import { reviewPrompt, reviewStreak, weekLabel, weekStartOf } from "@/lib/review";
import { cls } from "../cls";

/** Dashboard nudge for the weekly routine: due → a clear call to action; otherwise a quiet status line. */
export function WeeklyReviewCard({ today, reviewed }: { today: Day; reviewed: ReadonlySet<Day> }) {
  const prompt = reviewPrompt(today, reviewed);
  const streak = reviewStreak(reviewed, weekStartOf(today));
  const href = prompt.week === weekStartOf(today) ? "/review" : `/review?week=${prompt.week}`;
  const due = prompt.state === "due";
  const isLastWeek = prompt.week !== weekStartOf(today);

  const title = due ? (isLastWeek ? "Last week's review is waiting" : "Time for your weekly review") : prompt.state === "done" ? "This week is reviewed" : "Weekly review";
  const body = due
    ? `${weekLabel(prompt.week)} — what got done, what carries over, and what's next.`
    : prompt.state === "done"
      ? "Plan's set for next week. See you Friday."
      : "Opens on Friday. Look back, carry over what's open, plan the next week.";

  return (
    <section className={`${cls.card} flex flex-wrap items-center gap-x-4 gap-y-3 p-4 ${due ? "border-accent/40 bg-accent/[0.06]" : ""}`}>
      <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${due ? "bg-accent/15 text-accent" : "bg-panel-2 text-faint"}`}>
        {prompt.state === "done" ? <CheckCircle2 className="size-4 text-success" aria-hidden /> : <ClipboardCheck className="size-4" aria-hidden />}
      </span>
      <div className="min-w-[min(100%,16rem)] flex-1">
        <h2 className="text-sm font-medium">{title}</h2>
        <p className="mt-0.5 text-[13px] text-muted">{body}</p>
      </div>
      {streak ? (
        <span className={`${cls.chip} h-7 px-2`}>
          <Flame className="size-3.5 text-warn" aria-hidden /> {streak}-week streak
        </span>
      ) : null}
      <Link href={href} className={due ? cls.btnPrimary : cls.btn}>
        {due ? "Start review" : "Open"} <ArrowRight className="size-4" aria-hidden />
      </Link>
    </section>
  );
}
