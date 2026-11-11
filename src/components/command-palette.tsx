"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckSquare, CornerDownLeft, FileText, Link2, Search, type LucideIcon } from "lucide-react";
import { saveLink } from "@/app/(app)/library/actions";
import { quickNote, quickTask, searchEverything } from "@/app/(app)/search-actions";
import type { ActionResult } from "@/lib/actions";
import type { SearchHit } from "@/lib/queries/search";
import { normalizeUrl } from "@/lib/url";
import { NAV_ITEMS } from "./nav-items";

export const OPEN_PALETTE_EVENT = "logbook:open-palette";

interface Command {
  id: string;
  label: string;
  hint?: string | null;
  icon: LucideIcon;
  run: () => Promise<void> | void;
}

const SEARCH_DELAY_MS = 180;
const CLOSE_AFTER_SAVE_MS = 900;

function looksLikeUrl(text: string): string | null {
  const t = text.trim();
  if (!t || /\s/.test(t) || !/[.:/]/.test(t)) return null;
  return normalizeUrl(t);
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setHits([]);
    setStatus(null);
    setActive(0);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  // Debounced server search.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2 || looksLikeUrl(q)) {
      setHits([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const res = await searchEverything(q);
      if (!cancelled) setHits(res);
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, open]);

  const finish = useCallback(
    (result: ActionResult, href?: string) => {
      setStatus(result);
      if (!result.ok) return;
      router.refresh();
      setTimeout(() => {
        close();
        if (href) router.push(href);
      }, CLOSE_AFTER_SAVE_MS);
    },
    [router, close],
  );

  const commands = useMemo<Command[]>(() => {
    const q = query.trim();
    const url = looksLikeUrl(q);
    const list: Command[] = [];
    if (url) {
      list.push({
        id: "save-link",
        label: "Save link to Library",
        hint: url,
        icon: Link2,
        run: async () => {
          const fd = new FormData();
          fd.set("url", url);
          finish(await saveLink(null, fd));
        },
      });
    } else if (q) {
      list.push(
        { id: "task", label: `Add task for today: “${q}”`, icon: CheckSquare, run: async () => finish(await quickTask(q)) },
        {
          id: "note",
          label: `New note: “${q}”`,
          icon: FileText,
          run: async () => {
            const res = await quickNote(q);
            finish(res, res.ok && res.id ? `/notes/${res.id}` : undefined);
          },
        },
      );
    }
    for (const h of hits) {
      list.push({ id: `${h.kind}-${h.id}`, label: h.title, hint: h.subtitle, icon: Search, run: () => (close(), router.push(h.href)) });
    }
    const lower = q.toLowerCase();
    for (const n of NAV_ITEMS) {
      if (!q || n.label.toLowerCase().includes(lower)) {
        list.push({ id: `nav-${n.href}`, label: `Go to ${n.label}`, icon: n.icon, run: () => (close(), router.push(n.href)) });
      }
    }
    return list;
  }, [query, hits, finish, close, router]);

  useEffect(() => setActive(0), [query, hits]);

  if (!open) return null;

  const runActive = (index = active) => {
    const cmd = commands[index];
    if (!cmd || pending) return;
    startTransition(async () => {
      await cmd.run();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div role="dialog" aria-modal="true" aria-label="Search and quick capture" className="w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl shadow-black/50">
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Search className="size-4 shrink-0 text-muted" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setStatus(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
              else if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, commands.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                runActive();
              }
            }}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={commands[active] ? `${listId}-${active}` : undefined}
            placeholder="Paste a link, type a task or note, or search…"
            className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-muted/70"
          />
          <kbd className="hidden rounded border border-line px-1.5 text-[10px] text-muted sm:block">Esc</kbd>
        </div>

        {status ? (
          <p role={status.ok ? "status" : "alert"} className={`border-b border-line px-4 py-2 text-sm ${status.ok ? "text-success" : "text-danger"}`}>
            {status.ok ? status.message : status.error}
          </p>
        ) : pending ? (
          <p role="status" className="border-b border-line px-4 py-2 text-sm text-muted">
            Working…
          </p>
        ) : null}

        <ul id={listId} role="listbox" aria-label="Results" className="max-h-[50vh] overflow-y-auto p-2">
          {commands.map((c, i) => {
            const Icon = c.icon;
            return (
              <li
                key={c.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseMove={() => setActive(i)}
                onClick={() => runActive(i)}
                className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm ${i === active ? "bg-panel-2 text-fg" : "text-muted"}`}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-fg">{c.label}</span>
                  {c.hint ? <span className="block truncate text-xs text-muted">{c.hint}</span> : null}
                </span>
                {i === active ? <CornerDownLeft className="size-3.5 shrink-0" aria-hidden /> : null}
              </li>
            );
          })}
          {commands.length === 0 ? <li className="px-3 py-6 text-center text-sm text-muted">No matches.</li> : null}
        </ul>
      </div>
    </div>
  );
}
