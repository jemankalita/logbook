import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { cls } from "./cls";

/** Shared body of the 404 pages (inside the app shell and at the root). */
export function NotFoundCard() {
  return (
    <div className={`${cls.card} rise mx-auto mt-16 flex max-w-md flex-col items-center p-8 text-center`}>
      <span className="grid size-11 place-items-center rounded-xl border border-line bg-panel-2 text-muted shadow-raised">
        <FileQuestion className="size-5" aria-hidden />
      </span>
      <p className={`${cls.eyebrow} mt-5`}>404</p>
      <h1 className="mt-2 font-display text-[2rem] leading-none">Nothing on this page</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">It may have been deleted, or the link is mistyped.</p>
      <Link href="/" className={`${cls.btnPrimary} mt-6`}>
        Back to the dashboard
      </Link>
    </div>
  );
}
