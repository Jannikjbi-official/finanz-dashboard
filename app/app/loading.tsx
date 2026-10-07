/** Ladezustand: ruhige Platzhalter in der Form der Seite statt Spinner. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Wird geladen" className="flex animate-pulse flex-col gap-8">
      <div className="flex flex-col gap-3">
        <div className="h-3 w-40 rounded-xs bg-sunken" />
        <div className="h-11 w-72 rounded-xs bg-sunken" />
        <div className="h-3 w-56 rounded-xs bg-sunken" />
      </div>
      <div className="h-px bg-line" />
      <div className="h-48 rounded-xs bg-sunken/70" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex flex-col gap-2">
            <div className="h-3 w-20 rounded-xs bg-sunken" />
            <div className="h-6 w-28 rounded-xs bg-sunken" />
          </div>
        ))}
      </div>
    </div>
  );
}
