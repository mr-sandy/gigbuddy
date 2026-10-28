// A native <select> styled like `Input`, at the Body size so long options fit.
// Native on purpose: iPhone shows its picker wheel, the Mac a menu (Story 7.25).
// The browser's own arrow is hidden and a chevron is drawn inset by the text's
// left padding, so it sits inside the box rather than against the border (7.27).
import { ChevronDown } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils.js';

function NativeSelect({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <div className="relative w-full min-w-0">
      <select
        data-slot="native-select"
        className={cn(
          'block min-h-tap w-full min-w-0 appearance-none rounded-lg border border-input bg-background py-2 pr-10 pl-3 text-[length:var(--text-body)] text-foreground leading-[var(--text-body--line-height)] shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

export { NativeSelect };
