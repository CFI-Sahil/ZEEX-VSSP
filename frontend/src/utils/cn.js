import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines conditional class names with Tailwind merge
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

