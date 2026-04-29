export type WidgetType =
    | 'kpi'
    | 'chart_bar'
    | 'chart_pie'
    | 'chart_line'
    | 'chart_area'
    | 'stat_delta'
    | 'table';

export type KpiMetric = 'count' | 'sum' | 'avg';

export interface WidgetLayout {
    x: number;
    y: number;
    w: number;
    h: number;
}

/**
 * Granularidad temporal para charts con eje de fecha. Cuando se setea
 * sobre `chart_bar`/`chart_pie` con un `group_by_field_id` de tipo
 * date/datetime, o sobre `chart_line`/`chart_area` (que siempre usan
 * date_field_id), define el `DATE_FORMAT` que usa el backend para
 * agrupar.
 */
export type ChartTimeBucket = 'day' | 'week' | 'month' | 'quarter' | 'year';

/**
 * Período del widget — atajo dedicado para limitar los datos a un
 * rango relativo (este mes, últimos 7 días, este año…) sin pasar
 * por el panel de filtros. El backend (`WidgetEvaluator`) lo
 * inyecta como una condición `between_relative` adicional en el
 * filter tree cada vez que se evalúa el widget. UX equivalente
 * al "Período" del eje X de los charts de ClickUp.
 *
 * Si está ausente o `null`, el widget no aplica restricción
 * temporal (consume el filter_tree tal cual).
 */
export interface WidgetPeriod {
    /** ID del campo date/datetime contra el que se aplica el rango. */
    field_id: number;
    /**
     * Slug del preset relativo (`this_month`, `last_7_days`, …, ver
     * `app/admin/records/dateRangePresets.ts`).
     */
    preset: string;
}

export interface WidgetSpec {
    id: string;
    type: WidgetType;
    list_id: number;
    title: string;
    config: {
        metric?: KpiMetric;
        metric_field_id?: number;
        group_by_field_id?: number;
        date_field_id?: number;
        /** Atajo de período relativo, ver `WidgetPeriod`. */
        period?: WidgetPeriod | null;
        /** Granularidad temporal para charts con eje de fecha. Default: month. */
        time_bucket?: ChartTimeBucket;
        /** Mostrar línea de promedio horizontal (bar/line/area). */
        show_average_line?: boolean;
        /** Mostrar valor numérico encima de cada barra / punto / sector. */
        show_data_labels?: boolean;
        /** Mostrar leyenda de series (pie / charts con multi-serie). */
        show_legend?: boolean;
        /**
         * Filtros opcionales aplicados al widget. Forma legacy plana
         * `{ field_<id>: { op: value } }` — sólo soporta AND. Si el
         * widget se guardó con OR/nesting, mira `filter_tree` en su
         * lugar (ambos pueden coexistir, pero `filter_tree` tiene
         * prioridad en el backend).
         */
        filters?: Record<string, Record<string, unknown>>;
        /**
         * Árbol completo de filtros (ClickUp-style). El backend
         * (`WidgetEvaluator`) lo pasa por
         * `QueryBuilder::compileTreeWhereForList` y lo respeta en
         * todas las queries que ejecuta el widget.
         */
        filter_tree?: unknown;
        [key: string]: unknown;
    };
    layout: WidgetLayout;
}

export interface DashboardEntity {
    id: number;
    user_id: number | null;
    name: string;
    description: string | null;
    widgets: WidgetSpec[];
    is_default: boolean;
    position: number;
    created_by: number;
    created_at: string;
    updated_at: string;
}

export interface CreateDashboardInput {
    name: string;
    description?: string | null;
    widgets?: WidgetSpec[];
    is_default?: boolean;
    is_shared?: boolean;
    position?: number;
}

export interface UpdateDashboardInput {
    name?: string;
    description?: string | null;
    widgets?: WidgetSpec[];
    is_default?: boolean;
    position?: number;
}

export type WidgetData =
    | { value: number; metric: KpiMetric }
    | { data: Array<{ label: string; value: number }> }
    | {
          /** stat_delta */
          value: number;
          previous: number;
          delta_pct: number | null;
          period_days: number;
          metric: KpiMetric;
      }
    | {
          /** table */
          columns: Array<{ label: string; slug: string; type: string }>;
          rows: Array<{ id: number; fields: Record<string, unknown> }>;
      };
