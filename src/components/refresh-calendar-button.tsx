"use client";

import { cls } from "./cls";
import { RefreshCw } from "lucide-react";
import { useFormStatus } from "react-dom";
import { refreshCalendar } from "@/app/(app)/actions";

function Button() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cls.btn}
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
