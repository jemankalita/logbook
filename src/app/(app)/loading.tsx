/**
 * Shown instantly while a page's data loads (every page here is rendered on the server),
 * so navigation feels immediate instead of freezing on the previous page.
 */
const block = "rounded-xl bg-panel-2/70 motion-safe:animate-pulse";

export default function Loading() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6" role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="flex flex-col gap-3">
        <div className={`${block} h-3 w-28`} />
        <div className={`${block} h-9 w-64 max-w-full`} />
        <div className={`${block} h-4 w-96 max-w-full`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className={`${block} h-44`} />
        <div className={`${block} h-44`} />
        <div className={`${block} h-44`} />
      </div>
      <div className={`${block} h-64`} />
    </div>
  );
}
