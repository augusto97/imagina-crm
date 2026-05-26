import { ArrowDown, ArrowUp, X } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { __ } from '@/lib/i18n';
import type { FieldEntity } from '@/types/field';

import type { ResolvedPortalBlock } from './portalLayout';

interface FormProps {
    block: ResolvedPortalBlock;
    fields: FieldEntity[];
    onConfigChange: (config: Record<string, unknown>) => void;
}

/**
 * Renderea el form de configuración apropiado para el tipo del bloque.
 * Igual que el `BlockInspectorPanel` del CRM editor pero con los tipos
 * específicos del portal y field pickers reales (selects de campos,
 * no `<input type="text">` con slugs a mano).
 */
export function PortalBlockForm({ block, fields, onConfigChange }: FormProps): JSX.Element {
    switch (block.type) {
        case 'static_text':
            return <StaticTextForm config={block.config} onChange={onConfigChange} />;
        case 'client_data':
            return <ClientDataForm config={block.config} fields={fields} onChange={onConfigChange} />;
        case 'related_records_table':
            return <RelatedRecordsForm config={block.config} fields={fields} onChange={onConfigChange} />;
        case 'editable_form':
            return <EditableFormConfig config={block.config} fields={fields} onChange={onConfigChange} />;
        case 'external_link':
            return <ExternalLinkForm config={block.config} onChange={onConfigChange} />;
        case 'kpi_widget':
            return <KpiForm config={block.config} fields={fields} onChange={onConfigChange} />;
        case 'activity_timeline':
            return <ActivityForm config={block.config} onChange={onConfigChange} />;
        case 'download_files':
            return <DownloadFilesForm config={block.config} fields={fields} onChange={onConfigChange} />;
        case 'comments_thread':
            return <CommentsForm config={block.config} onChange={onConfigChange} />;
    }
}

// ─── Forms por tipo ───────────────────────────────────────────────────

function StaticTextForm({
    config,
    onChange,
}: {
    config: Record<string, unknown>;
    onChange: (c: Record<string, unknown>) => void;
}): JSX.Element {
    const content = typeof config.content === 'string' ? config.content : '';
    return (
        <Field label={__('Contenido (HTML básico permitido)')}>
            <Textarea
                rows={6}
                value={content}
                onChange={(e) => onChange({ ...config, content: e.target.value })}
                placeholder={__('Texto de bienvenida, instrucciones, anuncios…')}
            />
            <p className="imcrm-text-[11px] imcrm-text-muted-foreground">
                {__('Tags permitidos: <p>, <strong>, <em>, <a>, <ul>, <ol>, <li>, <br>.')}
            </p>
        </Field>
    );
}

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
    return (
        <FieldSlugMultiPicker
            label={__('Campos visibles del cliente')}
            value={slugs}
            onChange={(next) => onChange({ ...config, visible_field_slugs: next })}
            options={fields.filter((f) => f.type !== 'relation' && f.type !== 'file')}
            placeholder={__('Agregar campo a mostrar…')}
        />
    );
}

function RelatedRecordsForm({
    config,
    fields,
    onChange,
}: {
    config: Record<string, unknown>;
    fields: FieldEntity[];
    onChange: (c: Record<string, unknown>) => void;
}): JSX.Element {
    const relationFields = fields.filter((f) => f.type === 'relation');
    const relSlug = typeof config.relation_field_slug === 'string' ? config.relation_field_slug : '';
    const cols = Array.isArray(config.visible_field_slugs)
        ? (config.visible_field_slugs as unknown[]).map(String)
        : [];
    const maxRows = typeof config.max_rows === 'number' ? config.max_rows : 10;

    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-3">
            <Field label={__('Relation field a expandir')}>
                <Select
                    value={relSlug}
                    onChange={(e) => onChange({ ...config, relation_field_slug: e.target.value })}
                >
                    <option value="">{__('— Elegir relation —')}</option>
                    {relationFields.map((f) => (
                        <option key={f.id} value={f.slug}>{f.label}</option>
                    ))}
                </Select>
                {relationFields.length === 0 && (
                    <p className="imcrm-text-[11px] imcrm-text-warning">
                        {__('La lista no tiene relation fields.')}
                    </p>
                )}
            </Field>
            <Field label={__('Columnas visibles (slugs del list destino)')}>
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
                <p className="imcrm-text-[11px] imcrm-text-muted-foreground">
                    {__('Los slugs deben existir en la lista destino del relation.')}
                </p>
            </Field>
            <Field label={__('Máx filas')}>
                <Input
                    type="number"
                    min={1}
                    max={50}
                    value={maxRows}
                    onChange={(e) => onChange({ ...config, max_rows: Number(e.target.value) })}
                />
            </Field>
        </div>
    );
}

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
    const submitLabel = typeof config.submit_label === 'string' ? config.submit_label : 'Guardar';

    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-3">
            <FieldSlugMultiPicker
                label={__('Campos editables por el cliente')}
                value={slugs}
                onChange={(next) => onChange({ ...config, editable_field_slugs: next })}
                options={fields.filter(
                    (f) => f.type !== 'relation' && f.type !== 'file' && f.type !== 'computed',
                )}
                placeholder={__('Agregar campo editable…')}
            />
            <Field label={__('Label del botón de envío')}>
                <Input
                    value={submitLabel}
                    onChange={(e) => onChange({ ...config, submit_label: e.target.value })}
                />
            </Field>
        </div>
    );
}

