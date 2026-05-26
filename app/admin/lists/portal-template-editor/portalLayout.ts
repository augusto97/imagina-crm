import type {
    PortalBlockType,
    PortalTemplate,
    PortalTemplateBlock,
} from '@/types/portal';

/**
 * Bloque "resuelto" para el grid: todas las posiciones obligatorias
 * (id, x, y, w, h). El editor trabaja con este shape; al guardar
 * lo persiste tal cual al template.
 */
export interface ResolvedPortalBlock {
    id: string;
    type: PortalBlockType;
    config: Record<string, unknown>;
    x: number;
    y: number;
    w: number;
    h: number;
}

/**
 * Resuelve los bloques del template auto-asignando posiciones si
 * faltan. Backward-compat: templates antiguos (sin x/y/w/h) reciben
 * layout vertical full-width estándar.
 *
 * Reglas de auto-asignación:
 *  - id: `${type}-${idx}-${random}` si no viene
 *  - w: 12 (full width)
 *  - h: depende del tipo (heading=2, kpi=4, table=10, etc.)
 *  - x: 0
 *  - y: acumulativo en orden de declaración
 */
export function resolvePortalBlocks(blocks: PortalTemplateBlock[]): ResolvedPortalBlock[] {
    const out: ResolvedPortalBlock[] = [];
    let cursorY = 0;
    blocks.forEach((b, idx) => {
        const id = typeof b.id === 'string' && b.id !== ''
            ? b.id
            : `${b.type}-${idx}-${Math.random().toString(36).slice(2, 6)}`;
        const h = typeof b.h === 'number' && b.h > 0 ? b.h : defaultHeightFor(b.type);
        const w = typeof b.w === 'number' && b.w > 0 ? b.w : 12;
        const x = typeof b.x === 'number' && b.x >= 0 ? b.x : 0;
        const y = typeof b.y === 'number' && b.y >= 0 ? b.y : cursorY;
        out.push({ id, type: b.type, config: b.config, x, y, w, h });
        if (typeof b.y !== 'number') {
            // Solo avanzamos el cursor cuando estamos auto-asignando.
            cursorY = y + h;
        } else {
            cursorY = Math.max(cursorY, y + h);
        }
    });
    return out;
}

/** Default height por tipo, en unidades del grid (rowHeight=40px). */
export function defaultHeightFor(type: PortalBlockType): number {
    switch (type) {
        case 'static_text':           return 4;
        case 'client_data':           return 6;
        case 'related_records_table': return 10;
        case 'editable_form':         return 8;
        case 'external_link':         return 2;
        case 'kpi_widget':            return 3;
        case 'activity_timeline':     return 8;
        case 'download_files':        return 5;
        case 'comments_thread':       return 8;
        default:                      return 4;
    }
}

/** Default width por tipo. KPI y external_link son medio-ancho; el resto full. */
export function defaultWidthFor(type: PortalBlockType): number {
    switch (type) {
        case 'kpi_widget':    return 4;
        case 'external_link': return 4;
        default:              return 12;
    }
}

/** Default config inicial por tipo — usado por la palette al crear. */
export function defaultConfigFor(type: PortalBlockType): Record<string, unknown> {
    switch (type) {
        case 'static_text':
            return { content: '' };
        case 'client_data':
            return { visible_field_slugs: [] };
        case 'related_records_table':
            return { relation_field_slug: '', visible_field_slugs: [], max_rows: 10 };
        case 'editable_form':
            return { editable_field_slugs: [], submit_label: 'Guardar' };
        case 'external_link':
            return { label: 'Abrir', url: '' };
        case 'kpi_widget':
            return { field_slug: '', label: '' };
        case 'activity_timeline':
            return { max_items: 10 };
        case 'download_files':
            return { file_field_slugs: [] };
        case 'comments_thread':
            return { title: 'Comentarios' };
    }
}

/**
 * Crea un bloque nuevo con posición automática (al final del grid).
 *
 * @param existing Bloques ya resueltos para calcular el `y` final.
 */
export function createPortalBlock(
    type: PortalBlockType,
    existing: ResolvedPortalBlock[],
): ResolvedPortalBlock {
    const w = defaultWidthFor(type);
    const h = defaultHeightFor(type);
    const fallbackY = existing.reduce((m, b) => Math.max(m, b.y + b.h), 0);
    return {
        id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type,
        config: defaultConfigFor(type),
        x: 0,
        y: fallbackY,
        w,
        h,
    };
}

/** Serializa un set de bloques resueltos al shape del template. */
export function toPortalTemplate(blocks: ResolvedPortalBlock[]): PortalTemplate {
    return {
        blocks: blocks.map((b) => ({
            id: b.id,
            type: b.type,
            config: b.config,
            x: b.x,
            y: b.y,
            w: b.w,
            h: b.h,
        })),
    };
}
