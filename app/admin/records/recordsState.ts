import type { FilterOperator, RecordsQuery } from '@/types/record';

export interface ActiveFilter {
    /** ID estable del campo (no slug — sobrevive a renames). */
    field_id: number;
    op: FilterOperator;
    value: unknown;
}

export interface ActiveSort {
    field_id: number;
    dir: 'asc' | 'desc';
}

export interface RecordsState {
    page: number;
    perPage: number;
    filters: ActiveFilter[];
    sort: ActiveSort[];
    search: string;
    /** Visibilidad por column id (TanStack Table convention). `false`
     * = oculta. Si la key no existe, la columna está visible. */
    columnVisibility: Record<string, boolean>;
    /** Anchura por column id en px (resizing). Si la key no existe,
     * usa el `size` default de la columna. */
    columnSizing: Record<string, number>;
}

export const DEFAULT_PER_PAGE = 50;

export const INITIAL_STATE: RecordsState = {
    page: 1,
    perPage: DEFAULT_PER_PAGE,
    filters: [],
    sort: [],
    search: '',
    columnVisibility: {},
    columnSizing: {},
};

/**
 * Convierte el estado del frontend al shape `RecordsQuery` que entiende
 * la REST API. Usa `field_<id>` para que las consultas guardadas no se
 * rompan si el slug cambia.
 */
export function buildRecordsQuery(state: RecordsState): RecordsQuery {
    const query: RecordsQuery = {
        page: state.page,
        per_page: state.perPage,
    };

    if (state.search.trim() !== '') {
        query.search = state.search.trim();
    }

    if (state.sort.length > 0) {
        query.sort = state.sort.map((s) => `field_${s.field_id}:${s.dir}`).join(',');
    }

    if (state.filters.length > 0) {
        const filter: NonNullable<RecordsQuery['filter']> = {};
        for (const f of state.filters) {
            const key = `field_${f.field_id}`;
            const existing = (filter[key] as Partial<Record<FilterOperator, unknown>> | undefined) ?? {};
            existing[f.op] = f.value;
            filter[key] = existing;
        }
        query.filter = filter;
    }

    return query;
}

/**
 * Toggle del sort cuando se clickea en un header.
 *
 * - Click sin shift: reemplaza el sort entero con esta columna asc.
 * - Click sin shift sobre la columna ya activa: alterna asc → desc → off.
 * - Shift+click: añade la columna al sort multi-columna; si ya está,
 *   alterna su dir; si está en desc, la quita.
 */
export function toggleSort(
    current: ActiveSort[],
    fieldId: number,
    multi: boolean,
): ActiveSort[] {
    const existingIndex = current.findIndex((s) => s.field_id === fieldId);

    if (!multi) {
        if (existingIndex === -1) {
            return [{ field_id: fieldId, dir: 'asc' }];
        }
        const existing = current[existingIndex];
        if (!existing) {
            return [{ field_id: fieldId, dir: 'asc' }];
        }
        if (existing.dir === 'asc') {
            return [{ field_id: fieldId, dir: 'desc' }];
        }
        return [];
    }

    if (existingIndex === -1) {
        return [...current, { field_id: fieldId, dir: 'asc' }];
    }

    const existing = current[existingIndex];
    if (!existing) return current;

    if (existing.dir === 'asc') {
        const next = [...current];
        next[existingIndex] = { field_id: fieldId, dir: 'desc' };
        return next;
    }

    return current.filter((_, i) => i !== existingIndex);
}
