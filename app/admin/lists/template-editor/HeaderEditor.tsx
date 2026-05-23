import { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, X } from 'lucide-react';

import { Label } from '@/components/ui/label';
import { __ } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { CustomTemplateConfigV2 } from '@/lib/crmTemplates';
import type { FieldEntity } from '@/types/field';

interface HeaderEditorProps {
    fields: FieldEntity[];
    config: CustomTemplateConfigV2;
    onChange: (next: CustomTemplateConfigV2) => void;
}

/**
 * Editor del header (zona fija arriba del panel CRM). El header
 * NO está en el grid — su posición es fija por diseño porque es el
 * ancla visual del registro. Lo que se edita acá son los SLOTS:
 *  - Título principal (1 field).
 *  - Subtítulo (multi).
 *  - Status badges (multi).
 *  - Acciones rápidas (multi).
 *
 * Sección colapsable arriba del GridEditor para no saturar la vista.
 */
export function HeaderEditor({ fields, config, onChange }: HeaderEditorProps): JSX.Element {
    const [open, setOpen] = useState(false);

    const isPhoneLike = (f: FieldEntity): boolean =>
        f.type === 'text'
        && /\b(phone|tel|telefono|teléfono|celular|movil|móvil|whatsapp|wsp|sms|fax)\b/i.test(f.slug + ' ' + f.label);

    const updateHeader = (patch: Partial<CustomTemplateConfigV2['header']>): void => {
        onChange({ ...config, header: { ...config.header, ...patch } });
    };

    return (
        <section className="imcrm-overflow-hidden imcrm-rounded-lg imcrm-border imcrm-border-border imcrm-bg-card">
            <button
                type="button"
                onClick={() => setOpen((v) => ! v)}
                aria-expanded={open}
                className="imcrm-flex imcrm-w-full imcrm-items-center imcrm-gap-2 imcrm-px-4 imcrm-py-3 imcrm-text-left imcrm-transition-colors hover:imcrm-bg-accent/40"
            >
                {open ? (
                    <ChevronDown className="imcrm-h-3.5 imcrm-w-3.5 imcrm-text-muted-foreground" />
                ) : (
                    <ChevronRight className="imcrm-h-3.5 imcrm-w-3.5 imcrm-text-muted-foreground" />
                )}
                <span className="imcrm-flex imcrm-flex-1 imcrm-flex-col imcrm-gap-0.5">
                    <span className="imcrm-text-sm imcrm-font-semibold">{__('Encabezado del panel')}</span>
                    <span className="imcrm-text-[11px] imcrm-text-muted-foreground">
                        {__('Avatar, título, subtítulos, badges de estado y acciones rápidas. Posición fija arriba.')}
                    </span>
                </span>
            </button>
            {open && (
                <div className="imcrm-flex imcrm-flex-col imcrm-gap-4 imcrm-border-t imcrm-border-border imcrm-px-4 imcrm-py-3">
                    <SingleSlot
                        label={__('Título principal')}
                        description={__('Campo cuyo valor es el título grande. Vacío = primary auto-detectado.')}
                        fields={fields}
                        valueSlug={config.header.title_field_slug}
                        onChange={(slug) => updateHeader({ title_field_slug: slug })}
                    />
                    <MultiSlot
                        label={__('Subtítulo')}
                        description={__('Hasta 3 campos. Aparecen separados por · debajo del título.')}
                        fields={fields}
                        valueSlugs={config.header.subtitle_field_slugs}
                        onChange={(slugs) => updateHeader({ subtitle_field_slugs: slugs })}
                    />
                    <MultiSlot
                        label={__('Badges de estado')}
                        description={__('Pills coloreadas. Solo select / multi_select / checkbox.')}
                        fields={fields.filter((f) =>
                            f.type === 'select' || f.type === 'multi_select' || f.type === 'checkbox',
                        )}
                        valueSlugs={config.header.status_field_slugs}
                        onChange={(slugs) => updateHeader({ status_field_slugs: slugs })}
                    />
                    <MultiSlot
                        label={__('Acciones rápidas')}
                        description={__('Botones mailto / tel / abrir URL. Solo email, url o text con slug tipo phone.')}
                        fields={fields.filter((f) =>
                            f.type === 'email' || f.type === 'url' || isPhoneLike(f),
                        )}
                        valueSlugs={config.header.quick_action_field_slugs}
                        onChange={(slugs) => updateHeader({ quick_action_field_slugs: slugs })}
                    />
                </div>
            )}
        </section>
    );
}

