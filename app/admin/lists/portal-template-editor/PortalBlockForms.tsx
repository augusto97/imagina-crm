import { ArrowDown, ArrowUp, X } from 'lucide-react';

import { ColorPicker, type OptionColor } from '@/components/ui/color-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useLists } from '@/hooks/useLists';
import { __ } from '@/lib/i18n';
import type { FieldEntity } from '@/types/field';

import type { ResolvedPortalBlock } from './portalLayout';

interface FormProps {
    block: ResolvedPortalBlock;
    fields: FieldEntity[];
    onConfigChange: (config: Record<string, unknown>) => void;
}

/**
 * Forms del inspector — uno por tipo. Las **keys core** del config
 * matchean el shape que el bundle público (`PortalBlock`) espera leer.
 * Las keys adicionales (`variant`, `accent_color`) son aditivas — el
 * bundle las ignora hasta que cada block component se actualice.
 *
 * Forms agregan:
 *  - **Variante** visual cuando el bloque la soporta.
 *  - **Título** custom.
 *  - **Field pickers reales** en lugar de `<input type="text">` con CSVs.
 *  - **Color de acento** donde aplica.
 */
export function PortalBlockForm({ block, fields, onConfigChange }: FormProps): JSX.Element {
    switch (block.type) {
        case 'static_text':
            return <StaticTextForm config={block.config} onChange={onConfigChange} />;
        case 'client_data':
            return <ClientDataForm config={block.config} fields={fields} onChange={onConfigChange} />;
        case 'related_records_table':
            return <RelatedRecordsForm config={block.config} onChange={onConfigChange} />;
        case 'editable_form':
            return <EditableFormConfig config={block.config} fields={fields} onChange={onConfigChange} />;
        case 'external_link':
            return <ExternalLinkForm config={block.config} onChange={onConfigChange} />;
        case 'kpi_widget':
            return <KpiForm config={block.config} onChange={onConfigChange} />;
        case 'activity_timeline':
            return <ActivityForm config={block.config} onChange={onConfigChange} />;
        case 'download_files':
            return <DownloadFilesForm config={block.config} fields={fields} onChange={onConfigChange} />;
        case 'comments_thread':
            return <CommentsForm config={block.config} onChange={onConfigChange} />;
    }
}

// ─── static_text ──────────────────────────────────────────────────────

function StaticTextForm({
    config,
    onChange,
}: {
    config: Record<string, unknown>;
    onChange: (c: Record<string, unknown>) => void;
}): JSX.Element {
    const html = typeof config.html === 'string' ? config.html : '';
    const title = (config.title as string) ?? '';
    const variant = (config.variant as string) ?? 'card';
    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-3">
            <Field label={__('Título (opcional)')}>
                <Input
                    value={title}
                    onChange={(e) => onChange({ ...config, title: e.target.value })}
                    placeholder={__('Ej. "Bienvenido"')}
                />
            </Field>
            <VariantPicker
                value={variant}
                onChange={(v) => onChange({ ...config, variant: v })}
                options={[
                    { value: 'card', label: __('Card con borde') },
                    { value: 'plain', label: __('Sin marco') },
                ]}
            />
            <Field label={__('Contenido (HTML básico)')}>
                <Textarea
                    rows={6}
                    value={html}
                    onChange={(e) => onChange({ ...config, html: e.target.value })}
                    placeholder={__('<p>Bienvenido a tu portal…</p>')}
                />
                <Hint>
                    {__('Tags permitidos: <p>, <strong>, <em>, <a>, <ul>, <ol>, <li>, <br>.')}
                </Hint>
            </Field>
        </div>
    );
}

// ─── client_data ──────────────────────────────────────────────────────

function ClientDataForm({
    config,
    fields,
    onChange,
}: {
    config: Record<string, unknown>;
    fields: FieldEntity[];
    onChange: (c: Record<string, unknown>) => void;
}): JSX.Element {
    const slugs = Array.isArray(config.visible_field_slugs)
        ? (config.visible_field_slugs as unknown[]).map(String)
        : [];
    const title = (config.title as string) ?? '';
    const variant = (config.variant as string) ?? 'definition_list';

    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-3">
            <Field label={__('Título (opcional)')}>
                <Input
                    value={title}
                    onChange={(e) => onChange({ ...config, title: e.target.value })}
                    placeholder={__('Datos del cliente')}
                />
            </Field>
            <VariantPicker
                value={variant}
                onChange={(v) => onChange({ ...config, variant: v })}
                options={[
                    { value: 'definition_list', label: __('Lista — label izq / valor der') },
                    { value: 'cards', label: __('Cards — grid 2 columnas') },
                ]}
            />
            <FieldSlugMultiPicker
                label={__('Campos visibles')}
                value={slugs}
                onChange={(next) => onChange({ ...config, visible_field_slugs: next })}
                options={fields.filter((f) => f.type !== 'relation' && f.type !== 'file')}
                placeholder={__('Agregar campo…')}
            />
        </div>
    );
}

