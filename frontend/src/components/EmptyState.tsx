import type { ReactNode } from "react";

/**
 * Standard branded empty state: soft navy icon tile, message, optional hint
 * and call-to-action. Use wherever a list or table has nothing to show.
 */
export default function EmptyState({
  Icon,
  title,
  hint,
  action,
}: {
  Icon: React.ElementType;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="w-12 h-12 rounded-xl bg-brand-navy/5 flex items-center justify-center mb-3">
        <Icon className="w-6 h-6 text-brand-navy-600" />
      </div>
      <p className="text-sm font-semibold text-gray-700">{title}</p>
      {hint && <p className="text-xs text-gray-400 mt-1 max-w-xs">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
