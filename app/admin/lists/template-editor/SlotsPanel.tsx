import { useState } from 'react';
import {
    ArrowDown,
    ArrowUp,
    ChevronDown,
    ChevronRight,
    Plus,
    Trash2,
    X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SIDEBAR_ICON_OPTIONS } from '@/lib/crmTemplates';
import type { CustomTemplateConfig, CustomSidebarGroupConfig } from '@/lib/crmTemplates';
import { __ } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { FieldEntity } from '@/types/field';

interface SlotsPanelProps {
    fields: FieldEntity[];
    config: CustomTemplateConfig;
    onChange: (next: CustomTemplateConfig) => void;
}

/**
 * Panel izquierdo del editor de plantilla. Lista los "slots"
 * (Header — title/subtitle/status/quick actions, Sidebar — groups,
 * Right rail — stats/related) y permite agregar/quitar/reordenar
 * fields en cada uno.
 *
 * Cada slot se renderea como una `Section` colapsable con su lista
 * actual de fields y un selector "+ Agregar campo" que filtra los
 * fields disponibles según el tipo permitido en ese slot
 * (ej. quick actions solo acepta email/url/phone-like; status solo
 * select/multi_select/checkbox).
 */
export function SlotsPanel({ fields, config, onChange }: SlotsPanelProps): JSX.Element {
    const isPhoneLike = (f: FieldEntity): boolean =>
        f.type === 'text'
        && /\b(phone|tel|telefono|teléfono|celular|movil|móvil|whatsapp|wsp|sms|fax)\b/i.test(f.slug + ' ' + f.label);

    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-3">
            <Section
                title={__('Encabezado')}
                description={__('El nombre grande, subtítulos y badges de estado del registro.')}
                defaultOpen
            >
                <SingleFieldSlot
                    label={__('Título principal')}
                    description={__('Campo cuyo valor es el título grande. Por defecto el campo primary.')}
                    fields={fields}
                    valueSlug={config.title_field_slug}
                    onChange={(slug) => onChange({ ...config, title_field_slug: slug })}
                />
                <MultiFieldSlot
                    label={__('Subtítulo')}
                    description={__('Líneas debajo del título (ej. empresa, rol). Hasta 3 campos recomendado.')}
                    fields={fields}
                    valueSlugs={config.subtitle_field_slugs}
                    onChange={(slugs) => onChange({ ...config, subtitle_field_slugs: slugs })}
                />
                <MultiFieldSlot
                    label={__('Badges de estado')}
                    description={__('Pills coloreadas con valor de selects. Solo campos select / multi_select / checkbox.')}
                    fields={fields.filter((f) =>
                        f.type === 'select' || f.type === 'multi_select' || f.type === 'checkbox',
                    )}
                    valueSlugs={config.status_field_slugs}
                    onChange={(slugs) => onChange({ ...config, status_field_slugs: slugs })}
                />
                <MultiFieldSlot
                    label={__('Acciones rápidas')}
                    description={__('Botones mailto / tel / abrir URL. Solo campos email, url o text con slug tipo "phone".')}
                    fields={fields.filter((f) =>
                        f.type === 'email' || f.type === 'url' || isPhoneLike(f),
                    )}
                    valueSlugs={config.quick_action_field_slugs}
                    onChange={(slugs) => onChange({ ...config, quick_action_field_slugs: slugs })}
                />
            </Section>

            <Section
                title={__('Sidebar de propiedades')}
                description={__('Bloques colapsables a la izquierda con campos editables.')}
                defaultOpen
            >
                <SidebarGroupsEditor
                    fields={fields}
                    groups={config.sidebar_groups}
                    onChange={(groups) => onChange({ ...config, sidebar_groups: groups })}
                />
            </Section>

            <Section
                title={__('Right rail (panel derecho)')}
                description={__('Bloques de resumen y registros relacionados.')}
                defaultOpen
            >
                <label className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-text-sm">
                    <input
                        type="checkbox"
                        checked={config.show_stats}
                        onChange={(e) => onChange({ ...config, show_stats: e.target.checked })}
                    />
                    {__('Mostrar bloque "Resumen" (días en sistema, # comentarios, # cambios)')}
                </label>
                <MultiFieldSlot
                    label={__('Records relacionados')}
                    description={__('1 card por relation field con la lista de vinculados resueltos a su título.')}
                    fields={fields.filter((f) => f.type === 'relation')}
                    valueSlugs={config.related_field_slugs}
                    onChange={(slugs) => onChange({ ...config, related_field_slugs: slugs })}
                />
            </Section>
        </div>
    );
}

// --- Sections + Slots primitives --------------------------------------------

function Section({
    title,
    description,
    defaultOpen,
    children,
}: {
    title: string;
    description: string;
    defaultOpen?: boolean;
    children: React.ReactNode;
}): JSX.Element {
    const [open, setOpen] = useState(defaultOpen ?? false);
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
                    <span className="imcrm-text-sm imcrm-font-semibold">{title}</span>
                    <span className="imcrm-text-[11px] imcrm-text-muted-foreground">{description}</span>
                </span>
            </button>
            {open && (
                <div className="imcrm-flex imcrm-flex-col imcrm-gap-3 imcrm-border-t imcrm-border-border imcrm-px-4 imcrm-py-3">
                    {children}
                </div>
            )}
        </section>
    );
}

