/**
 * Layout por filas — el modelo unificado de render desde 0.57.23.
 *
 * Antes (modelo libre tipo react-grid-layout):
 *   Cada bloque tenía `(x, y, w, h)` libre en una grilla 12-col × N-row
 *   con rowHeight fijo. Esto creaba dos problemas crónicos:
 *     1. **Huecos por fila distinta**: dos bloques con distinto `y`
 *        pero misma "columna visual" generaban una fila CSS Grid de
 *        altura del más alto, dejando hueco abajo del más chico.
 *     2. **Editor vs front divergente**: el editor usaba rowHeight
 *        fijo (h × 40px) y el front intentaba auto-height — nunca
 *        coincidían visualmente.
 *
 * Ahora (modelo por filas explícitas):
 *   - El template = lista ORDENADA de filas (`Row`).
 *   - Cada fila contiene N bloques en orden horizontal.
 *   - La altura de cada fila la define el bloque más alto adentro.
 *   - Cada bloque tiene `width` (1-12) que es su fracción de 12-col.
 *   - La suma de widths de una fila puede ser ≤ 12 (el resto queda vacío).
 *
 * Almacenamiento (JSON-compat con templates viejos):
 *   El JSON sigue siendo `blocks: [{ id, type, config, x, y, w, h }]`.
 *   Reinterpretamos los campos:
 *     - `y` → índice de fila (0, 1, 2, ...)
 *     - `x` → posición dentro de la fila (0, 1, 2, ...)
 *     - `w` → ancho en cols de 12 (no cambia semántica)
 *     - `h` → ignorado en render (se mantiene para compat)
 *
 * Migración automática:
 *   Los templates viejos tienen `y` con valores arbitrarios (0, 4, 8, ...)
 *   correspondientes a "row offset" del rowHeight. `normalizeToRows`
 *   los re-numera a índices consecutivos (0, 1, 2, ...) agrupando por
 *   `y` original.
 */

export interface PositionedBlock {
    /** Opcional para compat con el front del portal que no siempre lo
     * lleva. Los métodos que mutan por id (`moveBlock`, `removeBlock`,
     * `setBlockWidth`) requieren su variante `& { id: string }`. */
    id?: string;
    x?: number;
    y?: number;
    w?: number;
    h?: number;
}

type WithId<T> = T & { id: string };

export interface Row<T extends PositionedBlock> {
    /** Índice de la fila (0-based). */
    index: number;
    /** Bloques de la fila en orden horizontal de izq a der. */
    blocks: T[];
}

/**
 * Agrupa blocks por su `y` (índice de fila) y los ordena por `x`
 * dentro de cada fila. Devuelve las filas ordenadas por índice.
 *
 * El `y` resultante de los blocks NO se re-numera — se usa tal cual.
 * Si los blocks vienen migrados (índices consecutivos 0, 1, 2...) las
 * filas también lo son. Si vienen sin migrar (y arbitrarios), las
 * filas tendrán los `y` originales como índice pero estarán en orden.
 *
 * Si querés que los blocks queden con índices consecutivos, usá
 * `normalizeToRows` antes.
 */
export function groupBlocksByRow<T extends PositionedBlock>(
    blocks: ReadonlyArray<T>,
): Row<T>[] {
    const byRow = new Map<number, T[]>();
    for (const b of blocks) {
        const y = b.y ?? 0;
        const arr = byRow.get(y) ?? [];
        arr.push(b);
        byRow.set(y, arr);
    }

    const rows: Row<T>[] = [];
    const sortedKeys = Array.from(byRow.keys()).sort((a, b) => a - b);
    for (const key of sortedKeys) {
        const inRow = byRow.get(key) ?? [];
        // Orden horizontal por `x` ascendente; empate → orden de inserción.
        inRow.sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
        rows.push({ index: key, blocks: inRow });
    }
    return rows;
}

/**
 * Migra blocks legacy (con `y` arbitrarios del modelo react-grid-layout)
 * al modelo por filas con índices consecutivos.
 *
 * Pasos:
 *  1. Agrupa por `y` original.
 *  2. Reasigna `y` como índice consecutivo (0, 1, 2...).
 *  3. Reasigna `x` como posición consecutiva dentro de la fila (0, 1, 2...).
 *  4. Mantiene `w` (ancho en cols de 12).
 *  5. Limpia `h` poniéndolo en 0 (señaliza "auto height" pero
 *     conservamos el campo por compat de schema).
 *
 * El orden de los blocks en el array de salida es:
 *   row 0 left-to-right, row 1 left-to-right, etc.
 *
 * Es **idempotente**: aplicar dos veces da el mismo resultado.
 */
export function normalizeToRows<T extends PositionedBlock>(
    blocks: ReadonlyArray<T>,
): T[] {
    const grouped = groupBlocksByRow(blocks);
    const out: T[] = [];
    grouped.forEach((row, rowIdx) => {
        row.blocks.forEach((block, colIdx) => {
            out.push({
                ...block,
                x: colIdx,
                y: rowIdx,
                w: clampWidth(block.w ?? 12),
                h: 0,
            });
        });
    });
    return out;
}

