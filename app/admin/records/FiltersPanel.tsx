import { useState } from 'react';
import { Filter, Info, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { __, sprintf } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { FieldEntity } from '@/types/field';
import { countConditions, isEmptyTree, type FilterTree } from '@/types/record';

import { FilterGroupView } from './FilterGroupView';
import { SavedFiltersDropdown } from './SavedFiltersDropdown';

interface FiltersPanelProps {
    listId: number | undefined;
    fields: FieldEntity[];
    tree: FilterTree;
    onChange: (next: FilterTree) => void;
}

/**
 * Panel inline ClickUp-style.
 *
 * Renderizado vía Radix `Popover` para que el motor de posicionamiento
 * (collision detection + auto-flip) garantice que el panel queda
 * dentro del viewport, sin meterse bajo la sidebar o cortarse a la
 * derecha. Antes lo hacíamos con `position: absolute; right: 0` sobre
 * el wrapper del botón — eso ignora completamente el viewport y deja
 * el panel cortado en layouts angostos.
 */
export function FiltersPanel({
    listId,
    fields,
    tree,
    onChange,
}: FiltersPanelProps): JSX.Element {
    const [open, setOpen] = useState(false);
    const count = isEmptyTree(tree) ? 0 : countConditions(tree);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                        'imcrm-gap-1.5',
                        count > 0 &&
                            'imcrm-border-primary/40 imcrm-bg-primary/10 imcrm-text-primary',
                    )}
                >
                    <Filter className="imcrm-h-3.5 imcrm-w-3.5" />
                    {count === 0
                        ? __('Filtrar')
                        : sprintf(
                            /* translators: %d count of active filter conditions */
                            count === 1 ? __('%d filtro') : __('%d filtros'),
                            count,
                        )}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                sideOffset={8}
                collisionPadding={16}
                className="imcrm-w-[min(720px,calc(100vw-2rem))] imcrm-p-4 imcrm-text-foreground"
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <div className="imcrm-mb-3 imcrm-flex imcrm-items-center imcrm-justify-between imcrm-gap-3">
                    <h3 className="imcrm-flex imcrm-items-center imcrm-gap-1.5 imcrm-text-sm imcrm-font-semibold imcrm-text-foreground">
                        <Filter className="imcrm-h-3.5 imcrm-w-3.5 imcrm-text-muted-foreground" />
                        {__('Filtros')}
                        <span
                            className="imcrm-cursor-help imcrm-text-muted-foreground"
                            title={__(
                                'Combina filtros con Y / O. Usa "Agregar filtro anidado" para grupos.',
                            )}
                        >
                            <Info className="imcrm-h-3 imcrm-w-3" />
                        </span>
                    </h3>
                    <div className="imcrm-flex imcrm-items-center imcrm-gap-2">
                        {listId !== undefined && (
                            <SavedFiltersDropdown
                                listId={listId}
                                currentTree={tree}
                                onApply={onChange}
                            />
                        )}
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="imcrm-rounded imcrm-p-1 imcrm-text-muted-foreground hover:imcrm-text-foreground"
                            aria-label={__('Cerrar panel')}
                        >
                            <X className="imcrm-h-4 imcrm-w-4" />
                        </button>
                    </div>
                </div>

                <FilterGroupView
                    root={tree}
                    path={[]}
                    fields={fields}
                    listId={listId}
                    onRootChange={onChange}
                />

                {!isEmptyTree(tree) && (
                    <div className="imcrm-mt-3 imcrm-flex imcrm-justify-end imcrm-border-t imcrm-border-border imcrm-pt-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                                onChange({ type: 'group', logic: 'and', children: [] })
                            }
                            className="imcrm-text-destructive hover:imcrm-bg-destructive/10"
                        >
                            {__('Borrar todo')}
                        </Button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
