import { Loader2, TriangleAlert } from 'lucide-react';

import { useWidgetData } from '@/hooks/useDashboards';
import { __ } from '@/lib/i18n';
import type { WidgetSpec } from '@/types/dashboard';

interface PieChartWidgetProps {
    dashboardId: number;
    widget: WidgetSpec;
}

/**
 * Donut chart SVG nativo — sin librería de charts. Misma data shape
 * que BarChartWidget (`{data: [{label, value}]}`), distinta
 * presentación: arcos coloreados con leyenda a la derecha.
 *
 * Paleta cyclic de 12 colores (las mismas tone-* de la marca) para
 * que cada segmento sea visualmente distinto.
 */
export function PieChartWidget({ dashboardId, widget }: PieChartWidgetProps): JSX.Element {
    const data = useWidgetData(dashboardId, widget.id);

    return (
        <div className="imcrm-flex imcrm-h-full imcrm-flex-col imcrm-gap-3">
            <header>
                <h3 className="imcrm-text-[11px] imcrm-font-bold imcrm-uppercase imcrm-tracking-[0.06em] imcrm-text-muted-foreground">
                    {widget.title || __('Distribución')}
                </h3>
            </header>

            <div className="imcrm-flex imcrm-flex-1 imcrm-items-center imcrm-justify-center">
                {data.isLoading ? (
                    <Loader2 className="imcrm-h-5 imcrm-w-5 imcrm-animate-spin imcrm-text-muted-foreground" />
                ) : data.isError ? (
                    <span
                        className="imcrm-flex imcrm-items-center imcrm-gap-1 imcrm-text-xs imcrm-text-destructive"
                        title={(data.error as Error).message}
                    >
                        <TriangleAlert className="imcrm-h-4 imcrm-w-4" />
                        {__('Error')}
                    </span>
                ) : data.data && 'data' in data.data && data.data.data.length > 0 ? (
                    <Donut rows={data.data.data} />
                ) : (
                    <p className="imcrm-text-xs imcrm-text-muted-foreground">{__('Sin datos.')}</p>
                )}
            </div>
        </div>
    );
}

const PALETTE = [
    'cyan', 'violet', 'green', 'amber', 'rose', 'blue',
    'teal', 'pink', 'orange', 'lime', 'yellow', 'gray',
];

function Donut({ rows }: { rows: Array<{ label: string; value: number }> }): JSX.Element {
    const total = rows.reduce((acc, r) => acc + r.value, 0) || 1;
    const radius = 42;
    const circumference = 2 * Math.PI * radius;

    let offset = 0;
    return (
        <div className="imcrm-flex imcrm-w-full imcrm-items-center imcrm-gap-4">
            <svg viewBox="0 0 100 100" className="imcrm-h-32 imcrm-w-32 imcrm-shrink-0">
                <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    strokeWidth="14"
                    className="imcrm-stroke-muted"
                />
                {rows.map((row, i) => {
                    const pct = row.value / total;
                    const len = pct * circumference;
                    const dasharray = `${len} ${circumference - len}`;
                    const colorVar = `hsl(var(--imcrm-opt-${PALETTE[i % PALETTE.length]}))`;
                    const seg = (
                        <circle
                            key={row.label}
                            cx="50"
                            cy="50"
                            r={radius}
                            fill="none"
                            strokeWidth="14"
                            stroke={colorVar}
                            strokeDasharray={dasharray}
                            strokeDashoffset={-offset}
                            transform="rotate(-90 50 50)"
                        />
                    );
                    offset += len;
                    return seg;
                })}
                <text
                    x="50"
                    y="50"
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="imcrm-fill-foreground"
                    style={{ fontSize: 14, fontWeight: 600 }}
                >
                    {total.toLocaleString()}
                </text>
            </svg>

            <ul className="imcrm-flex imcrm-min-w-0 imcrm-flex-1 imcrm-flex-col imcrm-gap-1 imcrm-text-xs">
                {rows.slice(0, 6).map((row, i) => (
                    <li key={row.label} className="imcrm-flex imcrm-items-center imcrm-gap-2">
                        <span
                            className="imcrm-h-2.5 imcrm-w-2.5 imcrm-shrink-0 imcrm-rounded-sm"
                            style={{ backgroundColor: `hsl(var(--imcrm-opt-${PALETTE[i % PALETTE.length]}))` }}
                            aria-hidden
                        />
                        <span className="imcrm-min-w-0 imcrm-flex-1 imcrm-truncate imcrm-text-muted-foreground" title={row.label}>
                            {row.label}
                        </span>
                        <span className="imcrm-shrink-0 imcrm-tabular-nums imcrm-font-semibold imcrm-text-foreground">
                            {row.value.toLocaleString()}
                        </span>
                    </li>
                ))}
                {rows.length > 6 && (
                    <li className="imcrm-text-[10px] imcrm-text-muted-foreground/70">
                        +{rows.length - 6} {__('más')}
                    </li>
                )}
            </ul>
        </div>
    );
}
