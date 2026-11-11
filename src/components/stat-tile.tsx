export function StatTile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="tabular mt-1 text-2xl font-semibold">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
