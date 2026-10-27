// shadcn/ui Textarea (Story 7.18), adapted to GigBuddy sizes and tokens.
import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils.js';

function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'block min-h-tap w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-[length:var(--text-reading)] text-foreground leading-[var(--text-reading--line-height)] shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
