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
