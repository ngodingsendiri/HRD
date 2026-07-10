import type { LucideIcon } from "lucide-react";
import { Search } from "lucide-react";
import { emptyIconWrap } from "../lib/ui";

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
}

export function EmptyState({
  title = "Data belum tersedia",
  description = "Tidak ada data yang cocok dengan filter atau pencarian saat ini.",
  icon: Icon = Search,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className={emptyIconWrap}>
        <Icon className="w-6 h-6 text-slate-400" strokeWidth={1.5} />
      </div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="text-xs text-slate-500 mt-1 max-w-sm leading-relaxed">
        {description}
      </p>
    </div>
  );
}
