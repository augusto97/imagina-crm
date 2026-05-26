import {
    Activity,
    Download,
    ExternalLink,
    FileText,
    LayoutList,
    Link,
    MessageSquare,
    PenLine,
    Table,
    TrendingUp,
    User,
} from 'lucide-react';

import { __ } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { PortalBlockType } from '@/types/portal';

import type { ResolvedPortalBlock } from './portalLayout';

interface Props {
    block: ResolvedPortalBlock;
}

/**
 * Preview compacto del bloque dentro del grid editor. Muestra icono +
 * tipo + un summary del config (qué fields se muestran, etc.) sin
 * intentar renderear datos reales — eso solo pasa en runtime con un
 * record real del cliente.
 *
 * Es similar al preview que el `BlockRenderer` del CRM editor muestra
 * pero más liviano (no requiere `sampleRecord`).
 */
export function PortalBlockPreview({ block }: Props): JSX.Element {
    const Icon = iconForType(block.type);
    return (
        <div className="imcrm-flex imcrm-h-full imcrm-flex-col imcrm-overflow-hidden imcrm-rounded-md imcrm-border imcrm-border-border imcrm-bg-card imcrm-p-3">
            <header className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-text-xs imcrm-text-muted-foreground">
                <Icon className="imcrm-h-3.5 imcrm-w-3.5" aria-hidden />
                <span className="imcrm-font-medium imcrm-uppercase imcrm-tracking-wider">
                    {labelForType(block.type)}
                </span>
            </header>
            <div className="imcrm-mt-2 imcrm-min-w-0 imcrm-flex-1 imcrm-overflow-hidden">
                <Summary block={block} />
            </div>
        </div>
    );
}

function iconForType(type: PortalBlockType) {
    switch (type) {
        case 'static_text':           return FileText;
        case 'client_data':           return User;
        case 'related_records_table': return Table;
        case 'editable_form':         return PenLine;
        case 'external_link':         return ExternalLink;
        case 'kpi_widget':            return TrendingUp;
        case 'activity_timeline':     return Activity;
        case 'download_files':        return Download;
        case 'comments_thread':       return MessageSquare;
        default:                      return LayoutList;
    }
}

function labelForType(type: PortalBlockType): string {
    switch (type) {
        case 'static_text':           return __('Texto');
        case 'client_data':           return __('Datos del cliente');
        case 'related_records_table': return __('Tabla relacionada');
        case 'editable_form':         return __('Formulario');
        case 'external_link':         return __('Enlace externo');
        case 'kpi_widget':            return __('KPI');
        case 'activity_timeline':     return __('Timeline');
        case 'download_files':        return __('Descargas');
        case 'comments_thread':       return __('Comentarios');
    }
}

function Summary({ block }: { block: ResolvedPortalBlock }): JSX.Element {
    const cfg = block.config;
    switch (block.type) {
        case 'static_text': {
            const content = typeof cfg.content === 'string' ? cfg.content : '';
            if (content === '') return <Hint>{__('Sin contenido. Click para editar.')}</Hint>;
            const preview = content.slice(0, 120);
            return (
                <p className="imcrm-line-clamp-3 imcrm-text-sm imcrm-text-foreground imcrm-whitespace-pre-wrap">
                    {preview}
                </p>
            );
        }
        case 'client_data': {
            const slugs = Array.isArray(cfg.visible_field_slugs) ? cfg.visible_field_slugs : [];
            if (slugs.length === 0) return <Hint>{__('Sin campos. Click para configurar.')}</Hint>;
            return (
                <Chips items={slugs.map(String)} />
            );
        }
        case 'related_records_table': {
            const rel = typeof cfg.relation_field_slug === 'string' ? cfg.relation_field_slug : '';
            const cols = Array.isArray(cfg.visible_field_slugs) ? cfg.visible_field_slugs : [];
            if (rel === '') return <Hint>{__('Sin relation field configurado.')}</Hint>;
            return (
                <div className="imcrm-flex imcrm-flex-col imcrm-gap-1">
                    <p className="imcrm-text-xs">
                        <span className="imcrm-text-muted-foreground">{__('Relación:')}</span>{' '}
                        <span className="imcrm-font-medium">{rel}</span>
                    </p>
                    <Chips items={cols.map(String)} />
                </div>
            );
        }
        case 'editable_form': {
            const slugs = Array.isArray(cfg.editable_field_slugs) ? cfg.editable_field_slugs : [];
            if (slugs.length === 0) return <Hint>{__('Sin campos editables.')}</Hint>;
            return <Chips items={slugs.map(String)} />;
        }
        case 'external_link': {
            const label = typeof cfg.label === 'string' ? cfg.label : '';
            const url = typeof cfg.url === 'string' ? cfg.url : '';
            return (
                <div className="imcrm-flex imcrm-items-center imcrm-gap-1.5 imcrm-text-xs">
                    <Link className="imcrm-h-3 imcrm-w-3 imcrm-text-muted-foreground" />
                    <span className="imcrm-truncate imcrm-font-medium">{label || __('Sin label')}</span>
                    {url && (
                        <span className="imcrm-truncate imcrm-text-muted-foreground">{url}</span>
                    )}
                </div>
            );
        }
        case 'kpi_widget': {
            const slug = typeof cfg.field_slug === 'string' ? cfg.field_slug : '';
            const label = typeof cfg.label === 'string' ? cfg.label : '';
            if (slug === '') return <Hint>{__('Sin campo configurado.')}</Hint>;
            return (
                <div className="imcrm-flex imcrm-flex-col">
                    <span className="imcrm-text-[10px] imcrm-uppercase imcrm-tracking-wider imcrm-text-muted-foreground">
                        {label || slug}
                    </span>
                    <span className="imcrm-text-2xl imcrm-font-semibold imcrm-text-primary">
                        ###
                    </span>
                </div>
            );
        }
        case 'activity_timeline': {
            const max = typeof cfg.max_items === 'number' ? cfg.max_items : 10;
            return (
                <p className="imcrm-text-xs imcrm-text-muted-foreground">
                    {__('Últimas')} {max} {__('actividades')}
                </p>
            );
        }
        case 'download_files': {
            const slugs = Array.isArray(cfg.file_field_slugs) ? cfg.file_field_slugs : [];
            if (slugs.length === 0) {
                return <Hint>{__('Sin file fields configurados.')}</Hint>;
            }
            return <Chips items={slugs.map(String)} />;
        }
        case 'comments_thread': {
            const title = typeof cfg.title === 'string' ? cfg.title : '';
            return (
                <p className="imcrm-text-xs imcrm-text-muted-foreground">
                    {title || __('Comentarios')}
                </p>
            );
        }
    }
}

function Hint({ children }: { children: React.ReactNode }): JSX.Element {
    return (
        <p className="imcrm-text-xs imcrm-italic imcrm-text-muted-foreground/70">
            {children}
        </p>
    );
}

function Chips({ items }: { items: string[] }): JSX.Element {
    if (items.length === 0) return <Hint>—</Hint>;
    return (
        <div className={cn('imcrm-flex imcrm-flex-wrap imcrm-gap-1')}>
            {items.slice(0, 6).map((s) => (
                <span
                    key={s}
                    className="imcrm-inline-flex imcrm-items-center imcrm-rounded imcrm-bg-muted imcrm-px-1.5 imcrm-py-0.5 imcrm-text-[10px] imcrm-text-muted-foreground"
                >
                    {s}
                </span>
            ))}
            {items.length > 6 && (
                <span className="imcrm-text-[10px] imcrm-text-muted-foreground">
                    +{items.length - 6}
                </span>
            )}
        </div>
    );
}
