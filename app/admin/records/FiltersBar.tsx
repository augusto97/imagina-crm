import { Filter, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { __ } from '@/lib/i18n';
import type { FieldEntity } from '@/types/field';

import { FilterPopover } from './FilterPopover';
import { isNullaryOperator, operatorsForType } from './operators';
import type { ActiveFilter } from './recordsState';

interface FiltersBarProps {
    listId: number | undefined;
    fields: FieldEntity[];
    filters: ActiveFilter[];
    onFiltersChange: (filters: ActiveFilter[]) => void;
}

export function FiltersBar({ listId, fields, filters, onFiltersChange }: FiltersBarProps): JSX.Element {
    const fieldsById = new Map(fields.map((f) => [f.id, f]));

    const addFilter = (filter: ActiveFilter): void => {
        onFiltersChange([...filters, filter]);
    };

    const updateFilter = (index: number, filter: ActiveFilter): void => {
        const next = [...filters];
        next[index] = filter;
        onFiltersChange(next);
    };

    const removeFilter = (index: number): void => {
        onFiltersChange(filters.filter((_, i) => i !== index));
    };

    return (
        <div className="imcrm-flex imcrm-flex-wrap imcrm-items-center imcrm-gap-2">
            <FilterPopover listId={listId} fields={fields} initial={null} onApply={addFilter}>
                <Button variant="outline" size="sm" className="imcrm-gap-1.5">
                    <Filter className="imcrm-h-3.5 imcrm-w-3.5" />
                    {filters.length === 0 ? __('Filtrar') : __('Añadir filtro')}
                </Button>
            </FilterPopover>

            {filters.map((filter, index) => {
                const field = fieldsById.get(filter.field_id);
                if (!field) return null;
                const opMeta = operatorsForType(field.type).find((o) => o.op === filter.op);
                const opLabel = opMeta?.label ?? filter.op;
                const valueLabel = isNullaryOperator(filter.op)
                    ? ''
                    : Array.isArray(filter.value)
                        ? filter.value.join(', ')
                        : String(filter.value ?? '');

                return (
                    <FilterPopover
                        key={index}
                        listId={listId}
                        fields={fields}
                        initial={filter}
                        onApply={(next) => updateFilter(index, next)}
                    >
                        <button
                            type="button"
                            className="imcrm-flex imcrm-items-center imcrm-gap-1.5 imcrm-rounded-md imcrm-border imcrm-border-primary/30 imcrm-bg-primary/10 imcrm-px-2 imcrm-py-1 imcrm-text-xs imcrm-text-foreground hover:imcrm-bg-primary/20"
                        >
                            <span className="imcrm-font-medium">{field.label}</span>
                            <span className="imcrm-text-muted-foreground">{opLabel}</span>
                            {valueLabel !== '' && (
                                <span className="imcrm-font-mono imcrm-truncate imcrm-max-w-[150px]">
                                    {valueLabel}
                                </span>
                            )}
                            <span
                                role="button"
                                aria-label={__('Quitar filtro')}
                                tabIndex={0}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeFilter(index);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        removeFilter(index);
                                    }
                                }}
                                className="imcrm-ml-1 imcrm-text-muted-foreground hover:imcrm-text-destructive"
                            >
                                <X className="imcrm-h-3 imcrm-w-3" />
                            </span>
                        </button>
                    </FilterPopover>
                );
            })}

            {filters.length > 0 && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onFiltersChange([])}
                    className="imcrm-text-xs imcrm-text-muted-foreground"
                >
                    {__('Limpiar')}
                </Button>
            )}
        </div>
    );
}
