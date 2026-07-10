import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import { pageDescription, pageHeaderBar, pageTitle } from "../lib/ui";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

/**
 * Consistent page title row used across Dashboard, Employees, Print, Settings.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn(pageHeaderBar, className)}>
      <div className="min-w-0">
        <h1 className={pageTitle}>{title}</h1>
        {description ? <p className={pageDescription}>{description}</p> : null}
      </div>
      {actions ? (
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 w-full md:w-auto shrink-0">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
