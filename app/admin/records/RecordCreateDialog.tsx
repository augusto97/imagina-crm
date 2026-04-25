import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateRecord } from '@/hooks/useRecords';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { FieldEntity } from '@/types/field';

import { extractFieldOptions } from './fieldOptions';

interface RecordCreateDialogProps {
    listId: number;
    fields: FieldEntity[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function RecordCreateDialog({
    listId,
    fields,
    open,
    onOpenChange,
}: RecordCreateDialogProps): JSX.Element {
    const create = useCreateRecord(listId);
    const [values, setValues] = useState<Record<string, unknown>>({});
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!open) {
            setValues({});
            setError(null);
            setFieldErrors({});
            create.reset();
        }
    }, [open, create]);

    const handleSubmit = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        setError(null);
        setFieldErrors({});
        try {
            await create.mutateAsync(values);
            onOpenChange(false);
        } catch (err) {
            if (err instanceof ApiError) {
                setError(err.message);
                setFieldErrors(err.errors);
            } else if (err instanceof Error) {
                setError(err.message);
            }
        }
    };

    const editableFields = fields.filter((f) => f.type !== 'relation' && f.type !== 'file');

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay
                    className={cn(
                        'imcrm-fixed imcrm-inset-0 imcrm-z-50 imcrm-bg-black/40 imcrm-backdrop-blur-sm',
                    )}
                />
                <Dialog.Content
                    className={cn(
                        'imcrm-fixed imcrm-left-1/2 imcrm-top-1/2 imcrm-z-50 imcrm-w-full imcrm-max-w-lg',
                        'imcrm--translate-x-1/2 imcrm--translate-y-1/2',
                        'imcrm-rounded-lg imcrm-border imcrm-border-border imcrm-bg-card imcrm-p-6 imcrm-shadow-imcrm-lg',
                        'imcrm-max-h-[85vh] imcrm-overflow-y-auto',
                    )}
                >
                    <div className="imcrm-flex imcrm-items-start imcrm-justify-between imcrm-gap-2">
                        <div>
                            <Dialog.Title className="imcrm-text-base imcrm-font-semibold">
                                Nuevo registro
                            </Dialog.Title>
                            <Dialog.Description className="imcrm-text-sm imcrm-text-muted-foreground">
                                Completa los campos para crear un nuevo registro.
                            </Dialog.Description>
                        </div>
                        <Dialog.Close asChild>
                            <Button variant="ghost" size="icon" aria-label="Cerrar">
                                <X className="imcrm-h-4 imcrm-w-4" />
                            </Button>
                        </Dialog.Close>
                    </div>

                    <form onSubmit={handleSubmit} className="imcrm-mt-4 imcrm-flex imcrm-flex-col imcrm-gap-4">
                        {editableFields.map((field) => (
                            <FieldInput
                                key={field.id}
                                field={field}
                                value={values[field.slug]}
                                onChange={(v) => setValues((prev) => ({ ...prev, [field.slug]: v }))}
                                error={fieldErrors[field.slug]}
                            />
                        ))}

                        {error !== null && (
                            <div className="imcrm-rounded-md imcrm-border imcrm-border-destructive/40 imcrm-bg-destructive/10 imcrm-p-3 imcrm-text-sm imcrm-text-destructive">
                                {error}
                            </div>
                        )}

                        <div className="imcrm-flex imcrm-justify-end imcrm-gap-2">
                            <Dialog.Close asChild>
                                <Button type="button" variant="outline">
                                    Cancelar
                                </Button>
                            </Dialog.Close>
                            <Button type="submit" disabled={create.isPending}>
                                {create.isPending ? 'Creando…' : 'Crear registro'}
                            </Button>
                        </div>
                    </form>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

interface FieldInputProps {
    field: FieldEntity;
    value: unknown;
    onChange: (value: unknown) => void;
    error?: string;
}

