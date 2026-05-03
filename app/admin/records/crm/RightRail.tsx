import { Link } from 'react-router-dom';
import {
    Activity as ActivityIcon,
    BarChart3,
    Calendar,
    Database,
    ExternalLink,
    Loader2,
    MessageSquare,
    Network,
} from 'lucide-react';

import { useRecordActivity } from '@/hooks/useActivity';
import { useComments } from '@/hooks/useComments';
import { useList } from '@/hooks/useLists';
import { useRecords } from '@/hooks/useRecords';
import { __, sprintf } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { ResolvedLayout, RightRailBlock } from '@/lib/crmTemplates';
import type { FieldEntity } from '@/types/field';
import type { RecordEntity } from '@/types/record';

interface RightRailProps {
    listId: number;
    record: RecordEntity;
    layout: ResolvedLayout;
}

/**
 * Right rail del layout CRM panel. Renderea bloques declarados por la
 * plantilla activa. Tipos soportados (0.33.0):
 *
 *   - **stats**: días desde creación / última edición, # comentarios,
 *     # cambios. Computado client-side de data ya cargada.
 *   - **related**: 1 card por relation field con la lista de records
 *     vinculados, cada uno linkeable a su propia ficha.
 *
 * Si `layout.rightRail` está vacío, devuelve null y el grid del
 * `RecordCrmLayout` colapsa a 2 columnas (sidebar + timeline).
 */
export function RightRail({ listId, record, layout }: RightRailProps): JSX.Element | null {
    if (layout.rightRail.length === 0) return null;

    return (
        <aside className="imcrm-flex imcrm-flex-col imcrm-gap-3">
            {layout.rightRail.map((block) => (
                <Block key={block.id} block={block} listId={listId} record={record} />
            ))}
        </aside>
    );
}

function Block({
    block,
    listId,
    record,
}: {
    block: RightRailBlock;
    listId: number;
    record: RecordEntity;
}): JSX.Element {
    if (block.kind === 'stats') {
        return <StatsBlock listId={listId} record={record} />;
    }
    return <RelatedBlock field={block.field} record={record} />;
}

// --- Stats -------------------------------------------------------------------

export function StatsBlock({ listId, record }: { listId: number; record: RecordEntity }): JSX.Element {
    const comments = useComments(listId, record.id);
    const activity = useRecordActivity(listId, record.id);

    const createdMs = parseTimestamp(record.created_at);
    const updatedMs = parseTimestamp(record.updated_at);

    const daysSinceCreated = createdMs > 0 ? Math.floor((Date.now() - createdMs) / 86400000) : null;
    const daysSinceUpdated = updatedMs > 0 ? Math.floor((Date.now() - updatedMs) / 86400000) : null;

    const commentCount = comments.data?.length ?? null;
    const changeCount = activity.data
        ? activity.data.filter((a) => ! a.action.startsWith('comment.')).length
        : null;

    return (
        <Card title={__('Resumen')} icon={BarChart3}>
            <dl className="imcrm-grid imcrm-grid-cols-2 imcrm-gap-3">
                <Stat
                    label={__('Días en sistema')}
                    value={daysSinceCreated !== null ? String(daysSinceCreated) : '—'}
                    icon={Calendar}
                />
                <Stat
                    label={__('Días sin cambios')}
                    value={daysSinceUpdated !== null ? String(daysSinceUpdated) : '—'}
                    icon={Calendar}
                />
                <Stat
                    label={__('Comentarios')}
                    value={commentCount !== null ? String(commentCount) : '…'}
                    icon={MessageSquare}
                />
                <Stat
                    label={__('Cambios')}
                    value={changeCount !== null ? String(changeCount) : '…'}
                    icon={ActivityIcon}
                />
            </dl>
        </Card>
    );
}

function Stat({
    label,
    value,
    icon: Icon,
}: {
    label: string;
    value: string;
    icon: typeof Calendar;
}): JSX.Element {
    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-0.5 imcrm-rounded-md imcrm-border imcrm-border-border imcrm-bg-muted/30 imcrm-px-3 imcrm-py-2">
            <dt className="imcrm-flex imcrm-items-center imcrm-gap-1 imcrm-text-[10px] imcrm-font-medium imcrm-uppercase imcrm-tracking-wide imcrm-text-muted-foreground">
                <Icon className="imcrm-h-3 imcrm-w-3" aria-hidden />
                {label}
            </dt>
            <dd className="imcrm-text-base imcrm-font-semibold imcrm-text-foreground">{value}</dd>
        </div>
    );
}

