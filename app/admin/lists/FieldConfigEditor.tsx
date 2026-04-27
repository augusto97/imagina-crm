import { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useLists } from '@/hooks/useLists';
import { __ } from '@/lib/i18n';
import type { FieldTypeSlug } from '@/types/field';

/**
 * Editor de la propiedad `config` de un campo. Cambia su contenido
 * según el `type`: cada tipo tiene reglas distintas (select tiene
 * options, number tiene precision, relation tiene target_list_id, etc.).
 *
 * El config se guarda directo como `field.config` JSON en el backend,
 * y el RecordValidator/FieldType correspondiente lo interpreta. Aquí
 * solo damos UI; la validación final la hace PHP.
 */
interface FieldConfigEditorProps {
    type: FieldTypeSlug | '';
    config: Record<string, unknown>;
    onChange: (next: Record<string, unknown>) => void;
}

export function FieldConfigEditor({
    type,
    config,
    onChange,
}: FieldConfigEditorProps): JSX.Element | null {
    if (type === 'select' || type === 'multi_select') {
        return <OptionsEditor config={config} onChange={onChange} />;
    }
    if (type === 'text' || type === 'long_text') {
        return <MaxLengthEditor config={config} onChange={onChange} />;
    }
    if (type === 'number') {
        return <PrecisionEditor config={config} onChange={onChange} />;
    }
    if (type === 'currency') {
        return <CurrencyEditor config={config} onChange={onChange} />;
    }
    if (type === 'relation') {
        return <RelationEditor config={config} onChange={onChange} />;
    }
    if (type === 'checkbox') {
        return <CheckboxDefaultEditor config={config} onChange={onChange} />;
    }
    // date/datetime/url/email/user/file: no requieren config extra en MVP.
    return null;
}

interface SubProps {
    config: Record<string, unknown>;
    onChange: (next: Record<string, unknown>) => void;
}

interface OptionRow {
    value: string;
    label: string;
}

function OptionsEditor({ config, onChange }: SubProps): JSX.Element {
    const options = useMemo<OptionRow[]>(() => {
        const raw = config.options;
        if (!Array.isArray(raw)) return [];
        return raw
            .filter((o): o is { value?: unknown; label?: unknown } =>
                typeof o === 'object' && o !== null,
            )
            .map((o) => ({
                value: typeof o.value === 'string' ? o.value : String(o.value ?? ''),
                label: typeof o.label === 'string' ? o.label : String(o.label ?? ''),
            }));
    }, [config.options]);

    const setOptions = (next: OptionRow[]): void => {
        onChange({ ...config, options: next });
    };

    const addRow = (): void => setOptions([...options, { value: '', label: '' }]);

    return (
        <fieldset className="imcrm-flex imcrm-flex-col imcrm-gap-2 imcrm-rounded-md imcrm-border imcrm-border-border imcrm-bg-muted/20 imcrm-p-3">
            <legend className="imcrm-px-1 imcrm-text-xs imcrm-font-medium imcrm-uppercase imcrm-text-muted-foreground">
                {__('Opciones')}
            </legend>
            <p className="imcrm-text-xs imcrm-text-muted-foreground">
                {__('Cada opción tiene un valor (interno, snake_case) y un label (visible al usuario).')}
            </p>

            {options.length === 0 ? (
                <p className="imcrm-text-xs imcrm-text-warning">
                    {__('Añade al menos una opción para que el campo sea usable.')}
                </p>
            ) : (
                <ul className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                    <li className="imcrm-grid imcrm-grid-cols-[1fr_1fr_auto] imcrm-gap-2 imcrm-text-[10px] imcrm-uppercase imcrm-text-muted-foreground">
                        <span>{__('Valor')}</span>
                        <span>{__('Label')}</span>
                        <span aria-hidden />
                    </li>
                    {options.map((opt, i) => (
                        <li
                            key={i}
                            className="imcrm-grid imcrm-grid-cols-[1fr_1fr_auto] imcrm-gap-2"
                        >
                            <Input
                                value={opt.value}
                                onChange={(e) => {
                                    const next = [...options];
                                    next[i] = { ...next[i]!, value: e.target.value };
                                    setOptions(next);
                                }}
                                placeholder="active"
                            />
                            <Input
                                value={opt.label}
                                onChange={(e) => {
                                    const next = [...options];
                                    next[i] = { ...next[i]!, label: e.target.value };
                                    setOptions(next);
                                }}
                                placeholder={__('Activo')}
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => setOptions(options.filter((_, j) => j !== i))}
                                aria-label={__('Eliminar opción')}
                            >
                                <Trash2 className="imcrm-h-4 imcrm-w-4" />
                            </Button>
                        </li>
                    ))}
                </ul>
            )}

            <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addRow}
                className="imcrm-self-start imcrm-gap-2"
            >
                <Plus className="imcrm-h-3.5 imcrm-w-3.5" />
                {__('Añadir opción')}
            </Button>
        </fieldset>
    );
}

