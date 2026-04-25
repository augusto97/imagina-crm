import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import type { FieldEntity } from '@/types/field';
import type { FilterOperator } from '@/types/record';

import { extractFieldOptions } from './fieldOptions';
import { isNullaryOperator, operatorsForType } from './operators';
import type { ActiveFilter } from './recordsState';

interface FilterPopoverProps {
    fields: FieldEntity[];
    /** Filtro existente para edit, o `null` para añadir uno nuevo. */
    initial: ActiveFilter | null;
    onApply: (filter: ActiveFilter) => void;
    onCancel?: () => void;
    children: React.ReactNode;
}

export function FilterPopover({
    fields,
    initial,
    onApply,
    onCancel,
    children,
}: FilterPopoverProps): JSX.Element {
    const [open, setOpen] = useState(false);
    const [fieldId, setFieldId] = useState<number | null>(initial?.field_id ?? null);
    const [op, setOp] = useState<FilterOperator>(initial?.op ?? 'contains');
    const [value, setValue] = useState<unknown>(initial?.value ?? '');

    // Filtramos a campos filtrables (excluye relation y file en MVP).
    const filterableFields = fields.filter(
        (f) => f.type !== 'relation' && operatorsForType(f.type).length > 0,
    );
    const selectedField = fieldId !== null ? fields.find((f) => f.id === fieldId) ?? null : null;
    const operators = selectedField ? operatorsForType(selectedField.type) : [];

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
                        {initial ? 'Editar filtro' : 'Añadir filtro'}
                    </h4>
                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="imcrm-text-muted-foreground hover:imcrm-text-foreground"
                        aria-label="Cerrar"
                    >
                        <X className="imcrm-h-4 imcrm-w-4" />
                    </button>
                </div>

                <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                    <Label className="imcrm-text-xs">Campo</Label>
                    <Select
                        value={fieldId === null ? '' : String(fieldId)}
                        onChange={(e) => {
                            setFieldId(e.target.value === '' ? null : Number(e.target.value));
                            setValue('');
                        }}
                    >
                        <option value="" disabled>
                            Selecciona un campo
                        </option>
                        {filterableFields.map((f) => (
                            <option key={f.id} value={f.id}>
                                {f.label}
                            </option>
                        ))}
                    </Select>
                </div>

                {selectedField && (
                    <>
                        <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                            <Label className="imcrm-text-xs">Operador</Label>
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
                                <Label className="imcrm-text-xs">Valor</Label>
                                <FilterValueInput
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
                        Cancelar
                    </Button>
                    <Button size="sm" onClick={handleApply} disabled={!canApply} className="imcrm-gap-1">
                        <Plus className="imcrm-h-3 imcrm-w-3" />
                        {initial ? 'Guardar' : 'Aplicar'}
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}

interface ValueInputProps {
    field: FieldEntity;
    op: FilterOperator;
    value: unknown;
    onChange: (v: unknown) => void;
}

function FilterValueInput({ field, op, value, onChange }: ValueInputProps): JSX.Element {
    if (op === 'in' || op === 'nin') {
        // Acepta CSV; el QueryBuilder backend trabaja con array.
        const text = Array.isArray(value) ? value.join(', ') : (typeof value === 'string' ? value : '');
        return (
            <Input
                value={text}
                onChange={(e) => onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
                placeholder="valor1, valor2…"
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
                        Selecciona…
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
                    <option value="1">Marcado</option>
                    <option value="0">No marcado</option>
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
                <Input
                    value={typeof value === 'string' ? value : ''}
                    onChange={(e) => onChange(e.target.value)}
                />
            );
    }
}
