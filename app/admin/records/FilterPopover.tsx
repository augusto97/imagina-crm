import { useEffect, useState } from 'react';
import { CalendarRange, Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AutocompleteInput } from '@/components/ui/autocomplete-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { __ } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { FieldEntity } from '@/types/field';
import type { FilterOperator } from '@/types/record';

import {
    DATE_RANGE_PRESETS,
    computePresetRange,
    type DateRangePresetId,
} from './dateRangePresets';
import { extractFieldOptions } from './fieldOptions';
import { isNullaryOperator, operatorsForType } from './operators';
import type { ActiveFilter } from './recordsState';

interface FilterPopoverProps {
    listId: number | undefined;
    fields: FieldEntity[];
    /** Filtro existente para edit, o `null` para añadir uno nuevo. */
    initial: ActiveFilter | null;
    onApply: (filter: ActiveFilter) => void;
    /**
     * Aplicar varios filtros a la vez. Lo usan los presets de fecha
     * (que crean un par `gte`+`lte` sobre el mismo campo) — sólo está
     * presente al añadir un filtro nuevo, no al editar uno existente.
     */
    onApplyMany?: (filters: ActiveFilter[]) => void;
    onCancel?: () => void;
    children: React.ReactNode;
}

export function FilterPopover({
    listId,
    fields,
    initial,
    onApply,
    onApplyMany,
    onCancel,
    children,
}: FilterPopoverProps): JSX.Element {
    const [open, setOpen] = useState(false);
    const [fieldId, setFieldId] = useState<number | null>(initial?.field_id ?? null);
    const [op, setOp] = useState<FilterOperator>(initial?.op ?? 'contains');
    const [value, setValue] = useState<unknown>(initial?.value ?? '');
    const [activePreset, setActivePreset] = useState<DateRangePresetId | null>(null);

    // Filtramos a campos filtrables (excluye relation y file en MVP).
    const filterableFields = fields.filter(
        (f) => f.type !== 'relation' && operatorsForType(f.type).length > 0,
    );
    const selectedField = fieldId !== null ? fields.find((f) => f.id === fieldId) ?? null : null;
    const operators = selectedField ? operatorsForType(selectedField.type) : [];
    const isDateField = selectedField?.type === 'date' || selectedField?.type === 'datetime';
    const showPresets = isDateField && initial === null && onApplyMany !== undefined;

    // Si cambia el field, reseteamos op a la primera disponible.
    useEffect(() => {
        if (selectedField && operators.length > 0 && !operators.some((o) => o.op === op)) {
            setOp(operators[0]!.op);
        }
    }, [selectedField, operators, op]);

    const handleApply = (): void => {
        if (fieldId === null || !selectedField) return;
        onApply({
            field_id: fieldId,
            op,
            value: isNullaryOperator(op) ? null : value,
        });
        setOpen(false);
    };

    const applyPreset = (presetId: DateRangePresetId): void => {
        if (
            fieldId === null ||
            !selectedField ||
            !isDateField ||
            !onApplyMany ||
            selectedField.type !== 'date' && selectedField.type !== 'datetime'
        ) {
            return;
        }
        const range = computePresetRange(presetId, selectedField.type, new Date());
        if (range === null) {
            // "Personalizado": solo activa el modo y deja al usuario
            // poner los valores con los inputs gte/lte abajo.
            setActivePreset('custom');
            return;
        }
        setActivePreset(presetId);
        onApplyMany([
            { field_id: fieldId, op: 'gte', value: range.from },
            { field_id: fieldId, op: 'lte', value: range.to },
        ]);
        setOpen(false);
    };

    const canApply =
        fieldId !== null &&
        selectedField !== null &&
        (isNullaryOperator(op) || (value !== '' && value !== undefined && value !== null));

    return (
        <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) onCancel?.(); }}>
            <PopoverTrigger asChild>{children}</PopoverTrigger>
            <PopoverContent className="imcrm-w-80 imcrm-flex imcrm-flex-col imcrm-gap-3">
                <div className="imcrm-flex imcrm-items-start imcrm-justify-between">
                    <h4 className="imcrm-text-sm imcrm-font-medium">
                        {initial ? __('Editar filtro') : __('Añadir filtro')}
                    </h4>
                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="imcrm-text-muted-foreground hover:imcrm-text-foreground"
                        aria-label={__('Cerrar')}
                    >
                        <X className="imcrm-h-4 imcrm-w-4" />
                    </button>
                </div>

                <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                    <Label className="imcrm-text-xs">{__('Campo')}</Label>
                    <Select
                        value={fieldId === null ? '' : String(fieldId)}
                        onChange={(e) => {
                            setFieldId(e.target.value === '' ? null : Number(e.target.value));
                            setValue('');
                        }}
                    >
                        <option value="" disabled>
                            {__('Selecciona un campo')}
                        </option>
                        {filterableFields.map((f) => (
                            <option key={f.id} value={f.id}>
                                {f.label}
                            </option>
                        ))}
                    </Select>
                </div>

                {showPresets && (
                    <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5 imcrm-rounded-md imcrm-border imcrm-border-dashed imcrm-border-border imcrm-bg-muted/20 imcrm-p-2">
                        <Label className="imcrm-flex imcrm-items-center imcrm-gap-1.5 imcrm-text-xs imcrm-text-muted-foreground">
                            <CalendarRange className="imcrm-h-3 imcrm-w-3" />
                            {__('Rangos rápidos')}
                        </Label>
                        <div className="imcrm-flex imcrm-flex-wrap imcrm-gap-1">
                            {DATE_RANGE_PRESETS.map((p) => (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => applyPreset(p.id)}
                                    className={cn(
                                        'imcrm-rounded imcrm-border imcrm-border-border imcrm-bg-card imcrm-px-2 imcrm-py-1 imcrm-text-[11px]',
                                        'hover:imcrm-bg-accent hover:imcrm-text-foreground',
                                        activePreset === p.id && 'imcrm-border-primary imcrm-bg-primary/10 imcrm-text-primary',
                                    )}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                        <p className="imcrm-text-[10px] imcrm-text-muted-foreground">
                            {__('O define un rango manual con los campos abajo.')}
                        </p>
                    </div>
                )}

                {selectedField && (
                    <>
                        <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                            <Label className="imcrm-text-xs">{__('Operador')}</Label>
                            <Select value={op} onChange={(e) => setOp(e.target.value as FilterOperator)}>
                                {operators.map((o) => (
                                    <option key={o.op} value={o.op}>
                                        {o.label}
                                    </option>
                                ))}
                            </Select>
                        </div>

                        {!isNullaryOperator(op) && (
                            <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                                <Label className="imcrm-text-xs">{__('Valor')}</Label>
                                <FilterValueInput
                                    listId={listId}
                                    field={selectedField}
                                    op={op}
                                    value={value}
                                    onChange={setValue}
                                />
                            </div>
                        )}
                    </>
                )}

                <div className="imcrm-mt-1 imcrm-flex imcrm-justify-end imcrm-gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                        {__('Cancelar')}
                    </Button>
                    <Button size="sm" onClick={handleApply} disabled={!canApply} className="imcrm-gap-1">
                        <Plus className="imcrm-h-3 imcrm-w-3" />
                        {initial ? __('Guardar') : __('Aplicar')}
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}

interface ValueInputProps {
    listId: number | undefined;
    field: FieldEntity;
    op: FilterOperator;
    value: unknown;
    onChange: (v: unknown) => void;
}

function FilterValueInput({ listId, field, op, value, onChange }: ValueInputProps): JSX.Element {
    if (op === 'in' || op === 'nin') {
        // Acepta CSV; el QueryBuilder backend trabaja con array.
        const text = Array.isArray(value) ? value.join(', ') : (typeof value === 'string' ? value : '');
        return (
            <Input
                value={text}
                onChange={(e) => onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
                placeholder={__('valor1, valor2…')}
            />
        );
    }

    switch (field.type) {
        case 'select':
        case 'multi_select': {
            const options = extractFieldOptions(field);
            return (
                <Select
                    value={typeof value === 'string' ? value : ''}
                    onChange={(e) => onChange(e.target.value)}
                >
                    <option value="" disabled>
                        {__('Selecciona…')}
                    </option>
                    {options.map((o) => (
                        <option key={o.value} value={o.value}>
                            {o.label}
                        </option>
                    ))}
                </Select>
            );
        }
        case 'checkbox':
            return (
                <Select
                    value={value === true || value === '1' ? '1' : '0'}
                    onChange={(e) => onChange(e.target.value === '1')}
                >
                    <option value="1">{__('Marcado')}</option>
                    <option value="0">{__('No marcado')}</option>
                </Select>
            );
        case 'date':
            return (
                <Input
                    type="date"
                    value={typeof value === 'string' ? value : ''}
                    onChange={(e) => onChange(e.target.value)}
                />
            );
        case 'datetime':
            return (
                <Input
                    type="datetime-local"
                    value={typeof value === 'string' ? value : ''}
                    onChange={(e) => onChange(e.target.value)}
                />
            );
        case 'number':
        case 'currency':
        case 'user':
        case 'file':
            return (
                <Input
                    type="number"
                    step="any"
                    value={value === null || value === undefined ? '' : String(value)}
                    onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
                />
            );
        default:
            return (
                <AutocompleteInput
                    listId={listId}
                    fieldId={field.id}
                    value={typeof value === 'string' ? value : ''}
                    onChange={onChange}
                    aria-label={__('Valor')}
                />
            );
    }
}
