import { __ } from '@/lib/i18n';
import type { FieldTypeSlug } from '@/types/field';
import type { FilterOperator } from '@/types/record';

interface OperatorMeta {
    op: FilterOperator;
    label: string;
    /** El operador no requiere valor (is_null, is_not_null). */
    nullary?: boolean;
}

const TEXT_LIKE: OperatorMeta[] = [
    { op: 'contains', label: __('contiene') },
    { op: 'eq', label: __('es') },
    { op: 'neq', label: __('no es') },
    { op: 'starts_with', label: __('empieza con') },
    { op: 'ends_with', label: __('termina con') },
    { op: 'is_null', label: __('está vacío'), nullary: true },
    { op: 'is_not_null', label: __('no está vacío'), nullary: true },
];

const NUMERIC: OperatorMeta[] = [
    { op: 'eq', label: '=' },
    { op: 'neq', label: '≠' },
    { op: 'gt', label: '>' },
    { op: 'gte', label: '≥' },
    { op: 'lt', label: '<' },
    { op: 'lte', label: '≤' },
    { op: 'is_null', label: __('está vacío'), nullary: true },
    { op: 'is_not_null', label: __('no está vacío'), nullary: true },
];

const DATE_LIKE: OperatorMeta[] = [
    { op: 'eq', label: __('es') },
    { op: 'neq', label: __('no es') },
    { op: 'gte', label: __('desde') },
    { op: 'lte', label: __('hasta') },
    { op: 'is_null', label: __('está vacío'), nullary: true },
    { op: 'is_not_null', label: __('no está vacío'), nullary: true },
];

const SELECT_LIKE: OperatorMeta[] = [
    { op: 'eq', label: __('es') },
    { op: 'neq', label: __('no es') },
    { op: 'in', label: __('es alguno de') },
    { op: 'nin', label: __('no es ninguno de') },
    { op: 'is_null', label: __('está vacío'), nullary: true },
    { op: 'is_not_null', label: __('no está vacío'), nullary: true },
];

const ID_LIKE: OperatorMeta[] = [
    { op: 'eq', label: '=' },
    { op: 'neq', label: '≠' },
    { op: 'in', label: __('es alguno de') },
    { op: 'nin', label: __('no es ninguno de') },
    { op: 'is_null', label: __('está vacío'), nullary: true },
    { op: 'is_not_null', label: __('no está vacío'), nullary: true },
];

export function operatorsForType(type: FieldTypeSlug): OperatorMeta[] {
    switch (type) {
        case 'text':
        case 'long_text':
        case 'email':
        case 'url':
            return TEXT_LIKE;
        case 'number':
        case 'currency':
            return NUMERIC;
        case 'date':
        case 'datetime':
            return DATE_LIKE;
        case 'select':
        case 'multi_select':
            return SELECT_LIKE;
        case 'checkbox':
            return [{ op: 'eq', label: '=' }];
        case 'user':
        case 'file':
            return ID_LIKE;
        case 'relation':
            // No filtrable en MVP (CLAUDE.md §9.4 — relation vive en wp_imcrm_relations).
            return [];
    }
}

export function isNullaryOperator(op: FilterOperator): boolean {
    return op === 'is_null' || op === 'is_not_null';
}
