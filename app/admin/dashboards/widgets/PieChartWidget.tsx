import { Loader2, TriangleAlert } from 'lucide-react';

import { useWidgetData } from '@/hooks/useDashboards';
import { __ } from '@/lib/i18n';
import type { WidgetSpec } from '@/types/dashboard';

import { categoryColor, useGroupColorMap } from './useChartColors';

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
 * 0.57.39 — cada sector usa el color REAL de la opción del select
 * agrupado (coherente con Kanban/chips); leyenda muestra valor + %;
 * centro del donut con total + sublabel.
 *
 * Toggles del widget:
 *  - `show_data_labels` → labels alrededor del aro (default: on)
 *  - `show_legend`      → leyenda lateral (default: on)
 */
export function PieChartWidget({ dashboardId, widget }: PieChartWidgetProps): JSX.Element {
    const data = useWidgetData(dashboardId, widget.id);
    const showLabels = widget.config.show_data_labels !== false;
    const showLegend = widget.config.show_legend !== false;
    const colorMap = useGroupColorMap(widget.list_id, widget.config.group_by_field_id);

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
                        rows={data.data.data.map((r) => ({ label: r.label, value: typeof r.value === 'number' ? r.value : Date.parse(r.value) || 0 }))}
                        showLabels={showLabels}
                        showLegend={showLegend}
                        colorMap={colorMap}
                    />
                ) : (
                    <p className="imcrm-text-xs imcrm-text-muted-foreground">{__('Sin datos.')}</p>
                )}
            </div>
        </div>
    );
}

interface DonutProps {
    rows: Array<{ label: string; value: number }>;
    showLabels: boolean;
    showLegend: boolean;
    colorMap: Map<string, string>;
}

function Donut({ rows, showLabels, showLegend, colorMap }: DonutProps): JSX.Element {
    const total = rows.reduce((acc, r) => acc + r.value, 0) || 1;
    // Viewbox amplio cuando mostramos labels alrededor para que las
    // etiquetas no se corten contra el borde del SVG.
    const viewSize = showLabels ? 220 : 100;
    const cx = viewSize / 2;
    const cy = viewSize / 2;
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
                        const color = categoryColor(colorMap, row.label, i);
                        const seg = (
                            <circle
                                key={`seg-${row.label}`}
                                cx={cx}
                                cy={cy}
                                r={radius}
                                fill="none"
                                strokeWidth={stroke}
                                stroke={color}
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

                        const color = categoryColor(colorMap, row.label, i);
                        return (
                            <g key={`lbl-${row.label}`}>
                                <polyline
                                    points={`${x1.toFixed(1)},${y1.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)} ${x3.toFixed(1)},${y2.toFixed(1)}`}
                                    fill="none"
                                    stroke={color}
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
                        y={cy - (showLabels ? 3 : 4)}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="imcrm-fill-foreground"
                        style={{ fontSize: showLabels ? 13 : 15, fontWeight: 700 }}
                    >
                        {total.toLocaleString()}
                    </text>
                    <text
                        x={cx}
                        y={cy + (showLabels ? 8 : 9)}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="imcrm-fill-muted-foreground"
                        style={{ fontSize: showLabels ? 6 : 7, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}
                    >
                        {__('Total')}
                    </text>
                </svg>
            </div>

            {showLegend && (
                <ul className="imcrm-flex imcrm-min-w-0 imcrm-flex-1 imcrm-flex-col imcrm-gap-1 imcrm-overflow-y-auto imcrm-text-xs">
                    {rows.slice(0, 8).map((row, i) => {
                        const pct = (row.value / total) * 100;
                        return (
                            <li key={row.label} className="imcrm-flex imcrm-items-center imcrm-gap-2">
                                <span
                                    className="imcrm-h-2.5 imcrm-w-2.5 imcrm-shrink-0 imcrm-rounded-sm"
                                    style={{ backgroundColor: categoryColor(colorMap, row.label, i) }}
                                    aria-hidden
                                />
                                <span className="imcrm-min-w-0 imcrm-flex-1 imcrm-truncate imcrm-text-muted-foreground" title={row.label}>
                                    {row.label}
                                </span>
                                <span className="imcrm-shrink-0 imcrm-tabular-nums imcrm-font-semibold imcrm-text-foreground">
                                    {row.value.toLocaleString()}
                                </span>
                                <span className="imcrm-w-9 imcrm-shrink-0 imcrm-text-right imcrm-tabular-nums imcrm-text-[10px] imcrm-text-muted-foreground/80">
                                    {pct.toFixed(0)}%
                                </span>
                            </li>
                        );
                    })}
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
