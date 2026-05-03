import { useState } from 'react';
import { ChevronDown, ChevronRight, StickyNote } from 'lucide-react';

import { RecordFieldsForm } from '@/admin/records/RecordFieldsForm';
import { __ } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { ResolvedV2Block } from '@/lib/crmTemplates';

import { ChartBlockView } from './blocks/ChartBlockView';
import { KpiBlockView } from './blocks/KpiBlockView';
import {
    ActionButtonView,
    EmbedBlockView,
    FilesBlockView,
    MarkdownBlockView,
} from './blocks/SimpleBlockViews';
import { RecordTimeline } from './RecordTimeline';
import { RelatedBlock as RelatedBlockView, StatsBlock as StatsBlockView } from './RightRail';

export interface BlockRendererProps {
    block: ResolvedV2Block;
    listId: number;
    recordId: number;
    currentUserId: number;
    isAdmin: boolean;
    values: Record<string, unknown>;
    onChange: (values: Record<string, unknown>) => void;
    fieldErrors?: Record<string, string>;
    record: import('@/types/record').RecordEntity;
}

/**
 * Renderea un bloque V2 según su tipo. Usado tanto por el
 * `RecordCrmLayout` (modo static, en la ficha real) como por la
 * preview del editor visual.
 */
export function BlockRenderer({
    block,
    listId,
    recordId,
    currentUserId,
    isAdmin,
    values,
    onChange,
    fieldErrors,
    record,
}: BlockRendererProps): JSX.Element | null {
    if (block.type === 'properties_group') {
        return <PropertiesGroupView block={block} values={values} onChange={onChange} fieldErrors={fieldErrors} />;
    }
    if (block.type === 'timeline') {
        return (
            <RecordTimeline
                listId={listId}
                recordId={recordId}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
            />
        );
    }
    if (block.type === 'stats') {
        return <StatsBlockView listId={listId} record={record} />;
    }
    if (block.type === 'related') {
        return <RelatedBlockView field={block.config.field} record={record} />;
    }
    if (block.type === 'kpi') {
        return <KpiBlockView block={block} record={record} />;
    }
    if (block.type === 'chart') {
        return <ChartBlockView block={block} record={record} />;
    }
    if (block.type === 'files') {
        return <FilesBlockView block={block} record={record} />;
    }
    if (block.type === 'embed') {
        return <EmbedBlockView block={block} record={record} />;
    }
    if (block.type === 'action_button') {
        return <ActionButtonView block={block} />;
    }
    if (block.type === 'markdown') {
        return <MarkdownBlockView block={block} />;
    }
    if (block.type === 'notes') {
        return <NotesView title={block.config.title} content={block.config.content} />;
    }
    return null;
}

// --- properties_group view ---------------------------------------------------

function PropertiesGroupView({
    block,
    values,
    onChange,
    fieldErrors,
}: {
    block: Extract<ResolvedV2Block, { type: 'properties_group' }>;
    values: Record<string, unknown>;
    onChange: (values: Record<string, unknown>) => void;
    fieldErrors?: Record<string, string>;
}): JSX.Element {
    const [open, setOpen] = useState(! block.config.collapsedByDefault);
    const Icon = block.config.icon;

    return (
        <section className="imcrm-flex imcrm-h-full imcrm-flex-col imcrm-overflow-hidden imcrm-rounded-lg imcrm-border imcrm-border-border imcrm-bg-card">
            <button
                type="button"
                onClick={() => setOpen((v) => ! v)}
                aria-expanded={open}
                className={cn(
                    'imcrm-flex imcrm-w-full imcrm-items-center imcrm-gap-2 imcrm-px-4 imcrm-py-3 imcrm-text-left imcrm-text-sm imcrm-font-medium imcrm-transition-colors',
                    'hover:imcrm-bg-accent/40',
                )}
            >
                {open ? (
                    <ChevronDown className="imcrm-h-3.5 imcrm-w-3.5 imcrm-text-muted-foreground" />
                ) : (
                    <ChevronRight className="imcrm-h-3.5 imcrm-w-3.5 imcrm-text-muted-foreground" />
                )}
                <Icon className="imcrm-h-3.5 imcrm-w-3.5 imcrm-text-muted-foreground" aria-hidden />
                <span className="imcrm-flex-1">{__(block.config.label)}</span>
                <span className="imcrm-text-xs imcrm-text-muted-foreground">{block.config.fields.length}</span>
            </button>
            {open && (
                <div className="imcrm-flex-1 imcrm-overflow-y-auto imcrm-border-t imcrm-border-border imcrm-px-4 imcrm-py-3">
                    {block.config.fields.length === 0 ? (
                        <p className="imcrm-text-xs imcrm-text-muted-foreground">
                            {__('Grupo vacío. Editalo desde el template editor.')}
                        </p>
                    ) : (
                        <RecordFieldsForm
                            fields={block.config.fields}
                            values={values}
                            onChange={onChange}
                            fieldErrors={fieldErrors}
                        />
                    )}
                </div>
            )}
        </section>
    );
}

// --- notes view --------------------------------------------------------------

function NotesView({ title, content }: { title: string; content: string }): JSX.Element {
    return (
        <section className="imcrm-flex imcrm-h-full imcrm-flex-col imcrm-overflow-hidden imcrm-rounded-lg imcrm-border imcrm-border-warning/30 imcrm-bg-warning/5 imcrm-p-4">
            <header className="imcrm-mb-2 imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-text-sm imcrm-font-semibold imcrm-text-warning">
                <StickyNote className="imcrm-h-3.5 imcrm-w-3.5" aria-hidden />
                {title || __('Nota')}
            </header>
            <div className="imcrm-flex-1 imcrm-overflow-y-auto imcrm-whitespace-pre-wrap imcrm-text-sm imcrm-leading-relaxed imcrm-text-foreground">
                {content || (
                    <span className="imcrm-italic imcrm-text-muted-foreground">
                        {__('Bloque de notas vacío.')}
                    </span>
                )}
            </div>
        </section>
    );
}
