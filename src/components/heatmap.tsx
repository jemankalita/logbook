import { formatDay, type Day } from "@/lib/dates";
import type { HeatmapCell, HeatmapData, HeatmapMode } from "@/lib/heatmap";

const CELL_PX = 12;
const GAP_PX = 3;
const STEP_PX = CELL_PX + GAP_PX;
const LABEL_GUTTER_PX = 30;
const WEEKDAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

function describe(cell: HeatmapCell, mode: HeatmapMode): string {
  const date = formatDay(cell.day);
  const tasks = `${cell.tasksDone} task${cell.tasksDone === 1 ? "" : "s"} done`;
  switch (mode) {
    case "attendance":
      return `${cell.attended ? "Present" : "No check-in"} · ${date}`;
    case "tasks":
      return `${tasks} · ${date}`;
    case "combined":
      return `${cell.attended ? "Present" : "No check-in"}, ${tasks} · ${date}`;
  }
}

export function Heatmap({ data, mode, today, summary }: { data: HeatmapData; mode: HeatmapMode; today: Day; summary: string }) {
  const cells = data.weeks.flat();

  return (
    <figure>
      {/* Screen readers get the numbers; the grid itself is colour-only. */}
      <p className="sr-only">{summary}</p>
      {/* rtl scroller so phones open on the most recent weeks */}
      <div className="overflow-x-auto pb-1" dir="rtl">
        <div dir="ltr" className="relative inline-block" style={{ paddingLeft: LABEL_GUTTER_PX, paddingTop: 20 }}>
          {data.months.map((m) => (
            <span
              key={`${m.label}-${m.column}`}
              className="absolute top-0 text-xs text-muted"
              style={{ left: LABEL_GUTTER_PX + m.column * STEP_PX }}
            >
              {m.label}
            </span>
          ))}

          <div
            aria-hidden
            className="absolute left-0 grid text-[10px] leading-none text-muted"
            style={{ top: 20, gridTemplateRows: `repeat(7, ${CELL_PX}px)`, rowGap: GAP_PX }}
          >
            {WEEKDAY_LABELS.map((label, i) => (
              <span key={i} className="flex items-center">
                {label}
              </span>
            ))}
          </div>

          <div
            role="img"
            aria-label={`Activity heatmap, ${mode} mode, last 12 months`}
            className="grid grid-flow-col"
            style={{ gridTemplateRows: `repeat(7, ${CELL_PX}px)`, gridAutoColumns: `${CELL_PX}px`, gap: GAP_PX }}
          >
            {cells.map((cell, i) =>
              cell ? (
                <div
                  key={cell.day}
                  title={describe(cell, mode)}
                  className={`rounded-[3px] ${cell.day === today ? "ring-1 ring-fg/70 ring-offset-1 ring-offset-panel" : ""}`}
                  style={{ background: `var(--heat-${cell.level})` }}
                />
              ) : (
                <div key={`empty-${i}`} />
              ),
            )}
          </div>
        </div>
      </div>

      <figcaption className="mt-3 flex items-center justify-end gap-1.5 text-xs text-muted">
        {mode === "attendance" ? (
          <>
            <span className="size-3 rounded-[3px]" style={{ background: "var(--heat-0)" }} /> Missed
            <span className="ml-2 size-3 rounded-[3px]" style={{ background: "var(--heat-4)" }} /> Present
          </>
        ) : (
          <>
            Less
            {[0, 1, 2, 3, 4].map((l) => (
              <span key={l} className="size-3 rounded-[3px]" style={{ background: `var(--heat-${l})` }} />
            ))}
            More
          </>
        )}
      </figcaption>
    </figure>
  );
}
