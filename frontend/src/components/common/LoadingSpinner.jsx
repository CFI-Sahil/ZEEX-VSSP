import React from 'react';
import { cn } from '../../utils/cn';
import { Loader2 } from 'lucide-react';

export function LoadingSpinner({ size = 'md', message, className }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div className={cn('flex flex-col items-center justify-center p-8 gap-3', className)}>
      <Loader2
        className={cn(
          'animate-spin text-[var(--color-primary)]',
          sizeClasses[size] || sizeClasses.md
        )}
      />
      {message && (
        <p className="text-xs font-medium text-[var(--color-text-muted)] animate-pulse">
          {message}
        </p>
      )}
    </div>
  );
}

export default LoadingSpinner;

