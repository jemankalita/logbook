"use client";

import { RefreshCw } from "lucide-react";
import { useFormStatus } from "react-dom";
import { refreshCalendar } from "@/app/(app)/actions";

function Button() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel-2 px-3 py-1.5 text-sm transition hover:brightness-125 active:scale-[0.97] disabled:opacity-60"
    >
      <RefreshCw className={`size-3.5 ${pending ? "animate-spin" : ""}`} aria-hidden />
      {pending ? "Refreshing…" : "Refresh"}
    </button>
  );
}

export function RefreshCalendarButton() {
  return (
    <form action={refreshCalendar}>
      <Button />
    </form>
  );
}
