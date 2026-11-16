import Link from "next/link";
import { KnowledgeGraph } from "@/components/insights/knowledge-graph";
import { getGraph, MAX_LINK_NODES } from "@/lib/queries/graph";
import { BackLink, PageHeader } from "@/components/page-ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Knowledge graph · Logbook" };

export default async function GraphPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const all = (await searchParams).all === "1";
  const graph = await getGraph(all);

  return (
    <div className="rise mx-auto flex max-w-7xl flex-col gap-4">
      <BackLink href="/insights">Insights</BackLink>
      <PageHeader
        title="Knowledge graph"
        description="How your folders, links, notes, tags and paths connect. Links inside a note connect it to what it points at; tags connect everything that shares them."
      />
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
        <div className="rounded-xl border border-dashed border-line-strong/70 px-6 py-12 text-center text-sm text-muted">Nothing to connect yet. Save links into folders, tag them, write notes — the graph grows as you do.</div>
      ) : (
        <KnowledgeGraph data={{ nodes: graph.nodes, edges: graph.edges }} />
      )}
    </div>
  );
}
