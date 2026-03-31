import type { LucideIcon } from "lucide-react";

interface SummaryCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
}

export default function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: SummaryCardProps) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            {value}
          </h3>
          {subtitle ? (
            <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
          ) : null}
        </div>

        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}