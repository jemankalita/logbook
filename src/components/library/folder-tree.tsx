import Link from "next/link";
import { Folder, Inbox, Layers, Star } from "lucide-react";
import type { FolderNode } from "@/lib/queries/library";

export type FolderSelection = { kind: "all" } | { kind: "unsorted" } | { kind: "starred" } | { kind: "folder"; id: string };

interface RowProps {
  href: string;
  active: boolean;
  label: React.ReactNode;
  count?: number;
  icon: React.ReactNode;
  depth?: number;
}

function Row({ href, active, label, count, icon, depth = 0 }: RowProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      style={{ paddingLeft: `${0.5 + depth * 0.85}rem` }}
      className={`flex items-center gap-2 rounded-lg py-1.5 pr-2 text-sm transition-colors ${active ? "bg-panel-2 text-fg" : "text-muted hover:bg-panel-2/60 hover:text-fg"}`}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined ? <span className="tabular text-xs text-muted">{count}</span> : null}
    </Link>
  );
}

function Branch({ nodes, selected }: { nodes: FolderNode[]; selected: FolderSelection }) {
  return (
    <>
      {nodes.map((n) => (
        <div key={n.id}>
          <Row
            href={`/library?folder=${n.id}`}
            active={selected.kind === "folder" && selected.id === n.id}
            depth={n.depth}
            count={n.total}
            label={n.name}
            icon={
              n.emoji ? (
                <span aria-hidden className="w-4 text-center text-sm">
                  {n.emoji}
                </span>
              ) : (
                <Folder className="size-4 shrink-0" aria-hidden />
              )
            }
          />
          {n.children.length ? <Branch nodes={n.children} selected={selected} /> : null}
        </div>
      ))}
    </>
  );
}

export function FolderTree({
  tree,
  selected,
  counts,
}: {
  tree: FolderNode[];
  selected: FolderSelection;
  counts: { links: number; starred: number; unsorted: number };
}) {
  return (
    <nav aria-label="Folders" className="flex flex-col gap-0.5">
      <Row href="/library" active={selected.kind === "all"} label="All links" count={counts.links} icon={<Layers className="size-4 shrink-0" aria-hidden />} />
      <Row href="/library?folder=starred" active={selected.kind === "starred"} label="Starred" count={counts.starred} icon={<Star className="size-4 shrink-0" aria-hidden />} />
      <Row href="/library?folder=unsorted" active={selected.kind === "unsorted"} label="Unsorted" count={counts.unsorted} icon={<Inbox className="size-4 shrink-0" aria-hidden />} />
      <div className="my-2 h-px bg-line" />
      {tree.length ? <Branch nodes={tree} selected={selected} /> : <p className="px-2 text-xs text-muted">No folders yet.</p>}
    </nav>
  );
}
