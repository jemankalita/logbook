import Link from "next/link";
import { Folder, FolderOpen, Inbox, Layers, Star } from "lucide-react";
import { cls } from "@/components/cls";
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
      style={{ paddingLeft: `${0.625 + depth * 0.9}rem` }}
      className={`group flex h-8 items-center gap-2 rounded-lg pr-2 text-[13px] transition-colors duration-150 ${
        active ? "border border-line bg-panel-2 font-medium text-fg shadow-card" : "border border-transparent text-muted hover:bg-panel-2/50 hover:text-fg"
      }`}
    >
      <span className={`shrink-0 transition-colors duration-150 ${active ? "text-accent" : "text-faint group-hover:text-muted"}`}>{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined ? <span className="tabular text-[11px] text-faint">{count}</span> : null}
    </Link>
  );
}

function Branch({ nodes, selected }: { nodes: FolderNode[]; selected: FolderSelection }) {
  return (
    <>
      {nodes.map((n) => {
        const active = selected.kind === "folder" && selected.id === n.id;
        const Icon = active ? FolderOpen : Folder;
        return (
          <div key={n.id}>
            <Row
              href={`/library?folder=${n.id}`}
              active={active}
              depth={n.depth}
              count={n.total}
              label={n.name}
              icon={
                n.emoji ? (
                  <span aria-hidden className="block w-4 text-center text-sm leading-none">
                    {n.emoji}
                  </span>
                ) : (
                  <Icon className="size-4" aria-hidden />
                )
              }
            />
            {n.children.length ? <Branch nodes={n.children} selected={selected} /> : null}
          </div>
        );
      })}
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
    <nav aria-label="Folders" className="flex flex-col gap-px">
      <Row href="/library" active={selected.kind === "all"} label="All links" count={counts.links} icon={<Layers className="size-4" aria-hidden />} />
      <Row href="/library?folder=starred" active={selected.kind === "starred"} label="Starred" count={counts.starred} icon={<Star className="size-4" aria-hidden />} />
      <Row href="/library?folder=unsorted" active={selected.kind === "unsorted"} label="Unsorted" count={counts.unsorted} icon={<Inbox className="size-4" aria-hidden />} />
      <p className={`${cls.eyebrow} mb-1 mt-4 px-2.5`}>Folders</p>
      {tree.length ? <Branch nodes={tree} selected={selected} /> : <p className="px-2.5 py-1 text-xs text-faint">No folders yet.</p>}
    </nav>
  );
}