// ─── related_records_table ────────────────────────────────────────────

function RelatedRecordsForm({
    config,
    onChange,
}: {
    config: Record<string, unknown>;
    onChange: (c: Record<string, unknown>) => void;
}): JSX.Element {
    const lists = useLists();
    const listSlug = (config.list_slug as string) ?? '';
    const cols = Array.isArray(config.visible_field_slugs)
        ? (config.visible_field_slugs as unknown[]).map(String)
        : [];
    const perPage = (config.per_page as number) ?? 10;
    const variant = (config.variant as string) ?? 'table';
    const title = (config.title as string) ?? '';

    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-3">
            <Field label={__('Título (opcional)')}>
                <Input
                    value={title}
                    onChange={(e) => onChange({ ...config, title: e.target.value })}
                    placeholder={__('Registros relacionados')}
                />
            </Field>
            <VariantPicker
                value={variant}
                onChange={(v) => onChange({ ...config, variant: v })}
                options={[
                    { value: 'table', label: __('Tabla completa') },
                    { value: 'compact_list', label: __('Lista compacta') },
                ]}
            />
            <Field label={__('Lista relacionada')}>
                <Select
                    value={listSlug}
                    onChange={(e) => onChange({ ...config, list_slug: e.target.value })}
                >
                    <option value="">{__('— Elegir lista —')}</option>
                    {(lists.data ?? []).map((l) => (
                        <option key={l.id} value={l.slug}>{l.name}</option>
                    ))}
                </Select>
                <Hint>
                    {__('Los records de esta lista se filtran por scope del portal — el cliente solo ve los suyos.')}
                </Hint>
            </Field>
            <Field label={__('Columnas visibles (slugs)')}>
                <Input
                    value={cols.join(', ')}
                    onChange={(e) => {
                        const next = e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter((s) => s !== '');
                        onChange({ ...config, visible_field_slugs: next });
                    }}
                    placeholder={__('Ej. fecha, monto, estado')}
                />
                <Hint>
                    {__('Slugs separados por coma de los campos de la lista elegida arriba.')}
                </Hint>
            </Field>
            <Field label={__('Máximo registros por página')}>
                <Input
                    type="number"
                    min={1}
                    max={50}
                    value={perPage}
                    onChange={(e) => onChange({ ...config, per_page: Number(e.target.value) })}
                />
            </Field>
        </div>
    );
}

// ─── editable_form ────────────────────────────────────────────────────

function EditableFormConfig({
    config,
    fields,
    onChange,
}: {
    config: Record<string, unknown>;
    fields: FieldEntity[];
    onChange: (c: Record<string, unknown>) => void;
}): JSX.Element {
    const slugs = Array.isArray(config.editable_field_slugs)
        ? (config.editable_field_slugs as unknown[]).map(String)
        : [];
    const submitLabel = (config.submit_label as string) ?? 'Guardar';
    const title = (config.title as string) ?? '';

    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-3">
            <Field label={__('Título del formulario')}>
                <Input
                    value={title}
                    onChange={(e) => onChange({ ...config, title: e.target.value })}
                    placeholder={__('Actualizar mis datos')}
                />
            </Field>
            <FieldSlugMultiPicker
                label={__('Campos editables')}
                value={slugs}
                onChange={(next) => onChange({ ...config, editable_field_slugs: next })}
                options={fields.filter(
                    (f) => f.type !== 'relation' && f.type !== 'file' && f.type !== 'computed',
                )}
                placeholder={__('Agregar campo…')}
            />
            <Field label={__('Texto del botón')}>
                <Input
                    value={submitLabel}
                    onChange={(e) => onChange({ ...config, submit_label: e.target.value })}
                    placeholder="Guardar"
                />
            </Field>
        </div>
    );
}

// ─── external_link ────────────────────────────────────────────────────

