import { Loader2, TriangleAlert } from 'lucide-react';

import { useWidgetData } from '@/hooks/useDashboards';
import { __ } from '@/lib/i18n';
import type { WidgetSpec } from '@/types/dashboard';

interface KpiWidgetProps {
    dashboardId: number;
    widget: WidgetSpec;
}

/**
 * Render simple para widgets `kpi`: un número grande con label y la
 * unidad/metric debajo.
 */
export function KpiWidget({ dashboardId, widget }: KpiWidgetProps): JSX.Element {
    const data = useWidgetData(dashboardId, widget.id);

    return (
        <div className="imcrm-flex imcrm-h-full imcrm-flex-col imcrm-gap-3">
            <header className="imcrm-flex imcrm-items-start imcrm-justify-between imcrm-gap-2">
                <h3 className="imcrm-text-[11px] imcrm-font-bold imcrm-uppercase imcrm-tracking-[0.06em] imcrm-text-muted-foreground">
                    {widget.title || __('KPI')}
                </h3>
            </header>

            <div className="imcrm-flex imcrm-flex-1 imcrm-flex-col imcrm-justify-end imcrm-gap-1">
                {data.isLoading ? (
                    <Loader2 className="imcrm-h-6 imcrm-w-6 imcrm-animate-spin imcrm-text-muted-foreground" />
                ) : data.isError ? (
                    <span
                        className="imcrm-flex imcrm-items-center imcrm-gap-1.5 imcrm-text-sm imcrm-text-destructive"
                        title={(data.error as Error).message}
                    >
                        <TriangleAlert className="imcrm-h-4 imcrm-w-4" />
                        {__('Error al cargar')}
                    </span>
                ) : data.data && 'value' in data.data ? (
                    <>
                        <span className="imcrm-text-4xl imcrm-font-bold imcrm-tabular-nums imcrm-leading-none imcrm-text-foreground">
                            {formatValue(data.data.value, data.data.metric)}
                        </span>
                        {widget.config.metric && (
                            <span className="imcrm-text-xs imcrm-font-medium imcrm-text-muted-foreground">
                                {labelForMetric(widget.config.metric)}
                            </span>
                        )}
                    </>
                ) : null}
            </div>
        </div>
    );
}

function formatValue(value: number, metric: string): string {
    if (metric === 'avg') {
        return value.toFixed(2);
    }
    if (Number.isInteger(value)) {
        return value.toLocaleString();
    }
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function labelForMetric(metric: string): string {
    switch (metric) {
        case 'count':
            return __('Conteo');
        case 'sum':
            return __('Suma');
        case 'avg':
            return __('Promedio');
        default:
            return metric;
    }
}
