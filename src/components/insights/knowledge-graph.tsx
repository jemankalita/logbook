"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, type SimulationLinkDatum, type SimulationNodeDatum } from "d3-force";
import { PALETTE } from "@/lib/colors";
import { KIND_ORDER, type GraphData, type GraphKind, type GraphNode } from "@/lib/graph";

const KIND_COLOR: Record<GraphKind, string> = {
  folder: PALETTE[3],
  link: PALETTE[0],
  note: PALETTE[2],
  tag: PALETTE[4],
  path: PALETTE[1],
  task: PALETTE[6],
};
const KIND_LABEL: Record<GraphKind, string> = { folder: "Folders", link: "Links", note: "Notes", tag: "Tags", path: "Paths", task: "Path tasks" };

type SimNode = GraphNode & SimulationNodeDatum;
type SimLink = SimulationLinkDatum<SimNode>;

const radius = (n: GraphNode) => Math.min(18, 3 + Math.sqrt(n.degree) * 2 + (n.kind === "folder" || n.kind === "path" ? 3 : 0));

export function KnowledgeGraph({ data }: { data: GraphData }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState<Set<GraphKind>>(new Set());
  const [hover, setHover] = useState<SimNode | null>(null);
  const [query, setQuery] = useState("");
  // The highlight text is read by the draw loop through a ref, so typing only redraws —
  // it doesn't rebuild the simulation (which would reset the layout, zoom and hover).
  const queryRef = useRef("");
  const redrawRef = useRef<() => void>(() => {});

  const view = useMemo(() => {
    const nodes: GraphNode[] = data.nodes.filter((n) => !hidden.has(n.kind));
    const ids = new Set(nodes.map((n) => n.id));
    const edges = data.edges.filter((e) => ids.has(e.source) && ids.has(e.target));
    const neighbours = new Map<string, Set<string>>();
    for (const e of edges) {
      if (!neighbours.has(e.source)) neighbours.set(e.source, new Set());
      if (!neighbours.has(e.target)) neighbours.set(e.target, new Set());
      neighbours.get(e.source)!.add(e.target);
      neighbours.get(e.target)!.add(e.source);
    }
    return { nodes, edges, neighbours };
  }, [data, hidden]);

  useEffect(() => {
    queryRef.current = query.trim().toLowerCase();
    redrawRef.current();
  }, [query]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = wrap.clientWidth;
    let height = wrap.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    const transform = { x: width / 2, y: height / 2, k: 0.9 };
    let hovered: SimNode | null = null;
    let dragging: SimNode | null = null;
    let panning: { x: number; y: number } | null = null;
    let moved = false;
    // d3 mutates nodes/links in place, so every run gets fresh copies.
    const nodes: SimNode[] = view.nodes.map((n) => ({ ...n }));
    const links: SimLink[] = view.edges.map((e) => ({ source: e.source, target: e.target }));
    const neighbours = view.neighbours;

    const resize = () => {
      width = wrap.clientWidth;
      height = wrap.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };
    resize();

    const sim = forceSimulation<SimNode>(nodes)
      .force("link", forceLink<SimNode, SimLink>(links).id((d) => d.id).distance(40).strength(0.4))
      .force("charge", forceManyBody<SimNode>().strength(-60).distanceMax(400))
      .force("center", forceCenter(0, 0))
      .force("collide", forceCollide<SimNode>().radius((d) => radius(d) + 2));

    function draw() {
      if (!ctx) return;
      const q = queryRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.translate(transform.x, transform.y);
      ctx.scale(transform.k, transform.k);
      const focus = hovered ? neighbours.get(hovered.id) : null;

      ctx.lineWidth = 1 / transform.k;
      for (const l of links) {
        const s = l.source as SimNode;
        const t = l.target as SimNode;
        const lit = hovered && (s.id === hovered.id || t.id === hovered.id);
        ctx.strokeStyle = lit ? "rgba(236,237,238,0.6)" : "rgba(154,157,166,0.16)";
        ctx.beginPath();
        ctx.moveTo(s.x ?? 0, s.y ?? 0);
        ctx.lineTo(t.x ?? 0, t.y ?? 0);
        ctx.stroke();
      }
      for (const n of nodes) {
        const dim = (hovered && n.id !== hovered.id && !focus?.has(n.id)) || (q && !n.label.toLowerCase().includes(q));
        ctx.globalAlpha = dim ? 0.2 : 1;
        ctx.fillStyle = KIND_COLOR[n.kind];
        ctx.beginPath();
        ctx.arc(n.x ?? 0, n.y ?? 0, radius(n), 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 2 / transform.k;
        ctx.strokeStyle = "#0b0c0e";
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // Labels: big nodes always, the hovered node and its neighbours, and search matches.
      ctx.font = `${12 / transform.k}px system-ui, sans-serif`;
      ctx.fillStyle = "#ecedee";
      ctx.textAlign = "center";
      for (const n of nodes) {
        const show = n === hovered || focus?.has(n.id) || (q && n.label.toLowerCase().includes(q)) || (!hovered && !q && n.degree >= 6 && transform.k > 0.6);
        if (!show) continue;
        const label = n.label.length > 40 ? `${n.label.slice(0, 39)}…` : n.label;
        ctx.fillText(label, n.x ?? 0, (n.y ?? 0) + radius(n) + 12 / transform.k);
      }
    }
    sim.on("tick", draw);
    redrawRef.current = draw;

    const toWorld = (e: PointerEvent | WheelEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: (e.clientX - rect.left - transform.x) / transform.k, y: (e.clientY - rect.top - transform.y) / transform.k };
    };
    const pick = (e: PointerEvent) => {
      const p = toWorld(e);
      let best: SimNode | null = null;
      let bestDist = Infinity;
      for (const n of nodes) {
        const d = Math.hypot((n.x ?? 0) - p.x, (n.y ?? 0) - p.y);
        if (d < radius(n) + 4 / transform.k && d < bestDist) {
          best = n;
          bestDist = d;
        }
      }
      return best;
    };

    const onDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      moved = false;
      const n = pick(e);
      if (n) {
        dragging = n;
        sim.alphaTarget(0.2).restart();
      } else panning = { x: e.clientX - transform.x, y: e.clientY - transform.y };
    };
    const onMove = (e: PointerEvent) => {
      if (dragging) {
        const p = toWorld(e);
        dragging.fx = p.x;
        dragging.fy = p.y;
        moved = true;
        return;
      }
      if (panning) {
        transform.x = e.clientX - panning.x;
        transform.y = e.clientY - panning.y;
        moved = true;
        draw();
        return;
      }
      const n = pick(e);
      if (n !== hovered) {
        hovered = n;
        setHover(n);
        canvas.style.cursor = n?.href ? "pointer" : n ? "grab" : "default";
        draw();
      }
    };
    const onUp = () => {
      if (dragging) {
        if (!moved && dragging.href) router.push(dragging.href);
        dragging.fx = null;
        dragging.fy = null;
        sim.alphaTarget(0);
      }
      dragging = null;
      panning = null;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const k = Math.min(4, Math.max(0.15, transform.k * Math.exp(-e.deltaY * 0.0015)));
      transform.x = mx - ((mx - transform.x) * k) / transform.k;
      transform.y = my - ((my - transform.y) * k) / transform.k;
      transform.k = k;
      draw();
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointerleave", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    const ro = new ResizeObserver(() => {
      resize();
      draw();
    });
    ro.observe(wrap);

    return () => {
      sim.stop();
      ro.disconnect();
      redrawRef.current = () => {};
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointerleave", onUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [view, router]);

  const counts = useMemo(() => {
    const m = new Map<GraphKind, number>();
    for (const n of data.nodes) m.set(n.kind, (m.get(n.kind) ?? 0) + 1);
    return m;
  }, [data]);
  const hubs = useMemo(() => [...data.nodes].sort((a, b) => b.degree - a.degree).slice(0, 12), [data]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="graph-q">
          Highlight nodes
        </label>
        <input id="graph-q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Highlight…" className="h-8 w-44 rounded-lg border border-line bg-panel-2 px-2.5 text-sm outline-none focus:border-accent" />
        <ul className="flex flex-wrap gap-1.5" aria-label="Show or hide node types">
          {KIND_ORDER.filter((k) => counts.get(k)).map((k) => (
            <li key={k}>
              <button
                type="button"
                aria-pressed={!hidden.has(k)}
                onClick={() =>
                  setHidden((h) => {
                    const next = new Set(h);
                    if (next.has(k)) next.delete(k);
                    else next.add(k);
                    return next;
                  })
                }
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${hidden.has(k) ? "border-line text-muted/60 line-through" : "border-line text-fg"}`}
              >
                <span aria-hidden className="size-2.5 rounded-full" style={{ background: KIND_COLOR[k] }} />
                {KIND_LABEL[k]} · {counts.get(k)}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div ref={wrapRef} className="relative h-[65vh] min-h-96 overflow-hidden rounded-xl border border-line bg-bg">
        <canvas ref={canvasRef} className="touch-none" aria-label={`Knowledge graph with ${view.nodes.length} items and ${view.edges.length} connections. A list of the most connected items follows.`} role="img" />
        {hover ? (
          <div className="pointer-events-none absolute left-3 top-3 max-w-sm rounded-lg border border-line bg-panel/95 px-3 py-2 text-xs shadow-lg">
            <p className="font-medium text-fg">{hover.label}</p>
            <p className="text-muted">
              {KIND_LABEL[hover.kind].replace(/s$/, "")} · {hover.degree} connection{hover.degree === 1 ? "" : "s"}
              {hover.href ? " · click to open" : ""}
            </p>
          </div>
        ) : null}
        <p className="pointer-events-none absolute bottom-2 right-3 text-[11px] text-muted">Scroll to zoom · drag to pan · drag a dot to move it</p>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted">Most connected</summary>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {hubs.map((n) => (
            <li key={n.id} className="flex items-center gap-2">
              <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: KIND_COLOR[n.kind] }} />
              {n.href ? (
                <a href={n.href} className="truncate hover:underline">
                  {n.label}
                </a>
              ) : (
                <span className="truncate">{n.label}</span>
              )}
              <span className="tabular ml-auto text-xs text-muted">{n.degree}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
