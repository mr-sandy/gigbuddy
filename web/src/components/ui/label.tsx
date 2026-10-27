// shadcn/ui Label (Story 7.18), adapted to GigBuddy sizes and tokens.
import * as LabelPrimitive from '@radix-ui/react-label';
import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils.js';

function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        'block select-none font-medium text-[length:var(--text-body)] text-foreground leading-[var(--text-body--line-height)]',
        className,
      )}
      {...props}
    />
  );
}

export { Label };
