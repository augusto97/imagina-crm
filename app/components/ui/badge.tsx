import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
    'imcrm-inline-flex imcrm-items-center imcrm-rounded-md imcrm-border imcrm-px-2 imcrm-py-0.5 imcrm-text-xs imcrm-font-medium imcrm-transition-colors',
    {
        variants: {
            variant: {
                default:
                    'imcrm-border-transparent imcrm-bg-primary imcrm-text-primary-foreground',
                secondary:
                    'imcrm-border-transparent imcrm-bg-secondary imcrm-text-secondary-foreground',
                outline:
                    'imcrm-text-foreground imcrm-border-border',
                success:
                    'imcrm-border-transparent imcrm-bg-success imcrm-text-success-foreground',
                warning:
                    'imcrm-border-transparent imcrm-bg-warning imcrm-text-warning-foreground',
                destructive:
                    'imcrm-border-transparent imcrm-bg-destructive imcrm-text-destructive-foreground',
            },
        },
        defaultVariants: { variant: 'default' },
    },
);

export interface BadgeProps
    extends React.HTMLAttributes<HTMLSpanElement>,
        VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps): JSX.Element {
    return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
