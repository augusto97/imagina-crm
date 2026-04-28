import type { FilterOperator } from '@/types/record';
import type { SavedViewConfig } from '@/types/view';

import type { ActiveFilter, ActiveSort, RecordsState } from '../recordsState';

/**
 * Convierte el estado del UI en el `config` que persistimos en
 * `wp_imcrm_saved_views.config`. Solo guardamos filters/sort/search por
 * ahora; visible_fields/column_widths llegarán cuando tengamos UI para
 * mostrar/ocultar columnas y resize.
 */
export function stateToViewConfig(state: RecordsState): SavedViewConfig {
    const config: SavedViewConfig = {};
    if (state.filters.length > 0) {
        config.filters = state.filters.map((f) => ({
            field_id: f.field_id,
            op: f.op,
            value: f.value,
        }));
    }
    if (state.sort.length > 0) {
        config.sort = state.sort.map((s) => ({ field_id: s.field_id, dir: s.dir }));
    }
    if (state.search.trim() !== '') {
        config.search = state.search.trim();
    }
    const hidden = Object.entries(state.columnVisibility)
        .filter(([, v]) => v === false)
        .map(([k]) => k);
    if (hidden.length > 0) {
        config.hidden_columns = hidden;
    }
    if (Object.keys(state.columnSizing).length > 0) {
        config.column_widths = state.columnSizing;
    }
    if (state.groupByFieldId !== null) {
        config.group_by_field_id = state.groupByFieldId;
    }
    return config;
}

/**
 * Inverso: aplica la configuración guardada al estado del UI.
 *
 * Mantenemos la paginación local (no se persiste por vista) y se vuelve a
 * la página 1 al cambiar de vista para que el usuario vea resultados desde
 * el principio.
 */
export function viewConfigToState(config: SavedViewConfig, perPage: number): RecordsState {
    const filters: ActiveFilter[] = (config.filters ?? []).map((f) => ({
        field_id: f.field_id,
        op: f.op as FilterOperator,
        value: f.value,
    }));
    const sort: ActiveSort[] = (config.sort ?? []).map((s) => ({
        field_id: s.field_id,
        dir: s.dir,
    }));

    const columnVisibility: Record<string, boolean> = {};
    for (const id of config.hidden_columns ?? []) {
        columnVisibility[id] = false;
    }

    return {
        page: 1,
        perPage,
        filters,
        sort,
        search: config.search ?? '',
        columnVisibility,
        columnSizing: config.column_widths ?? {},
        groupByFieldId: config.group_by_field_id ?? null,
    };
}

/**
 * Compara semánticamente el estado actual contra la configuración de la
 * vista activa. Devuelve `true` si hay diferencias persistibles
 * (filters/sort/search). La paginación NO cuenta como cambio.
 */
export function hasChangesVsView(state: RecordsState, config: SavedViewConfig): boolean {
    const a = JSON.stringify(stateToViewConfig(state));
    const b = JSON.stringify(stripPaginationOnlyKeys(config));
    return a !== b;
}

function stripPaginationOnlyKeys(config: SavedViewConfig): SavedViewConfig {
    const out: SavedViewConfig = {};
    if (config.filters && config.filters.length > 0) out.filters = config.filters;
    if (config.sort && config.sort.length > 0) out.sort = config.sort;
    if (config.search && config.search.trim() !== '') out.search = config.search.trim();
    if (config.hidden_columns && config.hidden_columns.length > 0) {
        out.hidden_columns = config.hidden_columns;
    }
    if (config.column_widths && Object.keys(config.column_widths).length > 0) {
        out.column_widths = config.column_widths;
    }
    if (config.group_by_field_id !== undefined) {
        out.group_by_field_id = config.group_by_field_id;
    }
    return out;
}
