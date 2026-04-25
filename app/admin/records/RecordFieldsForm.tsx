import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { __ } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { FieldEntity } from '@/types/field';

import { extractFieldOptions } from './fieldOptions';

interface RecordFieldsFormProps {
    fields: FieldEntity[];
    values: Record<string, unknown>;
    onChange: (values: Record<string, unknown>) => void;
    fieldErrors?: Record<string, string>;
    /** Si true, omitimos los campos que ya pueden editarse inline en la tabla
     *  para evitar duplicación visual. Default: false (drawer muestra todo). */
    onlyNonInline?: boolean;
}

const NON_INLINE_TYPES: ReadonlyArray<string> = ['user', 'file', 'relation'];

/**
 * Form per-tipo reutilizado por RecordCreateDialog y RecordDetailDrawer.
 * Se renderiza un input apropiado por tipo; los tipos `relation` se editan
 * como CSV de IDs (placeholder hasta que tengamos el RecordPicker en Fase
 * posterior).
 */
export function RecordFieldsForm({
    fields,
    values,
    onChange,
    fieldErrors,
    onlyNonInline,
}: RecordFieldsFormProps): JSX.Element {
    const visible = fields
        .filter((f) => (onlyNonInline ? NON_INLINE_TYPES.includes(f.type) : true))
        .sort((a, b) => a.position - b.position);

    const setValue = (slug: string, value: unknown): void => {
        onChange({ ...values, [slug]: value });
    };

    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-4">
            {visible.map((field) => (
                <FieldInput
                    key={field.id}
                    field={field}
                    value={values[field.slug]}
                    onChange={(v) => setValue(field.slug, v)}
                    error={fieldErrors?.[field.slug]}
                />
            ))}
        </div>
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
                    rows={4}
                />
            );
            break;
        case 'checkbox':
            control = (
                <label className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-text-sm">
                    <input
                        id={id}
                        type="checkbox"
                        checked={Boolean(value)}
                        onChange={(e) => onChange(e.target.checked)}
                    />
                    <span className="imcrm-text-muted-foreground">{field.label}</span>
                </label>
            );
            break;
        case 'date':
            control = (
                <Input
                    id={id}
                    type="date"
                    value={typeof value === 'string' ? value : ''}
                    onChange={(e) => onChange(e.target.value || null)}
                />
            );
            break;
        case 'datetime':
            control = (
                <Input
                    id={id}
                    type="datetime-local"
                    value={typeof value === 'string' ? value.replace(' ', 'T').slice(0, 16) : ''}
                    onChange={(e) => onChange(e.target.value || null)}
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
        case 'user':
        case 'file':
            control = (
                <Input
                    id={id}
                    type="number"
                    min={1}
                    value={value === undefined || value === null ? '' : String(value)}
                    onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
                    placeholder={field.type === 'user' ? __('ID de usuario WP') : __('ID de attachment')}
                />
            );
            break;
        case 'relation': {
            // Placeholder: CSV de IDs hasta que tengamos un picker.
            const current = Array.isArray(value)
                ? value.join(', ')
                : typeof value === 'string'
                    ? value
                    : '';
            control = (
                <Input
                    id={id}
                    value={current}
                    onChange={(e) => {
                        const ids = e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean)
                            .map(Number)
                            .filter((n) => !Number.isNaN(n));
                        onChange(ids);
                    }}
                    placeholder={__('IDs separados por coma')}
                />
            );
            break;
        }
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
                {error !== undefined && (
                    <span className="imcrm-text-xs imcrm-text-destructive">{error}</span>
                )}
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
            {error !== undefined && (
                <span className="imcrm-text-xs imcrm-text-destructive">{error}</span>
            )}
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
            <option value="">{__('— Seleccionar —')}</option>
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