function MaxLengthEditor({ config, onChange }: SubProps): JSX.Element {
    const max = typeof config.max_length === 'number' ? config.max_length : '';
    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
            <Label>{__('Largo máximo (opcional)')}</Label>
            <Input
                type="number"
                min={1}
                max={65535}
                value={max}
                onChange={(e) => {
                    const v = e.target.value;
                    if (v === '') {
                        const next = { ...config };
                        delete next.max_length;
                        onChange(next);
                    } else {
                        onChange({ ...config, max_length: Number(v) });
                    }
                }}
                placeholder="255"
            />
            <p className="imcrm-text-xs imcrm-text-muted-foreground">
                {__('Si se deja vacío usa el default del tipo (255 para text, ilimitado para long text).')}
            </p>
        </div>
    );
}

function PrecisionEditor({ config, onChange }: SubProps): JSX.Element {
    const precision = typeof config.precision === 'number' ? config.precision : 0;
    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
            <Label>{__('Precisión decimal')}</Label>
            <Select
                value={precision}
                onChange={(e) => onChange({ ...config, precision: Number(e.target.value) })}
            >
                <option value={0}>{__('Entero (sin decimales)')}</option>
                <option value={1}>{__('1 decimal')}</option>
                <option value={2}>{__('2 decimales')}</option>
                <option value={4}>{__('4 decimales')}</option>
            </Select>
        </div>
    );
}

function CurrencyEditor({ config, onChange }: SubProps): JSX.Element {
    const currency = typeof config.currency === 'string' ? config.currency : 'USD';
    const precision = typeof config.precision === 'number' ? config.precision : 2;
    return (
        <div className="imcrm-grid imcrm-grid-cols-2 imcrm-gap-2">
            <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                <Label>{__('Moneda')}</Label>
                <Input
                    value={currency}
                    onChange={(e) => onChange({ ...config, currency: e.target.value.toUpperCase() })}
                    placeholder="USD"
                    maxLength={3}
                />
            </div>
            <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                <Label>{__('Decimales')}</Label>
                <Select
                    value={precision}
                    onChange={(e) => onChange({ ...config, precision: Number(e.target.value) })}
                >
                    <option value={0}>0</option>
                    <option value={2}>2</option>
                    <option value={4}>4</option>
                </Select>
            </div>
        </div>
    );
}

function RelationEditor({ config, onChange }: SubProps): JSX.Element {
    const lists = useLists();
    const targetId = typeof config.target_list_id === 'number' ? config.target_list_id : 0;
    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
            <Label>{__('Lista relacionada')}</Label>
            <Select
                value={targetId}
                onChange={(e) => onChange({ ...config, target_list_id: Number(e.target.value) })}
            >
                <option value={0}>{__('— Selecciona —')}</option>
                {(lists.data ?? []).map((l) => (
                    <option key={l.id} value={l.id}>
                        {l.name}
                    </option>
                ))}
            </Select>
            <p className="imcrm-text-xs imcrm-text-muted-foreground">
                {__('El campo permitirá vincular registros de esta lista.')}
            </p>
        </div>
    );
}

function CheckboxDefaultEditor({ config, onChange }: SubProps): JSX.Element {
    const def = config.default === true;
    return (
        <label className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-text-sm">
            <input
                type="checkbox"
                checked={def}
                onChange={(e) => onChange({ ...config, default: e.target.checked })}
            />
            {__('Marcado por defecto')}
        </label>
    );
}
