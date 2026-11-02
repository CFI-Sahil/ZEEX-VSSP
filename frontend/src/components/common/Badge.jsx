import React from 'react';
import { cn } from '../../utils/cn';

const variantClasses = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-rose-50 text-rose-700 border-rose-200',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  navy: 'bg-[#183653] text-blue-200 border-blue-900',
};

const dotClasses = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
  info: 'bg-sky-500',
  neutral: 'bg-slate-400',
  navy: 'bg-blue-400',
};

export function Badge({
  children,
  variant = 'neutral',
  dot = false,
  className,
  size = 'md',
  ...props
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full border leading-none',
        size === 'sm' ? 'px-2 py-0.5 text-[11px] gap-1' : 'px-2.5 py-1 text-xs gap-1.5',
        variantClasses[variant] || variantClasses.neutral,
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotClasses[variant] || dotClasses.neutral)}
        />
      )}
      {children}
    </span>
  );
}

export default Badge;

