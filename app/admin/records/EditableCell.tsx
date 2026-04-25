import { useEffect, useRef, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useUpdateRecord } from '@/hooks/useRecords';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { FieldEntity } from '@/types/field';

import { extractFieldOptions } from './fieldOptions';
import { renderCellValue } from './renderCellValue';

interface EditableCellProps {
    field: FieldEntity;
    recordId: number;
    listId: number;
    value: unknown;
}

/**
 * Celda con edición inline.
 *
 * - Doble click activa modo edición (input apropiado al tipo).
 * - Enter o blur confirma → mutación optimistic.
 * - Escape cancela.
 * - Si el server rechaza, mostramos un tooltip de error sobre la celda
 *   y revertimos al valor previo (la mutación lo hace en `onError`).
 *
 * Tipos editables inline en MVP: text, long_text, number, currency,
 * email, url, date, datetime, checkbox, select, multi_select.
 * Tipos NO editables inline: user, file, relation (requieren pickers
 * más complejos — se editan por el RecordDetailDrawer en una iteración
 * posterior).
 */
const NON_INLINE_TYPES = ['user', 'file', 'relation'];

export function EditableCell({ field, recordId, listId, value }: EditableCellProps): JSX.Element {
    const update = useUpdateRecord(listId);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<unknown>(value);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!editing) {
            setDraft(value);
            setError(null);
        }
    }, [value, editing]);

    const canEdit = !NON_INLINE_TYPES.includes(field.type);

    const startEdit = (): void => {
        if (!canEdit) return;
        setDraft(value);
        setError(null);
        setEditing(true);
    };

    const cancel = (): void => {
        setDraft(value);
        setError(null);
        setEditing(false);
    };

    const commit = async (next: unknown): Promise<void> => {
        if (next === value) {
            setEditing(false);
            return;
        }
        setError(null);
        try {
            await update.mutateAsync({ id: recordId, values: { [field.slug]: next } });
            setEditing(false);
        } catch (err) {
            const msg = err instanceof ApiError
                ? (err.errors[field.slug] ?? err.message)
                : err instanceof Error
                    ? err.message
                    : 'Error';
            setError(msg);
            // Mantenemos el modo edición para que el usuario corrija.
        }
    };

    if (!editing) {
        return (
            <button
                type="button"
                onDoubleClick={startEdit}
                disabled={!canEdit}
                className={cn(
                    'imcrm-w-full imcrm-text-left imcrm-min-h-[1.5rem]',
                    canEdit && 'hover:imcrm-bg-accent/40 imcrm-rounded imcrm--mx-1 imcrm-px-1',
                    !canEdit && 'imcrm-cursor-default',
                )}
                title={canEdit ? 'Doble click para editar' : 'No editable inline'}
            >
                {renderCellValue(field, value)}
            </button>
        );
    }

    return (
        <div className="imcrm-relative imcrm--mx-1 imcrm--my-0.5">
            <CellEditor
                field={field}
                value={draft}
                onChange={setDraft}
                onCommit={(v) => void commit(v)}
                onCancel={cancel}
                isPending={update.isPending}
            />
            {error !== null && (
                <div className="imcrm-absolute imcrm-left-0 imcrm-top-full imcrm-z-10 imcrm-mt-1 imcrm-rounded-md imcrm-border imcrm-border-destructive imcrm-bg-destructive imcrm-px-2 imcrm-py-1 imcrm-text-xs imcrm-text-destructive-foreground imcrm-shadow-imcrm-md">
                    {error}
                </div>
            )}
        </div>
    );
}

interface CellEditorProps {
    field: FieldEntity;
    value: unknown;
    onChange: (value: unknown) => void;
    onCommit: (value: unknown) => void;
    onCancel: () => void;
    isPending: boolean;
}

