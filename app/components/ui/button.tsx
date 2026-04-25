import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
    'imcrm-inline-flex imcrm-items-center imcrm-justify-center imcrm-gap-2 imcrm-whitespace-nowrap imcrm-rounded-md imcrm-text-sm imcrm-font-medium imcrm-transition-colors focus-visible:imcrm-outline-none focus-visible:imcrm-ring-2 focus-visible:imcrm-ring-ring focus-visible:imcrm-ring-offset-2 disabled:imcrm-pointer-events-none disabled:imcrm-opacity-50',
    {
        variants: {
            variant: {
                default:
                    'imcrm-bg-primary imcrm-text-primary-foreground hover:imcrm-bg-primary/90',
                destructive:
                    'imcrm-bg-destructive imcrm-text-destructive-foreground hover:imcrm-bg-destructive/90',
                outline:
                    'imcrm-border imcrm-border-border imcrm-bg-background hover:imcrm-bg-accent hover:imcrm-text-accent-foreground',
                secondary:
                    'imcrm-bg-secondary imcrm-text-secondary-foreground hover:imcrm-bg-secondary/80',
                ghost: 'hover:imcrm-bg-accent hover:imcrm-text-accent-foreground',
                link: 'imcrm-text-primary imcrm-underline-offset-4 hover:imcrm-underline',
            },
            size: {
                default: 'imcrm-h-9 imcrm-px-4 imcrm-py-2',
                sm: 'imcrm-h-8 imcrm-rounded-md imcrm-px-3 imcrm-text-xs',
                lg: 'imcrm-h-10 imcrm-rounded-md imcrm-px-6',
                icon: 'imcrm-h-9 imcrm-w-9',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    },
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : 'button';
        return (
            <Comp
                ref={ref}
                className={cn(buttonVariants({ variant, size, className }))}
                {...props}
            />
        );
    },
);
Button.displayName = 'Button';

export { buttonVariants };
