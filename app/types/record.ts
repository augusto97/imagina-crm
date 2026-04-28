export interface RecordEntity {
    id: number;
    fields: Record<string, unknown>;
    relations: Record<string, number[]>;
    created_by: number;
    created_at: string;
    updated_at: string;
}

export interface RecordListMeta {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
}

export interface RecordListResponse {
    data: RecordEntity[];
    meta: RecordListMeta;
}

export type FilterOperator =
    | 'eq'
    | 'neq'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'contains'
    | 'starts_with'
    | 'ends_with'
    | 'in'
    | 'nin'
    | 'is_null'
    | 'is_not_null';

export interface RecordsQuery {
    page?: number;
    per_page?: number;
    sort?: string;
    search?: string;
    fields?: string;
    filter?: Record<string, Partial<Record<FilterOperator, unknown>> | unknown>;
}

/**
 * Bucket de la respuesta del endpoint `/records/groups`.
 *
 * `value` es lo que el frontend usa para filtrar al expandir el grupo
 * (un eq simple para tipos escalares, un contains para multi_select).
 * `null` representa el grupo "(Sin valor)".
 */
export interface RecordGroupBucket {
    value: string | null;
    count: number;
}

export interface RecordGroupsResponse {
    data: RecordGroupBucket[];
    meta: {
        group_by_field_id: number;
        group_by_slug: string;
        group_by_type: string;
        total_groups: number;
        total_records: number;
    };
}

export const GROUPABLE_FIELD_TYPES = [
    'select',
    'multi_select',
    'user',
    'checkbox',
    'date',
    'datetime',
] as const;

export type GroupableFieldType = (typeof GROUPABLE_FIELD_TYPES)[number];

export function isGroupableType(type: string): type is GroupableFieldType {
    return (GROUPABLE_FIELD_TYPES as readonly string[]).includes(type);
}