function ExternalLinkForm({
    config,
    onChange,
}: {
    config: Record<string, unknown>;
    onChange: (c: Record<string, unknown>) => void;
}): JSX.Element {
    const label = typeof config.label === 'string' ? config.label : '';
    const url = typeof config.url === 'string' ? config.url : '';
    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-3">
            <Field label={__('Texto del botón')}>
                <Input
                    value={label}
                    onChange={(e) => onChange({ ...config, label: e.target.value })}
                    placeholder={__('Ej. "Pagar ahora"')}
                />
            </Field>
            <Field label={__('URL')}>
                <Input
                    type="url"
                    value={url}
                    onChange={(e) => onChange({ ...config, url: e.target.value })}
                    placeholder="https://…"
                />
            </Field>
        </div>
    );
}

function KpiForm({
    config,
    fields,
    onChange,
}: {
    config: Record<string, unknown>;
    fields: FieldEntity[];
    onChange: (c: Record<string, unknown>) => void;
}): JSX.Element {
    const slug = typeof config.field_slug === 'string' ? config.field_slug : '';
    const label = typeof config.label === 'string' ? config.label : '';
    const candidates = fields.filter((f) =>
        ['number', 'currency', 'computed', 'text', 'date'].includes(f.type),
    );
    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-3">
            <Field label={__('Campo a mostrar como métrica')}>
                <Select
                    value={slug}
                    onChange={(e) => onChange({ ...config, field_slug: e.target.value })}
                >
                    <option value="">{__('— Elegir campo —')}</option>
                    {candidates.map((f) => (
                        <option key={f.id} value={f.slug}>
                            {f.label} ({f.type})
                        </option>
                    ))}
                </Select>
            </Field>
            <Field label={__('Label (opcional)')}>
                <Input
                    value={label}
                    onChange={(e) => onChange({ ...config, label: e.target.value })}
                    placeholder={__('Default: nombre del campo')}
                />
            </Field>
        </div>
    );
}

function ActivityForm({
    config,
    onChange,
}: {
    config: Record<string, unknown>;
    onChange: (c: Record<string, unknown>) => void;
}): JSX.Element {
    const max = typeof config.max_items === 'number' ? config.max_items : 10;
    return (
        <Field label={__('Máximo de actividades a mostrar')}>
            <Input
                type="number"
                min={1}
                max={50}
                value={max}
                onChange={(e) => onChange({ ...config, max_items: Number(e.target.value) })}
            />
        </Field>
    );
}

function DownloadFilesForm({
    config,
    fields,
    onChange,
}: {
    config: Record<string, unknown>;
    fields: FieldEntity[];
    onChange: (c: Record<string, unknown>) => void;
}): JSX.Element {
    const slugs = Array.isArray(config.file_field_slugs)
        ? (config.file_field_slugs as unknown[]).map(String)
        : [];
    return (
        <FieldSlugMultiPicker
            label={__('Campos tipo "archivo" a mostrar como descargables')}
            value={slugs}
            onChange={(next) => onChange({ ...config, file_field_slugs: next })}
            options={fields.filter((f) => f.type === 'file')}
            placeholder={__('Agregar archivo…')}
        />
    );
}

function CommentsForm({
    config,
    onChange,
}: {
    config: Record<string, unknown>;
    onChange: (c: Record<string, unknown>) => void;
}): JSX.Element {
    const title = typeof config.title === 'string' ? config.title : '';
    return (
        <Field label={__('Título de la sección')}>
            <Input
                value={title}
                onChange={(e) => onChange({ ...config, title: e.target.value })}
                placeholder={__('Ej. "Mensajes del equipo"')}
            />
        </Field>
    );
}

// ─── Helpers ──────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
            <Label className="imcrm-text-xs">{label}</Label>
            {children}
        </div>
    );
}

/**
 * Multi-picker de slugs de campo. Lista reordenable + dropdown para
 * agregar campos del set candidato. Reemplaza el `<input type="text">`
 * crudo donde antes había que tipear slugs separados por comas.
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
                    {__('Vacío. Agregá campos desde abajo.')}
                </p>
            ) : (
                <ul className="imcrm-flex imcrm-flex-col imcrm-gap-1">
                    {value.map((slug, i) => {
                        const f = bySlug.get(slug);
                        return (
                            <li
                                key={slug}
                                className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-rounded imcrm-border imcrm-border-border imcrm-px-2 imcrm-py-1 imcrm-text-xs"
                            >
                                <span className="imcrm-flex-1 imcrm-truncate">
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
