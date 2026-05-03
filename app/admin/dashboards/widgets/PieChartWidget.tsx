import { Loader2, TriangleAlert } from 'lucide-react';

import { useWidgetData } from '@/hooks/useDashboards';
import { __ } from '@/lib/i18n';
import type { WidgetSpec } from '@/types/dashboard';

interface PieChartWidgetProps {
    dashboardId: number;
    widget: WidgetSpec;
}

/**
 * Donut chart con leader-line labels (estilo ClickUp/Looker): cada
 * sector grande pinta su porcentaje + label afuera del aro con una
 * línea que conecta. Los segmentos chicos (<3%) caen sólo en la
 * leyenda lateral para no saturar.
 *
 * El SVG usa `aspect-square` y `h-full` — antes era 160×160 fijo y
 * se veía minúsculo cuando el widget se agrandaba en la grilla.
 *
 * Toggles del widget:
 *  - `show_data_labels` → labels alrededor del aro (default: on)
 *  - `show_legend`      → leyenda lateral (default: on)
 */
export function PieChartWidget({ dashboardId, widget }: PieChartWidgetProps): JSX.Element {
    const data = useWidgetData(dashboardId, widget.id);
    const showLabels = widget.config.show_data_labels !== false;
    const showLegend = widget.config.show_legend !== false;

    return (
        <div className="imcrm-flex imcrm-h-full imcrm-flex-col imcrm-gap-2 imcrm-min-h-0">
            <header className="imcrm-shrink-0">
                <h3 className="imcrm-text-[11px] imcrm-font-bold imcrm-uppercase imcrm-tracking-[0.06em] imcrm-text-muted-foreground">
                    {widget.title || __('Distribución')}
                </h3>
            </header>

            <div className="imcrm-flex imcrm-flex-1 imcrm-items-center imcrm-justify-center imcrm-min-h-0">
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
                    <Donut
                        rows={data.data.data}
                        showLabels={showLabels}
                        showLegend={showLegend}
                    />
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

interface DonutProps {
    rows: Array<{ label: string; value: number }>;
    showLabels: boolean;
    showLegend: boolean;
}

function Donut({ rows, showLabels, showLegend }: DonutProps): JSX.Element {
    const total = rows.reduce((acc, r) => acc + r.value, 0) || 1;
    // Viewbox amplio cuando mostramos labels alrededor para que las
    // etiquetas no se corten contra el borde del SVG.
    const viewSize = showLabels ? 220 : 100;
    const cx = viewSize / 2;
    const cy = viewSize / 2;
    // Donut delgado-medio. Stroke 14 es perfecto para vista pequeña;
    // a vista grande el aro se ve un toque delgado pero proporcionado.
    const radius = showLabels ? 40 : 42;
    const stroke = 14;
    const circumference = 2 * Math.PI * radius;

    let offset = 0;
    let cumulative = 0;
    return (
        <div className="imcrm-flex imcrm-h-full imcrm-w-full imcrm-items-center imcrm-gap-4 imcrm-min-h-0">
            <div className="imcrm-relative imcrm-flex imcrm-aspect-square imcrm-h-full imcrm-shrink-0 imcrm-items-center imcrm-justify-center">
                <svg
                    viewBox={`0 0 ${viewSize} ${viewSize}`}
                    className="imcrm-h-full imcrm-w-full"
                    preserveAspectRatio="xMidYMid meet"
                >
                    <circle
                        cx={cx}
                        cy={cy}
                        r={radius}
                        fill="none"
                        strokeWidth={stroke}
                        className="imcrm-stroke-muted"
                    />
                    {rows.map((row, i) => {
                        const pct = row.value / total;
                        const len = pct * circumference;
                        const dasharray = `${len} ${circumference - len}`;
                        const colorVar = `hsl(var(--imcrm-opt-${PALETTE[i % PALETTE.length]}))`;
                        const seg = (
                            <circle
                                key={`seg-${row.label}`}
                                cx={cx}
                                cy={cy}
                                r={radius}
                                fill="none"
                                strokeWidth={stroke}
                                stroke={colorVar}
                                strokeDasharray={dasharray}
                                strokeDashoffset={-offset}
                                transform={`rotate(-90 ${cx} ${cy})`}
                            >
                                <title>{`${row.label}: ${row.value.toLocaleString()} (${(pct * 100).toFixed(1)}%)`}</title>
                            </circle>
                        );
                        offset += len;
                        return seg;
                    })}

                    {showLabels && rows.map((row, i) => {
                        const pct = row.value / total;
                        if (pct < 0.03) {
                            cumulative += pct;
                            return null;
                        }
                        const angleDeg = -90 + 360 * (cumulative + pct / 2);
                        const angle = (angleDeg * Math.PI) / 180;
                        cumulative += pct;

                        const startR = radius + 10;
                        const elbowR = radius + 18;
                        const labelR = radius + 26;

                        const x1 = cx + Math.cos(angle) * startR;
                        const y1 = cy + Math.sin(angle) * startR;
                        const x2 = cx + Math.cos(angle) * elbowR;
                        const y2 = cy + Math.sin(angle) * elbowR;
                        const onRight = Math.cos(angle) >= 0;
                        const x3 = onRight ? x2 + 10 : x2 - 10;
                        const xText = cx + Math.cos(angle) * labelR + (onRight ? 6 : -6);

                        const colorVar = `hsl(var(--imcrm-opt-${PALETTE[i % PALETTE.length]}))`;
                        return (
                            <g key={`lbl-${row.label}`}>
                                <polyline
                                    points={`${x1.toFixed(1)},${y1.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)} ${x3.toFixed(1)},${y2.toFixed(1)}`}
                                    fill="none"
                                    stroke={colorVar}
                                    strokeWidth="0.8"
                                />
                                <text
                                    x={xText}
                                    y={y2 + 3}
                                    textAnchor={onRight ? 'start' : 'end'}
                                    className="imcrm-fill-foreground"
                                    style={{ fontSize: 7, fontWeight: 600 }}
                                >
                                    {row.label} {(pct * 100).toFixed(1)}%
                                </text>
                            </g>
                        );
                    })}

                    <text
                        x={cx}
                        y={cy}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="imcrm-fill-foreground"
                        style={{ fontSize: showLabels ? 12 : 14, fontWeight: 600 }}
                    >
                        {total.toLocaleString()}
                    </text>
                </svg>
            </div>

            {showLegend && (
                <ul className="imcrm-flex imcrm-min-w-0 imcrm-flex-1 imcrm-flex-col imcrm-gap-1 imcrm-overflow-y-auto imcrm-text-xs">
                    {rows.slice(0, 8).map((row, i) => (
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
                    {rows.length > 8 && (
                        <li className="imcrm-text-[10px] imcrm-text-muted-foreground/70">
                            +{rows.length - 8} {__('más')}
                        </li>
                    )}
                </ul>
            )}
        </div>
    );
}
