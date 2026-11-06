import React from 'react';
import { cn } from '../../utils/cn';

export function Table({ className, containerClassName, children, ...props }) {
  return (
    <div className={cn('w-full overflow-x-auto', containerClassName)}>
      <table className={cn('w-full text-left text-sm border-collapse min-w-[640px]', className)} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ className, children, ...props }) {
  return (
    <thead
      className={cn('bg-slate-50/80 border-b border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider', className)}
      {...props}
    >
      {children}
    </thead>
  );
}

export function TableBody({ className, children, ...props }) {
  return (
    <tbody
      className={cn('divide-y divide-[var(--color-border)] text-[var(--color-text-main)]', className)}
      {...props}
    >
      {children}
    </tbody>
  );
}

export function TableRow({ className, children, ...props }) {
  return (
    <tr
      className={cn('transition-colors hover:bg-slate-50/60', className)}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHead({ className, children, ...props }) {
  return (
    <th className={cn('px-3 lg:px-4 py-2.5 lg:py-3 font-semibold text-xs text-[var(--color-text-muted)]', className)} {...props}>
      {children}
    </th>
  );
}

export function TableCell({ className, children, ...props }) {
  return (
    <td className={cn('px-3 lg:px-4 py-2.5 lg:py-3 align-middle text-xs sm:text-sm text-[var(--color-text-main)]', className)} {...props}>
      {children}
    </td>
  );
}

export default Table;

