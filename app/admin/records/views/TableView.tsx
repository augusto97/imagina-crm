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
import { ArrowDown, ArrowUp, ArrowUpDown, GripVertical, Inbox, KeyRound, Plus } from 'lucide-react';

import { EmptyState } from '@/components/ui/empty-state';
import { useAggregates, type AggregateBag } from '@/hooks/useAggregates';
import { __, sprintf } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { FieldEntity } from '@/types/field';
import type { FilterTree, RecordEntity } from '@/types/record';

import { EditableCell } from '@/admin/records/EditableCell';
import { renderCellValue } from '@/admin/records/renderCellValue';
import type { ActiveSort } from '@/admin/records/recordsState';

interface TableViewProps {
    listId: number;
    /** Slug de la lista — para queries que necesitan slug en la URL (aggregates). */
    listSlug?: string;
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
    /**
     * Filtros activos — se pasan al hook de aggregates para que el
     * footer respete el filtro visible.
     */
    filterTree?: FilterTree;
    /** Click en "+ Nueva tarea" al final de la tabla. Si no se pasa, no se renderea. */
    onAddRecord?: () => void;
    /** Click en "+ Agregar columna" al final del header. Si no se pasa, no se renderea. */
    onAddColumn?: () => void;
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
    listSlug,
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
    filterTree,
    onAddRecord,
    onAddColumn,
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

    // Footer aggregations: pedimos sum/avg/count/min/max para todos
    // los fields visibles que son numéricos / fecha / checkbox / etc.
    // Solo si el caller pasó listSlug (caller controla si el footer
    // se necesita — algunos contextos como GroupedTableView lo
    // calculan aparte).
    const aggregatableFieldIds = useMemo(
        () => fields
            .filter((f) => f.type !== 'relation' && f.type !== 'computed')
            .filter((f) => columnVisibility[f.slug] !== false)
            .map((f) => f.id),
        [fields, columnVisibility],
    );
    const aggregates = useAggregates({
        listSlug,
        fieldIds: aggregatableFieldIds,
        filterTree,
    });

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

    // Sticky-left: el checkbox queda fijo en `left: 0` y, si hay un
    // field con `is_primary`, queda fijo en `left: 40px` (ancho del
    // checkbox). El render de cada `<th>`/`<td>` usa este helper para
    // saber si aplicar position:sticky + el offset correcto. En la
    // captura de ClickUp esa columna es la del nombre — el equivalente
    // acá es el primary field.
    const PRIMARY_OFFSET = 40;
    const stickyStyleFor = (
        meta: { fieldId: number | null; primary?: boolean } | undefined,
    ): React.CSSProperties | undefined => {
        if (meta?.primary) {
            return {
                position: 'sticky' as const,
                left: PRIMARY_OFFSET,
                zIndex: 1,
            };
        }
        return undefined;
    };

    // El `<thead sticky>` solo proyecta sombra cuando el contenedor
    // tiene scroll vertical activo. Sin scroll, el header se ve plano
    // (estilo ClickUp). On scroll, sombra suave indica que hay
    // contenido pasando por debajo.
    const [scrolled, setScrolled] = useState(false);

