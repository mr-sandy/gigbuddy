// shadcn/ui Button (Story 7.18), adapted to GigBuddy sizes and tokens.
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils.js';

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium text-[length:var(--text-body)] leading-[var(--text-body--line-height)] outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg:not([class*='size-'])]:size-5 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90',
        'destructive-outline':
          'border border-destructive bg-background text-destructive hover:bg-destructive/10',
        outline: 'border border-input bg-background text-foreground hover:bg-muted',
        ghost: 'text-foreground hover:bg-muted',
        link: 'text-muted-foreground underline underline-offset-4',
      },
      size: {
        default: 'min-h-tap px-4',
      },
    },
    compoundVariants: [
      { variant: 'ghost', className: 'px-2.5' },
      { variant: 'link', className: 'px-0' },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
