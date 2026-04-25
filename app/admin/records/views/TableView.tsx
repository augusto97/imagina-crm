import { useMemo } from 'react';
import {
    flexRender,
    getCoreRowModel,
    useReactTable,
    type ColumnDef,
} from '@tanstack/react-table';

import { cn } from '@/lib/utils';
import type { FieldEntity } from '@/types/field';
import type { RecordEntity } from '@/types/record';

interface TableViewProps {
    fields: FieldEntity[];
    records: RecordEntity[];
    onRowClick?: (record: RecordEntity) => void;
}

/**
 * Vista de tabla read-only sobre TanStack Table v8. Esta es la primera
 * iteración del MVP — la edición inline, virtualización, sort multi-columna
 * y filtros visuales se añaden en commits subsiguientes una vez validado el
 * camino completo.
 */
export function TableView({ fields, records, onRowClick }: TableViewProps): JSX.Element {
    const columns = useMemo<ColumnDef<RecordEntity>[]>(() => {
        const dynamic = fields
            .filter((f) => f.type !== 'relation')
            .sort((a, b) => a.position - b.position)
            .map<ColumnDef<RecordEntity>>((field) => ({
                id: field.slug,
                header: field.label,
                accessorFn: (row) => row.fields[field.slug],
                cell: (ctx) => formatValue(field, ctx.getValue()),
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
            },
        ];
    }, [fields]);

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
                            {hg.headers.map((h) => (
                                <th
                                    key={h.id}
                                    className="imcrm-whitespace-nowrap imcrm-px-3 imcrm-py-2 imcrm-text-left imcrm-text-xs imcrm-font-medium imcrm-text-muted-foreground imcrm-uppercase imcrm-tracking-wide"
                                >
                                    {h.isPlaceholder
                                        ? null
                                        : flexRender(h.column.columnDef.header, h.getContext())}
                                </th>
                            ))}
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
                                No hay registros aún. Crea uno para empezar.
                            </td>
                        </tr>
                    ) : (
                        table.getRowModel().rows.map((row) => (
                            <tr
                                key={row.id}
                                className={cn(
                                    'imcrm-border-t imcrm-border-border imcrm-transition-colors',
                                    onRowClick &&
                                        'hover:imcrm-bg-accent/40 imcrm-cursor-pointer',
                                )}
                                onClick={() => onRowClick?.(row.original)}
                            >
                                {row.getVisibleCells().map((cell) => (
                                    <td
                                        key={cell.id}
                                        className="imcrm-whitespace-nowrap imcrm-px-3 imcrm-py-2"
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

function formatValue(field: FieldEntity, value: unknown): React.ReactNode {
    if (value === null || value === undefined || value === '') {
        return <span className="imcrm-text-muted-foreground">—</span>;
    }

    if (field.type === 'checkbox') {
        return value ? '✓' : '—';
    }

    if (field.type === 'multi_select' && Array.isArray(value)) {
        return (
            <div className="imcrm-flex imcrm-flex-wrap imcrm-gap-1">
                {value.map((v, i) => (
                    <span
                        key={i}
                        className="imcrm-rounded-md imcrm-bg-secondary imcrm-px-1.5 imcrm-py-0.5 imcrm-text-xs"
                    >
                        {String(v)}
                    </span>
                ))}
            </div>
        );
    }

    if (field.type === 'datetime' && typeof value === 'string') {
        try {
            return new Date(value + 'Z').toLocaleString();
        } catch {
            return value;
        }
    }

    if (field.type === 'currency' && typeof value === 'number') {
        return value.toLocaleString(undefined, { minimumFractionDigits: 2 });
    }

    if (field.type === 'url' && typeof value === 'string') {
        return (
            <a
                href={value}
                target="_blank"
                rel="noreferrer"
                className="imcrm-text-primary hover:imcrm-underline"
                onClick={(e) => e.stopPropagation()}
            >
                {value}
            </a>
        );
    }

    return String(value);
}
