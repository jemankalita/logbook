import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cls } from "@/components/cls";
import { KnowledgeGraph } from "@/components/insights/knowledge-graph";
import { getGraph, MAX_LINK_NODES } from "@/lib/queries/graph";

export const dynamic = "force-dynamic";
export const metadata = { title: "Knowledge graph · Logbook" };

export default async function GraphPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const all = (await searchParams).all === "1";
  const graph = await getGraph(all);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <Link href="/insights" className={`${cls.btnGhost} self-start`}>
        <ArrowLeft className="size-4" aria-hidden /> Insights
      </Link>
      <div>
        <h1 className={cls.h1}>Knowledge graph</h1>
        <p className="mt-1 text-sm text-muted">
          How your folders, links, notes, tags and paths connect. Links inside a note connect it to what it points at; tags connect everything that shares them.
        </p>
      </div>
      {graph.hiddenLinks > 0 ? (
        <p className="text-xs text-muted">
          Showing {MAX_LINK_NODES} of your links (starred and recent first) to keep it fast.{" "}
          <Link href="/insights/graph?all=1" className="text-accent hover:underline">
            Show all {graph.hiddenLinks + MAX_LINK_NODES}
          </Link>
        </p>
      ) : all ? (
        <p className="text-xs text-muted">
          Showing every link.{" "}
          <Link href="/insights/graph" className="text-accent hover:underline">
            Show fewer (faster)
          </Link>
        </p>
      ) : null}
      {graph.nodes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-10 text-center text-sm text-muted">Nothing to connect yet. Save links into folders, tag them, write notes — the graph grows as you do.</div>
      ) : (
        <KnowledgeGraph data={{ nodes: graph.nodes, edges: graph.edges }} />
      )}
    </div>
  );
}
