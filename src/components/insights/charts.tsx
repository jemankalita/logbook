"use client";

import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { areaColor, PALETTE } from "@/lib/colors";

const INK_MUTED = "#9b9a97";
const GRID = "#2f2f2f";
const TOOLTIP_STYLE = { background: "#262626", border: "1px solid #2f2f2f", borderRadius: 10, color: "#e9e9e7", fontSize: 12 };
const CURSOR = { fill: "rgba(255,255,255,0.04)" };
const MOOD_LABELS = ["", "Rough", "Meh", "Okay", "Good", "Great"];

interface Point {
  label?: string;
  name?: string;
  value: number;
}

function TableView({ rows, unit, keyLabel }: { rows: { key: string; value: number | string }[]; unit: string; keyLabel: string }) {
  return (
    <details className="mt-2 text-xs text-muted">
      <summary className="cursor-pointer">Show as table</summary>
      <table className="mt-2 w-full text-left">
        <thead>
          <tr>
            <th className="py-1 font-medium">{keyLabel}</th>
            <th className="py-1 text-right font-medium">{unit}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-line">
              <td className="py-1">{r.key}</td>
              <td className="tabular py-1 text-right text-fg">{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-4">
      <h2 className="font-medium">{title}</h2>
      {subtitle ? <p className="text-xs text-muted">{subtitle}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** One series over time: weekly columns. */
export function WeeklyBars({ title, subtitle, data, unit, colorIndex = 0 }: { title: string; subtitle?: string; data: Point[]; unit: string; colorIndex?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <Card title={title} subtitle={subtitle ?? `${total} in the last ${data.length} weeks`}>
      {total === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Nothing here yet — this fills in as you use the app.</p>
      ) : (
      <>
      <div className="h-48" role="img" aria-label={`${title}: ${total} total over ${data.length} weeks`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" tick={{ fill: INK_MUTED, fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
            <YAxis allowDecimals={false} tick={{ fill: INK_MUTED, fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip cursor={CURSOR} contentStyle={TOOLTIP_STYLE} labelFormatter={(l) => `Week of ${l}`} formatter={(v) => [v, unit]} />
            <Bar dataKey="value" name={unit} fill={PALETTE[colorIndex]} radius={[4, 4, 0, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <TableView rows={data.map((d) => ({ key: d.label ?? "", value: d.value }))} unit={unit} keyLabel="Week of" />
      </>
      )}
    </Card>
  );
}

/** Magnitude by category: horizontal bars, labelled, sorted. */
export function CategoryBars({ title, subtitle, data, unit, colorBy = "single", empty }: { title: string; subtitle?: string; data: Point[]; unit: string; colorBy?: "single" | "area"; empty: string }) {
  const height = Math.max(120, data.length * 30 + 20);
  return (
    <Card title={title} subtitle={subtitle}>
      {data.length === 0 || data.every((d) => d.value === 0) ? (
        <p className="py-6 text-center text-sm text-muted">{empty}</p>
      ) : (
        <>
          <div style={{ height }} role="img" aria-label={`${title}: ${data.map((d) => `${d.name} ${d.value}`).join(", ")}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 0 }}>
                <CartesianGrid horizontal={false} stroke={GRID} />
                <XAxis type="number" allowDecimals={unit !== "items"} tick={{ fill: INK_MUTED, fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fill: "#e9e9e7", fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip cursor={CURSOR} contentStyle={TOOLTIP_STYLE} formatter={(v) => [v, unit]} />
                <Bar dataKey="value" name={unit} fill={PALETTE[0]} radius={[0, 4, 4, 0]} maxBarSize={18} label={{ position: "right", fill: INK_MUTED, fontSize: 11 }}>
                  {colorBy === "area" ? data.map((d) => <Cell key={d.name} fill={areaColor(d.name ?? "")} />) : null}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <TableView rows={data.map((d) => ({ key: d.name ?? "", value: d.value }))} unit={unit} keyLabel="Category" />
        </>
      )}
    </Card>
  );
}

export function MoodLine({ data }: { data: { day: string; label: string; mood: number }[] }) {
  const avg = data.length ? data.reduce((s, d) => s + d.mood, 0) / data.length : 0;
  return (
    <Card title="Mood" subtitle={data.length ? `Average ${avg.toFixed(1)} / 5 over ${data.length} logged days (last 90)` : "Log your mood on the Journal page"}>
      {data.length < 2 ? (
        <p className="py-6 text-center text-sm text-muted">Pick a mood on a couple of journal days to see the trend.</p>
      ) : (
        <>
          <div className="h-48" role="img" aria-label={`Mood over time, average ${avg.toFixed(1)} out of 5`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="label" tick={{ fill: INK_MUTED, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fill: INK_MUTED, fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: INK_MUTED, strokeDasharray: "3 3" }} formatter={(v) => [`${v} · ${MOOD_LABELS[Number(v)] ?? ""}`, "Mood"]} />
                <Line type="monotone" dataKey="mood" stroke={PALETTE[4]} strokeWidth={2} dot={{ r: 4, fill: PALETTE[4], stroke: "#202020", strokeWidth: 2 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <TableView rows={data.map((d) => ({ key: d.label, value: `${d.mood} · ${MOOD_LABELS[d.mood]}` }))} unit="Mood" keyLabel="Day" />
        </>
      )}
    </Card>
  );
}