function ExternalLinkForm({
    config,
    onChange,
}: {
    config: Record<string, unknown>;
    onChange: (c: Record<string, unknown>) => void;
}): JSX.Element {
    const title = (config.title as string) ?? '';
    const description = (config.description as string) ?? '';
    const label = (config.label as string) ?? '';
    const href = (config.href as string) ?? '';
    const newWindow = config.new_window !== false;
    const variant = (config.variant as string) ?? 'button';
    const accent = (config.accent_color as string | null) ?? null;
    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-3">
            <VariantPicker
                value={variant}
                onChange={(v) => onChange({ ...config, variant: v })}
                options={[
                    { value: 'button', label: __('Botón centrado') },
                    { value: 'card_cta', label: __('Card con icono + descripción') },
                ]}
            />
            <Field label={__('Título (visible solo en variante card)')}>
                <Input
                    value={title}
                    onChange={(e) => onChange({ ...config, title: e.target.value })}
                    placeholder={__('Ej. "Pagar factura"')}
                />
            </Field>
            <Field label={__('Descripción (visible solo en variante card)')}>
                <Input
                    value={description}
                    onChange={(e) => onChange({ ...config, description: e.target.value })}
                    placeholder={__('Texto secundario opcional')}
                />
            </Field>
            <Field label={__('Texto del botón')}>
                <Input
                    value={label}
                    onChange={(e) => onChange({ ...config, label: e.target.value })}
                    placeholder={__('Ej. "Abrir"')}
                />
            </Field>
            <Field label={__('URL destino')}>
                <Input
                    type="url"
                    value={href}
                    onChange={(e) => onChange({ ...config, href: e.target.value })}
                    placeholder="https://…"
                />
            </Field>
            <label className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-text-xs imcrm-cursor-pointer">
                <input
                    type="checkbox"
                    checked={newWindow}
                    onChange={(e) => onChange({ ...config, new_window: e.target.checked })}
                />
                {__('Abrir en pestaña nueva')}
            </label>
            <AccentColorField
                value={accent}
                onChange={(v) => onChange({ ...config, accent_color: v })}
            />
        </div>
    );
}

// ─── kpi_widget ───────────────────────────────────────────────────────

function KpiForm({
    config,
    onChange,
}: {
    config: Record<string, unknown>;
    onChange: (c: Record<string, unknown>) => void;
}): JSX.Element {
    const lists = useLists();
    const listSlug = (config.list_slug as string) ?? '';
    const fieldId = (config.field_id as number) ?? 0;
    const metric = (config.metric as string) ?? 'count';
    const title = (config.title as string) ?? '';
    const prefix = (config.prefix as string) ?? '';
    const suffix = (config.suffix as string) ?? '';
    const variant = (config.variant as string) ?? 'card';
    const accent = (config.accent_color as string | null) ?? null;

    // Necesitamos los fields de la lista elegida (no de la lista actual)
    // — pero `useFields` requiere un listId. Buscamos el id por slug.
    const targetList = (lists.data ?? []).find((l) => l.slug === listSlug);

    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-3">
            <VariantPicker
                value={variant}
                onChange={(v) => onChange({ ...config, variant: v })}
                options={[
                    { value: 'card', label: __('Card con número grande') },
                    { value: 'inline', label: __('Inline — label + valor en línea') },
                ]}
            />
            <Field label={__('Título (opcional)')}>
                <Input
                    value={title}
                    onChange={(e) => onChange({ ...config, title: e.target.value })}
                    placeholder={__('Ej. "Total facturado"')}
                />
            </Field>
            <Field label={__('Lista a agregar')}>
                <Select
                    value={listSlug}
                    onChange={(e) => onChange({ ...config, list_slug: e.target.value })}
                >
                    <option value="">{__('— Elegir lista —')}</option>
                    {(lists.data ?? []).map((l) => (
                        <option key={l.id} value={l.slug}>{l.name}</option>
                    ))}
                </Select>
            </Field>
            <Field label={__('Métrica')}>
                <Select
                    value={metric}
                    onChange={(e) => onChange({ ...config, metric: e.target.value })}
                >
                    <option value="count">{__('Contar registros')}</option>
                    <option value="sum">{__('Suma')}</option>
                    <option value="avg">{__('Promedio')}</option>
                    <option value="min">{__('Mínimo')}</option>
                    <option value="max">{__('Máximo')}</option>
                </Select>
            </Field>
            {metric !== 'count' && (
                <Field label={__('Campo numérico a agregar')}>
                    <Input
                        type="number"
                        min={0}
                        value={fieldId}
                        onChange={(e) => onChange({ ...config, field_id: Number(e.target.value) })}
                        placeholder={__('ID del campo')}
                    />
                    <Hint variant={targetList ? 'default' : 'warning'}>
                        {targetList
                            ? __('Buscá el ID del campo numérico en la lista elegida.')
                            : __('Elegí primero la lista arriba.')}
                    </Hint>
                </Field>
            )}
            <div className="imcrm-grid imcrm-grid-cols-2 imcrm-gap-2">
                <Field label={__('Prefijo')}>
                    <Input
                        value={prefix}
                        onChange={(e) => onChange({ ...config, prefix: e.target.value })}
                        placeholder="$"
                    />
                </Field>
                <Field label={__('Sufijo')}>
                    <Input
                        value={suffix}
                        onChange={(e) => onChange({ ...config, suffix: e.target.value })}
                        placeholder="USD"
                    />
                </Field>
            </div>
            <AccentColorField
                value={accent}
                onChange={(v) => onChange({ ...config, accent_color: v })}
            />
        </div>
    );
}

