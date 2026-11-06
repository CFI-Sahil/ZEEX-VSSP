import React, { useEffect } from 'react';
import { cn } from '../../utils/cn';
import { X } from 'lucide-react';
import Button from './Button';

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'max-w-lg',
  className,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative w-full bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-xl z-10 overflow-hidden my-auto max-h-[92dvh] flex flex-col',
          maxWidth,
          className
        )}
      >
        {/* Header */}
        {(title || onClose) && (
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-[var(--color-border)] flex items-start justify-between shrink-0">
            <div>
              {title && (
                <h3 className="text-sm sm:text-base font-semibold text-[var(--color-text-main)]">
                  {title}
                </h3>
              )}
              {description && (
                <p className="text-[11px] sm:text-xs text-[var(--color-text-muted)] mt-0.5 sm:mt-1">
                  {description}
                </p>
              )}
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100 transition-colors cursor-pointer shrink-0 ml-2"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-5 overflow-y-auto flex-1">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-4 sm:px-6 py-2.5 sm:py-3.5 bg-slate-50 border-t border-[var(--color-border)] flex flex-wrap items-center justify-end gap-2 sm:gap-2.5 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default Modal;

