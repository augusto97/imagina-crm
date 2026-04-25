import { useMemo } from 'react';
import {
    flexRender,
    getCoreRowModel,
    useReactTable,
    type ColumnDef,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, KeyRound } from 'lucide-react';

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
    onRowClick?: (record: RecordEntity) => void;
}

/**
 * Vista de tabla sobre TanStack Table v8.
 *
 * - Headers clickeables: sort asc → desc → off; shift+click para multi.
 * - Celdas editables inline (delegado a `EditableCell`).
 * - Tipos no soportados inline (user, file, relation) muestran solo
 *   lectura — la edición se hará desde el RecordDetailDrawer (próximo).
 */
export function TableView({
    listId,
    fields,
    records,
    sort,
    onSortChange,
    onRowClick,
}: TableViewProps): JSX.Element {
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
                header: 'ID',
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
                header: 'Actualizado',
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
                                colSpan={columns.length}
                                className="imcrm-px-4 imcrm-py-12 imcrm-text-center imcrm-text-sm imcrm-text-muted-foreground"
                            >
                                No hay registros que coincidan.
                            </td>
                        </tr>
                    ) : (
                        table.getRowModel().rows.map((row) => (
                            <tr
                                key={row.id}
                                className={cn(
                                    'imcrm-border-t imcrm-border-border imcrm-transition-colors',
                                    onRowClick && 'hover:imcrm-bg-accent/30',
                                )}
                                onClick={(e) => {
                                    if ((e.target as HTMLElement).closest('button, input, select, a, textarea')) return;
                                    onRowClick?.(row.original);
                                }}
                            >
                                {row.getVisibleCells().map((cell) => (
                                    <td
                                        key={cell.id}
                                        className="imcrm-whitespace-nowrap imcrm-px-3 imcrm-py-1.5 imcrm-align-top"
                                    >
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </td>
                                ))}
                            </tr>
                        ))
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

// Mantener export del helper por si alguien lo importa.
export { renderCellValue };
