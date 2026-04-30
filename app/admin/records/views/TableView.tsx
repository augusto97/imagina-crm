import { useMemo, useState } from 'react';
import {
    flexRender,
    getCoreRowModel,
    useReactTable,
    type ColumnDef,
    type ColumnOrderState,
    type ColumnSizingState,
    type VisibilityState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, GripVertical, Inbox, KeyRound } from 'lucide-react';

import { EmptyState } from '@/components/ui/empty-state';
import { __, sprintf } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { FieldEntity } from '@/types/field';
import type { RecordEntity } from '@/types/record';

import { EditableCell } from '@/admin/records/EditableCell';
import { renderCellValue } from '@/admin/records/renderCellValue';
import type { ActiveSort } from '@/admin/records/recordsState';

interface TableViewProps {
    listId: number;
    fields: FieldEntity[];
    records: RecordEntity[];
    sort: ActiveSort[];
    onSortChange: (fieldId: number, multi: boolean) => void;
    selectedIds: number[];
    onSelectionChange: (ids: number[]) => void;
    onRowClick?: (record: RecordEntity) => void;
    /** Estado de visibilidad de columnas (Excel-style). */
    columnVisibility: VisibilityState;
    onColumnVisibilityChange: (next: VisibilityState) => void;
    /** Anchuras de columnas en px (resizable). */
    columnSizing: ColumnSizingState;
    onColumnSizingChange: (next: ColumnSizingState) => void;
    /**
     * Orden custom de columnas (TanStack convention): array de column ids.
     * Cuando está vacío usa el orden default (field.position).
     * Se actualiza con drag-and-drop sobre los headers.
     */
    columnOrder: ColumnOrderState;
    onColumnOrderChange: (next: ColumnOrderState) => void;
}

/**
 * Vista de tabla sobre TanStack Table v8.
 *
 * - Columna de checkbox al inicio para selección múltiple.
 * - Headers clickeables: sort asc → desc → off; shift+click para multi.
 * - Celdas editables inline (delegado a `EditableCell`).
 * - Click en zona vacía de la fila → onRowClick (drawer).
 * - Tipos no soportados inline (user, file, relation) muestran solo
 *   lectura aquí; se editan desde RecordDetailDrawer.
 */
