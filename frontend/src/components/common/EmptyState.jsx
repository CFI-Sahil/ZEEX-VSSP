import React from 'react';
import { cn } from '../../utils/cn';
import { Inbox } from 'lucide-react';

export function EmptyState({
  icon: Icon = Inbox,
  title = 'No records found',
  description = 'There are no items to display at this moment.',
  action,
  className,
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-xl border border-dashed border-[var(--color-border)] bg-slate-50/50',
        className
      )}
    >
      <div className="p-3 bg-white rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)] shadow-2xs mb-3.5">
        <Icon className="w-6 h-6 text-slate-400" />
      </div>
      <h4 className="text-sm font-semibold text-[var(--color-text-main)]">
        {title}
      </h4>
      <p className="text-xs text-[var(--color-text-muted)] mt-1 max-w-sm">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export default EmptyState;

