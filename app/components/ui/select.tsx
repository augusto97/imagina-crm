import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Select nativo estilizado. Para casos avanzados (búsqueda, virtualización)
 * crearemos un Combobox sobre Radix Popover, pero esto cubre el FieldType
 * picker y filtros simples.
 */
export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
    ({ className, children, ...props }, ref) => (
        <select
            ref={ref}
            className={cn(
                'imcrm-flex imcrm-h-9 imcrm-w-full imcrm-rounded-md imcrm-border imcrm-border-input imcrm-bg-background imcrm-px-3 imcrm-py-1 imcrm-text-sm imcrm-shadow-sm imcrm-transition-colors',
                'focus-visible:imcrm-outline-none focus-visible:imcrm-ring-2 focus-visible:imcrm-ring-ring focus-visible:imcrm-ring-offset-2',
                'disabled:imcrm-cursor-not-allowed disabled:imcrm-opacity-50',
                className,
            )}
            {...props}
        >
            {children}
        </select>
    ),
);
Select.displayName = 'Select';
