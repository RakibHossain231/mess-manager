import type { ReactNode } from "react";

interface SectionTitleProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export default function SectionTitle({
  title,
  subtitle,
  action,
}: SectionTitleProps) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>

      {action ? <div>{action}</div> : null}
    </div>
  );
}