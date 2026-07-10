import { cn } from "../lib/utils";
import { card } from "../lib/ui";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-slate-100", className)}
      aria-hidden
    />
  );
}

export function PageSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="space-y-6" role="status" aria-label="Memuat">
      <div className="space-y-2 border-b border-slate-200 pb-6">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className={`${card} p-4 space-y-3`}>
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
      <div className={`${card} p-4 space-y-3`}>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className={`${card} overflow-hidden`} role="status" aria-label="Memuat data">
      <div className="p-3 border-b border-slate-100 flex gap-2">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-4 py-3 flex gap-4 items-center">
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 flex-1 max-w-[200px]" />
            <Skeleton className="h-4 w-28 hidden sm:block" />
            <Skeleton className="h-5 w-14 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
