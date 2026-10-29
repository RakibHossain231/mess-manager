import AppShell from "@/components/layout/app-shell";

export default function PageSkeleton() {
  return (
    <AppShell>
      <div className="space-y-8 animate-pulse">
        {/* Header Skeleton */}
        <div className="space-y-2">
          <div className="h-8 w-48 rounded-2xl bg-slate-200 dark:bg-slate-800" />
          <div className="h-4 w-72 rounded-xl bg-slate-200 dark:bg-slate-800" />
        </div>

        {/* Metric Cards Skeleton */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between">
                <div className="h-4 w-20 rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-8 w-8 rounded-xl bg-slate-200 dark:bg-slate-800" />
              </div>
              <div className="mt-4 h-6 w-28 rounded bg-slate-200 dark:bg-slate-800" />
            </div>
          ))}
        </div>

        {/* Main Content / Table Skeleton */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6 space-y-2">
            <div className="h-6 w-36 rounded-xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-4 w-60 rounded-lg bg-slate-200 dark:bg-slate-800" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-12 w-full rounded-2xl bg-slate-100 dark:bg-slate-800/60"
              />
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
