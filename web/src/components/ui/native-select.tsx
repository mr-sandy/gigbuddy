// A native <select> styled like `Input`, at the Body size so long options fit.
// Native on purpose: iPhone shows its picker wheel, the Mac a menu (Story 7.25).
import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils.js';

function NativeSelect({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        'block min-h-tap w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-[length:var(--text-body)] text-foreground leading-[var(--text-body--line-height)] shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export { NativeSelect };
