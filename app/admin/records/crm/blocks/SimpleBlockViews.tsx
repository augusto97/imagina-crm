import { useMemo, useState } from 'react';
import {
    Check,
    Copy,
    ExternalLink,
    File as FileIcon,
    FileText,
    Image as ImageIcon,
    Mail,
    Paperclip,
    Phone,
    Play,
    StickyNote,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { __ } from '@/lib/i18n';
import type { ResolvedV2Block } from '@/lib/crmTemplates';
import type { FieldEntity } from '@/types/field';
import type { RecordEntity } from '@/types/record';

// ============================================================================
// FilesBlockView
// ============================================================================

interface FilesBlockViewProps {
    block: Extract<ResolvedV2Block, { type: 'files' }>;
    record: RecordEntity;
}

export function FilesBlockView({ block, record }: FilesBlockViewProps): JSX.Element {
    const { fileFields, title } = block.config;

    const items = useMemo(() => {
        const out: Array<{ field: FieldEntity; attachmentId: number }> = [];
        for (const f of fileFields) {
            const v = record.fields[f.slug];
            const id = typeof v === 'number' ? v : Number(v ?? 0);
            if (id > 0) out.push({ field: f, attachmentId: id });
        }
        return out;
    }, [fileFields, record]);

    return (
        <Card title={title ?? __('Archivos')} icon={Paperclip}>
            {fileFields.length === 0 ? (
                <Empty>{__('No hay file fields. Editá el bloque para configurar.')}</Empty>
            ) : items.length === 0 ? (
                <Empty>{__('Sin archivos vinculados a este registro.')}</Empty>
            ) : (
                <ul className="imcrm-grid imcrm-grid-cols-2 imcrm-gap-2">
                    {items.map(({ field, attachmentId }) => (
                        <FileItem key={field.id} field={field} attachmentId={attachmentId} />
                    ))}
                </ul>
            )}
        </Card>
    );
}

function FileItem({
    field,
    attachmentId,
}: {
    field: FieldEntity;
    attachmentId: number;
}): JSX.Element {
    // Resolución vía REST de WP. Cargamos el thumbnail + filename.
    // Sin un hook específico, el endpoint nativo de WP es
    // `/wp/v2/media/<id>` — autenticado vía nonce ya configurado.
    const [data, setData] = useState<{ url?: string; thumb?: string; title?: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useMemo(() => {
        let cancelled = false;
        setLoading(true);
        const root = (window as { wpApiSettings?: { root: string; nonce: string } }).wpApiSettings;
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (root?.nonce) headers['X-WP-Nonce'] = root.nonce;
        const base = root?.root ?? '/wp-json/';
        fetch(`${base}wp/v2/media/${attachmentId}`, { headers, credentials: 'same-origin' })
            .then((r) => r.ok ? r.json() : Promise.reject(new Error('not ok')))
            .then((json: {
                source_url?: string;
                title?: { rendered?: string };
                media_details?: { sizes?: { thumbnail?: { source_url?: string } } };
            }) => {
                if (cancelled) return;
                setData({
                    url: json.source_url,
                    thumb: json.media_details?.sizes?.thumbnail?.source_url,
                    title: json.title?.rendered ?? `#${attachmentId}`,
                });
                setLoading(false);
            })
            .catch(() => {
                if (cancelled) return;
                setError(true);
                setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [attachmentId]);

    return (
        <li className="imcrm-overflow-hidden imcrm-rounded-md imcrm-border imcrm-border-border imcrm-bg-muted/20">
            <a
                href={data?.url ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="imcrm-flex imcrm-flex-col imcrm-gap-1 imcrm-p-2 imcrm-transition-colors hover:imcrm-bg-accent/40"
            >
                <div className="imcrm-flex imcrm-h-16 imcrm-items-center imcrm-justify-center imcrm-rounded imcrm-bg-card">
                    {loading ? (
                        <span className="imcrm-h-4 imcrm-w-4 imcrm-animate-pulse imcrm-rounded imcrm-bg-muted" />
                    ) : error ? (
                        <FileIcon className="imcrm-h-6 imcrm-w-6 imcrm-text-muted-foreground" aria-hidden />
                    ) : data?.thumb ? (
                        <img
                            src={data.thumb}
                            alt={data.title ?? ''}
                            className="imcrm-h-full imcrm-w-full imcrm-object-cover"
                        />
                    ) : (
                        <FileText className="imcrm-h-6 imcrm-w-6 imcrm-text-muted-foreground" aria-hidden />
                    )}
                </div>
                <span className="imcrm-text-[10px] imcrm-text-muted-foreground">
                    {field.label}
                </span>
                <span className="imcrm-truncate imcrm-text-xs imcrm-font-medium">
                    {data?.title ?? `#${attachmentId}`}
                </span>
            </a>
        </li>
    );
}

// ============================================================================
// EmbedBlockView
// ============================================================================

interface EmbedBlockViewProps {
    block: Extract<ResolvedV2Block, { type: 'embed' }>;
    record: RecordEntity;
}

const EMBED_ALLOWLIST = [
    /^https:\/\/(www\.)?youtube\.com\/embed\//,
    /^https:\/\/(www\.)?youtube-nocookie\.com\/embed\//,
    /^https:\/\/player\.vimeo\.com\/video\//,
    /^https:\/\/www\.google\.com\/maps\//,
    /^https:\/\/maps\.google\.com\//,
    /^https:\/\/(www\.)?loom\.com\/embed\//,
    /^https:\/\/(www\.)?figma\.com\/embed/,
    /^https:\/\/calendly\.com\//,
];

export function EmbedBlockView({ block, record }: EmbedBlockViewProps): JSX.Element {
    const { source, url, fieldSlug, title } = block.config;

    let resolvedUrl = '';
    if (source === 'literal' && url) {
        resolvedUrl = url.trim();
    } else if (source === 'field' && fieldSlug) {
        const v = record.fields[fieldSlug];
        if (typeof v === 'string') resolvedUrl = v.trim();
    }

    const allowed = EMBED_ALLOWLIST.some((re) => re.test(resolvedUrl));

    return (
        <Card title={title ?? __('Embed')} icon={Play}>
            {! resolvedUrl ? (
                <Empty>{__('Sin URL configurada.')}</Empty>
            ) : ! allowed ? (
                <div className="imcrm-flex imcrm-flex-col imcrm-gap-2 imcrm-text-xs">
                    <p className="imcrm-text-warning">
                        {__('URL no permitida en embed (solo YouTube, Vimeo, Google Maps, Loom, Figma, Calendly).')}
                    </p>
                    <a
                        href={resolvedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="imcrm-truncate imcrm-text-primary hover:imcrm-underline"
                    >
                        {resolvedUrl}
                    </a>
                </div>
            ) : (
                <div className="imcrm-h-full imcrm-w-full imcrm-overflow-hidden imcrm-rounded">
                    <iframe
                        src={resolvedUrl}
                        title={title ?? __('Embed')}
                        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                        loading="lazy"
                        className="imcrm-h-full imcrm-w-full imcrm-border-0"
                    />
                </div>
            )}
        </Card>
    );
}

// ============================================================================
// ActionButtonView
// ============================================================================

interface ActionButtonViewProps {
    block: Extract<ResolvedV2Block, { type: 'action_button' }>;
}

export function ActionButtonView({ block }: ActionButtonViewProps): JSX.Element {
    const { label, actionType, target, variant = 'default' } = block.config;
    const toast = useToast();

    const handleClick = async (): Promise<void> => {
        if (actionType === 'copy') {
            try {
                await navigator.clipboard.writeText(target);
                toast.success(__('Copiado al portapapeles'));
            } catch {
                toast.error(__('No se pudo copiar'));
            }
        } else if (actionType === 'mailto') {
            window.location.href = `mailto:${target}`;
        } else if (actionType === 'tel') {
            window.location.href = `tel:${target.replace(/[^\d+]/g, '')}`;
        } else if (actionType === 'url') {
            const url = target.startsWith('http') ? target : `https://${target}`;
            window.open(url, '_blank', 'noopener');
        }
    };

    const Icon =
        actionType === 'mailto' ? Mail :
        actionType === 'tel' ? Phone :
        actionType === 'copy' ? Copy :
        ExternalLink;

    return (
        <section className="imcrm-flex imcrm-h-full imcrm-flex-col imcrm-items-center imcrm-justify-center imcrm-rounded-lg imcrm-border imcrm-border-border imcrm-bg-card imcrm-p-4">
            <Button
                variant={variant}
                size="lg"
                className="imcrm-gap-2"
                onClick={() => void handleClick()}
                disabled={!target}
            >
                <Icon className="imcrm-h-4 imcrm-w-4" />
                {label || __('Acción')}
            </Button>
            {!target && (
                <p className="imcrm-mt-2 imcrm-text-[11px] imcrm-text-muted-foreground">
                    {__('Configurá el target en el bloque.')}
                </p>
            )}
        </section>
    );
}

// ============================================================================
// MarkdownBlockView
// ============================================================================

interface MarkdownBlockViewProps {
    block: Extract<ResolvedV2Block, { type: 'markdown' }>;
}

export function MarkdownBlockView({ block }: MarkdownBlockViewProps): JSX.Element {
    return (
        <Card title={block.config.title || __('Notas')} icon={StickyNote}>
            <div
                className="imcrm-prose-sm imcrm-text-sm imcrm-leading-relaxed imcrm-text-foreground"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(block.config.content) }}
            />
        </Card>
    );
}

/**
 * Mini-parser de markdown ligero. Soporta:
 *  - # heading 1, ## heading 2, ### heading 3
 *  - **bold**, *italic*
 *  - `inline code`
 *  - [text](url) links (target=_blank, rel=noopener)
 *  - listas con - o * o números
 *  - párrafos separados por línea en blanco
 *  - Auto-escape de HTML para evitar XSS
 *
 * NO soporta tablas, imágenes, blockquotes, etc. Si el user quiere
 * más, puede usar el bloque embed o crear un PR para extender.
 */
function renderMarkdown(input: string): string {
    if (! input) return '';
    let text = input;
    // 1. Escape HTML primero.
    text = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // 2. Inline: code, bold, italic, links.
    text = text
        .replace(/`([^`]+)`/g, '<code class="imcrm-rounded imcrm-bg-muted imcrm-px-1 imcrm-py-0.5 imcrm-text-[12px]">$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
        .replace(
            /\[([^\]]+)\]\(([^)]+)\)/g,
            '<a href="$2" target="_blank" rel="noopener noreferrer" class="imcrm-text-primary hover:imcrm-underline">$1</a>',
        );

    // 3. Block-level: headings y listas. Procesamos línea por línea.
    const lines = text.split('\n');
    const out: string[] = [];
    let inList: 'ul' | 'ol' | null = null;

    const closeList = (): void => {
        if (inList) {
            out.push(`</${inList}>`);
            inList = null;
        }
    };

    for (const rawLine of lines) {
        const line = rawLine.trimEnd();
        if (line === '') {
            closeList();
            continue;
        }
        const h = /^(#{1,3})\s+(.*)$/.exec(line);
        if (h) {
            closeList();
            const level = h[1]!.length;
            const cls = level === 1
                ? 'imcrm-text-base imcrm-font-bold imcrm-mb-1'
                : level === 2
                    ? 'imcrm-text-sm imcrm-font-semibold imcrm-mb-1'
                    : 'imcrm-text-xs imcrm-font-semibold imcrm-mb-0.5 imcrm-uppercase imcrm-tracking-wide';
            out.push(`<h${level} class="${cls}">${h[2]}</h${level}>`);
            continue;
        }
        const ulMatch = /^[-*]\s+(.*)$/.exec(line);
        if (ulMatch) {
            if (inList !== 'ul') {
                closeList();
                out.push('<ul class="imcrm-ml-4 imcrm-list-disc imcrm-flex imcrm-flex-col imcrm-gap-0.5">');
                inList = 'ul';
            }
            out.push(`<li>${ulMatch[1]}</li>`);
            continue;
        }
        const olMatch = /^\d+\.\s+(.*)$/.exec(line);
        if (olMatch) {
            if (inList !== 'ol') {
                closeList();
                out.push('<ol class="imcrm-ml-4 imcrm-list-decimal imcrm-flex imcrm-flex-col imcrm-gap-0.5">');
                inList = 'ol';
            }
            out.push(`<li>${olMatch[1]}</li>`);
            continue;
        }
        // Párrafo normal.
        closeList();
        out.push(`<p>${line}</p>`);
    }
    closeList();
    return out.join('\n');
}

// ============================================================================
// Shared helpers
// ============================================================================

function Card({
    title,
    icon: Icon,
    children,
}: {
    title: string;
    icon: typeof FileIcon;
    children: React.ReactNode;
}): JSX.Element {
    return (
        <section className="imcrm-flex imcrm-h-full imcrm-flex-col imcrm-overflow-hidden imcrm-rounded-lg imcrm-border imcrm-border-border imcrm-bg-card imcrm-p-4">
            <header className="imcrm-mb-3 imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-text-sm imcrm-font-semibold">
                <Icon className="imcrm-h-3.5 imcrm-w-3.5 imcrm-text-muted-foreground" aria-hidden />
                {title}
            </header>
            <div className="imcrm-flex-1 imcrm-overflow-y-auto">{children}</div>
        </section>
    );
}

function Empty({ children }: { children: React.ReactNode }): JSX.Element {
    return <p className="imcrm-text-xs imcrm-text-muted-foreground">{children}</p>;
}

// Force usage to satisfy linter if some icons aren't reached.
void ImageIcon;
void Check;
