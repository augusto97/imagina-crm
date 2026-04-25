export type SavedViewType = 'table';

export interface SavedViewConfig {
    visible_fields?: number[];
    column_widths?: Record<string, number>;
    filters?: Array<{ field_id: number; op: string; value: unknown }>;
    sort?: Array<{ field_id: number; dir: 'asc' | 'desc' }>;
    search?: string;
}

export interface SavedViewEntity {
    id: number;
    list_id: number;
    user_id: number | null;
    name: string;
    type: SavedViewType;
    config: SavedViewConfig;
    is_default: boolean;
    position: number;
    created_at: string;
    updated_at: string;
}