function SingleSlot({
    label,
    description,
    fields,
    valueSlug,
    onChange,
}: {
    label: string;
    description: string;
    fields: FieldEntity[];
    valueSlug: string | undefined;
    onChange: (slug: string | undefined) => void;
}): JSX.Element {
    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-1">
            <Label className="imcrm-text-xs imcrm-font-medium">{label}</Label>
            <p className="imcrm-text-[11px] imcrm-text-muted-foreground">{description}</p>
            <select
                value={valueSlug ?? ''}
                onChange={(e) => onChange(e.target.value || undefined)}
                className="imcrm-h-9 imcrm-rounded-md imcrm-border imcrm-border-input imcrm-bg-background imcrm-px-2 imcrm-text-sm"
            >
                <option value="">{__('— Auto —')}</option>
                {fields.map((f) => (
                    <option key={f.id} value={f.slug}>
                        {f.label} ({f.type})
                    </option>
                ))}
            </select>
        </div>
    );
}

function MultiSlot({
    label,
    description,
    fields,
    valueSlugs,
    onChange,
}: {
    label: string;
    description: string;
    fields: FieldEntity[];
    valueSlugs: string[];
    onChange: (slugs: string[]) => void;
}): JSX.Element {
    const bySlug = new Map(fields.map((f) => [f.slug, f]));
    const available = fields.filter((f) => ! valueSlugs.includes(f.slug));

    const remove = (slug: string): void => onChange(valueSlugs.filter((s) => s !== slug));
    const move = (slug: string, dir: -1 | 1): void => {
        const idx = valueSlugs.indexOf(slug);
        const next = idx + dir;
        if (idx < 0 || next < 0 || next >= valueSlugs.length) return;
        const out = [...valueSlugs];
        [out[idx], out[next]] = [out[next]!, out[idx]!];
        onChange(out);
    };
    const add = (slug: string): void => {
        if (! slug || valueSlugs.includes(slug)) return;
        onChange([...valueSlugs, slug]);
    };

    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
            <Label className="imcrm-text-xs imcrm-font-medium">{label}</Label>
            <p className="imcrm-text-[11px] imcrm-text-muted-foreground">{description}</p>
            {valueSlugs.length === 0 ? (
                <p className="imcrm-rounded-md imcrm-border imcrm-border-dashed imcrm-border-border imcrm-px-2 imcrm-py-2 imcrm-text-[11px] imcrm-text-muted-foreground">
                    {__('Vacío')}
                </p>
            ) : (
                <ul className="imcrm-flex imcrm-flex-col imcrm-gap-1">
                    {valueSlugs.map((slug, i) => {
                        const f = bySlug.get(slug);
                        return (
                            <li
                                key={slug}
                                className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-rounded-md imcrm-border imcrm-border-border imcrm-bg-muted/30 imcrm-px-2.5 imcrm-py-1.5 imcrm-text-xs"
                            >
                                <span className="imcrm-flex imcrm-flex-1 imcrm-flex-col">
                                    <span className="imcrm-truncate imcrm-font-medium">{f ? f.label : slug}</span>
                                    <span className="imcrm-text-[10px] imcrm-text-muted-foreground">
                                        {f ? f.type : __('campo no encontrado')}
                                    </span>
                                </span>
                                <button
                                    type="button"
                                    onClick={() => move(slug, -1)}
                                    disabled={i === 0}
                                    className="imcrm-flex imcrm-h-6 imcrm-w-6 imcrm-items-center imcrm-justify-center imcrm-rounded imcrm-text-muted-foreground hover:imcrm-bg-accent disabled:imcrm-opacity-30"
                                    aria-label={__('Subir')}
                                >
                                    <ArrowUp className="imcrm-h-3 imcrm-w-3" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => move(slug, 1)}
                                    disabled={i === valueSlugs.length - 1}
                                    className={cn(
                                        'imcrm-flex imcrm-h-6 imcrm-w-6 imcrm-items-center imcrm-justify-center imcrm-rounded imcrm-text-muted-foreground hover:imcrm-bg-accent disabled:imcrm-opacity-30',
                                    )}
                                    aria-label={__('Bajar')}
                                >
                                    <ArrowDown className="imcrm-h-3 imcrm-w-3" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => remove(slug)}
                                    className="imcrm-flex imcrm-h-6 imcrm-w-6 imcrm-items-center imcrm-justify-center imcrm-rounded imcrm-text-muted-foreground hover:imcrm-bg-destructive/10 hover:imcrm-text-destructive"
                                    aria-label={__('Quitar')}
                                >
                                    <X className="imcrm-h-3 imcrm-w-3" />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
            <select
                onChange={(e) => {
                    add(e.target.value);
                    e.target.value = '';
                }}
                disabled={available.length === 0}
                defaultValue=""
                className="imcrm-h-8 imcrm-rounded-md imcrm-border imcrm-border-input imcrm-bg-background imcrm-px-2 imcrm-text-xs"
            >
                <option value="">
                    {available.length === 0 ? __('— Sin disponibles —') : __('+ Agregar…')}
                </option>
                {available.map((f) => (
                    <option key={f.id} value={f.slug}>
                        {f.label} ({f.type})
                    </option>
                ))}
            </select>
        </div>
    );
}
