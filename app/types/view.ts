export type SavedViewType = 'table' | 'kanban' | 'calendar';

export interface SavedViewConfig {
    visible_fields?: number[];
    /** Column ids ocultos (Excel-style hide). Usa el `id` de la
     * columna TanStack Table — para campos dinámicos es el slug del
     * field, para columnas fijas es 'id' / 'updated_at' / etc. */
    hidden_columns?: string[];
    /** Anchura por columna en px. Persistida cuando el usuario hace
     * drag del resizer. Excel-style. */
    column_widths?: Record<string, number>;
    /**
     * Forma legacy plana: `[{field_id, op, value}, ...]`. Solo se
     * usaba cuando los filtros eran AND plano. Se mantiene como
     * espejo opcional cuando `filter_tree` es AND plano para
     * compatibilidad con backends antiguos. Para árboles con OR /
     * nested, este campo NO se escribe.
     */
    filters?: Array<{ field_id: number; op: string; value: unknown }>;
    /**
     * Árbol completo de filtros (forma nueva, ClickUp-style). Tipo
     * declarado como `unknown` porque `view.ts` se importa desde
     * código que no debe traer toda la cadena de tipos del filtro;
     * los consumers (`viewConfigToState`) lo castean a `FilterTree`.
     */
    filter_tree?: unknown;
    sort?: Array<{ field_id: number; dir: 'asc' | 'desc' }>;
    search?: string;
    /**
     * - Vistas `kanban`: id del campo `select` que define columnas (requerido).
     * - Vistas `table`: id del campo de agrupación ClickUp-style (opcional;
     *   tipos válidos: select, multi_select, user, checkbox, date, datetime).
     */
    group_by_field_id?: number;
    /** Sólo para vistas tipo `calendar`: id del campo `date`/`datetime` que ubica cada record. */
    date_field_id?: number;
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