    return (
        <div
            className="imcrm-overflow-auto imcrm-rounded-xl imcrm-border imcrm-border-border imcrm-bg-card imcrm-shadow-imcrm-sm"
            role="region"
            aria-label={__('Tabla de registros')}
            onScroll={(e) => {
                const top = (e.currentTarget as HTMLDivElement).scrollTop > 0;
                if (top !== scrolled) setScrolled(top);
            }}
        >
            <table
                className="imcrm-w-full imcrm-text-sm"
                style={{ tableLayout: 'fixed', width: table.getCenterTotalSize() }}
                aria-label={__('Registros de la lista')}
            >
                <thead
                    className={cn(
                        'imcrm-sticky imcrm-top-0 imcrm-z-20 imcrm-bg-muted/60 imcrm-backdrop-blur imcrm-transition-shadow imcrm-duration-150',
                        scrolled && 'imcrm-shadow-[0_2px_4px_-1px_rgba(0,0,0,0.06)]',
                    )}
                >
                    {table.getHeaderGroups().map((hg) => (
                        <tr key={hg.id} className="imcrm-border-b imcrm-border-border">
                            <th
                                scope="col"
                                className="imcrm-w-10 imcrm-px-3 imcrm-py-3 imcrm-bg-muted/60"
                                style={{ position: 'sticky', left: 0, zIndex: 2 }}
                            >
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

                                const stickyStyle = stickyStyleFor(meta);
                                return (
                                    <th
                                        key={h.id}
                                        scope="col"
                                        aria-sort={fieldId !== null ? ariaSort : undefined}
                                        style={{
                                            width: h.getSize(),
                                            ...(stickyStyle ?? {}),
                                        }}
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
                                            // Sticky cells necesitan bg sólido para no
                                            // dejar transparentar el contenido scrolleado
                                            // por debajo. El `<thead>` ya trae gradiente,
                                            // pero el `<th>` sticky-left necesita su
                                            // propio bg para tapar las celdas que pasan
                                            // por detrás horizontalmente.
                                            stickyStyle && 'imcrm-bg-muted/60',
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
                            {onAddColumn && (
                                <th
                                    scope="col"
                                    className="imcrm-w-12 imcrm-px-2 imcrm-py-3 imcrm-text-left"
                                >
                                    <button
                                        type="button"
                                        onClick={onAddColumn}
                                        className="imcrm-flex imcrm-h-6 imcrm-w-6 imcrm-items-center imcrm-justify-center imcrm-rounded imcrm-border imcrm-border-dashed imcrm-border-border imcrm-text-muted-foreground hover:imcrm-border-primary hover:imcrm-bg-primary/10 hover:imcrm-text-primary"
                                        title={__('Agregar columna')}
                                        aria-label={__('Agregar columna')}
                                    >
                                        <Plus className="imcrm-h-3.5 imcrm-w-3.5" />
                                    </button>
                                </th>
                            )}
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
                                        'imcrm-group/row imcrm-border-t imcrm-border-border/50 imcrm-transition-colors imcrm-duration-100',
                                        isSelected
                                            ? 'imcrm-bg-primary/5'
                                            : 'hover:imcrm-bg-accent/40',
                                    )}
                                >
                                    <td
                                        className={cn(
                                            'imcrm-w-10 imcrm-px-3 imcrm-py-2.5 imcrm-align-middle',
                                            // bg sólido para tapar contenido scrolleado por
                                            // detrás cuando es sticky-left.
                                            isSelected
                                                ? 'imcrm-bg-primary/5'
                                                : 'imcrm-bg-card group-hover/row:imcrm-bg-accent/40',
                                        )}
                                        style={{ position: 'sticky', left: 0, zIndex: 1 }}
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
                                        const cellMeta = cell.column.columnDef.meta as
                                            | { fieldId: number | null; primary?: boolean }
                                            | undefined;
                                        const cellSticky = stickyStyleFor(cellMeta);
                                        return (
                                            <td
                                                key={cell.id}
                                                style={{
                                                    width: cell.column.getSize(),
                                                    maxWidth: cell.column.getSize(),
                                                    ...(cellSticky ?? {}),
                                                }}
                                                className={cn(
                                                    // `overflow-hidden` + `width/maxWidth` cortan el
                                                    // desbordamiento visual de cells largas (long_text,
                                                    // multi_select con muchas opciones). El truncate
                                                    // con elipsis va dentro de `EditableCell` para que
                                                    // afecte solo al modo lectura — el editor inline
                                                    // necesita escaparse del clip cuando el user clickea.
                                                    'imcrm-overflow-hidden imcrm-px-3 imcrm-py-2.5 imcrm-align-middle',
                                                    cellSticky && (isSelected
                                                        ? 'imcrm-bg-primary/5'
                                                        : 'imcrm-bg-card group-hover/row:imcrm-bg-accent/40'),
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
                                    {onAddColumn && <td className="imcrm-w-12" />}
                                </tr>
                            );
                        })
                    )}
                    {onAddRecord && (
                        <tr className="imcrm-border-t imcrm-border-border/50">
                            <td colSpan={columns.length + 1 + (onAddColumn ? 1 : 0)} className="imcrm-px-3 imcrm-py-2">
                                <button
                                    type="button"
                                    onClick={onAddRecord}
                                    className="imcrm-flex imcrm-w-full imcrm-items-center imcrm-gap-2 imcrm-rounded imcrm-px-2 imcrm-py-1.5 imcrm-text-xs imcrm-text-muted-foreground hover:imcrm-bg-accent/40 hover:imcrm-text-foreground"
                                >
                                    <Plus className="imcrm-h-3.5 imcrm-w-3.5" />
                                    {__('Agregar tarea')}
                                </button>
                            </td>
                        </tr>
                    )}
                </tbody>
                {/* Footer con agregaciones por columna (sum/avg/count/
                    min/max según el tipo del field). Solo se renderea
                    si llegó algún dato del endpoint — cuando la lista
                    está vacía o todos los fields son no-agregables, se
                    omite. */}
                {aggregates.data && Object.keys(aggregates.data.totals).length > 0 && (
                    <tfoot className="imcrm-sticky imcrm-bottom-0 imcrm-z-10 imcrm-bg-muted/40 imcrm-backdrop-blur">
                        <tr className="imcrm-border-t imcrm-border-border">
                            <td
                                className="imcrm-w-10 imcrm-bg-muted/60"
                                style={{ position: 'sticky', left: 0, zIndex: 2 }}
                            />
                            {table.getVisibleLeafColumns().map((col) => {
                                const meta = col.columnDef.meta as
                                    | { fieldId: number | null; primary?: boolean }
                                    | undefined;
                                const fieldId = meta?.fieldId ?? null;
                                const field: FieldEntity | null = fieldId !== null
                                    ? (fields.find((f) => f.id === fieldId) ?? null)
                                    : null;
                                const agg = field !== null
                                    ? aggregates.data.totals[field.slug]
                                    : undefined;
                                const cellSticky = stickyStyleFor(meta);
                                return (
                                    <td
                                        key={col.id}
                                        style={{
                                            width: col.getSize(),
                                            maxWidth: col.getSize(),
                                            ...(cellSticky ?? {}),
                                        }}
                                        className={cn(
                                            'imcrm-overflow-hidden imcrm-px-3 imcrm-py-2 imcrm-text-[11px] imcrm-text-muted-foreground',
                                            cellSticky && 'imcrm-bg-muted/60',
                                        )}
                                    >
                                        <FooterAggregate field={field} agg={agg} />
                                    </td>
                                );
                            })}
                            {onAddColumn && <td className="imcrm-w-12" />}
                        </tr>
                    </tfoot>
                )}
            </table>
        </div>
    );
}