function CellEditor({ field, value, onChange, onCommit, onCancel, isPending }: CellEditorProps): JSX.Element {
    const ref = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);

    useEffect(() => {
        ref.current?.focus();
        if (ref.current && 'select' in ref.current) {
            try {
                (ref.current as HTMLInputElement).select();
            } catch {
                // ignore
            }
        }
    }, []);

    const handleKeyDown = (
        e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
    ): void => {
        if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
        } else if (e.key === 'Enter' && field.type !== 'long_text') {
            e.preventDefault();
            onCommit(value);
        } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onCommit(value);
        }
    };

    const commonProps = {
        onKeyDown: handleKeyDown,
        onBlur: () => onCommit(value),
        disabled: isPending,
        className: 'imcrm-h-7 imcrm-text-sm',
    };

    switch (field.type) {
        case 'long_text':
            return (
                <Textarea
                    ref={ref as React.RefObject<HTMLTextAreaElement>}
                    value={typeof value === 'string' ? value : ''}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={() => onCommit(value)}
                    disabled={isPending}
                    className="imcrm-min-h-[60px] imcrm-text-sm"
                    rows={3}
                />
            );
        case 'checkbox':
            return (
                <input
                    ref={ref as React.RefObject<HTMLInputElement>}
                    type="checkbox"
                    checked={Boolean(value)}
                    onChange={(e) => {
                        onChange(e.target.checked);
                        // Para checkbox, el commit es inmediato.
                        onCommit(e.target.checked);
                    }}
                    disabled={isPending}
                />
            );
        case 'select': {
            const options = extractFieldOptions(field);
            return (
                <select
                    ref={ref as React.RefObject<HTMLSelectElement>}
                    value={typeof value === 'string' ? value : ''}
                    onChange={(e) => {
                        onChange(e.target.value || null);
                        onCommit(e.target.value || null);
                    }}
                    onKeyDown={handleKeyDown}
                    onBlur={() => onCommit(value)}
                    disabled={isPending}
                    className="imcrm-h-7 imcrm-w-full imcrm-rounded-md imcrm-border imcrm-border-input imcrm-bg-background imcrm-px-2 imcrm-text-sm"
                >
                    <option value="">—</option>
                    {options.map((o) => (
                        <option key={o.value} value={o.value}>
                            {o.label}
                        </option>
                    ))}
                </select>
            );
        }
        case 'multi_select': {
            // Para multi_select, abrimos un mini panel con checkboxes.
            // Confirmamos solo al hacer blur fuera del contenedor entero.
            const options = extractFieldOptions(field);
            const current = Array.isArray(value) ? (value as string[]) : [];
            return (
                <div
                    tabIndex={-1}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') onCancel();
                        if (e.key === 'Enter') onCommit(current);
                    }}
                    className="imcrm-flex imcrm-flex-wrap imcrm-gap-1 imcrm-rounded imcrm-border imcrm-border-input imcrm-bg-background imcrm-p-1"
                >
                    {options.map((o) => {
                        const checked = current.includes(o.value);
                        return (
                            <label
                                key={o.value}
                                className={cn(
                                    'imcrm-flex imcrm-items-center imcrm-gap-1 imcrm-rounded imcrm-px-1.5 imcrm-py-0.5 imcrm-text-xs imcrm-cursor-pointer',
                                    checked && 'imcrm-bg-secondary',
                                )}
                            >
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                        const next = e.target.checked
                                            ? [...current, o.value]
                                            : current.filter((v) => v !== o.value);
                                        onChange(next);
                                    }}
                                />
                                {o.label}
                            </label>
                        );
                    })}
                    <button
                        type="button"
                        onClick={() => onCommit(value)}
                        className="imcrm-ml-auto imcrm-rounded imcrm-px-1.5 imcrm-text-xs imcrm-text-muted-foreground hover:imcrm-text-foreground"
                    >
                        OK
                    </button>
                </div>
            );
        }
        case 'number':
        case 'currency':
            return (
                <Input
                    {...commonProps}
                    ref={ref as React.RefObject<HTMLInputElement>}
                    type="number"
                    step="any"
                    value={value === null || value === undefined ? '' : String(value)}
                    onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
                />
            );
        case 'date':
            return (
                <Input
                    {...commonProps}
                    ref={ref as React.RefObject<HTMLInputElement>}
                    type="date"
                    value={typeof value === 'string' ? value : ''}
                    onChange={(e) => onChange(e.target.value || null)}
                />
            );
        case 'datetime':
            return (
                <Input
                    {...commonProps}
                    ref={ref as React.RefObject<HTMLInputElement>}
                    type="datetime-local"
                    value={typeof value === 'string' ? value.replace(' ', 'T').slice(0, 16) : ''}
                    onChange={(e) => onChange(e.target.value || null)}
                />
            );
        case 'email':
            return (
                <Input
                    {...commonProps}
                    ref={ref as React.RefObject<HTMLInputElement>}
                    type="email"
                    value={typeof value === 'string' ? value : ''}
                    onChange={(e) => onChange(e.target.value)}
                />
            );
        case 'url':
            return (
                <Input
                    {...commonProps}
                    ref={ref as React.RefObject<HTMLInputElement>}
                    type="url"
                    value={typeof value === 'string' ? value : ''}
                    onChange={(e) => onChange(e.target.value)}
                />
            );
        default:
            return (
                <Input
                    {...commonProps}
                    ref={ref as React.RefObject<HTMLInputElement>}
                    value={typeof value === 'string' ? value : ''}
                    onChange={(e) => onChange(e.target.value)}
                />
            );
    }
}
