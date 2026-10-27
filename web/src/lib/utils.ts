import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Teach tailwind-merge our custom spacing tokens (tokens.css `--spacing-*`) so
// e.g. `min-h-play-bar` replaces Button's `min-h-tap` instead of both surviving.
const twMerge = extendTailwindMerge({
  extend: {
    theme: { spacing: ['unit', 'gutter', 'tap', 'play-bar', 'tab-bar', 'header', 'sheet'] },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
