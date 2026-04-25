import { useMemo, useState } from 'react';
import { GripVertical } from 'lucide-react';

import { useUpdateRecord } from '@/hooks/useRecords';
import { __, sprintf } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { FieldEntity } from '@/types/field';
import type { RecordEntity } from '@/types/record';

/**
 * Vista Kanban: tablero de columnas derivadas de las options del campo
 * `select` configurado como `group_by_field_id` en la saved view.
 *
 * Drag-and-drop nativo HTML5 — sin librerías externas. Funciona bien
 * para la UX básica del MVP (drag a otra columna). Si en el futuro
 * necesitamos reorder dentro de la columna o accesibilidad por
 * teclado, @dnd-kit es la siguiente parada.
 *
 * Card mínima: muestra el campo "primary" (o el primer text) como
 * título y un par de campos extra como meta. Click abre el drawer
 * (mismo flujo que la TableView).
 */
interface KanbanViewProps {
    listId: number;
    fields: FieldEntity[];
    records: RecordEntity[];
    groupByField: FieldEntity;
    onCardClick: (record: RecordEntity) => void;
}

interface SelectOption {
    value: string;
    label: string;
    color?: string;
}

const UNCATEGORIZED_KEY = '__uncategorized__';

export function KanbanView({
    listId,
    fields,
    records,
    groupByField,
    onCardClick,
}: KanbanViewProps): JSX.Element {
    const update = useUpdateRecord(listId);
    const [draggingId, setDraggingId] = useState<number | null>(null);
    const [dropTarget, setDropTarget] = useState<string | null>(null);
    const [moveError, setMoveError] = useState<string | null>(null);

    const options = useMemo<SelectOption[]>(() => {
        const raw = groupByField.config?.options;
        if (!Array.isArray(raw)) return [];
        return raw
            .filter((o): o is SelectOption =>
                typeof o === 'object' &&
                o !== null &&
                'value' in o &&
                typeof (o as Record<string, unknown>).value === 'string',
            )
            .map((o) => ({
                value: String(o.value),
                label: typeof o.label === 'string' ? o.label : String(o.value),
                color: typeof o.color === 'string' ? o.color : undefined,
            }));
    }, [groupByField.config]);

    const grouped = useMemo(() => {
        const map = new Map<string, RecordEntity[]>();
        for (const opt of options) map.set(opt.value, []);
        map.set(UNCATEGORIZED_KEY, []);

        for (const record of records) {
            const v = record.fields[groupByField.slug];
            const key = typeof v === 'string' && v !== '' ? v : UNCATEGORIZED_KEY;
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(record);
        }
        return map;
    }, [records, options, groupByField.slug]);

    const titleField = useMemo(() => pickTitleField(fields, groupByField.id), [fields, groupByField.id]);
    const metaFields = useMemo(
        () => pickMetaFields(fields, groupByField.id, titleField?.id),
        [fields, groupByField.id, titleField?.id],
    );

    const handleDrop = async (targetValue: string): Promise<void> => {
        setDropTarget(null);
        if (draggingId === null) return;

        const record = records.find((r) => r.id === draggingId);
        if (!record) {
            setDraggingId(null);
            return;
        }

        const currentValue = record.fields[groupByField.slug];
        const newValue = targetValue === UNCATEGORIZED_KEY ? null : targetValue;
        if (currentValue === newValue) {
            setDraggingId(null);
            return;
        }

        setMoveError(null);
        try {
            await update.mutateAsync({
                id: record.id,
                values: { [groupByField.slug]: newValue },
            });
        } catch (err) {
            // El optimistic update de TanStack Query revierte la caché,
            // pero el usuario merece saber qué pasó (validación que
            // rechaza el valor, error de red, etc.) antes que ver el
            // card "saltar" silenciosamente de columna.
            setMoveError(err instanceof Error ? err.message : __('Error al mover el registro.'));
        } finally {
            setDraggingId(null);
        }
    };

    const allColumns: Array<{ key: string; label: string; color?: string }> = [
        ...options.map((o) => ({ key: o.value, label: o.label, color: o.color })),
        { key: UNCATEGORIZED_KEY, label: __('Sin asignar') },
    ];

    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-2">
            {moveError !== null && (
                <div
                    role="alert"
                    className="imcrm-flex imcrm-items-center imcrm-justify-between imcrm-gap-2 imcrm-rounded-md imcrm-border imcrm-border-destructive/40 imcrm-bg-destructive/10 imcrm-px-3 imcrm-py-2 imcrm-text-sm imcrm-text-destructive"
                >
                    <span>{moveError}</span>
                    <button
                        type="button"
                        onClick={() => setMoveError(null)}
                        className="imcrm-text-xs imcrm-underline"
                    >
                        {__('Cerrar')}
                    </button>
                </div>
            )}
            <div className="imcrm-flex imcrm-gap-3 imcrm-overflow-x-auto imcrm-pb-2">
            {allColumns.map((col) => {
                const colRecords = grouped.get(col.key) ?? [];
                const isTarget = dropTarget === col.key;
                return (
                    <div
                        key={col.key}
                        className={cn(
                            'imcrm-flex imcrm-w-72 imcrm-shrink-0 imcrm-flex-col imcrm-gap-2 imcrm-rounded-lg imcrm-border imcrm-bg-muted/30 imcrm-p-2 imcrm-transition-colors',
                            isTarget
                                ? 'imcrm-border-primary imcrm-bg-primary/5'
                                : 'imcrm-border-border',
                        )}
                        onDragOver={(e) => {
                            if (draggingId !== null) {
                                e.preventDefault();
                                if (dropTarget !== col.key) setDropTarget(col.key);
                            }
                        }}
                        onDragLeave={() => {
                            if (dropTarget === col.key) setDropTarget(null);
                        }}
                        onDrop={() => void handleDrop(col.key)}
                    >
                        <header className="imcrm-flex imcrm-items-center imcrm-justify-between imcrm-px-2 imcrm-py-1">
                            <div className="imcrm-flex imcrm-items-center imcrm-gap-2">
                                {col.color && (
                                    <span
                                        className="imcrm-h-2 imcrm-w-2 imcrm-rounded-full"
                                        style={{ backgroundColor: col.color }}
                                        aria-hidden
                                    />
                                )}
                                <h3 className="imcrm-text-xs imcrm-font-semibold imcrm-uppercase imcrm-tracking-wide imcrm-text-muted-foreground">
                                    {col.label}
                                </h3>
                            </div>
                            <span className="imcrm-rounded imcrm-bg-card imcrm-px-1.5 imcrm-py-0.5 imcrm-text-[10px] imcrm-font-medium imcrm-text-muted-foreground">
                                {colRecords.length}
                            </span>
                        </header>

                        <div className="imcrm-flex imcrm-flex-col imcrm-gap-2">
                            {colRecords.length === 0 ? (
                                <p className="imcrm-px-2 imcrm-py-4 imcrm-text-center imcrm-text-xs imcrm-text-muted-foreground">
                                    {__('Vacía')}
                                </p>
                            ) : (
                                colRecords.map((record) => (
                                    <KanbanCard
                                        key={record.id}
                                        record={record}
                                        titleField={titleField}
                                        metaFields={metaFields}
                                        isDragging={draggingId === record.id}
                                        onDragStart={() => setDraggingId(record.id)}
                                        onDragEnd={() => {
                                            setDraggingId(null);
                                            setDropTarget(null);
                                        }}
                                        onClick={() => onCardClick(record)}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                );
            })}
            </div>
        </div>
    );
}

interface KanbanCardProps {
    record: RecordEntity;
    titleField?: FieldEntity;
    metaFields: FieldEntity[];
    isDragging: boolean;
    onDragStart: () => void;
    onDragEnd: () => void;
    onClick: () => void;
}

function KanbanCard({
    record,
    titleField,
    metaFields,
    isDragging,
    onDragStart,
    onDragEnd,
    onClick,
}: KanbanCardProps): JSX.Element {
    const titleValue = titleField ? record.fields[titleField.slug] : undefined;
    const title =
        typeof titleValue === 'string' && titleValue !== ''
            ? titleValue
            : sprintf(
                  /* translators: %d: record id */
                  __('Registro #%d'),
                  record.id,
              );

    return (
        <article
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onClick={onClick}
            className={cn(
                'imcrm-cursor-pointer imcrm-rounded-md imcrm-border imcrm-border-border imcrm-bg-card imcrm-p-3 imcrm-text-sm imcrm-shadow-imcrm-sm imcrm-transition-shadow hover:imcrm-shadow-imcrm-md',
                isDragging && 'imcrm-opacity-50',
            )}
        >
            <div className="imcrm-flex imcrm-items-start imcrm-gap-2">
                <GripVertical
                    className="imcrm-mt-0.5 imcrm-h-3.5 imcrm-w-3.5 imcrm-shrink-0 imcrm-text-muted-foreground"
                    aria-hidden
                />
                <div className="imcrm-flex imcrm-min-w-0 imcrm-flex-1 imcrm-flex-col imcrm-gap-1">
                    <p className="imcrm-truncate imcrm-font-medium imcrm-text-foreground">{String(title)}</p>
                    {metaFields.map((field) => {
                        const v = record.fields[field.slug];
                        if (v === undefined || v === null || v === '') return null;
                        return (
                            <p
                                key={field.id}
                                className="imcrm-truncate imcrm-text-xs imcrm-text-muted-foreground"
                            >
                                <span className="imcrm-font-mono imcrm-text-[10px]">{field.slug}:</span>{' '}
                                {renderMeta(v)}
                            </p>
                        );
                    })}
                </div>
            </div>
        </article>
    );
}

function pickTitleField(fields: FieldEntity[], excludeId: number): FieldEntity | undefined {
    const primary = fields.find((f) => f.is_primary);
    if (primary) return primary;
    return fields.find((f) => f.id !== excludeId && (f.type === 'text' || f.type === 'email'));
}

function pickMetaFields(
    fields: FieldEntity[],
    excludeGroupBy: number,
    excludeTitle: number | undefined,
): FieldEntity[] {
    return fields
        .filter(
            (f) =>
                f.id !== excludeGroupBy &&
                f.id !== excludeTitle &&
                f.type !== 'long_text' &&
                f.type !== 'file' &&
                f.type !== 'relation',
        )
        .slice(0, 3);
}

function renderMeta(v: unknown): string {
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
}