/**
 * Inserta una nueva fila vacía en `rowIndex`. Los blocks de esa fila
 * en adelante se shiftan +1.
 *
 * Devuelve los blocks shifteados — el caller agrega después los blocks
 * nuevos con `y = rowIndex`.
 */
export function shiftRowsDown<T extends PositionedBlock>(
    blocks: ReadonlyArray<T>,
    fromRowIndex: number,
): T[] {
    return blocks.map((b) => {
        const y = b.y ?? 0;
        if (y >= fromRowIndex) return { ...b, y: y + 1 };
        return { ...b };
    });
}

/**
 * Recompacta los `y` después de eliminar bloques (cierra huecos).
 * Si tras un delete la fila 3 quedó vacía, los blocks de filas 4+
 * bajan a 3, 4, 5...
 */
export function compactRows<T extends PositionedBlock>(
    blocks: ReadonlyArray<T>,
): T[] {
    const rows = groupBlocksByRow(blocks);
    const out: T[] = [];
    rows.forEach((row, newIdx) => {
        row.blocks.forEach((block, colIdx) => {
            out.push({ ...block, x: colIdx, y: newIdx });
        });
    });
    return out;
}

/**
 * Mueve un block dentro del array a un destino (rowIndex, colIndex).
 * Si el destino está fuera del rango actual de filas, crea una nueva
 * fila al final. Después compacta para que no queden huecos.
 *
 * Útil para drag-and-drop en el editor.
 */
export function moveBlock<T extends WithId<PositionedBlock>>(
    blocks: ReadonlyArray<T>,
    blockId: string,
    targetRow: number,
    targetCol: number,
): T[] {
    const block = blocks.find((b) => b.id === blockId);
    if (! block) return [...blocks];

    // Excluir el block del array y armar el grouped sin él.
    const without = blocks.filter((b) => b.id !== blockId);
    const grouped = groupBlocksByRow(without);

    // Asegurar que el target row exista (rellenar con vacías si hace
    // falta). Trabajamos sobre un array `rowsArr` indexado por índice
    // nuevo consecutivo.
    const rowsArr: T[][] = grouped.map((r) => r.blocks);
    while (rowsArr.length <= targetRow) rowsArr.push([]);

    // Insertar block en posición targetCol de la fila target.
    const targetArr = rowsArr[targetRow] ?? [];
    const insertIdx = Math.max(0, Math.min(targetCol, targetArr.length));
    targetArr.splice(insertIdx, 0, block);
    rowsArr[targetRow] = targetArr;

    // Aplanar reasignando x, y consecutivos.
    const out: T[] = [];
    rowsArr.forEach((row, rowIdx) => {
        row.forEach((b, colIdx) => {
            out.push({ ...b, x: colIdx, y: rowIdx });
        });
    });
    return out;
}

/**
 * Quita un block del array y compacta filas para cerrar huecos.
 */
export function removeBlock<T extends WithId<PositionedBlock>>(
    blocks: ReadonlyArray<T>,
    blockId: string,
): T[] {
    return compactRows(blocks.filter((b) => b.id !== blockId));
}

/**
 * Cambia el ancho de un block en cols (1-12). El width final se
 * clampea entre 1 y 12. La suma de la fila puede quedar > 12; en
 * render usamos `flex-wrap: wrap` para que los excedentes pasen
 * a la siguiente línea visual dentro de la fila lógica — esto
 * raramente ocurre porque el editor previene seleccionar widths
 * que excedan el espacio disponible.
 */
export function setBlockWidth<T extends WithId<PositionedBlock>>(
    blocks: ReadonlyArray<T>,
    blockId: string,
    width: number,
): T[] {
    return blocks.map((b) => {
        if (b.id !== blockId) return b;
        return { ...b, w: clampWidth(width) };
    });
}

function clampWidth(w: number): number {
    if (! Number.isFinite(w)) return 12;
    return Math.max(1, Math.min(12, Math.round(w)));
}

/** Presets de ancho que mostramos en el editor. */
export const WIDTH_PRESETS: ReadonlyArray<{ value: number; label: string }> = [
    { value: 3,  label: '1/4' },
    { value: 4,  label: '1/3' },
    { value: 6,  label: '1/2' },
    { value: 8,  label: '2/3' },
    { value: 9,  label: '3/4' },
    { value: 12, label: 'Full' },
];

/**
 * Espacio disponible en cols (de 12) en la fila después de los
 * bloques actuales, excluyendo opcionalmente un block (para cálculos
 * "si saco este, cuánto queda libre").
 */
export function rowRemainingWidth<T extends PositionedBlock>(
    blocksInRow: ReadonlyArray<T>,
    excludeBlockId?: string,
): number {
    const used = blocksInRow.reduce((sum, b) => {
        if (excludeBlockId && b.id === excludeBlockId) return sum;
        return sum + (b.w ?? 12);
    }, 0);
    return Math.max(0, 12 - used);
}
