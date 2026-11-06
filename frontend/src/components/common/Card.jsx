import React from 'react';
import { cn } from '../../utils/cn';

export function Card({ className, children, ...props }) {
  return (
    <div
      className={cn(
        'bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-xs transition-shadow overflow-hidden',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }) {
  return (
    <div
      className={cn('px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }) {
  return (
    <h3
      className={cn('text-sm font-semibold text-[var(--color-text-main)] tracking-tight', className)}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({ className, children, ...props }) {
  return (
    <p
      className={cn('text-xs text-[var(--color-text-muted)] mt-0.5', className)}
      {...props}
    >
      {children}
    </p>
  );
}

export function CardContent({ className, children, ...props }) {
  return (
    <div className={cn('p-5', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...props }) {
  return (
    <div
      className={cn('px-5 py-3.5 bg-slate-50/50 border-t border-[var(--color-border)] rounded-b-xl flex items-center', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export default Card;