/**
 * Render del valor agregado en el footer de una columna. Por tipo:
 *  - number/currency  → "Σ 12.500" (sum, default)
 *  - date/datetime    → "min – max" o "N items"
 *  - checkbox         → "✓ N · ✗ M"
 *  - text/select/etc  → "N items"
 *
 * Nada se muestra si el field no es agregable (relation/computed) o
 * si el endpoint todavía no respondió.
 */
function FooterAggregate({
    field,
    agg,
}: {
    field: FieldEntity | null;
    agg: AggregateBag | undefined;
}): JSX.Element | null {
    if (field === null || agg === undefined) return null;

    if (field.type === 'number' || field.type === 'currency') {
        if (agg.sum === null || agg.sum === undefined) return null;
        const formatted = (agg.sum as number).toLocaleString(undefined, {
            maximumFractionDigits: field.type === 'currency' ? 2 : 4,
            minimumFractionDigits: field.type === 'currency' ? 2 : 0,
        });
        return (
            <span className="imcrm-flex imcrm-items-baseline imcrm-gap-1.5">
                <span className="imcrm-text-[10px] imcrm-uppercase imcrm-tracking-wide">{__('Suma')}</span>
                <span className="imcrm-font-semibold imcrm-text-foreground imcrm-tabular-nums">
                    {formatted}
                </span>
            </span>
        );
    }

    if (field.type === 'checkbox') {
        return (
            <span className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-tabular-nums">
                <span>✓ {agg.count_true ?? 0}</span>
                <span>✗ {agg.count_false ?? 0}</span>
            </span>
        );
    }

    if (field.type === 'date' || field.type === 'datetime') {
        if (! agg.min && ! agg.max) {
            return (
                <span className="imcrm-tabular-nums">
                    {(agg.count ?? 0).toLocaleString()} {__('items')}
                </span>
            );
        }
        return (
            <span className="imcrm-flex imcrm-flex-col imcrm-text-[10px] imcrm-tabular-nums">
                <span>{__('Min')}: {String(agg.min ?? '—').slice(0, 10)}</span>
                <span>{__('Max')}: {String(agg.max ?? '—').slice(0, 10)}</span>
            </span>
        );
    }

    // text / select / multi_select / email / url / user / file
    return (
        <span className="imcrm-tabular-nums">
            {(agg.count ?? 0).toLocaleString()} {__('items')}
        </span>
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
