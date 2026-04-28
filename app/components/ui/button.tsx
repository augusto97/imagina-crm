import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
    [
        // Base: layout + tipografía + transición
        'imcrm-relative imcrm-inline-flex imcrm-items-center imcrm-justify-center imcrm-gap-1.5',
        'imcrm-whitespace-nowrap imcrm-font-medium imcrm-tracking-tight',
        'imcrm-transition-all imcrm-duration-150',
        // Focus ring refinado
        'focus-visible:imcrm-outline-none focus-visible:imcrm-ring-2 focus-visible:imcrm-ring-ring focus-visible:imcrm-ring-offset-2 focus-visible:imcrm-ring-offset-background',
        // Disabled
        'disabled:imcrm-pointer-events-none disabled:imcrm-opacity-50',
        // Active feedback global
        'active:imcrm-scale-[0.98]',
    ].join(' '),
    {
        variants: {
            variant: {
                /* Primary: solid con sombra muy sutil y un highlight
                 * blanco interno (inset top) para sentir profundidad.
                 * Hover oscurece levemente; active scale ya viene de base. */
                default: [
                    'imcrm-bg-primary imcrm-text-primary-foreground',
                    'imcrm-shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_1px_2px_0_rgb(15_23_42/0.08)]',
                    'hover:imcrm-bg-primary/90 hover:imcrm-shadow-imcrm-sm',
                ].join(' '),

                /* Secondary: lo que en Linear/Vercel es el botón "default" —
                 * white + hairline border + hover bg muy leve. Es el más
                 * usado para acciones no-primarias. */
                outline: [
                    'imcrm-bg-card imcrm-text-foreground imcrm-border imcrm-border-border',
                    'imcrm-shadow-imcrm-sm',
                    'hover:imcrm-bg-accent hover:imcrm-border-input',
                ].join(' '),

                /* Secondary: gris suave, sin border. Para acciones
                 * paralelas dentro de un grupo. */
                secondary: [
                    'imcrm-bg-secondary imcrm-text-secondary-foreground',
                    'hover:imcrm-bg-accent',
                ].join(' '),

                /* Destructive */
                destructive: [
                    'imcrm-bg-destructive imcrm-text-destructive-foreground',
                    'imcrm-shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_1px_2px_0_rgb(15_23_42/0.08)]',
                    'hover:imcrm-bg-destructive/90 hover:imcrm-shadow-imcrm-sm',
                ].join(' '),

                /* Ghost: sin chrome, sólo hover. Para íconos y acciones
                 * sutiles dentro de cards / toolbars. */
                ghost: [
                    'imcrm-text-foreground/80',
                    'hover:imcrm-bg-accent hover:imcrm-text-foreground',
                ].join(' '),

                /* Link */
                link: 'imcrm-text-primary imcrm-underline-offset-4 hover:imcrm-underline',
            },
            size: {
                default: 'imcrm-h-9 imcrm-rounded-lg imcrm-px-3.5 imcrm-text-sm',
                sm: 'imcrm-h-8 imcrm-rounded-md imcrm-px-3 imcrm-text-[13px]',
                lg: 'imcrm-h-10 imcrm-rounded-lg imcrm-px-5 imcrm-text-sm',
                icon: 'imcrm-h-9 imcrm-w-9 imcrm-rounded-lg',
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
