import * as React from 'react';

import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, ...props }, ref) => {
        return (
            <input
                ref={ref}
                type={type ?? 'text'}
                className={cn(
                    'imcrm-flex imcrm-h-9 imcrm-w-full imcrm-rounded-md imcrm-border imcrm-border-input imcrm-bg-background imcrm-px-3 imcrm-py-1 imcrm-text-sm imcrm-shadow-sm imcrm-transition-colors',
                    'file:imcrm-border-0 file:imcrm-bg-transparent file:imcrm-text-sm file:imcrm-font-medium',
                    'placeholder:imcrm-text-muted-foreground',
                    'focus-visible:imcrm-outline-none focus-visible:imcrm-ring-2 focus-visible:imcrm-ring-ring focus-visible:imcrm-ring-offset-2',
                    'disabled:imcrm-cursor-not-allowed disabled:imcrm-opacity-50',
                    className,
                )}
                {...props}
            />
        );
    },
);
Input.displayName = 'Input';
