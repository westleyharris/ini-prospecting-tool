import type { ReactNode } from "react";

/**
 * Standard page header: lime tick + navy title, optional subtitle and
 * right-aligned actions. Use on every top-level page for a consistent look.
 */
export default function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5 sm:mb-6">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <span className="w-1.5 h-6 rounded-sm bg-brand-lime shrink-0" />
          <h1 className="text-xl sm:text-2xl font-bold text-brand-navy tracking-tight truncate">
            {title}
          </h1>
        </div>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
