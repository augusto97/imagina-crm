import { Loader2, TriangleAlert } from 'lucide-react';

import { useWidgetData } from '@/hooks/useDashboards';
import { __ } from '@/lib/i18n';
import type { WidgetSpec } from '@/types/dashboard';

interface LineChartWidgetProps {
    dashboardId: number;
    widget: WidgetSpec;
}

/**
 * Line chart minimalista con SVG vanilla. El backend agrupa por mes
 * (YYYY-MM); cada punto es un mes. Se renderiza el polyline + dots,
 * sin ejes ni grid (cubre el caso "tendencia"). Tooltip básico via
 * <title> nativo del SVG.
 */
export function LineChartWidget({ dashboardId, widget }: LineChartWidgetProps): JSX.Element {
    const data = useWidgetData(dashboardId, widget.id);

    return (
        <div className="imcrm-flex imcrm-h-full imcrm-flex-col imcrm-gap-3">
            <header>
                <h3 className="imcrm-text-xs imcrm-font-medium imcrm-uppercase imcrm-tracking-wide imcrm-text-muted-foreground">
                    {widget.title || __('Tendencia mensual')}
                </h3>
            </header>

            <div className="imcrm-flex imcrm-flex-1 imcrm-items-center imcrm-justify-center">
                {data.isLoading ? (
                    <Loader2 className="imcrm-h-5 imcrm-w-5 imcrm-animate-spin imcrm-text-muted-foreground" />
                ) : data.isError ? (
                    <div
                        className="imcrm-flex imcrm-items-center imcrm-gap-1 imcrm-text-xs imcrm-text-destructive"
                        title={(data.error as Error).message}
                    >
                        <TriangleAlert className="imcrm-h-4 imcrm-w-4" />
                        {__('Error')}
                    </div>
                ) : data.data && 'data' in data.data && data.data.data.length > 0 ? (
                    <SparkLine rows={data.data.data} />
                ) : (
                    <p className="imcrm-text-xs imcrm-text-muted-foreground">{__('Sin datos.')}</p>
                )}
            </div>
        </div>
    );
}

const VIEWBOX_WIDTH = 300;
const VIEWBOX_HEIGHT = 100;
const PADDING = 8;

function SparkLine({ rows }: { rows: Array<{ label: string; value: number }> }): JSX.Element {
    const max = Math.max(...rows.map((r) => r.value), 1);
    const min = 0;
    const innerW = VIEWBOX_WIDTH - PADDING * 2;
    const innerH = VIEWBOX_HEIGHT - PADDING * 2;

    const points = rows.map((row, i) => {
        const x =
            rows.length === 1
                ? PADDING + innerW / 2
                : PADDING + (i / (rows.length - 1)) * innerW;
        const y = PADDING + innerH - ((row.value - min) / (max - min || 1)) * innerH;
        return { x, y, ...row };
    });

    const polylinePoints = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    return (
        <div className="imcrm-flex imcrm-w-full imcrm-flex-col imcrm-gap-1">
            <svg
                viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
                className="imcrm-w-full imcrm-h-24"
                role="img"
                aria-label="Tendencia mensual"
            >
                <polyline
                    points={polylinePoints}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="imcrm-text-primary"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                {points.map((p) => (
                    <circle
                        key={p.label}
                        cx={p.x}
                        cy={p.y}
                        r={2.5}
                        className="imcrm-fill-primary"
                    >
                        <title>{`${p.label}: ${p.value.toLocaleString()}`}</title>
                    </circle>
                ))}
            </svg>
            <div className="imcrm-flex imcrm-justify-between imcrm-text-[10px] imcrm-text-muted-foreground">
                <span>{points[0]?.label}</span>
                {points.length > 1 && <span>{points[points.length - 1]?.label}</span>}
            </div>
        </div>
    );
}
