import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowDown, ArrowUp, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SIDEBAR_ICON_OPTIONS, type V2Block } from '@/lib/crmTemplates';
import { __ } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { FieldEntity } from '@/types/field';

interface BlockConfigDialogProps {
    block: V2Block;
    fields: FieldEntity[];
    onUpdate: (patch: Partial<V2Block>) => void;
    onClose: () => void;
}

/**
 * Dialog que abre al click ✏ sobre un bloque del editor visual.
 * Switchea por `block.type` y rendera el form apropiado para ese
 * tipo. Los cambios se aplican en vivo (vía `onUpdate` callback) —
 * el dialog es solo el contenedor + helper.
 *
 * Para `timeline` y `stats` no hay nada que configurar, así que el
 * dialog muestra un mensaje y solo permite cerrar.
 */
export function BlockConfigDialog({
    block,
    fields,
    onUpdate,
    onClose,
}: BlockConfigDialogProps): JSX.Element {
    return (
        <Dialog.Root open onOpenChange={(open) => ! open && onClose()}>
            <Dialog.Portal>
                <Dialog.Overlay className="imcrm-fixed imcrm-inset-0 imcrm-z-50 imcrm-bg-black/40 imcrm-backdrop-blur-sm" />
                <Dialog.Content
                    className={cn(
                        'imcrm-fixed imcrm-left-1/2 imcrm-top-1/2 imcrm-z-50 imcrm-w-full imcrm-max-w-lg',
                        'imcrm--translate-x-1/2 imcrm--translate-y-1/2',
                        'imcrm-rounded-lg imcrm-border imcrm-border-border imcrm-bg-card imcrm-p-6 imcrm-shadow-imcrm-lg',
                    )}
                >
                    <div className="imcrm-flex imcrm-items-start imcrm-justify-between imcrm-gap-2">
                        <div>
                            <Dialog.Title className="imcrm-text-base imcrm-font-semibold">
                                {titleForType(block.type)}
                            </Dialog.Title>
                            <Dialog.Description className="imcrm-text-sm imcrm-text-muted-foreground">
                                {descriptionForType(block.type)}
                            </Dialog.Description>
                        </div>
                        <Dialog.Close asChild>
                            <Button variant="ghost" size="icon" aria-label={__('Cerrar')}>
                                <X className="imcrm-h-4 imcrm-w-4" />
                            </Button>
                        </Dialog.Close>
                    </div>

                    <div className="imcrm-mt-4">
                        {block.type === 'properties_group' && (
                            <PropertiesGroupForm
                                block={block}
                                fields={fields}
                                onUpdate={(patch) => onUpdate(patch as Partial<V2Block>)}
                            />
                        )}
                        {block.type === 'notes' && (
                            <NotesForm
                                block={block}
                                onUpdate={(patch) => onUpdate(patch as Partial<V2Block>)}
                            />
                        )}
                        {block.type === 'related' && (
                            <RelatedForm
                                block={block}
                                fields={fields}
                                onUpdate={(patch) => onUpdate(patch as Partial<V2Block>)}
                            />
                        )}
                        {(block.type === 'timeline' || block.type === 'stats') && (
                            <p className="imcrm-text-sm imcrm-text-muted-foreground">
                                {__('Este bloque no tiene opciones configurables. Movelo o cambiá su tamaño con el grid.')}
                            </p>
                        )}
                        {block.type === 'kpi' && (
                            <KpiForm
                                block={block}
                                fields={fields}
                                onUpdate={(patch) => onUpdate(patch as Partial<V2Block>)}
                            />
                        )}
                        {block.type === 'chart' && (
                            <ChartForm
                                block={block}
                                fields={fields}
                                onUpdate={(patch) => onUpdate(patch as Partial<V2Block>)}
                            />
                        )}
                        {block.type === 'files' && (
                            <FilesForm
                                block={block}
                                fields={fields}
                                onUpdate={(patch) => onUpdate(patch as Partial<V2Block>)}
                            />
                        )}
                        {block.type === 'embed' && (
                            <EmbedForm
                                block={block}
                                fields={fields}
                                onUpdate={(patch) => onUpdate(patch as Partial<V2Block>)}
                            />
                        )}
                        {block.type === 'action_button' && (
                            <ActionButtonForm
                                block={block}
                                onUpdate={(patch) => onUpdate(patch as Partial<V2Block>)}
                            />
                        )}
                        {block.type === 'markdown' && (
                            <MarkdownForm
                                block={block}
                                onUpdate={(patch) => onUpdate(patch as Partial<V2Block>)}
                            />
                        )}
                    </div>

                    <div className="imcrm-mt-5 imcrm-flex imcrm-justify-end">
                        <Dialog.Close asChild>
                            <Button>{__('Listo')}</Button>
                        </Dialog.Close>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

function titleForType(type: V2Block['type']): string {
    switch (type) {
        case 'properties_group': return __('Editar grupo de propiedades');
        case 'notes':            return __('Editar bloque de notas');
        case 'related':          return __('Editar bloque de relacionados');
        case 'timeline':         return __('Bloque Timeline');
        case 'stats':            return __('Bloque Resumen');
        case 'kpi':              return __('Editar KPI');
        case 'chart':            return __('Editar gráfico');
        case 'files':            return __('Editar bloque de archivos');
        case 'embed':            return __('Editar embed');
        case 'action_button':    return __('Editar botón de acción');
        case 'markdown':         return __('Editar markdown');
    }
}

function descriptionForType(type: V2Block['type']): string {
    switch (type) {
        case 'properties_group': return __('Nombre, icono y campos de este grupo.');
        case 'notes':            return __('Texto custom que se mostrará a todos los users en cada record de la lista.');
        case 'related':          return __('Elegí qué relation field se renderea en este bloque.');
        case 'timeline':         return __('Feed de actividad y comentarios. Configuración fija.');
        case 'stats':            return __('Resumen del record (días, # comentarios, # cambios). Configuración fija.');
        case 'kpi':              return __('Número grande con label opcional y barra de progreso a meta.');
        case 'chart':            return __('Distribución de records relacionados agrupados por un field destino.');
        case 'files':            return __('Archivos adjuntos del record (file fields).');
        case 'embed':            return __('iframe externo (YouTube, Vimeo, Maps, Loom, Figma, Calendly).');
        case 'action_button':    return __('Botón configurable: URL externa, mailto, tel o copy al clipboard.');
        case 'markdown':         return __('Texto rich con headings, listas, negrita, links, código.');
    }
}

// --- properties_group form ---------------------------------------------------

function PropertiesGroupForm({
    block,
    fields,
    onUpdate,
}: {
    block: Extract<V2Block, { type: 'properties_group' }>;
    fields: FieldEntity[];
    onUpdate: (patch: { config: typeof block.config }) => void;
}): JSX.Element {
    const updateConfig = (patch: Partial<typeof block.config>): void => {
        onUpdate({ config: { ...block.config, ...patch } });
    };

    const slugSet = new Set(block.config.field_slugs);
    const available = fields.filter((f) => f.type !== 'relation' && ! slugSet.has(f.slug));
    const bySlug = new Map(fields.map((f) => [f.slug, f]));

    const move = (slug: string, dir: -1 | 1): void => {
        const slugs = [...block.config.field_slugs];
        const idx = slugs.indexOf(slug);
        const next = idx + dir;
        if (idx < 0 || next < 0 || next >= slugs.length) return;
        [slugs[idx], slugs[next]] = [slugs[next]!, slugs[idx]!];
        updateConfig({ field_slugs: slugs });
    };

    const remove = (slug: string): void => {
        updateConfig({ field_slugs: block.config.field_slugs.filter((s) => s !== slug) });
    };

    const add = (slug: string): void => {
        if (! slug) return;
        updateConfig({ field_slugs: [...block.config.field_slugs, slug] });
    };

    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-4">
            <div className="imcrm-grid imcrm-grid-cols-2 imcrm-gap-3">
                <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                    <Label htmlFor="g-label" className="imcrm-text-xs">{__('Nombre')}</Label>
                    <Input
                        id="g-label"
                        value={block.config.label}
                        onChange={(e) => updateConfig({ label: e.target.value })}
                    />
                </div>
                <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                    <Label htmlFor="g-icon" className="imcrm-text-xs">{__('Icono')}</Label>
                    <select
                        id="g-icon"
                        value={block.config.icon_key}
                        onChange={(e) => updateConfig({ icon_key: e.target.value })}
                        className="imcrm-h-9 imcrm-rounded-md imcrm-border imcrm-border-input imcrm-bg-background imcrm-px-2 imcrm-text-sm"
                    >
                        {SIDEBAR_ICON_OPTIONS.map((o) => (
                            <option key={o.key} value={o.key}>{o.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            <label className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-text-xs">
                <input
                    type="checkbox"
                    checked={block.config.collapsed_by_default}
                    onChange={(e) => updateConfig({ collapsed_by_default: e.target.checked })}
                />
                {__('Iniciar colapsado')}
            </label>

            <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                <Label className="imcrm-text-xs">{__('Campos del grupo')}</Label>
                {block.config.field_slugs.length === 0 ? (
                    <p className="imcrm-rounded-md imcrm-border imcrm-border-dashed imcrm-border-border imcrm-px-2 imcrm-py-2 imcrm-text-[11px] imcrm-text-muted-foreground">
                        {__('Vacío. Agregá campos abajo.')}
                    </p>
                ) : (
                    <ul className="imcrm-flex imcrm-flex-col imcrm-gap-1">
                        {block.config.field_slugs.map((slug, i) => {
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
                                        disabled={i === block.config.field_slugs.length - 1}
                                        className="imcrm-flex imcrm-h-6 imcrm-w-6 imcrm-items-center imcrm-justify-center imcrm-rounded imcrm-text-muted-foreground hover:imcrm-bg-accent disabled:imcrm-opacity-30"
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
                        {available.length === 0
                            ? __('— Sin campos disponibles —')
                            : __('+ Agregar campo…')}
                    </option>
                    {available.map((f) => (
                        <option key={f.id} value={f.slug}>
                            {f.label} ({f.type})
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}

// --- notes form --------------------------------------------------------------

function NotesForm({
    block,
    onUpdate,
}: {
    block: Extract<V2Block, { type: 'notes' }>;
    onUpdate: (patch: { config: typeof block.config }) => void;
}): JSX.Element {
    const [draft, setDraft] = useState(block.config);

    useEffect(() => {
        setDraft(block.config);
    }, [block.config]);

    // Commit on blur to no spamear renders al tipear.
    const commit = (): void => {
        onUpdate({ config: draft });
    };

    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-3">
            <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                <Label htmlFor="n-title" className="imcrm-text-xs">{__('Título')}</Label>
                <Input
                    id="n-title"
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    onBlur={commit}
                    placeholder={__('Ej. Recordatorios')}
                />
            </div>
            <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                <Label htmlFor="n-content" className="imcrm-text-xs">{__('Contenido')}</Label>
                <Textarea
                    id="n-content"
                    rows={6}
                    value={draft.content}
                    onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                    onBlur={commit}
                    placeholder={__('Texto que verán todos en esta lista. Saltos de línea respetados.')}
                />
                <p className="imcrm-text-[11px] imcrm-text-muted-foreground">
                    {__('Este texto es STATIC para todos los records de la lista — no varía por record. Útil para recordatorios al operador.')}
                </p>
            </div>
        </div>
    );
}

// --- related form ------------------------------------------------------------

function RelatedForm({
    block,
    fields,
    onUpdate,
}: {
    block: Extract<V2Block, { type: 'related' }>;
    fields: FieldEntity[];
    onUpdate: (patch: { config: typeof block.config }) => void;
}): JSX.Element {
    const relations = fields.filter((f) => f.type === 'relation');

    if (relations.length === 0) {
        return (
            <p className="imcrm-rounded-md imcrm-border imcrm-border-warning/30 imcrm-bg-warning/10 imcrm-px-3 imcrm-py-2 imcrm-text-xs imcrm-text-warning">
                {__('Esta lista no tiene relation fields. Eliminá este bloque o creá un campo tipo relation primero.')}
            </p>
        );
    }

    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
            <Label htmlFor="r-field" className="imcrm-text-xs">{__('Relation field')}</Label>
            <select
                id="r-field"
                value={block.config.field_slug}
                onChange={(e) => onUpdate({ config: { field_slug: e.target.value } })}
                className="imcrm-h-9 imcrm-rounded-md imcrm-border imcrm-border-input imcrm-bg-background imcrm-px-2 imcrm-text-sm"
            >
                {relations.map((f) => (
                    <option key={f.id} value={f.slug}>
                        {f.label}
                    </option>
                ))}
            </select>
        </div>
    );
}

// --- KPI form ----------------------------------------------------------------

function KpiForm({
    block,
    fields,
    onUpdate,
}: {
    block: Extract<V2Block, { type: 'kpi' }>;
    fields: FieldEntity[];
    onUpdate: (patch: { config: typeof block.config }) => void;
}): JSX.Element {
    const updateConfig = (patch: Partial<typeof block.config>): void => {
        onUpdate({ config: { ...block.config, ...patch } });
    };
    const numericFields = fields.filter((f) => f.type === 'number' || f.type === 'currency');

    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-3">
            <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                <Label htmlFor="kpi-field" className="imcrm-text-xs">{__('Campo numérico')}</Label>
                <select
                    id="kpi-field"
                    value={block.config.field_slug}
                    onChange={(e) => updateConfig({ field_slug: e.target.value })}
                    className="imcrm-h-9 imcrm-rounded-md imcrm-border imcrm-border-input imcrm-bg-background imcrm-px-2 imcrm-text-sm"
                >
                    <option value="">{__('— Sin field —')}</option>
                    {numericFields.map((f) => (
                        <option key={f.id} value={f.slug}>{f.label} ({f.type})</option>
                    ))}
                </select>
            </div>
            <div className="imcrm-grid imcrm-grid-cols-2 imcrm-gap-3">
                <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                    <Label htmlFor="kpi-label" className="imcrm-text-xs">{__('Label (opcional)')}</Label>
                    <Input
                        id="kpi-label"
                        value={block.config.label ?? ''}
                        onChange={(e) => updateConfig({ label: e.target.value || undefined })}
                        placeholder={__('Ej. "Monto total"')}
                    />
                </div>
                <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                    <Label htmlFor="kpi-format" className="imcrm-text-xs">{__('Formato')}</Label>
                    <select
                        id="kpi-format"
                        value={block.config.format ?? 'number'}
                        onChange={(e) => updateConfig({ format: e.target.value as 'number' | 'currency' | 'percent' })}
                        className="imcrm-h-9 imcrm-rounded-md imcrm-border imcrm-border-input imcrm-bg-background imcrm-px-2 imcrm-text-sm"
                    >
                        <option value="number">{__('Número')}</option>
                        <option value="currency">{__('Moneda')}</option>
                        <option value="percent">{__('Porcentaje')}</option>
                    </select>
                </div>
            </div>
            <div className="imcrm-grid imcrm-grid-cols-3 imcrm-gap-3">
                <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                    <Label htmlFor="kpi-prefix" className="imcrm-text-xs">{__('Prefijo')}</Label>
                    <Input
                        id="kpi-prefix"
                        value={block.config.prefix ?? ''}
                        onChange={(e) => updateConfig({ prefix: e.target.value || undefined })}
                    />
                </div>
                <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                    <Label htmlFor="kpi-suffix" className="imcrm-text-xs">{__('Sufijo')}</Label>
                    <Input
                        id="kpi-suffix"
                        value={block.config.suffix ?? ''}
                        onChange={(e) => updateConfig({ suffix: e.target.value || undefined })}
                    />
                </div>
                <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                    <Label htmlFor="kpi-goal" className="imcrm-text-xs">{__('Meta (opcional)')}</Label>
                    <Input
                        id="kpi-goal"
                        type="number"
                        value={block.config.goal_value ?? ''}
                        onChange={(e) => updateConfig({ goal_value: e.target.value === '' ? undefined : Number(e.target.value) })}
                    />
                </div>
            </div>
        </div>
    );
}

// --- Chart form --------------------------------------------------------------

function ChartForm({
    block,
    fields,
    onUpdate,
}: {
    block: Extract<V2Block, { type: 'chart' }>;
    fields: FieldEntity[];
    onUpdate: (patch: { config: typeof block.config }) => void;
}): JSX.Element {
    const updateConfig = (patch: Partial<typeof block.config>): void => {
        onUpdate({ config: { ...block.config, ...patch } });
    };
    const relations = fields.filter((f) => f.type === 'relation');

    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-3">
            <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                <Label htmlFor="chart-rel" className="imcrm-text-xs">{__('Relation field')}</Label>
                <select
                    id="chart-rel"
                    value={block.config.relation_field_slug}
                    onChange={(e) => updateConfig({ relation_field_slug: e.target.value })}
                    className="imcrm-h-9 imcrm-rounded-md imcrm-border imcrm-border-input imcrm-bg-background imcrm-px-2 imcrm-text-sm"
                >
                    <option value="">{__('— Elegí —')}</option>
                    {relations.map((f) => (
                        <option key={f.id} value={f.slug}>{f.label}</option>
                    ))}
                </select>
                {relations.length === 0 && (
                    <p className="imcrm-text-[11px] imcrm-text-warning">
                        {__('Esta lista no tiene relation fields. Creá uno primero.')}
                    </p>
                )}
            </div>
            <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                <Label htmlFor="chart-group" className="imcrm-text-xs">{__('Field de agrupación (slug en lista destino)')}</Label>
                <Input
                    id="chart-group"
                    value={block.config.group_by_field_slug}
                    onChange={(e) => updateConfig({ group_by_field_slug: e.target.value })}
                    placeholder={__('Ej. status, etapa, prioridad')}
                />
                <p className="imcrm-text-[11px] imcrm-text-muted-foreground">
                    {__('Slug del field en la lista destino por el cual agrupar (ideal: select / multi_select).')}
                </p>
            </div>
            <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                <Label htmlFor="chart-title" className="imcrm-text-xs">{__('Título (opcional)')}</Label>
                <Input
                    id="chart-title"
                    value={block.config.title ?? ''}
                    onChange={(e) => updateConfig({ title: e.target.value || undefined })}
                />
            </div>
        </div>
    );
}

// --- Files form --------------------------------------------------------------

function FilesForm({
    block,
    fields,
    onUpdate,
}: {
    block: Extract<V2Block, { type: 'files' }>;
    fields: FieldEntity[];
    onUpdate: (patch: { config: typeof block.config }) => void;
}): JSX.Element {
    const fileFields = fields.filter((f) => f.type === 'file');

    if (fileFields.length === 0) {
        return (
            <p className="imcrm-text-xs imcrm-text-warning">
                {__('Esta lista no tiene fields de tipo file. Creá uno primero.')}
            </p>
        );
    }

    const toggle = (slug: string): void => {
        const current = block.config.file_field_slugs;
        const next = current.includes(slug)
            ? current.filter((s) => s !== slug)
            : [...current, slug];
        onUpdate({ config: { ...block.config, file_field_slugs: next } });
    };

    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-3">
            <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                <Label htmlFor="files-title" className="imcrm-text-xs">{__('Título')}</Label>
                <Input
                    id="files-title"
                    value={block.config.title ?? ''}
                    onChange={(e) => onUpdate({ config: { ...block.config, title: e.target.value || undefined } })}
                    placeholder={__('Archivos')}
                />
            </div>
            <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                <Label className="imcrm-text-xs">{__('Fields a mostrar')}</Label>
                <p className="imcrm-text-[11px] imcrm-text-muted-foreground">
                    {__('Vacío = todos los file fields. Seleccioná específicos para limitar.')}
                </p>
                <ul className="imcrm-flex imcrm-flex-col imcrm-gap-1">
                    {fileFields.map((f) => (
                        <li key={f.id}>
                            <label className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-text-xs">
                                <input
                                    type="checkbox"
                                    checked={block.config.file_field_slugs.includes(f.slug)}
                                    onChange={() => toggle(f.slug)}
                                />
                                {f.label}
                            </label>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

// --- Embed form --------------------------------------------------------------

function EmbedForm({
    block,
    fields,
    onUpdate,
}: {
    block: Extract<V2Block, { type: 'embed' }>;
    fields: FieldEntity[];
    onUpdate: (patch: { config: typeof block.config }) => void;
}): JSX.Element {
    const updateConfig = (patch: Partial<typeof block.config>): void => {
        onUpdate({ config: { ...block.config, ...patch } });
    };
    const urlFields = fields.filter((f) => f.type === 'url');

    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-3">
            <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                <Label className="imcrm-text-xs">{__('Fuente del URL')}</Label>
                <div className="imcrm-flex imcrm-gap-3 imcrm-text-xs">
                    <label className="imcrm-flex imcrm-items-center imcrm-gap-1.5">
                        <input
                            type="radio"
                            name="embed-source"
                            checked={block.config.source === 'literal'}
                            onChange={() => updateConfig({ source: 'literal' })}
                        />
                        {__('URL fijo')}
                    </label>
                    <label className="imcrm-flex imcrm-items-center imcrm-gap-1.5">
                        <input
                            type="radio"
                            name="embed-source"
                            checked={block.config.source === 'field'}
                            onChange={() => updateConfig({ source: 'field' })}
                        />
                        {__('Desde un field URL del record')}
                    </label>
                </div>
            </div>
            {block.config.source === 'literal' ? (
                <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                    <Label htmlFor="embed-url" className="imcrm-text-xs">{__('URL')}</Label>
                    <Input
                        id="embed-url"
                        value={block.config.url ?? ''}
                        onChange={(e) => updateConfig({ url: e.target.value })}
                        placeholder="https://www.youtube.com/embed/..."
                    />
                    <p className="imcrm-text-[11px] imcrm-text-muted-foreground">
                        {__('Solo se permiten: YouTube, Vimeo, Google Maps, Loom, Figma, Calendly.')}
                    </p>
                </div>
            ) : (
                <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                    <Label htmlFor="embed-field" className="imcrm-text-xs">{__('Field URL')}</Label>
                    <select
                        id="embed-field"
                        value={block.config.field_slug ?? ''}
                        onChange={(e) => updateConfig({ field_slug: e.target.value })}
                        className="imcrm-h-9 imcrm-rounded-md imcrm-border imcrm-border-input imcrm-bg-background imcrm-px-2 imcrm-text-sm"
                    >
                        <option value="">{__('— Elegí —')}</option>
                        {urlFields.map((f) => (
                            <option key={f.id} value={f.slug}>{f.label}</option>
                        ))}
                    </select>
                    {urlFields.length === 0 && (
                        <p className="imcrm-text-[11px] imcrm-text-warning">
                            {__('No hay fields tipo url en esta lista.')}
                        </p>
                    )}
                </div>
            )}
            <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                <Label htmlFor="embed-title" className="imcrm-text-xs">{__('Título (opcional)')}</Label>
                <Input
                    id="embed-title"
                    value={block.config.title ?? ''}
                    onChange={(e) => updateConfig({ title: e.target.value || undefined })}
                />
            </div>
        </div>
    );
}

// --- Action button form ------------------------------------------------------

function ActionButtonForm({
    block,
    onUpdate,
}: {
    block: Extract<V2Block, { type: 'action_button' }>;
    onUpdate: (patch: { config: typeof block.config }) => void;
}): JSX.Element {
    const updateConfig = (patch: Partial<typeof block.config>): void => {
        onUpdate({ config: { ...block.config, ...patch } });
    };
    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-3">
            <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                <Label htmlFor="ab-label" className="imcrm-text-xs">{__('Label del botón')}</Label>
                <Input
                    id="ab-label"
                    value={block.config.label}
                    onChange={(e) => updateConfig({ label: e.target.value })}
                    placeholder={__('Ej. "Llamar"')}
                />
            </div>
            <div className="imcrm-grid imcrm-grid-cols-2 imcrm-gap-3">
                <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                    <Label htmlFor="ab-action" className="imcrm-text-xs">{__('Tipo')}</Label>
                    <select
                        id="ab-action"
                        value={block.config.action_type}
                        onChange={(e) => updateConfig({ action_type: e.target.value as 'url' | 'mailto' | 'tel' | 'copy' })}
                        className="imcrm-h-9 imcrm-rounded-md imcrm-border imcrm-border-input imcrm-bg-background imcrm-px-2 imcrm-text-sm"
                    >
                        <option value="url">{__('URL externa')}</option>
                        <option value="mailto">{__('Email (mailto:)')}</option>
                        <option value="tel">{__('Teléfono (tel:)')}</option>
                        <option value="copy">{__('Copiar al clipboard')}</option>
                    </select>
                </div>
                <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                    <Label htmlFor="ab-variant" className="imcrm-text-xs">{__('Variante')}</Label>
                    <select
                        id="ab-variant"
                        value={block.config.variant ?? 'default'}
                        onChange={(e) => updateConfig({ variant: e.target.value as 'default' | 'outline' | 'destructive' })}
                        className="imcrm-h-9 imcrm-rounded-md imcrm-border imcrm-border-input imcrm-bg-background imcrm-px-2 imcrm-text-sm"
                    >
                        <option value="default">{__('Primario')}</option>
                        <option value="outline">{__('Outline')}</option>
                        <option value="destructive">{__('Destructivo')}</option>
                    </select>
                </div>
            </div>
            <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                <Label htmlFor="ab-target" className="imcrm-text-xs">{__('Target')}</Label>
                <Input
                    id="ab-target"
                    value={block.config.target}
                    onChange={(e) => updateConfig({ target: e.target.value })}
                    placeholder={
                        block.config.action_type === 'url' ? 'https://…' :
                        block.config.action_type === 'mailto' ? 'foo@bar.com' :
                        block.config.action_type === 'tel' ? '+57 300 1234567' :
                        __('Texto a copiar')
                    }
                />
            </div>
        </div>
    );
}

// --- Markdown form -----------------------------------------------------------

function MarkdownForm({
    block,
    onUpdate,
}: {
    block: Extract<V2Block, { type: 'markdown' }>;
    onUpdate: (patch: { config: typeof block.config }) => void;
}): JSX.Element {
    const [draft, setDraft] = useState(block.config);

    useEffect(() => {
        setDraft(block.config);
    }, [block.config]);

    const commit = (): void => onUpdate({ config: draft });

    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-3">
            <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                <Label htmlFor="md-title" className="imcrm-text-xs">{__('Título')}</Label>
                <Input
                    id="md-title"
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    onBlur={commit}
                />
            </div>
            <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                <Label htmlFor="md-content" className="imcrm-text-xs">{__('Contenido (markdown)')}</Label>
                <Textarea
                    id="md-content"
                    rows={8}
                    value={draft.content}
                    onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                    onBlur={commit}
                    placeholder={'# Título\n## Sub\n- item\n**bold** *itálica* `code` [link](https://...)'}
                />
                <p className="imcrm-text-[11px] imcrm-text-muted-foreground">
                    {__('Markdown ligero: # ## ### · - · 1. · **bold** · *italic* · `code` · [link](url)')}
                </p>
            </div>
        </div>
    );
}