function FieldInput({ field, value, onChange, error }: FieldInputProps): JSX.Element {
    const id = `record-field-${field.id}`;

    let control: JSX.Element;
    switch (field.type) {
        case 'long_text':
            control = (
                <Textarea
                    id={id}
                    value={typeof value === 'string' ? value : ''}
                    onChange={(e) => onChange(e.target.value)}
                />
            );
            break;
        case 'checkbox':
            control = (
                <div className="imcrm-flex imcrm-items-center imcrm-gap-2">
                    <input
                        id={id}
                        type="checkbox"
                        checked={Boolean(value)}
                        onChange={(e) => onChange(e.target.checked)}
                    />
                    <span className="imcrm-text-sm imcrm-text-muted-foreground">
                        {field.label}
                    </span>
                </div>
            );
            break;
        case 'date':
            control = (
                <Input
                    id={id}
                    type="date"
                    value={typeof value === 'string' ? value : ''}
                    onChange={(e) => onChange(e.target.value)}
                />
            );
            break;
        case 'datetime':
            control = (
                <Input
                    id={id}
                    type="datetime-local"
                    value={typeof value === 'string' ? value.replace(' ', 'T').slice(0, 16) : ''}
                    onChange={(e) => onChange(e.target.value)}
                />
            );
            break;
        case 'number':
        case 'currency':
            control = (
                <Input
                    id={id}
                    type="number"
                    step="any"
                    value={value === undefined || value === null ? '' : String(value)}
                    onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
                />
            );
            break;
        case 'select':
            control = renderSelect(id, field, value, onChange);
            break;
        case 'multi_select':
            control = renderMultiSelect(id, field, value, onChange);
            break;
        case 'email':
            control = (
                <Input
                    id={id}
                    type="email"
                    value={typeof value === 'string' ? value : ''}
                    onChange={(e) => onChange(e.target.value)}
                />
            );
            break;
        case 'url':
            control = (
                <Input
                    id={id}
                    type="url"
                    value={typeof value === 'string' ? value : ''}
                    onChange={(e) => onChange(e.target.value)}
                />
            );
            break;
        default:
            control = (
                <Input
                    id={id}
                    value={typeof value === 'string' ? value : ''}
                    onChange={(e) => onChange(e.target.value)}
                />
            );
    }

    if (field.type === 'checkbox') {
        return (
            <div className="imcrm-flex imcrm-flex-col imcrm-gap-1">
                {control}
                {error && <span className="imcrm-text-xs imcrm-text-destructive">{error}</span>}
            </div>
        );
    }

    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
            <Label htmlFor={id}>
                {field.label}
                {field.is_required && <span className="imcrm-text-destructive"> *</span>}
            </Label>
            {control}
            {error && <span className="imcrm-text-xs imcrm-text-destructive">{error}</span>}
        </div>
    );
}

function renderSelect(
    id: string,
    field: FieldEntity,
    value: unknown,
    onChange: (v: unknown) => void,
): JSX.Element {
    const options = extractFieldOptions(field);
    return (
        <select
            id={id}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value || null)}
            className="imcrm-flex imcrm-h-9 imcrm-w-full imcrm-rounded-md imcrm-border imcrm-border-input imcrm-bg-background imcrm-px-3 imcrm-text-sm"
        >
            <option value="">— Seleccionar —</option>
            {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                    {opt.label}
                </option>
            ))}
        </select>
    );
}

function renderMultiSelect(
    id: string,
    field: FieldEntity,
    value: unknown,
    onChange: (v: unknown) => void,
): JSX.Element {
    const options = extractFieldOptions(field);
    const current = Array.isArray(value) ? value.map(String) : [];
    return (
        <div id={id} className="imcrm-flex imcrm-flex-wrap imcrm-gap-2">
            {options.map((opt) => {
                const checked = current.includes(opt.value);
                return (
                    <label
                        key={opt.value}
                        className={cn(
                            'imcrm-flex imcrm-items-center imcrm-gap-1.5 imcrm-rounded-md imcrm-border imcrm-border-border imcrm-px-2 imcrm-py-1 imcrm-text-xs imcrm-cursor-pointer',
                            checked && 'imcrm-bg-secondary',
                        )}
                    >
                        <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                                const next = e.target.checked
                                    ? [...current, opt.value]
                                    : current.filter((v) => v !== opt.value);
                                onChange(next);
                            }}
                        />
                        {opt.label}
                    </label>
                );
            })}
        </div>
    );
}

