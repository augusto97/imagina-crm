import { useMemo } from 'react';
import {
    flexRender,
    getCoreRowModel,
    useReactTable,
    type ColumnDef,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, KeyRound } from 'lucide-react';

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
}: TableViewProps): JSX.Element {
    const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

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
                meta: { fieldId: null },
            },
        ];
    }, [fields, listId]);

    const table = useReactTable({
        data: records,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    return (
        <div className="imcrm-overflow-auto imcrm-rounded-lg imcrm-border imcrm-border-border imcrm-bg-card">
            <table className="imcrm-w-full imcrm-text-sm">
                <thead className="imcrm-bg-muted/50">
                    {table.getHeaderGroups().map((hg) => (
                        <tr key={hg.id}>
                            <th className="imcrm-w-10 imcrm-px-3 imcrm-py-2">
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

                                return (
                                    <th
                                        key={h.id}
                                        className="imcrm-whitespace-nowrap imcrm-px-3 imcrm-py-2 imcrm-text-left imcrm-text-xs imcrm-font-medium imcrm-text-muted-foreground imcrm-uppercase imcrm-tracking-wide"
                                    >
                                        {fieldId !== null ? (
                                            <button
                                                type="button"
                                                onClick={(e) => onSortChange(fieldId, e.shiftKey)}
                                                className="imcrm-flex imcrm-items-center imcrm-gap-1.5 imcrm-rounded hover:imcrm-text-foreground"
                                            >
                                                {isPrimary && (
                                                    <KeyRound className="imcrm-h-3 imcrm-w-3 imcrm-text-primary" />
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
                                className="imcrm-px-4 imcrm-py-12 imcrm-text-center imcrm-text-sm imcrm-text-muted-foreground"
                            >
                                {__('No hay registros que coincidan.')}
                            </td>
                        </tr>
                    ) : (
                        table.getRowModel().rows.map((row) => {
                            const isSelected = selectedSet.has(row.original.id);
                            return (
                                <tr
                                    key={row.id}
                                    className={cn(
                                        'imcrm-border-t imcrm-border-border imcrm-transition-colors',
                                        isSelected
                                            ? 'imcrm-bg-primary/5'
                                            : 'hover:imcrm-bg-accent/30',
                                    )}
                                >
                                    <td
                                        className="imcrm-w-10 imcrm-px-3 imcrm-py-1.5 imcrm-align-top"
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
                                                className={cn(
                                                    'imcrm-whitespace-nowrap imcrm-px-3 imcrm-py-1.5 imcrm-align-top',
                                                    isOpenerCell && onRowClick && 'imcrm-cursor-pointer',
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

function SortIndicator({
    dir,
    index,
    multiCount,
}: {
    dir: 'asc' | 'desc' | null;
    index: number;
    multiCount: number;
}): JSX.Element | null {
    if (dir === null) {
        return <ArrowUpDown className="imcrm-h-3 imcrm-w-3 imcrm-opacity-30" />;
    }
    return (
        <span className="imcrm-flex imcrm-items-center imcrm-gap-0.5">
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
