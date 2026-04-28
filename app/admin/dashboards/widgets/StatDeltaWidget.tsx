import { Loader2, TrendingDown, TrendingUp, TriangleAlert } from 'lucide-react';

import { useWidgetData } from '@/hooks/useDashboards';
import { __, sprintf } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { WidgetSpec } from '@/types/dashboard';

interface StatDeltaWidgetProps {
    dashboardId: number;
    widget: WidgetSpec;
}

/**
 * KPI con comparación vs período anterior — el clásico "growth tile"
 * de cualquier dashboard SaaS. Backend computa current + previous
 * + delta_pct sobre 2 ventanas consecutivas de N días definidas en
 * `config.period_days`.
 */
export function StatDeltaWidget({ dashboardId, widget }: StatDeltaWidgetProps): JSX.Element {
    const data = useWidgetData(dashboardId, widget.id);

    return (
        <div className="imcrm-flex imcrm-h-full imcrm-flex-col imcrm-gap-3">
            <header>
                <h3 className="imcrm-text-[11px] imcrm-font-bold imcrm-uppercase imcrm-tracking-[0.06em] imcrm-text-muted-foreground">
                    {widget.title || __('Crecimiento')}
                </h3>
            </header>

            <div className="imcrm-flex imcrm-flex-1 imcrm-flex-col imcrm-justify-end imcrm-gap-1.5">
                {data.isLoading ? (
                    <Loader2 className="imcrm-h-6 imcrm-w-6 imcrm-animate-spin imcrm-text-muted-foreground" />
                ) : data.isError ? (
                    <span className="imcrm-flex imcrm-items-center imcrm-gap-1.5 imcrm-text-sm imcrm-text-destructive">
                        <TriangleAlert className="imcrm-h-4 imcrm-w-4" />
                        {__('Error al cargar')}
                    </span>
                ) : data.data && 'previous' in data.data ? (
                    <Body
                        value={data.data.value as number}
                        previous={data.data.previous as number}
                        deltaPct={data.data.delta_pct as number | null}
                        periodDays={data.data.period_days as number}
                    />
                ) : null}
            </div>
        </div>
    );
}

function Body({
    value,
    previous,
    deltaPct,
    periodDays,
}: {
    value: number;
    previous: number;
    deltaPct: number | null;
    periodDays: number;
}): JSX.Element {
    const isUp   = deltaPct !== null && deltaPct >= 0;
    const isDown = deltaPct !== null && deltaPct < 0;
    const Trend  = isUp ? TrendingUp : TrendingDown;

    return (
        <>
            <span className="imcrm-text-4xl imcrm-font-bold imcrm-leading-none imcrm-tabular-nums imcrm-text-foreground">
                {format(value)}
            </span>

            <div className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-text-xs">
                {deltaPct !== null && (
                    <span
                        className={cn(
                            'imcrm-inline-flex imcrm-items-center imcrm-gap-1 imcrm-rounded imcrm-px-1.5 imcrm-py-0.5 imcrm-font-semibold',
                            isUp
                                ? 'imcrm-bg-success/10 imcrm-text-success'
                                : isDown
                                  ? 'imcrm-bg-destructive/10 imcrm-text-destructive'
                                  : 'imcrm-bg-muted imcrm-text-muted-foreground',
                        )}
                    >
                        <Trend className="imcrm-h-3 imcrm-w-3" />
                        {deltaPct > 0 && '+'}
                        {deltaPct.toFixed(1)}%
                    </span>
                )}
                <span className="imcrm-text-muted-foreground">
                    {sprintf(
                        /* translators: 1: previous period value, 2: previous period days */
                        __('vs %1$s en los %2$d días previos'),
                        format(previous),
                        periodDays,
                    )}
                </span>
            </div>
        </>
    );
}

function format(v: number): string {
    if (Number.isInteger(v)) return v.toLocaleString();
    return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
