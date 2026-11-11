"use client";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border border-line bg-panel p-6 text-center">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted">This is usually a database hiccup. Your data is safe — try again.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-5 h-10 rounded-lg bg-accent px-5 font-medium text-accent-ink transition hover:brightness-110 active:scale-[0.98]"
      >
        Try again
      </button>
    </div>
  );
}
