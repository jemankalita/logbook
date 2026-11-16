"use client";

import { useId } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { springs } from "@/lib/motion-tokens";
import { cls } from "./cls";

export interface SegmentItem {
  href: string;
  label: string;
  active: boolean;
}

/** A view switch made of links; the highlight slides to the selected option. */
export function Segmented({ items, label }: { items: SegmentItem[]; label: string }) {
  const id = useId();
  return (
    <nav className={cls.segment} aria-label={label}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          scroll={false}
          aria-current={item.active ? "page" : undefined}
          className={`relative rounded-md px-3 py-1 transition-colors duration-150 ${item.active ? "text-fg" : "text-muted hover:text-fg"}`}
        >
          {item.active ? <motion.span layoutId={id} transition={springs.snappy} className="absolute inset-0 rounded-md bg-panel-3 shadow-raised" /> : null}
          <span className="relative">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
