import {
    Activity,
    Calendar,
    Download,
    ExternalLink as ExternalLinkIcon,
    File,
    Image as ImageIcon,
    Mail,
    MessageSquare,
    User,
} from 'lucide-react';

import { __ } from '@/lib/i18n';
import type { FieldEntity } from '@/types/field';

import type { ResolvedPortalBlock } from './portalLayout';

interface Props {
    block: ResolvedPortalBlock;
    fields: FieldEntity[];
}

/**
 * Preview visual de cada bloque dentro del grid editor. A diferencia
 * de un wireframe genérico, cada tipo renderea un mockup estilizado
 * que muestra cómo se verá en el portal real (con datos de ejemplo).
 *
 * Mismo enfoque que el `BlockRenderer` del CRM editor: estética
 * realista, no placeholders.
 */
export function PortalBlockPreview({ block, fields }: Props): JSX.Element {
    switch (block.type) {
        case 'static_text':
            return <StaticTextPreview block={block} />;
        case 'client_data':
            return <ClientDataPreview block={block} fields={fields} />;
        case 'related_records_table':
            return <RelatedRecordsPreview block={block} />;
        case 'editable_form':
            return <EditableFormPreview block={block} fields={fields} />;
        case 'external_link':
            return <ExternalLinkPreview block={block} />;
        case 'kpi_widget':
            return <KpiPreview block={block} fields={fields} />;
        case 'activity_timeline':
            return <ActivityTimelinePreview block={block} />;
        case 'download_files':
            return <DownloadFilesPreview block={block} fields={fields} />;
        case 'comments_thread':
            return <CommentsThreadPreview block={block} />;
    }
}

// ─── static_text ──────────────────────────────────────────────────────

function StaticTextPreview({ block }: { block: ResolvedPortalBlock }): JSX.Element {
    const html = typeof block.config.html === 'string' ? block.config.html : '';
    const variant = (block.config.variant as string) ?? 'card';
    const inner = (
        <div className="imcrm-text-sm imcrm-text-foreground imcrm-leading-relaxed">
            {html === '' ? (
                <span className="imcrm-italic imcrm-text-muted-foreground">
                    {__('Sin contenido. Click para escribir.')}
                </span>
            ) : (
                <div
                    className="imcrm-prose-sm imcrm-line-clamp-6"
                    dangerouslySetInnerHTML={{ __html: html }}
                />
            )}
        </div>
    );
    if (variant === 'plain') {
        return <div className="imcrm-h-full imcrm-p-3">{inner}</div>;
    }
    return (
        <div className="imcrm-h-full imcrm-rounded-md imcrm-border imcrm-border-border imcrm-bg-card imcrm-p-3">
            {inner}
        </div>
    );
}

// ─── client_data ──────────────────────────────────────────────────────

function ClientDataPreview({
    block,
    fields,
}: {
    block: ResolvedPortalBlock;
    fields: FieldEntity[];
}): JSX.Element {
    const slugs = Array.isArray(block.config.visible_field_slugs)
        ? (block.config.visible_field_slugs as string[])
        : [];
    const title = (block.config.title as string) || '';
    const variant = (block.config.variant as string) ?? 'definition_list';

    if (slugs.length === 0) {
        return <EmptyCard title={title || __('Datos del cliente')} icon={User} />;
    }

    const bySlug = new Map(fields.map((f) => [f.slug, f]));
    const items = slugs.slice(0, 6).map((slug) => ({
        slug,
        label: bySlug.get(slug)?.label ?? slug,
        sample: sampleValueFor(bySlug.get(slug)),
    }));

    return (
        <Card title={title || __('Datos del cliente')} icon={User}>
            {variant === 'cards' ? (
                <div className="imcrm-grid imcrm-grid-cols-2 imcrm-gap-2">
                    {items.map((it) => (
                        <div
                            key={it.slug}
                            className="imcrm-rounded imcrm-border imcrm-border-border imcrm-bg-muted/20 imcrm-p-2"
                        >
                            <p className="imcrm-text-[10px] imcrm-font-medium imcrm-uppercase imcrm-tracking-wider imcrm-text-muted-foreground">
                                {it.label}
                            </p>
                            <p className="imcrm-text-xs imcrm-text-foreground imcrm-truncate">
                                {it.sample}
                            </p>
                        </div>
                    ))}
                </div>
            ) : (
                <dl className="imcrm-grid imcrm-grid-cols-[minmax(100px,max-content)_1fr] imcrm-gap-x-3 imcrm-gap-y-1.5">
                    {items.map((it) => (
                        <div key={it.slug} className="imcrm-contents">
                            <dt className="imcrm-text-[10px] imcrm-font-medium imcrm-uppercase imcrm-tracking-wider imcrm-text-muted-foreground">
                                {it.label}
                            </dt>
                            <dd className="imcrm-truncate imcrm-text-xs imcrm-text-foreground">
                                {it.sample}
                            </dd>
                        </div>
                    ))}
                </dl>
            )}
            {slugs.length > 6 && (
                <p className="imcrm-mt-1 imcrm-text-[10px] imcrm-text-muted-foreground">
                    +{slugs.length - 6} {__('más')}
                </p>
            )}
        </Card>
    );
}

