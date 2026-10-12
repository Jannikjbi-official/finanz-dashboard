export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Wird geladen">
      <div className="h-7 w-48 animate-pulse rounded-[var(--radius)] bg-surface-secondary" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="panel h-80 animate-pulse lg:col-span-7" />
        <div className="panel h-80 animate-pulse lg:col-span-5" />
      </div>
      <div className="panel h-64 animate-pulse" />
    </div>
  );
}
