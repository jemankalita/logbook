import { formatDay, type Day } from "@/lib/dates";
import type { HeatmapCell, HeatmapData, HeatmapMode } from "@/lib/heatmap";

const CELL_PX = 12;
const GAP_PX = 3;
const STEP_PX = CELL_PX + GAP_PX;
const LABEL_GUTTER_PX = 30;
const MONTH_ROW_PX = 20;
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

function Swatch({ level }: { level: number }) {
  return <span className="size-3 rounded-[3px]" style={{ background: `var(--heat-${level})` }} />;
}

export function Heatmap({ data, mode, today, summary }: { data: HeatmapData; mode: HeatmapMode; today: Day; summary: string }) {
  const cells = data.weeks.flat();

  return (
    <figure>
      {/* Screen readers get the numbers; the grid itself is colour-only. */}
      <p className="sr-only">{summary}</p>
      {/* rtl scroller so phones open on the most recent weeks */}
      <div className="overflow-x-auto pb-1" dir="rtl">
        <div dir="ltr" className="relative inline-block" style={{ paddingLeft: LABEL_GUTTER_PX, paddingTop: MONTH_ROW_PX }}>
          {data.months.map((m) => (
            <span key={`${m.label}-${m.column}`} className="absolute top-0 text-[11px] text-faint" style={{ left: LABEL_GUTTER_PX + m.column * STEP_PX }}>
              {m.label}
            </span>
          ))}

          <div aria-hidden className="absolute left-0 grid text-[10px] leading-none text-faint" style={{ top: MONTH_ROW_PX, gridTemplateRows: `repeat(7, ${CELL_PX}px)`, rowGap: GAP_PX }}>
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
                  className={`rounded-[3px] hover:outline hover:outline-1 hover:outline-offset-1 hover:outline-fg/50 ${cell.day === today ? "outline outline-1 outline-offset-1 outline-fg/80" : ""}`}
                  style={{ background: `var(--heat-${cell.level})` }}
                />
              ) : (
                <div key={`empty-${i}`} />
              ),
            )}
          </div>
        </div>
      </div>

      <figcaption className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-faint">
        {mode === "attendance" ? (
          <>
            <Swatch level={0} /> Missed
            <span className="ml-2 inline-flex">
              <Swatch level={4} />
            </span>{" "}
            Present
          </>
        ) : (
          <>
            Less
            {[0, 1, 2, 3, 4].map((l) => (
              <Swatch key={l} level={l} />
            ))}
            More
          </>
        )}
      </figcaption>
    </figure>
  );
}
