import { Card, Skeleton } from "@heroui/react";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4 lg:gap-6" aria-busy="true" aria-label="Lädt …">
      <div className="flex items-end justify-between">
        <Skeleton className="hidden h-9 w-48 rounded-xl lg:block" />
        <Skeleton className="h-10 w-64 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} className="gap-4 rounded-3xl p-5">
            <Skeleton className="size-10 rounded-2xl" />
            <Skeleton className="h-3 w-1/2 rounded-lg" />
            <Skeleton className="h-7 w-3/4 rounded-lg" />
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        {Array.from({ length: 3 }, (_, i) => (
          <Card key={i} className="gap-4 rounded-3xl p-5">
            <Skeleton className="h-4 w-1/3 rounded-lg" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </Card>
        ))}
      </div>
    </div>
  );
}
