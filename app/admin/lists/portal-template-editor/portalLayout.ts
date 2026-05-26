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

/**
 * Default config inicial por tipo — usado por la palette al crear.
 *
 * Las **keys core** matchean el shape que el bundle público
 * (`app/portal/types.ts::PortalBlock`) espera leer. Las **keys
 * adicionales** del editor (`variant`, `accent_color`) son aditivas:
 * el bundle las ignora hasta que cada componente del block del
 * bundle se actualice para honrarlas.
 */
export function defaultConfigFor(type: PortalBlockType): Record<string, unknown> {
    switch (type) {
        case 'static_text':
            // Bundle: { html?: string; title?: string }
            return { html: '', title: '', variant: 'card' };
        case 'client_data':
            // Bundle: { visible_field_slugs?: string[]; title?: string }
            return { visible_field_slugs: [], title: '', variant: 'definition_list' };
        case 'related_records_table':
            // Bundle: { list_slug?: string; visible_field_slugs?: string[]; title?: string; per_page?: number }
            return { list_slug: '', visible_field_slugs: [], title: '', per_page: 10, variant: 'table' };
        case 'editable_form':
            // Bundle: { editable_field_slugs?: string[]; title?: string; submit_label?: string }
            return { editable_field_slugs: [], title: 'Actualizar mis datos', submit_label: 'Guardar' };
        case 'external_link':
            // Bundle: { title?: string; description?: string; href?: string; label?: string; new_window?: boolean }
            return { title: '', description: '', href: '', label: 'Abrir', new_window: true, variant: 'button', accent_color: null };
        case 'kpi_widget':
            // Bundle: { title?: string; list_slug?: string; field_id?: number; metric?: 'count' | 'sum' | 'avg' | 'min' | 'max'; suffix?: string; prefix?: string }
            return { title: '', list_slug: '', field_id: 0, metric: 'count', prefix: '', suffix: '', variant: 'card', accent_color: null };
        case 'activity_timeline':
            // Bundle: { title?: string; limit?: number }
            return { title: 'Actividad reciente', limit: 10 };
        case 'download_files':
            // Bundle: { title?: string; field_slug?: string }
            return { title: 'Archivos', field_slug: '', variant: 'list' };
        case 'comments_thread':
            // Bundle: { title?: string; readonly?: boolean }
            return { title: 'Comentarios', readonly: false };
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
