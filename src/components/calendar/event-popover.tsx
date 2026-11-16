"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { AlignLeft, ArrowUpRight, CalendarDays, CheckCircle2, MapPin, X } from "lucide-react";
import type { CalendarItem, CalendarSource } from "@/lib/calendar/items";
import { springs } from "@/lib/motion-tokens";
import { describeWhen } from "./format";
import { EmojiText } from "../emoji";

export interface OpenEvent {
  item: CalendarItem;
  /** the clicked chip, to anchor the card next to it */
  anchor: DOMRect;
}

const WIDTH = 360;
const GAP = 8;
const MARGIN = 12;

/** Google-style event card: floats beside the clicked event, closes on Esc or a click outside. */
export function EventPopover({ open, source, timeZone, onClose }: { open: OpenEvent; source: CalendarSource | undefined; timeZone: string; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const { item, anchor } = open;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(WIDTH, vw - MARGIN * 2);
    const height = el.offsetHeight;
    let left = anchor.right + GAP;
    if (left + width > vw - MARGIN) left = anchor.left - GAP - width;
    if (left < MARGIN) left = Math.max(MARGIN, Math.min(vw - width - MARGIN, anchor.left));
    let top = anchor.top;
    if (top + height > vh - MARGIN) top = vh - height - MARGIN;
    setPos({ left, top: Math.max(MARGIN, top) });
  }, [anchor]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown, true);
    ref.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [onClose]);

  const color = source?.color ?? "var(--accent)";
  return (
    <motion.div
      ref={ref}
      role="dialog"
      aria-modal="false"
      aria-labelledby="cal-pop-title"
      tabIndex={-1}
      initial={{ opacity: 0, scale: 0.96, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={springs.gentle}
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? 0, width: `min(${WIDTH}px, calc(100vw - ${MARGIN * 2}px))` }}
      className="fixed z-50 rounded-2xl border border-line bg-panel p-2 text-sm shadow-pop outline-none"
    >
      <div className="flex justify-end">
        <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-full text-muted transition-colors duration-150 hover:bg-panel-2 hover:text-fg">
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-[2.5rem_1fr] gap-y-3 px-2 pb-3">
        <span aria-hidden className="mt-1.5 size-3.5 justify-self-center rounded-[4px]" style={{ background: color }} />
        <div>
          <h2 id="cal-pop-title" className={`text-[1.35rem] leading-snug font-normal text-fg ${item.done ? "line-through decoration-faint" : ""}`}>
            <EmojiText text={item.title} />
          </h2>
          <p className="mt-1 text-[13px] text-muted">{describeWhen(item, timeZone)}</p>
        </div>

        {item.done ? (
          <>
            <CheckCircle2 className="size-4 justify-self-center text-success" aria-hidden />
            <p className="text-[13px] text-muted">Done</p>
          </>
        ) : null}

        {item.location ? (
          <>
            <MapPin className="size-4 justify-self-center text-muted" aria-hidden />
            <p className="break-words text-[13px]">{item.location}</p>
          </>
        ) : null}

        {item.detail ? (
          <>
            <AlignLeft className="size-4 justify-self-center text-muted" aria-hidden />
            <p className="break-words text-[13px] text-muted">{item.detail}</p>
          </>
        ) : null}

        <CalendarDays className="size-4 justify-self-center text-muted" aria-hidden />
        <p className="text-[13px]">{source?.name ?? "Calendar"}</p>

        {item.href ? (
          <>
            <span />
            <Link href={item.href} className="inline-flex items-center gap-1 justify-self-start rounded-full border border-line px-3 py-1.5 text-[13px] font-medium text-fg transition-colors duration-150 hover:bg-panel-2">
              Open in Logbook
              <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          </>
        ) : null}
      </div>
    </motion.div>
  );
}
