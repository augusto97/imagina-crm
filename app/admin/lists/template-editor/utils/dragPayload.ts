import type { V2BlockType } from '@/lib/crmTemplates';

/**
 * Payload del drag-from-palette al canvas del editor de plantilla
 * (Fase 11.B+). Se transmite vía `DataTransfer.setData('text/plain', ...)`
 * y se decodea en el handler `onDrop` del grid.
 *
 * El tipo discriminado nos permite que la paleta arrastre tanto
 * "tipos de bloque" (Bloques tab) como "fields concretos" (Campos
 * tab) — el handler decide qué hacer.
 *
 * El MIME custom (`application/x-imcrm-palette`) se setea en paralelo
 * a `text/plain` para evitar que el grid acepte drops de elementos
 * externos al editor (ej. archivos del SO). En `onDrop` validamos
 * que el MIME esté presente, sino ignoramos el drop.
 */

export const PALETTE_MIME = 'application/x-imcrm-palette';

export type PalettePayload =
    | { kind: 'block-type'; type: V2BlockType }
    | { kind: 'field'; slug: string };

export function encodePayload(p: PalettePayload): string {
    return JSON.stringify(p);
}

export function decodePayload(raw: string): PalettePayload | null {
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (! parsed || typeof parsed !== 'object') return null;
        const obj = parsed as Record<string, unknown>;
        if (obj.kind === 'block-type' && typeof obj.type === 'string') {
            return { kind: 'block-type', type: obj.type as V2BlockType };
        }
        if (obj.kind === 'field' && typeof obj.slug === 'string') {
            return { kind: 'field', slug: obj.slug };
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Helper para usar en `onDragStart` de las cards de la paleta.
 * Setea ambos MIMEs: el custom (para validar) y `text/plain`
 * (requerido por Firefox para que el drag arranque correctamente).
 */
export function setDragPayload(e: React.DragEvent, payload: PalettePayload): void {
    const raw = encodePayload(payload);
    e.dataTransfer.setData(PALETTE_MIME, raw);
    e.dataTransfer.setData('text/plain', raw);
    e.dataTransfer.effectAllowed = 'copy';
}

/**
 * Lee el payload de un drop event. Devuelve `null` si el drop no
 * viene de la paleta del editor (no tiene el MIME custom).
 *
 * NOTA: `e.dataTransfer.getData(PALETTE_MIME)` puede no estar
 * disponible si el browser solo expuso `text/plain` (algunos
 * browsers normalizan el MIME). Hacemos fallback a `text/plain`
 * cuando el primer intento falla, validando el shape via decode.
 */
export function readDropPayload(e: DragEvent | React.DragEvent): PalettePayload | null {
    const raw =
        e.dataTransfer?.getData(PALETTE_MIME)
        || e.dataTransfer?.getData('text/plain')
        || '';
    if (! raw) return null;
    return decodePayload(raw);
}