export function TableView({
    listId,
    fields,
    records,
    sort,
    onSortChange,
    selectedIds,
    onSelectionChange,
    onRowClick,
    columnVisibility,
    onColumnVisibilityChange,
    columnSizing,
    onColumnSizingChange,
    columnOrder,
    onColumnOrderChange,
}: TableViewProps): JSX.Element {
    const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

    // Drag-and-drop column reorder: trackeamos qué column está siendo
    // arrastrada en local state (no persiste). Al drop, computamos el
    // nuevo orden y se lo pasamos al parent vía `onColumnOrderChange`.
    const [draggingColId, setDraggingColId] = useState<string | null>(null);
    const [overColId, setOverColId] = useState<string | null>(null);

    const allVisibleSelected =
        records.length > 0 && records.every((r) => selectedSet.has(r.id));
    const someVisibleSelected =
        !allVisibleSelected && records.some((r) => selectedSet.has(r.id));

    const toggleAll = (): void => {
        if (allVisibleSelected) {
            const visible = new Set(records.map((r) => r.id));
            onSelectionChange(selectedIds.filter((id) => !visible.has(id)));
        } else {
            const next = new Set(selectedIds);
            for (const r of records) next.add(r.id);
            onSelectionChange([...next]);
        }
    };

    const toggleOne = (id: number): void => {
        if (selectedSet.has(id)) {
            onSelectionChange(selectedIds.filter((x) => x !== id));
        } else {
            onSelectionChange([...selectedIds, id]);
        }
    };

    const columns = useMemo<ColumnDef<RecordEntity>[]>(() => {
        const dynamic = fields
            .filter((f) => f.type !== 'relation')
            .sort((a, b) => a.position - b.position)
            .map<ColumnDef<RecordEntity>>((field) => ({
                id: field.slug,
                header: field.label,
                accessorFn: (row) => row.fields[field.slug],
                cell: (ctx) => (
                    <EditableCell
                        listId={listId}
                        recordId={ctx.row.original.id}
                        field={field}
                        value={ctx.getValue()}
                    />
                ),
                size: defaultSizeForType(field.type),
                minSize: 80,
                maxSize: 800,
                meta: { fieldId: field.id, primary: field.is_primary },
            }));

        return [
            {
                id: 'id',
                header: __('ID'),
                accessorFn: (row) => row.id,
                cell: (ctx) => (
                    <span className="imcrm-font-mono imcrm-text-xs imcrm-text-muted-foreground">
                        #{String(ctx.getValue())}
                    </span>
                ),
                size: 70,
                minSize: 60,
                maxSize: 120,
                meta: { fieldId: null },
            },
            ...dynamic,
            {
                id: 'updated_at',
                header: __('Actualizado'),
                accessorFn: (row) => row.updated_at,
                cell: (ctx) => {
                    const v = String(ctx.getValue() ?? '');
                    if (!v) return null;
                    const d = new Date(v + 'Z');
                    return (
                        <span className="imcrm-text-xs imcrm-text-muted-foreground">
                            {d.toLocaleString()}
                        </span>
                    );
                },
                size: 170,
                minSize: 130,
                maxSize: 260,
                meta: { fieldId: null },
            },
        ];
    }, [fields, listId]);

    const table = useReactTable({
        data: records,
        columns,
        getCoreRowModel: getCoreRowModel(),
        columnResizeMode: 'onChange',
        state: {
            columnVisibility,
            columnSizing,
            columnOrder,
        },
        onColumnVisibilityChange: (updater) => {
            const next = typeof updater === 'function' ? updater(columnVisibility) : updater;
            onColumnVisibilityChange(next);
        },
        onColumnSizingChange: (updater) => {
            const next = typeof updater === 'function' ? updater(columnSizing) : updater;
            onColumnSizingChange(next);
        },
        onColumnOrderChange: (updater) => {
            const next = typeof updater === 'function' ? updater(columnOrder) : updater;
            onColumnOrderChange(next);
        },
    });

    /**
     * Reordena `columnOrder` insertando `dragged` justo antes de
     * `target`. Si el `columnOrder` está vacío, lo derivamos del
     * orden actual de columnas (necesario para el primer drag — sin
     * esto, persistiríamos solo dos columnas y el resto quedaría al
     * principio en el orden default).
     */
    const reorderColumns = (dragged: string, target: string): void => {
        if (dragged === target) return;
        const currentOrder = columnOrder.length > 0
            ? [...columnOrder]
            : table.getAllLeafColumns().map((c) => c.id);
        const fromIdx = currentOrder.indexOf(dragged);
        const toIdx   = currentOrder.indexOf(target);
        if (fromIdx < 0 || toIdx < 0) return;
        currentOrder.splice(fromIdx, 1);
        // Si `dragged` estaba antes de `target`, los índices se
        // recalculan: insertamos en el `toIdx` original ajustado.
        const insertAt = fromIdx < toIdx ? toIdx - 1 : toIdx;
        currentOrder.splice(insertAt, 0, dragged);
        onColumnOrderChange(currentOrder);
    };

    return (
        <div
            className="imcrm-overflow-auto imcrm-rounded-xl imcrm-border imcrm-border-border imcrm-bg-card imcrm-shadow-imcrm-sm"
            role="region"
            aria-label={__('Tabla de registros')}
        >
            <table
                className="imcrm-w-full imcrm-text-sm"
                style={{ tableLayout: 'fixed', width: table.getCenterTotalSize() }}
                aria-label={__('Registros de la lista')}
            >
                <thead className="imcrm-sticky imcrm-top-0 imcrm-z-10 imcrm-bg-gradient-to-b imcrm-from-muted/60 imcrm-to-muted/40 imcrm-backdrop-blur">
                    {table.getHeaderGroups().map((hg) => (
                        <tr key={hg.id} className="imcrm-border-b imcrm-border-border">
                            <th scope="col" className="imcrm-w-10 imcrm-px-3 imcrm-py-3">
                                <input
                                    type="checkbox"
                                    checked={allVisibleSelected}
                                    ref={(el) => {
                                        if (el) el.indeterminate = someVisibleSelected;
                                    }}
                                    onChange={toggleAll}
                                    aria-label={__('Seleccionar todos')}
                                />
                            </th>
                            {hg.headers.map((h) => {
                                const meta = h.column.columnDef.meta as
                                    | { fieldId: number | null; primary?: boolean }
                                    | undefined;
                                const fieldId = meta?.fieldId ?? null;
                                const isPrimary = meta?.primary ?? false;
                                const sortIndex = fieldId !== null
                                    ? sort.findIndex((s) => s.field_id === fieldId)
                                    : -1;
                                const sortDir = sortIndex >= 0 ? sort[sortIndex]?.dir : null;
                                const ariaSort: 'ascending' | 'descending' | 'none' =
                                    sortDir === 'asc' ? 'ascending' : sortDir === 'desc' ? 'descending' : 'none';
                                // ID y updated_at no son re-orderables — los demás (los
                                // de campos del usuario) sí.
                                const isDraggable = fieldId !== null;
                                const isDragOver = overColId === h.id && draggingColId !== h.id;

                                return (
                                    <th
                                        key={h.id}
                                        scope="col"
                                        aria-sort={fieldId !== null ? ariaSort : undefined}
                                        style={{ width: h.getSize() }}
                                        draggable={isDraggable}
                                        onDragStart={isDraggable ? (e) => {
                                            setDraggingColId(h.id);
                                            // Algunos navegadores (Firefox) requieren
                                            // setData para iniciar el drag.
                                            e.dataTransfer.effectAllowed = 'move';
                                            e.dataTransfer.setData('text/plain', h.id);
                                        } : undefined}
                                        onDragEnd={() => {
                                            setDraggingColId(null);
                                            setOverColId(null);
                                        }}
                                        onDragOver={isDraggable ? (e) => {
                                            if (draggingColId === null || draggingColId === h.id) return;
                                            e.preventDefault();
                                            e.dataTransfer.dropEffect = 'move';
                                            if (overColId !== h.id) setOverColId(h.id);
                                        } : undefined}
                                        onDrop={isDraggable ? (e) => {
                                            e.preventDefault();
                                            if (draggingColId !== null) {
                                                reorderColumns(draggingColId, h.id);
                                            }
                                            setDraggingColId(null);
                                            setOverColId(null);
                                        } : undefined}
                                        className={cn(
                                            'imcrm-group/th imcrm-relative imcrm-whitespace-nowrap imcrm-px-3 imcrm-py-3 imcrm-text-left imcrm-text-[11px] imcrm-font-semibold imcrm-text-muted-foreground imcrm-uppercase imcrm-tracking-[0.06em]',
                                            isDragOver && 'imcrm-bg-primary/10',
                                            draggingColId === h.id && 'imcrm-opacity-50',
                                        )}
                                    >
                                        <div className="imcrm-flex imcrm-items-center imcrm-gap-1">
                                            {isDraggable && (
                                                <span
                                                    className="imcrm-cursor-grab imcrm-text-muted-foreground/40 imcrm-opacity-0 imcrm-transition-opacity group-hover/th:imcrm-opacity-100 active:imcrm-cursor-grabbing"
                                                    aria-hidden
                                                    title={__('Arrastra para reordenar')}
                                                >
                                                    <GripVertical className="imcrm-h-3 imcrm-w-3" />
                                                </span>
                                            )}
                                            {fieldId !== null ? (
                                                <button
                                                    type="button"
                                                    onClick={(e) => onSortChange(fieldId, e.shiftKey)}
                                                    className="imcrm-flex imcrm-items-center imcrm-gap-1.5 imcrm-rounded hover:imcrm-text-foreground"
                                                >
                                                    {isPrimary && (
                                                        <KeyRound className="imcrm-h-3 imcrm-w-3 imcrm-text-primary" aria-hidden="true" />
                                                    )}
                                                    <span>
                                                        {h.isPlaceholder
                                                            ? null
                                                            : flexRender(h.column.columnDef.header, h.getContext())}
                                                    </span>
                                                    <SortIndicator dir={sortDir ?? null} index={sortIndex} multiCount={sort.length} />
                                                </button>
                                            ) : h.isPlaceholder ? null : (
                                                flexRender(h.column.columnDef.header, h.getContext())
                                            )}
                                        </div>
                                        {/* Resize handle estilo Excel: barra
                                            de 4px al borde derecho del <th>.
                                            Antes era de 1px transparent y el
                                            user no la encontraba. Ahora es
                                            visible (border) y resalta a
                                            primary on hover. */}
                                        {h.column.getCanResize() && (
                                            <div
                                                onMouseDown={(e) => {
                                                    // Al iniciar resize, prevenir que el
                                                    // mousedown burbujee al draggable=<th>
                                                    // (sino el browser inicia un drag de
                                                    // columna en lugar del resize).
                                                    e.stopPropagation();
                                                    h.getResizeHandler()(e);
                                                }}
                                                onTouchStart={h.getResizeHandler()}
                                                onClick={(e) => e.stopPropagation()}
                                                draggable={false}
                                                onDragStart={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                }}
                                                className={cn(
                                                    'imcrm-absolute imcrm-right-0 imcrm-top-0 imcrm-h-full imcrm-w-1 imcrm-cursor-col-resize imcrm-select-none imcrm-touch-none imcrm-z-20',
                                                    'imcrm-bg-border/40 hover:imcrm-bg-primary/60',
                                                    h.column.getIsResizing() && 'imcrm-bg-primary imcrm-w-[2px]',
                                                )}
                                                aria-hidden
                                            />
                                        )}
                                    </th>
                                );
                            })}
                        </tr>
                    ))}
                </thead>
                <tbody>
                    {table.getRowModel().rows.length === 0 ? (
                        <tr>
                            <td
                                colSpan={columns.length + 1}
                                className="imcrm-px-4 imcrm-py-8"
                            >
                                <EmptyState
                                    icon={Inbox}
                                    title={__('No hay registros')}
                                    description={__('Esta lista todavía no tiene registros que coincidan con los filtros actuales.')}
                                    variant="bare"
                                />
                            </td>
                        </tr>
                    ) : (
                        table.getRowModel().rows.map((row) => {
                            const isSelected = selectedSet.has(row.original.id);
                            return (
                                <tr
                                    key={row.id}
                                    className={cn(
                                        'imcrm-border-t imcrm-border-border/50 imcrm-transition-colors imcrm-duration-100',
                                        isSelected
                                            ? 'imcrm-bg-primary/5'
                                            : 'hover:imcrm-bg-accent/40',
                                    )}
                                >
                                    <td
                                        className="imcrm-w-10 imcrm-px-3 imcrm-py-2.5 imcrm-align-middle"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleOne(row.original.id)}
                                            aria-label={sprintf(
                                                /* translators: %d: record ID */
                                                __('Seleccionar registro %d'),
                                                row.original.id,
                                            )}
                                        />
                                    </td>
                                    {row.getVisibleCells().map((cell, cellIndex) => {
                                        // El "ID" (primera celda dinámica) actúa como zona de drawer:
                                        // click ahí abre el drawer.
                                        const isOpenerCell = cellIndex === 0;
                                        return (
                                            <td
                                                key={cell.id}
                                                style={{ width: cell.column.getSize(), maxWidth: cell.column.getSize() }}
                                                className={cn(
                                                    // `overflow-hidden` + `width/maxWidth` cortan el
                                                    // desbordamiento visual de cells largas (long_text,
                                                    // multi_select con muchas opciones). El truncate
                                                    // con elipsis va dentro de `EditableCell` para que
                                                    // afecte solo al modo lectura — el editor inline
                                                    // necesita escaparse del clip cuando el user clickea.
                                                    'imcrm-overflow-hidden imcrm-px-3 imcrm-py-2.5 imcrm-align-middle',
                                                    isOpenerCell && onRowClick && 'imcrm-cursor-pointer imcrm-font-medium',
                                                )}
                                                onClick={
                                                    isOpenerCell && onRowClick
                                                        ? () => onRowClick(row.original)
                                                        : undefined
                                                }
                                            >
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    );
}

/**
 * Anchura inicial razonable según el tipo del campo. El usuario puede
 * resizear manualmente; estas son solo defaults antes del primer drag.
 */
function defaultSizeForType(type: string): number {
    switch (type) {
        case 'checkbox':
            return 90;
        case 'number':
        case 'currency':
            return 120;
        case 'date':
            return 130;
        case 'datetime':
            return 170;
        case 'select':
            return 140;
        case 'multi_select':
            return 200;
        case 'email':
        case 'url':
            return 220;
        case 'long_text':
            return 280;
        default:
            return 180;
    }
}

function SortIndicator({
    dir,
    index,
    multiCount,
}: {
    dir: 'asc' | 'desc' | null;
    index: number;
    multiCount: number;
}): JSX.Element | null {
    // El estado de sort ya está expuesto al SR vía aria-sort en el <th>;
    // los iconos solo son decorativos.
    if (dir === null) {
        return <ArrowUpDown className="imcrm-h-3 imcrm-w-3 imcrm-opacity-30" aria-hidden="true" />;
    }
    return (
        <span className="imcrm-flex imcrm-items-center imcrm-gap-0.5" aria-hidden="true">
            {dir === 'asc' ? (
                <ArrowUp className="imcrm-h-3 imcrm-w-3 imcrm-text-primary" />
            ) : (
                <ArrowDown className="imcrm-h-3 imcrm-w-3 imcrm-text-primary" />
            )}
            {multiCount > 1 && (
                <span className="imcrm-font-mono imcrm-text-[9px] imcrm-text-primary">{index + 1}</span>
            )}
        </span>
    );
}

export { renderCellValue };
