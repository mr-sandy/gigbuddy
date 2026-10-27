// shadcn/ui Sheet (Story 7.21), adapted: one responsive placement chosen by
// window width (bottom sheet on narrow, right panel from `md`), no animation
// library, no built-in close button, and no dismiss by tapping outside.
import * as SheetPrimitive from '@radix-ui/react-dialog';
import { type ComponentProps, useState } from 'react';
import { cn } from '../../lib/utils.js';

function Sheet(props: ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetContent({
  className,
  children,
  onInteractOutside,
  onCloseAutoFocus,
  ...props
}: ComponentProps<typeof SheetPrimitive.Content>) {
  // Radix Dialog only returns focus to a `Trigger`, and a route-driven sheet
  // has none, so remember what had focus when the sheet mounted (before Radix
  // moves focus inside) and give it back on close.
  const [opener] = useState(() => document.activeElement);
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay data-slot="sheet-overlay" className="fixed inset-0 z-50 bg-scrim" />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        onInteractOutside={(event) => {
          // A stray tap on the dimmed page must not throw away typing.
          event.preventDefault();
          onInteractOutside?.(event);
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
          onCloseAutoFocus?.(event);
        }}
        className={cn(
          'fixed inset-x-0 bottom-0 top-[calc(var(--spacing-unit)*11+env(safe-area-inset-top))] z-50 flex flex-col rounded-t-2xl bg-background shadow-lg outline-none md:inset-y-0 md:left-auto md:right-0 md:top-0 md:w-sheet md:rounded-none md:border-l md:border-border',
          className,
        )}
        {...props}
      >
        {children}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

function SheetHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-header"
      className={cn(
        'grid min-h-header shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-border px-2 [&>:last-child]:justify-self-end [&>:first-child]:justify-self-start',
        className,
      )}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        'm-0 text-center font-medium text-[length:var(--text-nav)] leading-[var(--text-nav--line-height)] text-foreground [font-family:var(--font-serif-editorial)]',
        className,
      )}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn(
        'm-0 text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

function SheetBody({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-body"
      className={cn(
        'flex-1 overflow-y-auto px-[var(--spacing-gutter)] pt-[var(--spacing-unit)] pb-[calc(var(--spacing-unit)*4+env(safe-area-inset-bottom))]',
        className,
      )}
      {...props}
    />
  );
}

export { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle };
