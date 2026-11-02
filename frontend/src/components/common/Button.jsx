import React from 'react';
import { cn } from '../../utils/cn';
import { Loader2 } from 'lucide-react';

const variantClasses = {
  primary: 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] focus-visible:ring-blue-500 shadow-sm',
  secondary: 'bg-white text-[var(--color-text-main)] border border-[var(--color-border)] hover:bg-slate-50 focus-visible:ring-slate-400 shadow-sm',
  danger: 'bg-[var(--color-status-danger)] text-white hover:bg-red-700 focus-visible:ring-red-500 shadow-sm',
  outline: 'bg-transparent text-[var(--color-primary)] border border-[var(--color-primary)] hover:bg-blue-50 focus-visible:ring-blue-500',
  ghost: 'bg-transparent text-[var(--color-text-muted)] hover:bg-slate-100 hover:text-[var(--color-text-main)]',
};

const sizeClasses = {
  sm: 'px-2.5 py-1.5 text-xs font-medium rounded-md gap-1.5',
  md: 'px-3.5 py-2 text-sm font-medium rounded-lg gap-2',
  lg: 'px-4 py-2.5 text-base font-medium rounded-lg gap-2.5',
};

export const Button = React.forwardRef(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled = false,
      children,
      type = 'button',
      icon: Icon,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center transition-colors cursor-pointer select-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
          variantClasses[variant] || variantClasses.primary,
          sizeClasses[size] || sizeClasses.md,
          className
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        ) : Icon ? (
          <Icon className="w-4 h-4 shrink-0" />
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;