// --- Related -----------------------------------------------------------------

export function RelatedBlock({
    field,
    record,
}: {
    field: FieldEntity;
    record: RecordEntity;
}): JSX.Element {
    const targetListId = (field.config as { target_list_id?: number }).target_list_id ?? 0;
    const ids = record.relations?.[field.slug] ?? [];

    return (
        <Card title={field.label} icon={Network}>
            <RelatedList targetListId={targetListId} ids={ids} />
        </Card>
    );
}

function RelatedList({
    targetListId,
    ids,
}: {
    targetListId: number;
    ids: number[];
}): JSX.Element {
    const targetList = useList(targetListId > 0 ? targetListId : undefined);
    const records = useRecords(
        ids.length > 0 && targetListId > 0 ? targetListId : undefined,
        { filter: { id: { in: ids.join(',') } }, per_page: ids.length || 1, page: 1 },
    );

    if (targetListId === 0) {
        return (
            <p className="imcrm-text-xs imcrm-text-muted-foreground">
                {__('Lista destino no configurada.')}
            </p>
        );
    }

    if (ids.length === 0) {
        return (
            <p className="imcrm-text-xs imcrm-text-muted-foreground">
                {__('Sin registros vinculados.')}
            </p>
        );
    }

    if (records.isLoading || targetList.isLoading) {
        return (
            <div className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-text-xs imcrm-text-muted-foreground">
                <Loader2 className="imcrm-h-3 imcrm-w-3 imcrm-animate-spin" />
                {__('Cargando…')}
            </div>
        );
    }

    const targetSlug = targetList.data?.slug ?? '';
    const recordsData = records.data?.data ?? [];
    // Map id → record para ordenar según el array original (preserva
    // el orden en que el user los relacionó, no el orden del SQL).
    const byId = new Map(recordsData.map((r) => [r.id, r]));

    return (
        <ul className="imcrm-flex imcrm-flex-col imcrm-gap-1">
            {ids.map((id) => {
                const r = byId.get(id);
                const title = r ? pickRelatedTitle(r) : sprintf(__('Registro #%d'), id);
                return (
                    <li key={id}>
                        <Link
                            to={`/lists/${targetSlug}/records/${id}`}
                            className={cn(
                                'imcrm-flex imcrm-items-center imcrm-justify-between imcrm-gap-2 imcrm-rounded-md imcrm-border imcrm-border-border imcrm-px-2.5 imcrm-py-1.5 imcrm-text-xs imcrm-transition-colors',
                                'hover:imcrm-border-primary/40 hover:imcrm-bg-primary/5',
                            )}
                        >
                            <span className="imcrm-truncate imcrm-font-medium imcrm-text-foreground">
                                {title}
                            </span>
                            <ExternalLink className="imcrm-h-3 imcrm-w-3 imcrm-shrink-0 imcrm-text-muted-foreground" aria-hidden />
                        </Link>
                    </li>
                );
            })}
        </ul>
    );
}

/**
 * Heurística para mostrar un record relacionado: el primer field
 * de tipo `text` con valor, o "Registro #id" como fallback.
 */
function pickRelatedTitle(r: RecordEntity): string {
    for (const [, v] of Object.entries(r.fields)) {
        if (typeof v === 'string' && v.trim() !== '') return v;
    }
    return sprintf(__('Registro #%d'), r.id);
}

// --- shared card -------------------------------------------------------------

function Card({
    title,
    icon: Icon,
    children,
}: {
    title: string;
    icon: typeof Database;
    children: React.ReactNode;
}): JSX.Element {
    return (
        <section className="imcrm-flex imcrm-flex-col imcrm-gap-3 imcrm-rounded-lg imcrm-border imcrm-border-border imcrm-bg-card imcrm-p-4">
            <header className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-text-sm imcrm-font-semibold">
                <Icon className="imcrm-h-3.5 imcrm-w-3.5 imcrm-text-muted-foreground" aria-hidden />
                {title}
            </header>
            {children}
        </section>
    );
}

function parseTimestamp(s: string | null): number {
    if (! s) return 0;
    return new Date(s + 'Z').getTime();
}