// ─── related_records_table ────────────────────────────────────────────

function RelatedRecordsPreview({ block }: { block: ResolvedPortalBlock }): JSX.Element {
    const listSlug = (block.config.list_slug as string) || '';
    const cols = Array.isArray(block.config.visible_field_slugs)
        ? (block.config.visible_field_slugs as string[])
        : [];
    const title = (block.config.title as string) || __('Registros relacionados');

    if (listSlug === '') {
        return <EmptyCard title={title} icon={Calendar} hint={__('Elegí una lista relacionada.')} />;
    }
    if (cols.length === 0) {
        return <EmptyCard title={title} icon={Calendar} hint={__('Sin columnas configuradas.')} />;
    }
    return (
        <Card title={title} icon={Calendar}>
            <div className="imcrm-overflow-hidden imcrm-rounded imcrm-border imcrm-border-border">
                <table className="imcrm-w-full imcrm-text-xs">
                    <thead className="imcrm-bg-muted/30">
                        <tr>
                            {cols.slice(0, 4).map((c) => (
                                <th
                                    key={c}
                                    className="imcrm-px-2 imcrm-py-1 imcrm-text-left imcrm-text-[10px] imcrm-font-medium imcrm-uppercase imcrm-tracking-wider imcrm-text-muted-foreground"
                                >
                                    {c}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {[0, 1, 2].map((row) => (
                            <tr key={row} className="imcrm-border-t imcrm-border-border">
                                {cols.slice(0, 4).map((c, i) => (
                                    <td key={c} className="imcrm-px-2 imcrm-py-1 imcrm-text-foreground">
                                        <span className="imcrm-inline-block imcrm-h-2 imcrm-w-12 imcrm-rounded imcrm-bg-muted" style={{ width: `${50 + ((i + row) % 3) * 20}px` }} />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}

// ─── editable_form ────────────────────────────────────────────────────

function EditableFormPreview({
    block,
    fields,
}: {
    block: ResolvedPortalBlock;
    fields: FieldEntity[];
}): JSX.Element {
    const slugs = Array.isArray(block.config.editable_field_slugs)
        ? (block.config.editable_field_slugs as string[])
        : [];
    const submitLabel = (block.config.submit_label as string) || 'Guardar';
    const title = (block.config.title as string) || __('Mis datos');

    if (slugs.length === 0) {
        return <EmptyCard title={title} icon={Mail} hint={__('Agregá campos editables.')} />;
    }
    const bySlug = new Map(fields.map((f) => [f.slug, f]));
    return (
        <Card title={title} icon={Mail}>
            <div className="imcrm-flex imcrm-flex-col imcrm-gap-2">
                {slugs.slice(0, 4).map((slug) => {
                    const f = bySlug.get(slug);
                    return (
                        <div key={slug} className="imcrm-flex imcrm-flex-col imcrm-gap-0.5">
                            <label className="imcrm-text-[10px] imcrm-font-medium imcrm-uppercase imcrm-tracking-wider imcrm-text-muted-foreground">
                                {f?.label ?? slug}
                            </label>
                            <div className="imcrm-h-6 imcrm-rounded imcrm-border imcrm-border-input imcrm-bg-background imcrm-px-2 imcrm-text-xs imcrm-text-muted-foreground/60 imcrm-flex imcrm-items-center">
                                {f?.type === 'long_text' ? '...' : '— '}
                            </div>
                        </div>
                    );
                })}
                <div className="imcrm-mt-1 imcrm-inline-flex imcrm-self-start imcrm-rounded imcrm-bg-primary imcrm-px-3 imcrm-py-1 imcrm-text-xs imcrm-font-medium imcrm-text-primary-foreground">
                    {submitLabel}
                </div>
            </div>
        </Card>
    );
}

// ─── external_link ────────────────────────────────────────────────────

function ExternalLinkPreview({ block }: { block: ResolvedPortalBlock }): JSX.Element {
    const label = (block.config.label as string) || __('Abrir');
    const title = (block.config.title as string) || '';
    const description = (block.config.description as string) || '';
    const href = (block.config.href as string) || '';
    const variant = (block.config.variant as string) ?? 'button';
    const accent = (block.config.accent_color as string | null) ?? null;

    if (variant === 'card_cta') {
        return (
            <div
                className="imcrm-flex imcrm-h-full imcrm-flex-col imcrm-gap-1 imcrm-rounded-md imcrm-border imcrm-border-border imcrm-bg-card imcrm-p-3"
                style={accent ? { borderLeftColor: accent, borderLeftWidth: 3 } : undefined}
            >
                <ExternalLinkIcon className="imcrm-h-4 imcrm-w-4 imcrm-text-muted-foreground" />
                <p className="imcrm-text-sm imcrm-font-semibold imcrm-text-foreground">
                    {title || label}
                </p>
                {description && (
                    <p className="imcrm-text-xs imcrm-text-muted-foreground imcrm-line-clamp-2">
                        {description}
                    </p>
                )}
                {href && (
                    <p className="imcrm-mt-auto imcrm-truncate imcrm-text-[10px] imcrm-text-muted-foreground">
                        {href}
                    </p>
                )}
            </div>
        );
    }
    return (
        <div className="imcrm-flex imcrm-h-full imcrm-items-center imcrm-justify-center imcrm-rounded-md imcrm-border imcrm-border-border imcrm-bg-card imcrm-p-3">
            <button
                type="button"
                className="imcrm-inline-flex imcrm-items-center imcrm-gap-1.5 imcrm-rounded imcrm-px-3 imcrm-py-1.5 imcrm-text-sm imcrm-font-medium imcrm-text-primary-foreground"
                style={{ background: accent ?? 'hsl(var(--imcrm-primary))' }}
            >
                <ExternalLinkIcon className="imcrm-h-3.5 imcrm-w-3.5" />
                {label}
            </button>
        </div>
    );
}

// ─── kpi_widget ───────────────────────────────────────────────────────

function KpiPreview({
    block,
}: {
    block: ResolvedPortalBlock;
    fields: FieldEntity[];
}): JSX.Element {
    const listSlug = (block.config.list_slug as string) || '';
    const metric = (block.config.metric as string) || 'count';
    const title = (block.config.title as string) || '';
    const prefix = (block.config.prefix as string) || '';
    const suffix = (block.config.suffix as string) || '';
    const accent = (block.config.accent_color as string | null) ?? null;
    const variant = (block.config.variant as string) ?? 'card';

    if (listSlug === '') {
        return (
            <div className="imcrm-flex imcrm-h-full imcrm-flex-col imcrm-items-center imcrm-justify-center imcrm-rounded-md imcrm-border imcrm-border-dashed imcrm-border-border imcrm-bg-muted/10 imcrm-p-3">
                <p className="imcrm-text-xs imcrm-italic imcrm-text-muted-foreground">
                    {__('Configurá una lista a agregar.')}
                </p>
            </div>
        );
    }

    const displayLabel = title || `${labelForMetric(metric)} ${listSlug}`;
    const sampleNumber = metric === 'count' ? '42' : '1.234';
    const sampleValue = `${prefix}${sampleNumber}${suffix ? ' ' + suffix : ''}`;
    const valueColor = accent ?? 'hsl(var(--imcrm-primary))';

    if (variant === 'inline') {
        return (
            <div className="imcrm-flex imcrm-h-full imcrm-items-center imcrm-gap-3 imcrm-rounded-md imcrm-border imcrm-border-border imcrm-bg-card imcrm-px-3 imcrm-py-2">
                <p className="imcrm-text-[10px] imcrm-font-medium imcrm-uppercase imcrm-tracking-wider imcrm-text-muted-foreground">
                    {displayLabel}
                </p>
                <p
                    className="imcrm-ml-auto imcrm-text-lg imcrm-font-semibold imcrm-tabular-nums"
                    style={{ color: valueColor }}
                >
                    {sampleValue}
                </p>
            </div>
        );
    }
    return (
        <div className="imcrm-flex imcrm-h-full imcrm-flex-col imcrm-justify-center imcrm-rounded-md imcrm-border imcrm-border-border imcrm-bg-card imcrm-p-3">
            <p className="imcrm-text-[10px] imcrm-font-medium imcrm-uppercase imcrm-tracking-wider imcrm-text-muted-foreground">
                {displayLabel}
            </p>
            <p
                className="imcrm-text-2xl imcrm-font-semibold imcrm-tabular-nums imcrm-leading-tight"
                style={{ color: valueColor }}
            >
                {sampleValue}
            </p>
        </div>
    );
}

// ─── activity_timeline ────────────────────────────────────────────────

function ActivityTimelinePreview({ block }: { block: ResolvedPortalBlock }): JSX.Element {
    const title = (block.config.title as string) || __('Actividad reciente');
    return (
        <Card title={title} icon={Activity}>
            <ul className="imcrm-flex imcrm-flex-col imcrm-gap-1.5 imcrm-border-l-2 imcrm-border-border imcrm-pl-3">
                {[0, 1, 2].map((i) => (
                    <li key={i} className="imcrm-relative">
                        <span className="imcrm-absolute imcrm--left-[15px] imcrm-top-1.5 imcrm-h-2 imcrm-w-2 imcrm-rounded-full imcrm-bg-primary" />
                        <p className="imcrm-text-xs imcrm-text-foreground">
                            <span className="imcrm-inline-block imcrm-h-2 imcrm-rounded imcrm-bg-muted" style={{ width: `${80 + i * 20}px` }} />
                        </p>
                        <p className="imcrm-text-[10px] imcrm-text-muted-foreground">
                            {i === 0 ? __('hace 2 horas') : i === 1 ? __('ayer') : __('hace 3 días')}
                        </p>
                    </li>
                ))}
            </ul>
        </Card>
    );
}

// ─── download_files ───────────────────────────────────────────────────

function DownloadFilesPreview({
    block,
    fields,
}: {
    block: ResolvedPortalBlock;
    fields: FieldEntity[];
}): JSX.Element {
    const fieldSlug = (block.config.field_slug as string) || '';
    const title = (block.config.title as string) || __('Archivos');
    const variant = (block.config.variant as string) ?? 'list';

    if (fieldSlug === '') {
        return <EmptyCard title={title} icon={Download} hint={__('Elegí un campo tipo archivo.')} />;
    }
    const field = fields.find((f) => f.slug === fieldSlug);
    const fileName = field?.label ?? fieldSlug;
    // Mock de 3 archivos para el preview
    const items = ['enero', 'febrero', 'marzo'];

    if (variant === 'grid') {
        return (
            <Card title={title} icon={Download}>
                <div className="imcrm-grid imcrm-grid-cols-3 imcrm-gap-1.5">
                    {items.map((mes) => (
                        <div
                            key={mes}
                            className="imcrm-flex imcrm-flex-col imcrm-items-center imcrm-gap-1 imcrm-rounded imcrm-border imcrm-border-border imcrm-bg-muted/20 imcrm-p-2"
                        >
                            <ImageIcon className="imcrm-h-4 imcrm-w-4 imcrm-text-muted-foreground" />
                            <p className="imcrm-truncate imcrm-text-[10px] imcrm-text-muted-foreground">
                                {fileName}-{mes}.pdf
                            </p>
                        </div>
                    ))}
                </div>
            </Card>
        );
    }
    return (
        <Card title={title} icon={Download}>
            <ul className="imcrm-flex imcrm-flex-col imcrm-gap-1">
                {items.map((mes) => (
                    <li
                        key={mes}
                        className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-rounded imcrm-border imcrm-border-border imcrm-bg-card imcrm-px-2 imcrm-py-1.5"
                    >
                        <File className="imcrm-h-3 imcrm-w-3 imcrm-text-muted-foreground" />
                        <span className="imcrm-flex-1 imcrm-truncate imcrm-text-xs imcrm-text-foreground">
                            {fileName}-{mes}.pdf
                        </span>
                        <Download className="imcrm-h-3 imcrm-w-3 imcrm-text-muted-foreground" />
                    </li>
                ))}
            </ul>
        </Card>
    );
}

// ─── comments_thread ──────────────────────────────────────────────────

function CommentsThreadPreview({ block }: { block: ResolvedPortalBlock }): JSX.Element {
    const title = (block.config.title as string) || __('Comentarios');
    return (
        <Card title={title} icon={MessageSquare}>
            <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                {[0, 1].map((i) => (
                    <div
                        key={i}
                        className="imcrm-rounded imcrm-border imcrm-border-border imcrm-bg-muted/20 imcrm-px-2 imcrm-py-1.5"
                    >
                        <p className="imcrm-text-[10px] imcrm-font-medium imcrm-text-foreground">
                            {i === 0 ? 'Operador' : 'Cliente'}
                        </p>
                        <p className="imcrm-text-xs imcrm-text-muted-foreground">
                            <span
                                className="imcrm-inline-block imcrm-h-2 imcrm-rounded imcrm-bg-muted/60"
                                style={{ width: `${100 + i * 30}px` }}
                            />
                        </p>
                    </div>
                ))}
                <div className="imcrm-mt-1 imcrm-rounded imcrm-border imcrm-border-dashed imcrm-border-border imcrm-bg-background imcrm-px-2 imcrm-py-1 imcrm-text-[10px] imcrm-italic imcrm-text-muted-foreground">
                    {__('Escribir mensaje…')}
                </div>
            </div>
        </Card>
    );
}

// ─── Helpers visuales compartidos ─────────────────────────────────────

function Card({
    title,
    icon: Icon,
    children,
}: {
    title: string;
    icon: typeof User;
    children: React.ReactNode;
}): JSX.Element {
    return (
        <div className="imcrm-flex imcrm-h-full imcrm-flex-col imcrm-overflow-hidden imcrm-rounded-md imcrm-border imcrm-border-border imcrm-bg-card">
            <header className="imcrm-flex imcrm-items-center imcrm-gap-1.5 imcrm-border-b imcrm-border-border imcrm-bg-muted/20 imcrm-px-3 imcrm-py-1.5">
                <Icon className="imcrm-h-3 imcrm-w-3 imcrm-text-muted-foreground" />
                <span className="imcrm-text-[10px] imcrm-font-semibold imcrm-uppercase imcrm-tracking-wider imcrm-text-muted-foreground">
                    {title}
                </span>
            </header>
            <div className="imcrm-min-w-0 imcrm-flex-1 imcrm-overflow-hidden imcrm-p-2">
                {children}
            </div>
        </div>
    );
}

function EmptyCard({
    title,
    icon: Icon,
    hint,
}: {
    title: string;
    icon: typeof User;
    hint?: string;
}): JSX.Element {
    return (
        <div className="imcrm-flex imcrm-h-full imcrm-flex-col imcrm-overflow-hidden imcrm-rounded-md imcrm-border imcrm-border-dashed imcrm-border-border imcrm-bg-muted/10">
            <header className="imcrm-flex imcrm-items-center imcrm-gap-1.5 imcrm-px-3 imcrm-py-1.5">
                <Icon className="imcrm-h-3 imcrm-w-3 imcrm-text-muted-foreground" />
                <span className="imcrm-text-[10px] imcrm-font-semibold imcrm-uppercase imcrm-tracking-wider imcrm-text-muted-foreground">
                    {title}
                </span>
            </header>
            <div className="imcrm-flex imcrm-flex-1 imcrm-items-center imcrm-justify-center imcrm-px-3 imcrm-pb-2">
                <p className="imcrm-text-center imcrm-text-[11px] imcrm-italic imcrm-text-muted-foreground/70">
                    {hint ?? __('Click para configurar.')}
                </p>
            </div>
        </div>
    );
}

function sampleValueFor(f?: FieldEntity): string {
    if (! f) return '—';
    switch (f.type) {
        case 'email':       return 'juan@ejemplo.com';
        case 'url':         return 'https://ejemplo.com';
        case 'currency':    return '$1.234.567';
        case 'number':      return '42';
        case 'date':        return '15/06/2026';
        case 'datetime':    return '15/06/2026 14:30';
        case 'checkbox':    return '✓ Sí';
        case 'select':      return 'Activo';
        case 'multi_select': return 'A, B';
        default:            return 'Ejemplo';
    }
}

function labelForMetric(metric: string): string {
    switch (metric) {
        case 'sum':   return __('Suma');
        case 'avg':   return __('Promedio');
        case 'min':   return __('Mínimo');
        case 'max':   return __('Máximo');
        default:      return __('Total');
    }
}