// ─── activity_timeline ────────────────────────────────────────────────

function ActivityForm({
    config,
    onChange,
}: {
    config: Record<string, unknown>;
    onChange: (c: Record<string, unknown>) => void;
}): JSX.Element {
    const limit = (config.limit as number) ?? 10;
    const title = (config.title as string) ?? '';
    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-3">
            <Field label={__('Título')}>
                <Input
                    value={title}
                    onChange={(e) => onChange({ ...config, title: e.target.value })}
                    placeholder={__('Actividad reciente')}
                />
            </Field>
            <Field label={__('Máximo de items a mostrar')}>
                <Input
                    type="number"
                    min={1}
                    max={50}
                    value={limit}
                    onChange={(e) => onChange({ ...config, limit: Number(e.target.value) })}
                />
            </Field>
        </div>
    );
}

// ─── download_files ───────────────────────────────────────────────────

function DownloadFilesForm({
    config,
    fields,
    onChange,
}: {
    config: Record<string, unknown>;
    fields: FieldEntity[];
    onChange: (c: Record<string, unknown>) => void;
}): JSX.Element {
    const fieldSlug = (config.field_slug as string) ?? '';
    const title = (config.title as string) ?? '';
    const variant = (config.variant as string) ?? 'list';
    const fileFields = fields.filter((f) => f.type === 'file');

    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-3">
            <Field label={__('Título')}>
                <Input
                    value={title}
                    onChange={(e) => onChange({ ...config, title: e.target.value })}
                    placeholder={__('Archivos')}
                />
            </Field>
            <VariantPicker
                value={variant}
                onChange={(v) => onChange({ ...config, variant: v })}
                options={[
                    { value: 'list', label: __('Lista vertical') },
                    { value: 'grid', label: __('Grid de 3 columnas') },
                ]}
            />
            <Field label={__('Campo tipo archivo a mostrar')}>
                <Select
                    value={fieldSlug}
                    onChange={(e) => onChange({ ...config, field_slug: e.target.value })}
                >
                    <option value="">{__('— Elegir campo —')}</option>
                    {fileFields.map((f) => (
                        <option key={f.id} value={f.slug}>{f.label}</option>
                    ))}
                </Select>
                {fileFields.length === 0 && (
                    <Hint variant="warning">
                        {__('La lista no tiene campos tipo "archivo". Agregá uno primero.')}
                    </Hint>
                )}
            </Field>
        </div>
    );
}

// ─── comments_thread ──────────────────────────────────────────────────

function CommentsForm({
    config,
    onChange,
}: {
    config: Record<string, unknown>;
    onChange: (c: Record<string, unknown>) => void;
}): JSX.Element {
    const title = (config.title as string) ?? '';
    const readonly = config.readonly === true;
    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-3">
            <Field label={__('Título de la sección')}>
                <Input
                    value={title}
                    onChange={(e) => onChange({ ...config, title: e.target.value })}
                    placeholder={__('Comentarios')}
                />
            </Field>
            <label className="imcrm-flex imcrm-items-start imcrm-gap-2 imcrm-text-xs imcrm-cursor-pointer">
                <input
                    type="checkbox"
                    checked={readonly}
                    onChange={(e) => onChange({ ...config, readonly: e.target.checked })}
                    className="imcrm-mt-0.5"
                />
                <span>
                    {__('Solo lectura')}
                    <span className="imcrm-block imcrm-text-[10px] imcrm-text-muted-foreground">
                        {__('El cliente ve los comentarios pero no puede escribir.')}
                    </span>
                </span>
            </label>
        </div>
    );
}

// ─── Helpers UI ───────────────────────────────────────────────────────

function Field({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}): JSX.Element {
    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
            <Label className="imcrm-text-xs">{label}</Label>
            {children}
        </div>
    );
}

function Hint({
    children,
    variant,
}: {
    children: React.ReactNode;
    variant?: 'default' | 'warning';
}): JSX.Element {
    return (
        <p
            className={
                variant === 'warning'
                    ? 'imcrm-text-[11px] imcrm-text-warning'
                    : 'imcrm-text-[11px] imcrm-text-muted-foreground'
            }
        >
            {children}
        </p>
    );
}

