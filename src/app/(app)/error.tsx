"use client";

import { RotateCw, TriangleAlert } from "lucide-react";
import { cls } from "@/components/cls";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className={`${cls.card} rise mx-auto mt-16 flex max-w-md flex-col items-center p-8 text-center`}>
      <span className="grid size-10 place-items-center rounded-xl border border-danger/30 bg-danger/10 text-danger">
        <TriangleAlert className="size-[18px]" aria-hidden />
      </span>
      <h1 className="mt-4 font-display text-2xl">Something went wrong</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">This is usually a database hiccup. Your data is safe — try again.</p>
      <button type="button" onClick={reset} className={`${cls.btnPrimary} mt-6`}>
        <RotateCw className="size-4" aria-hidden /> Try again
      </button>
    </div>
  );
}
