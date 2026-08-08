import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

// asChild renders the styles onto a child element, normally a router Link, so
// navigation stays a real anchor and middle-click still works.
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[4px] text-[13px] font-medium disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // Light fill rather than a saturated brand colour. Keeps the accent free
        // to mean "selected" everywhere else in the interface.
        primary: 'bg-fg text-canvas hover:bg-white',
        secondary: 'border border-line-strong bg-elevated text-fg hover:border-fg-subtle',
        ghost: 'text-fg-muted hover:bg-elevated hover:text-fg',
        outline: 'border border-line-strong text-fg-muted hover:border-fg-subtle hover:text-fg',
        danger: 'border border-risk-critical/50 text-risk-critical hover:bg-risk-critical/10',
        link: 'text-accent underline-offset-2 hover:underline',
      },
      size: {
        sm: 'h-6 px-2 text-[12px]',
        md: 'h-7 px-2.5',
        lg: 'h-8 px-3',
        icon: 'h-7 w-7',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Component = asChild ? Slot : 'button';
    return (
      <Component
        ref={ref}
        // Buttons in a form default to submit, which fires when someone adds a
        // Cancel button and forgets.
        type={asChild ? undefined : (type ?? 'button')}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