function VariantPicker({
    value,
    onChange,
    options,
}: {
    value: string;
    onChange: (v: string) => void;
    options: Array<{ value: string; label: string }>;
}): JSX.Element {
    return (
        <Field label={__('Variante visual')}>
            <Select value={value} onChange={(e) => onChange(e.target.value)}>
                {options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                ))}
            </Select>
        </Field>
    );
}

function AccentColorField({
    value,
    onChange,
}: {
    value: string | null;
    onChange: (v: string | null) => void;
}): JSX.Element {
    return (
        <Field label={__('Color de acento (opcional)')}>
            <div className="imcrm-flex imcrm-items-center imcrm-gap-2">
                <ColorPicker
                    value={value as OptionColor | null}
                    onChange={(c) => onChange((c as string | null) ?? null)}
                />
                <Hint>{__('Default: color primario del tema.')}</Hint>
            </div>
        </Field>
    );
}

/**
 * Multi-picker de slugs reordenable. Reemplaza el `<input type="text">`
 * con CSVs del editor anterior.
 */
function FieldSlugMultiPicker({
    label,
    value,
    onChange,
    options,
    placeholder,
}: {
    label: string;
    value: string[];
    onChange: (next: string[]) => void;
    options: FieldEntity[];
    placeholder: string;
}): JSX.Element {
    const bySlug = new Map(options.map((f) => [f.slug, f]));
    const available = options.filter((f) => ! value.includes(f.slug));
    const move = (slug: string, dir: -1 | 1): void => {
        const idx = value.indexOf(slug);
        const target = idx + dir;
        if (idx < 0 || target < 0 || target >= value.length) return;
        const next = [...value];
        [next[idx], next[target]] = [next[target]!, next[idx]!];
        onChange(next);
    };
    const remove = (slug: string): void => {
        onChange(value.filter((s) => s !== slug));
    };
    return (
        <Field label={label}>
            {value.length === 0 ? (
                <p className="imcrm-rounded-md imcrm-border imcrm-border-dashed imcrm-border-border imcrm-px-2 imcrm-py-2 imcrm-text-[11px] imcrm-text-muted-foreground">
                    {__('Vacío. Agregá campos desde el dropdown.')}
                </p>
            ) : (
                <ul className="imcrm-flex imcrm-flex-col imcrm-gap-1">
                    {value.map((slug, i) => {
                        const f = bySlug.get(slug);
                        return (
                            <li
                                key={slug}
                                className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-rounded imcrm-border imcrm-border-border imcrm-bg-card imcrm-px-2 imcrm-py-1 imcrm-text-xs"
                            >
                                <span className="imcrm-min-w-0 imcrm-flex-1 imcrm-truncate">
                                    {f ? f.label : slug}
                                    {f && (
                                        <span className="imcrm-ml-2 imcrm-text-[10px] imcrm-text-muted-foreground">
                                            ({f.type})
                                        </span>
                                    )}
                                    {!f && (
                                        <span className="imcrm-ml-2 imcrm-text-[10px] imcrm-text-warning">
                                            ({__('no encontrado')})
                                        </span>
                                    )}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => move(slug, -1)}
                                    disabled={i === 0}
                                    className="imcrm-text-muted-foreground hover:imcrm-text-foreground disabled:imcrm-opacity-30"
                                    title={__('Subir')}
                                >
                                    <ArrowUp className="imcrm-h-3 imcrm-w-3" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => move(slug, 1)}
                                    disabled={i === value.length - 1}
                                    className="imcrm-text-muted-foreground hover:imcrm-text-foreground disabled:imcrm-opacity-30"
                                    title={__('Bajar')}
                                >
                                    <ArrowDown className="imcrm-h-3 imcrm-w-3" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => remove(slug)}
                                    className="imcrm-text-muted-foreground hover:imcrm-text-destructive"
                                    title={__('Quitar')}
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
                    const slug = e.target.value;
                    if (slug !== '') {
                        onChange([...value, slug]);
                        e.target.value = '';
                    }
                }}
                defaultValue=""
                disabled={available.length === 0}
                className="imcrm-h-8 imcrm-rounded-md imcrm-border imcrm-border-input imcrm-bg-background imcrm-px-2 imcrm-text-xs"
            >
                <option value="">
                    {available.length === 0 ? __('— Sin campos disponibles —') : placeholder}
                </option>
                {available.map((f) => (
                    <option key={f.id} value={f.slug}>
                        {f.label} ({f.type})
                    </option>
                ))}
            </select>
        </Field>
    );
}