function SingleFieldSlot({
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
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
            <Label className="imcrm-text-xs imcrm-font-medium">{label}</Label>
            <p className="imcrm-text-[11px] imcrm-text-muted-foreground">{description}</p>
            <select
                value={valueSlug ?? ''}
                onChange={(e) => onChange(e.target.value || undefined)}
                className="imcrm-h-9 imcrm-rounded-md imcrm-border imcrm-border-input imcrm-bg-background imcrm-px-2 imcrm-text-sm"
            >
                <option value="">{__('— Auto (campo primary) —')}</option>
                {fields.map((f) => (
                    <option key={f.id} value={f.slug}>
                        {f.label} ({f.type})
                    </option>
                ))}
            </select>
        </div>
    );
}

function MultiFieldSlot({
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
    const [adding, setAdding] = useState('');

    const remove = (slug: string): void => {
        onChange(valueSlugs.filter((s) => s !== slug));
    };

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
        setAdding('');
    };

    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
            <Label className="imcrm-text-xs imcrm-font-medium">{label}</Label>
            <p className="imcrm-text-[11px] imcrm-text-muted-foreground">{description}</p>
            {valueSlugs.length === 0 ? (
                <p className="imcrm-rounded-md imcrm-border imcrm-border-dashed imcrm-border-border imcrm-px-2 imcrm-py-2 imcrm-text-[11px] imcrm-text-muted-foreground">
                    {__('Vacío. Usa el selector de abajo para agregar.')}
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
                                <span className="imcrm-flex imcrm-flex-1 imcrm-flex-col imcrm-overflow-hidden">
                                    <span className="imcrm-truncate imcrm-font-medium">
                                        {f ? f.label : slug}
                                    </span>
                                    <span className="imcrm-text-[10px] imcrm-text-muted-foreground">
                                        {f ? f.type : __('campo no encontrado')}
                                    </span>
                                </span>
                                <div className="imcrm-flex imcrm-shrink-0 imcrm-gap-0.5">
                                    <button
                                        type="button"
                                        onClick={() => move(slug, -1)}
                                        disabled={i === 0}
                                        className="imcrm-flex imcrm-h-6 imcrm-w-6 imcrm-items-center imcrm-justify-center imcrm-rounded imcrm-text-muted-foreground hover:imcrm-bg-accent hover:imcrm-text-foreground disabled:imcrm-opacity-30"
                                        aria-label={__('Mover arriba')}
                                    >
                                        <ArrowUp className="imcrm-h-3 imcrm-w-3" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => move(slug, 1)}
                                        disabled={i === valueSlugs.length - 1}
                                        className="imcrm-flex imcrm-h-6 imcrm-w-6 imcrm-items-center imcrm-justify-center imcrm-rounded imcrm-text-muted-foreground hover:imcrm-bg-accent hover:imcrm-text-foreground disabled:imcrm-opacity-30"
                                        aria-label={__('Mover abajo')}
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
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
            <select
                value={adding}
                onChange={(e) => add(e.target.value)}
                disabled={available.length === 0}
                className="imcrm-h-8 imcrm-rounded-md imcrm-border imcrm-border-input imcrm-bg-background imcrm-px-2 imcrm-text-xs"
            >
                <option value="">
                    {available.length === 0
                        ? __('— No hay campos disponibles —')
                        : __('+ Agregar campo…')}
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

// --- Sidebar groups (con label/icon editables) -------------------------------

function SidebarGroupsEditor({
    fields,
    groups,
    onChange,
}: {
    fields: FieldEntity[];
    groups: CustomSidebarGroupConfig[];
    onChange: (groups: CustomSidebarGroupConfig[]) => void;
}): JSX.Element {
    const addGroup = (): void => {
        onChange([
            ...groups,
            {
                id: `group-${Date.now()}`,
                label: __('Nuevo grupo'),
                icon_key: 'database',
                field_slugs: [],
                collapsed_by_default: false,
            },
        ]);
    };

    const updateGroup = (idx: number, patch: Partial<CustomSidebarGroupConfig>): void => {
        const next = groups.map((g, i) => (i === idx ? { ...g, ...patch } : g));
        onChange(next);
    };

    const removeGroup = (idx: number): void => {
        onChange(groups.filter((_, i) => i !== idx));
    };

    const moveGroup = (idx: number, dir: -1 | 1): void => {
        const next = [...groups];
        const target = idx + dir;
        if (target < 0 || target >= next.length) return;
        [next[idx], next[target]] = [next[target]!, next[idx]!];
        onChange(next);
    };

    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-2">
            {groups.length === 0 ? (
                <p className="imcrm-rounded-md imcrm-border imcrm-border-dashed imcrm-border-border imcrm-px-3 imcrm-py-3 imcrm-text-xs imcrm-text-muted-foreground">
                    {__('Sin grupos. Los campos no asignados a ningún grupo caerán en "Otros" colapsado.')}
                </p>
            ) : (
                groups.map((g, i) => (
                    <GroupEditor
                        key={g.id}
                        group={g}
                        index={i}
                        total={groups.length}
                        fields={fields}
                        onUpdate={(patch) => updateGroup(i, patch)}
                        onRemove={() => removeGroup(i)}
                        onMove={(dir) => moveGroup(i, dir)}
                    />
                ))
            )}
            <Button variant="outline" size="sm" onClick={addGroup} className="imcrm-gap-1.5">
                <Plus className="imcrm-h-3 imcrm-w-3" />
                {__('Agregar grupo')}
            </Button>
        </div>
    );
}

function GroupEditor({
    group,
    index,
    total,
    fields,
    onUpdate,
    onRemove,
    onMove,
}: {
    group: CustomSidebarGroupConfig;
    index: number;
    total: number;
    fields: FieldEntity[];
    onUpdate: (patch: Partial<CustomSidebarGroupConfig>) => void;
    onRemove: () => void;
    onMove: (dir: -1 | 1) => void;
}): JSX.Element {
    const [open, setOpen] = useState(true);

    return (
        <section className="imcrm-overflow-hidden imcrm-rounded-md imcrm-border imcrm-border-border imcrm-bg-muted/20">
            <header className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-px-3 imcrm-py-2">
                <button
                    type="button"
                    onClick={() => setOpen((v) => ! v)}
                    aria-expanded={open}
                    className="imcrm-flex imcrm-h-6 imcrm-w-6 imcrm-items-center imcrm-justify-center imcrm-rounded imcrm-text-muted-foreground hover:imcrm-bg-accent"
                >
                    {open ? <ChevronDown className="imcrm-h-3.5 imcrm-w-3.5" /> : <ChevronRight className="imcrm-h-3.5 imcrm-w-3.5" />}
                </button>
                <Input
                    value={group.label}
                    onChange={(e) => onUpdate({ label: e.target.value })}
                    placeholder={__('Nombre del grupo')}
                    className="imcrm-h-7 imcrm-flex-1 imcrm-text-sm"
                />
                <select
                    value={group.icon_key}
                    onChange={(e) => onUpdate({ icon_key: e.target.value })}
                    className="imcrm-h-7 imcrm-rounded-md imcrm-border imcrm-border-input imcrm-bg-background imcrm-px-2 imcrm-text-xs"
                >
                    {SIDEBAR_ICON_OPTIONS.map((o) => (
                        <option key={o.key} value={o.key}>
                            {o.label}
                        </option>
                    ))}
                </select>
                <div className="imcrm-flex imcrm-gap-0.5">
                    <button
                        type="button"
                        onClick={() => onMove(-1)}
                        disabled={index === 0}
                        className="imcrm-flex imcrm-h-6 imcrm-w-6 imcrm-items-center imcrm-justify-center imcrm-rounded imcrm-text-muted-foreground hover:imcrm-bg-accent disabled:imcrm-opacity-30"
                        aria-label={__('Subir grupo')}
                    >
                        <ArrowUp className="imcrm-h-3 imcrm-w-3" />
                    </button>
                    <button
                        type="button"
                        onClick={() => onMove(1)}
                        disabled={index === total - 1}
                        className="imcrm-flex imcrm-h-6 imcrm-w-6 imcrm-items-center imcrm-justify-center imcrm-rounded imcrm-text-muted-foreground hover:imcrm-bg-accent disabled:imcrm-opacity-30"
                        aria-label={__('Bajar grupo')}
                    >
                        <ArrowDown className="imcrm-h-3 imcrm-w-3" />
                    </button>
                    <button
                        type="button"
                        onClick={onRemove}
                        className="imcrm-flex imcrm-h-6 imcrm-w-6 imcrm-items-center imcrm-justify-center imcrm-rounded imcrm-text-muted-foreground hover:imcrm-bg-destructive/10 hover:imcrm-text-destructive"
                        aria-label={__('Eliminar grupo')}
                    >
                        <Trash2 className="imcrm-h-3 imcrm-w-3" />
                    </button>
                </div>
            </header>
            {open && (
                <div className={cn('imcrm-border-t imcrm-border-border imcrm-px-3 imcrm-py-2')}>
                    <MultiFieldSlot
                        label={__('Campos')}
                        description={__('Arrastra el orden con las flechas. Solo aparece campos no usados todavía.')}
                        fields={fields.filter((f) => f.type !== 'relation')}
                        valueSlugs={group.field_slugs}
                        onChange={(slugs) => onUpdate({ field_slugs: slugs })}
                    />
                    <label className="imcrm-mt-2 imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-text-xs">
                        <input
                            type="checkbox"
                            checked={group.collapsed_by_default}
                            onChange={(e) => onUpdate({ collapsed_by_default: e.target.checked })}
                        />
                        {__('Iniciar colapsado')}
                    </label>
                </div>
            )}
        </section>
    );
}
