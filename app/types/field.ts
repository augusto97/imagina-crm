export type FieldTypeSlug =
    | 'text'
    | 'long_text'
    | 'number'
    | 'currency'
    | 'select'
    | 'multi_select'
    | 'date'
    | 'datetime'
    | 'checkbox'
    | 'url'
    | 'email'
    | 'user'
    | 'relation'
    | 'file';

export interface FieldTypeMeta {
    slug: FieldTypeSlug;
    label: string;
    has_column: boolean;
    supports_unique: boolean;
    config_schema: Record<string, Record<string, unknown>>;
}

export interface FieldEntity {
    id: number;
    list_id: number;
    slug: string;
    label: string;
    type: FieldTypeSlug;
    config: Record<string, unknown>;
    is_required: boolean;
    is_unique: boolean;
    is_primary: boolean;
    position: number;
    created_at: string;
    updated_at: string;
    column_name?: string;
}

export interface CreateFieldInput {
    label: string;
    type: FieldTypeSlug;
    slug?: string;
    config?: Record<string, unknown>;
    is_required?: boolean;
    is_unique?: boolean;
    is_primary?: boolean;
    position?: number;
}

export interface UpdateFieldInput {
    label?: string;
    slug?: string;
    config?: Record<string, unknown>;
    is_required?: boolean;
    is_unique?: boolean;
    is_primary?: boolean;
    position?: number;
}
