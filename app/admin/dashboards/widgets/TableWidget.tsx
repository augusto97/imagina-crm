import { Loader2, TriangleAlert } from 'lucide-react';

import { __ } from '@/lib/i18n';
import { useWidgetData } from '@/hooks/useDashboards';
import type { WidgetSpec } from '@/types/dashboard';

interface TableWidgetProps {
    dashboardId: number;
    widget: WidgetSpec;
}

/**
 * Top N rows ordenados por un campo. Útil como "leaderboard" o
 * "últimos N records". El backend devuelve `{columns, rows}` donde
 * cada column tiene `{label, slug, type}` — el frontend solo formatea
 * fechas / numbers / booleans básicos. Para chips coloreados de
 * select/multi_select cae a string crudo (full polish requiere
 * traer config completo del field, fuera del scope de este widget).
 */
export function TableWidget({ dashboardId, widget }: TableWidgetProps): JSX.Element {
    const data = useWidgetData(dashboardId, widget.id);

    return (
        <div className="imcrm-flex imcrm-h-full imcrm-flex-col imcrm-gap-3">
            <header>
                <h3 className="imcrm-text-[11px] imcrm-font-bold imcrm-uppercase imcrm-tracking-[0.06em] imcrm-text-muted-foreground">
                    {widget.title || __('Top registros')}
                </h3>
            </header>

            <div className="imcrm-flex imcrm-flex-1 imcrm-min-h-0 imcrm-flex-col imcrm-overflow-auto imcrm-rounded-lg imcrm-border imcrm-border-border">
                {data.isLoading ? (
                    <div className="imcrm-flex imcrm-flex-1 imcrm-items-center imcrm-justify-center imcrm-py-6">
                        <Loader2 className="imcrm-h-5 imcrm-w-5 imcrm-animate-spin imcrm-text-muted-foreground" />
                    </div>
                ) : data.isError ? (
                    <div className="imcrm-flex imcrm-items-center imcrm-justify-center imcrm-gap-1.5 imcrm-py-6 imcrm-text-xs imcrm-text-destructive">
                        <TriangleAlert className="imcrm-h-4 imcrm-w-4" />
                        {__('Error al cargar')}
                    </div>
                ) : data.data && 'rows' in data.data ? (
                    <Body
                        columns={data.data.columns}
                        rows={data.data.rows}
                    />
                ) : null}
            </div>
        </div>
    );
}

function Body({
    columns,
    rows,
}: {
    columns: Array<{ label: string; slug: string; type: string }>;
    rows: Array<{ id: number; fields: Record<string, unknown> }>;
}): JSX.Element {
    if (rows.length === 0) {
        return (
            <p className="imcrm-py-6 imcrm-text-center imcrm-text-xs imcrm-text-muted-foreground">
                {__('Sin datos.')}
            </p>
        );
    }

    return (
        <table className="imcrm-w-full imcrm-text-sm">
            <thead className="imcrm-sticky imcrm-top-0 imcrm-bg-canvas">
                <tr className="imcrm-border-b imcrm-border-border">
                    {columns.map((col) => (
                        <th
                            key={col.slug}
                            scope="col"
                            className="imcrm-whitespace-nowrap imcrm-px-3 imcrm-py-2 imcrm-text-left imcrm-text-[10px] imcrm-font-bold imcrm-uppercase imcrm-tracking-[0.06em] imcrm-text-muted-foreground"
                        >
                            {col.label}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {rows.map((row) => (
                    <tr
                        key={row.id}
                        className="imcrm-border-t imcrm-border-border/50 hover:imcrm-bg-accent/40"
                    >
                        {columns.map((col) => (
                            <td
                                key={col.slug}
                                className="imcrm-whitespace-nowrap imcrm-px-3 imcrm-py-1.5 imcrm-align-middle imcrm-text-[13px]"
                            >
                                {formatCell(col.type, row.fields[col.slug])}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function formatCell(type: string, value: unknown): React.ReactNode {
    if (value === null || value === undefined || value === '') {
        return <span className="imcrm-text-muted-foreground/60">—</span>;
    }
    if (type === 'checkbox') {
        return value === '1' || value === 1 || value === true ? '✓' : '—';
    }
    if (type === 'datetime' && typeof value === 'string') {
        try {
            return new Date(value + 'Z').toLocaleString();
        } catch {
            return value;
        }
    }
    if (type === 'date' && typeof value === 'string') {
        return value;
    }
    if (type === 'currency' && typeof value === 'number') {
        return value.toLocaleString(undefined, { minimumFractionDigits: 2 });
    }
    if (type === 'multi_select' && typeof value === 'string') {
        // Backend devuelve JSON crudo de la columna multi_select.
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                return (
                    <span className="imcrm-flex imcrm-flex-wrap imcrm-gap-1">
                        {parsed.map((v, i) => (
                            <span
                                key={i}
                                className="imcrm-rounded imcrm-bg-muted imcrm-px-1.5 imcrm-py-0.5 imcrm-text-[11px]"
                            >
                                {String(v)}
                            </span>
                        ))}
                    </span>
                );
            }
        } catch {
            // fall through
        }
    }
    return String(value);
}
