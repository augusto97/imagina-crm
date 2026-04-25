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
