import { Loader2, TriangleAlert } from 'lucide-react';

import { useWidgetData } from '@/hooks/useDashboards';
import { __ } from '@/lib/i18n';
import type { WidgetSpec } from '@/types/dashboard';

interface BarChartWidgetProps {
    dashboardId: number;
    widget: WidgetSpec;
}

/**
 * Bar chart horizontal hecho con divs flexbox — sin librería de charts.
 * Cada barra es una row con label, fill proporcional al máximo y conteo
 * a la derecha.
 *
 * Toggles del widget config:
 *  - `show_average_line` → línea vertical punteada en el promedio
 *  - `show_data_labels`  → siempre mostramos el valor numérico, ya
 *                          es parte del layout base (no aplica acá)
 *  - `show_legend`       → bar chart no tiene multi-serie todavía
 */
export function BarChartWidget({ dashboardId, widget }: BarChartWidgetProps): JSX.Element {
    const data = useWidgetData(dashboardId, widget.id);
    const showAvg = Boolean(widget.config.show_average_line);

    return (
        <div className="imcrm-flex imcrm-h-full imcrm-flex-col imcrm-gap-3">
            <header>
                <h3 className="imcrm-text-[11px] imcrm-font-bold imcrm-uppercase imcrm-tracking-[0.06em] imcrm-text-muted-foreground">
                    {widget.title || __('Distribución')}
                </h3>
            </header>

            <div className="imcrm-flex imcrm-flex-1 imcrm-flex-col imcrm-justify-center">
                {data.isLoading ? (
                    <div className="imcrm-flex imcrm-items-center imcrm-justify-center">
                        <Loader2 className="imcrm-h-5 imcrm-w-5 imcrm-animate-spin imcrm-text-muted-foreground" />
                    </div>
                ) : data.isError ? (
                    <div
                        className="imcrm-flex imcrm-items-center imcrm-justify-center imcrm-gap-1 imcrm-text-xs imcrm-text-destructive"
                        title={(data.error as Error).message}
                    >
                        <TriangleAlert className="imcrm-h-4 imcrm-w-4" />
                        {__('Error')}
                    </div>
                ) : data.data && 'data' in data.data && data.data.data.length > 0 ? (
                    <BarRows rows={data.data.data} showAvg={showAvg} />
                ) : (
                    <p className="imcrm-text-center imcrm-text-xs imcrm-text-muted-foreground">
                        {__('Sin datos.')}
                    </p>
                )}
            </div>
        </div>
    );
}

function BarRows({
    rows,
    showAvg,
}: {
    rows: Array<{ label: string; value: number }>;
    showAvg: boolean;
}): JSX.Element {
    const max = Math.max(...rows.map((r) => r.value), 1);
    const avg = rows.reduce((sum, r) => sum + r.value, 0) / rows.length;
    const avgPct = (avg / max) * 100;

    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
            {showAvg && (
                <div className="imcrm-flex imcrm-items-center imcrm-justify-end imcrm-text-[10px] imcrm-text-muted-foreground">
                    {__('Promedio')}: <span className="imcrm-ml-1 imcrm-font-medium imcrm-text-foreground">{avg.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
            )}
            <ul className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                {rows.map((row) => {
                    const pct = (row.value / max) * 100;
                    return (
                        <li
                            key={row.label}
                            className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-text-xs"
                            title={`${row.label}: ${row.value.toLocaleString()}`}
                        >
                            <span className="imcrm-w-24 imcrm-shrink-0 imcrm-truncate imcrm-text-muted-foreground">
                                {row.label}
                            </span>
                            <div className="imcrm-relative imcrm-h-4 imcrm-flex-1 imcrm-rounded imcrm-bg-muted/50">
                                <div
                                    className="imcrm-absolute imcrm-inset-y-0 imcrm-left-0 imcrm-rounded imcrm-bg-primary"
                                    style={{ width: `${pct}%` }}
                                    aria-hidden
                                />
                                {showAvg && (
                                    // Marca punteada vertical en la posición del promedio.
                                    <div
                                        className="imcrm-pointer-events-none imcrm-absolute imcrm-inset-y-[-2px] imcrm-w-px imcrm-border-l imcrm-border-dashed imcrm-border-destructive"
                                        style={{ left: `${avgPct}%` }}
                                        aria-hidden
                                    />
                                )}
                            </div>
                            <span className="imcrm-w-10 imcrm-shrink-0 imcrm-text-right imcrm-tabular-nums imcrm-font-medium imcrm-text-foreground">
                                {row.value.toLocaleString()}
                            </span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
