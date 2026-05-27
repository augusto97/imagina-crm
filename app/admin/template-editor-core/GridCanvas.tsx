import { Fragment, useRef, useState, type CSSProperties } from 'react';
import { GripVertical, LayoutGrid } from 'lucide-react';

import { __ } from '@/lib/i18n';
import {
    compactRows,
    groupBlocksByRowsAndColumns,
    setColumnWidth,
    WIDTH_PRESETS,
    type Column,
    type Row,
} from '@/lib/rowsLayout';
import { cn } from '@/lib/utils';
import type { FieldEntity } from '@/types/field';
import type { RecordEntity } from '@/types/record';

import { type PalettePayload, PALETTE_MIME, readDropPayload } from './dragPayload';
import type { BaseTemplateBlock, BlockRegistry } from './types';

const INTERNAL_BLOCK_MIME = 'application/x-imcrm-block-move';

interface Props<TBlock extends BaseTemplateBlock> {
    listId: number;
    fields: FieldEntity[];
    blocks: TBlock[];
    record: RecordEntity | null;
    registry: BlockRegistry<TBlock>;
    selectedBlockIds: string[];
    preview?: boolean;
    onBlocksChange: (next: TBlock[]) => void;
    onSelectBlock: (id: string | null, additive?: boolean) => void;
    /**
     * Drop desde la paleta. `position` indica el destino:
     *   - `kind: 'append-col'` → agregar al final de una columna existente
     *   - `kind: 'new-col'`    → crear columna nueva en una fila existente
     *   - `kind: 'new-row'`    → crear fila nueva (shifteamos las posteriores)
     */
    onDropFromPalette: (
        payload: PalettePayload,
        position: DropTarget,
    ) => void;
    onDropOnBlock: (blockId: string, payload: PalettePayload) => boolean;
}

export type DropTarget =
    | { kind: 'append-col'; row: number; col: number; pos: number }
    | { kind: 'new-col'; row: number; col: number }
    | { kind: 'new-row'; row: number };

/**
 * Canvas del editor — modelo filas → columnas → bloques apilados (0.57.24).
 *
 * Mismo HTML/CSS que el front (`imcrm-rows-layout` / `imcrm-row` /
 * `imcrm-row__cell`). WYSIWYG real.
 *
 * Interacciones:
 *   - **Click bloque**: selecciona.
 *   - **Drag bloque** (handle ≡ a la izquierda): se puede soltar en
 *     cualquier drop zone: dentro de la misma columna (reorder),
 *     entre columnas (crear/cambiar columna), entre filas (crear fila).
 *   - **Drag desde paleta**: mismas drop zones que el move interno.
 *   - **Ancho de columna**: dropdown en el toolbar de cualquier bloque
 *     de la columna (afecta a toda la columna).
 *
 * Mantiene el nombre del export `GridCanvas` por compat de imports.
 */
export function GridCanvas<TBlock extends BaseTemplateBlock>({
    listId,
    fields,
    blocks,
    record,
    registry,
    selectedBlockIds,
    preview = false,
    onBlocksChange,
    onSelectBlock,
    onDropFromPalette,
    onDropOnBlock,
}: Props<TBlock>): JSX.Element {
    const [dragOverZone, setDragOverZone] = useState<string | null>(null);
    const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
    /** Id del bloque siendo arrastrado (internamente). null si es drag desde la paleta o no drag. */
    const draggedBlockId = useRef<string | null>(null);

    const rows = groupBlocksByRowsAndColumns(blocks);
    const ctx = { listId, fields, record };
    const isEmpty = blocks.length === 0;
    const selectedSet = new Set(selectedBlockIds);

    // — Helpers de mutación ─────────────────────────────────────────

    const performDrop = (payload: PalettePayload | null, target: DropTarget): void => {
        if (! payload) {
            // Drop interno (mover bloque). El bloque ya tiene su id en
            // `draggedBlockId`.
            const id = draggedBlockId.current;
            if (! id) return;
            const block = blocks.find((b) => b.id === id);
            if (! block) return;

            // 1. Sacar el bloque del array (sin compactar todavía).
            let next = blocks.filter((b) => b.id !== id);

            // 2. Hacer espacio en el destino según el tipo de drop.
            //    Después insertar el bloque movido en las coordenadas finales.
            let placed: TBlock;
            if (target.kind === 'new-row') {
                next = next.map((b) =>
                    (b.y ?? 0) >= target.row ? { ...b, y: (b.y ?? 0) + 1 } : b,
                );
                placed = { ...block, y: target.row, x: 0, pos: 0 };
            } else if (target.kind === 'new-col') {
                next = next.map((b) =>
                    (b.y ?? 0) === target.row && (b.x ?? 0) >= target.col
                        ? { ...b, x: (b.x ?? 0) + 1 }
                        : b,
                );
                placed = { ...block, y: target.row, x: target.col, pos: 0 };
            } else {
                // append-col: apilar dentro de la columna existente.
                // Shifteamos `pos` de los bloques con pos >= target.pos
                // en la misma (y, x).
                next = next.map((b) =>
                    (b.y ?? 0) === target.row
                        && (b.x ?? 0) === target.col
                        && (b.pos ?? 0) >= target.pos
                        ? { ...b, pos: (b.pos ?? 0) + 1 }
                        : b,
                );
                // El width del bloque movido pasa a coincidir con el
                // width de la columna destino (consistencia por columna).
                const colTarget = blocks.find(
                    (b) =>
                        b.id !== id
                        && (b.y ?? 0) === target.row
                        && (b.x ?? 0) === target.col,
                );
                placed = {
                    ...block,
                    y: target.row,
                    x: target.col,
                    pos: target.pos,
                    w: colTarget?.w ?? block.w,
                };
            }

            next.push(placed);
            // Compactar para cerrar cualquier hueco (ej. si el bloque
            // sacado dejó su fila/columna vacía).
            onBlocksChange(compactRows(next) as TBlock[]);
            return;
        }
        // Drop desde la paleta — el shell crea el bloque.
        onDropFromPalette(payload, target);
    };

    const handleSetWidth = (blockId: string, w: number): void => {
        const next = setColumnWidth(
            blocks as unknown as Array<TBlock & { id: string }>,
            blockId,
            w,
        );
        onBlocksChange(next as TBlock[]);
    };

    // — Handlers de drag de bloques internos ────────────────────────

    const handleBlockDragStart = (blockId: string) => (e: React.DragEvent): void => {
        draggedBlockId.current = blockId;
        e.dataTransfer.setData(INTERNAL_BLOCK_MIME, blockId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleBlockDragEnd = (): void => {
        draggedBlockId.current = null;
        setDragOverZone(null);
    };

    // — Drop zones ──────────────────────────────────────────────────

    const handleZoneDragOver = (zoneId: string) => (e: React.DragEvent): void => {
        const types = Array.from(e.dataTransfer.types);
        if (! types.includes(PALETTE_MIME) && ! types.includes(INTERNAL_BLOCK_MIME)) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = draggedBlockId.current ? 'move' : 'copy';
        setDragOverZone(zoneId);
    };

    const handleZoneDrop = (target: DropTarget, zoneId: string) =>
        (e: React.DragEvent): void => {
            e.preventDefault();
            e.stopPropagation();
            const payload = readDropPayload(e);
            setDragOverZone(null);
            // Si NO hay payload de paleta, es un drag interno (mover).
            performDrop(payload, target);
            draggedBlockId.current = null;
            // Reset zoneId after drop.
            void zoneId;
        };

    // — Drop sobre un bloque concreto (drop de field a properties_group) ─

    const handleBlockDragOver = (blockId: string) => (e: React.DragEvent): void => {
        const types = Array.from(e.dataTransfer.types);
        // Solo aceptamos PALETA aquí, NO drags internos (mueven entre
        // drop zones de fila/columna). Si el user pasa por encima de
        // un bloque con un drag interno, ignoramos.
        if (! types.includes(PALETTE_MIME)) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
        setHoveredBlockId(blockId);
    };

    const handleBlockDragLeave = (e: React.DragEvent): void => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setHoveredBlockId(null);
    };

    const handleBlockDrop = (blockId: string) => (e: React.DragEvent): void => {
        const payload = readDropPayload(e);
        setHoveredBlockId(null);
        if (! payload) return;
        const handled = onDropOnBlock(blockId, payload);
        if (handled) {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    // — Render ──────────────────────────────────────────────────────

    return (
        <div
            className={cn(
                'imcrm-relative imcrm-rounded-lg imcrm-border imcrm-border-dashed imcrm-border-border imcrm-bg-muted/10 imcrm-p-3',
                isEmpty && 'imcrm-min-h-[420px]',
            )}
            onClick={(e) => {
                if (e.target === e.currentTarget) onSelectBlock(null);
            }}
        >
            <div className="imcrm-rows-layout imcrm-template-editor-grid">
                {! preview && (
                    <NewRowDropZone
                        zoneId="new-row-0"
                        active={dragOverZone === 'new-row-0'}
                        onDragOver={handleZoneDragOver('new-row-0')}
                        onDragLeave={() => setDragOverZone(null)}
                        onDrop={handleZoneDrop({ kind: 'new-row', row: 0 }, 'new-row-0')}
                        position="between"
                    />
                )}

                {rows.map((row, rowIdx) => (
                    <Fragment key={`row-frag-${row.index}`}>
                        <RowRenderer
                            rowIdx={rowIdx}
                            row={row}
                            registry={registry}
                            ctx={ctx}
                            preview={preview}
                            selectedSet={selectedSet}
                            hoveredBlockId={hoveredBlockId}
                            dragOverZone={dragOverZone}
                            onSelect={onSelectBlock}
                            onSetWidth={handleSetWidth}
                            onBlockDragStart={handleBlockDragStart}
                            onBlockDragEnd={handleBlockDragEnd}
                            onBlockDragOver={handleBlockDragOver}
                            onBlockDragLeave={handleBlockDragLeave}
                            onBlockDrop={handleBlockDrop}
                            onZoneDragOver={handleZoneDragOver}
                            onZoneDrop={handleZoneDrop}
                            onZoneLeave={() => setDragOverZone(null)}
                        />
                        {! preview && (
                            <NewRowDropZone
                                zoneId={`new-row-${rowIdx + 1}`}
                                active={dragOverZone === `new-row-${rowIdx + 1}`}
                                onDragOver={handleZoneDragOver(`new-row-${rowIdx + 1}`)}
                                onDragLeave={() => setDragOverZone(null)}
                                onDrop={handleZoneDrop(
                                    { kind: 'new-row', row: rowIdx + 1 },
                                    `new-row-${rowIdx + 1}`,
                                )}
                                position={rowIdx === rows.length - 1 ? 'end' : 'between'}
                            />
                        )}
                    </Fragment>
                ))}
            </div>

            {isEmpty && (
                <div className="imcrm-pointer-events-none imcrm-absolute imcrm-inset-3 imcrm-flex imcrm-flex-col imcrm-items-center imcrm-justify-center imcrm-gap-3 imcrm-rounded-md imcrm-px-6 imcrm-text-center">
                    <div className="imcrm-flex imcrm-h-12 imcrm-w-12 imcrm-items-center imcrm-justify-center imcrm-rounded-full imcrm-bg-muted/50 imcrm-text-muted-foreground">
                        <LayoutGrid className="imcrm-h-5 imcrm-w-5" aria-hidden />
                    </div>
                    <p className="imcrm-max-w-sm imcrm-text-sm imcrm-text-muted-foreground">
                        {preview
                            ? __('Sin bloques — la plantilla está vacía.')
                            : __('Canvas vacío. Arrastrá un bloque desde la paleta de la izquierda.')}
                    </p>
                </div>
            )}
        </div>
    );
}

// ───────────────────────────────────────────────────────────────────
// Subcomponentes
// ───────────────────────────────────────────────────────────────────

interface RowRendererProps<TBlock extends BaseTemplateBlock> {
    rowIdx: number;
    row: Row<TBlock>;
    registry: BlockRegistry<TBlock>;
    ctx: { listId: number; fields: FieldEntity[]; record: RecordEntity | null };
    preview: boolean;
    selectedSet: Set<string>;
    hoveredBlockId: string | null;
    dragOverZone: string | null;
    onSelect: (id: string | null, additive?: boolean) => void;
    onSetWidth: (id: string, w: number) => void;
    onBlockDragStart: (id: string) => (e: React.DragEvent) => void;
    onBlockDragEnd: () => void;
    onBlockDragOver: (id: string) => (e: React.DragEvent) => void;
    onBlockDragLeave: (e: React.DragEvent) => void;
    onBlockDrop: (id: string) => (e: React.DragEvent) => void;
    onZoneDragOver: (zoneId: string) => (e: React.DragEvent) => void;
    onZoneDrop: (target: DropTarget, zoneId: string) => (e: React.DragEvent) => void;
    onZoneLeave: () => void;
}

function RowRenderer<TBlock extends BaseTemplateBlock>(props: RowRendererProps<TBlock>): JSX.Element {
    const {
        rowIdx, row, registry, ctx, preview, selectedSet, hoveredBlockId,
        dragOverZone, onSelect, onSetWidth, onBlockDragStart, onBlockDragEnd,
        onBlockDragOver, onBlockDragLeave, onBlockDrop, onZoneDragOver,
        onZoneDrop, onZoneLeave,
    } = props;

    return (
        <div className="imcrm-row">
            {/* Drop zone para crear una columna nueva al INICIO de la fila. */}
            {! preview && (
                <InterColDropZone
                    zoneId={`new-col-${rowIdx}-0`}
                    active={dragOverZone === `new-col-${rowIdx}-0`}
                    onDragOver={onZoneDragOver(`new-col-${rowIdx}-0`)}
                    onDragLeave={onZoneLeave}
                    onDrop={onZoneDrop(
                        { kind: 'new-col', row: rowIdx, col: 0 },
                        `new-col-${rowIdx}-0`,
                    )}
                />
            )}

            {row.columns.map((col, colIdx) => (
                <ColumnRenderer
                    key={`col-${rowIdx}-${col.colIdx}`}
                    rowIdx={rowIdx}
                    colIdx={colIdx}
                    column={col}
                    registry={registry}
                    ctx={ctx}
                    preview={preview}
                    selectedSet={selectedSet}
                    hoveredBlockId={hoveredBlockId}
                    dragOverZone={dragOverZone}
                    isLastColInRow={colIdx === row.columns.length - 1}
                    onSelect={onSelect}
                    onSetWidth={onSetWidth}
                    onBlockDragStart={onBlockDragStart}
                    onBlockDragEnd={onBlockDragEnd}
                    onBlockDragOver={onBlockDragOver}
                    onBlockDragLeave={onBlockDragLeave}
                    onBlockDrop={onBlockDrop}
                    onZoneDragOver={onZoneDragOver}
                    onZoneDrop={onZoneDrop}
                    onZoneLeave={onZoneLeave}
                />
            ))}
        </div>
    );
}

interface ColumnRendererProps<TBlock extends BaseTemplateBlock> {
    rowIdx: number;
    colIdx: number;
    column: Column<TBlock>;
    registry: BlockRegistry<TBlock>;
    ctx: { listId: number; fields: FieldEntity[]; record: RecordEntity | null };
    preview: boolean;
    selectedSet: Set<string>;
    hoveredBlockId: string | null;
    dragOverZone: string | null;
    isLastColInRow: boolean;
    onSelect: (id: string | null, additive?: boolean) => void;
    onSetWidth: (id: string, w: number) => void;
    onBlockDragStart: (id: string) => (e: React.DragEvent) => void;
    onBlockDragEnd: () => void;
    onBlockDragOver: (id: string) => (e: React.DragEvent) => void;
    onBlockDragLeave: (e: React.DragEvent) => void;
    onBlockDrop: (id: string) => (e: React.DragEvent) => void;
    onZoneDragOver: (zoneId: string) => (e: React.DragEvent) => void;
    onZoneDrop: (target: DropTarget, zoneId: string) => (e: React.DragEvent) => void;
    onZoneLeave: () => void;
}

function ColumnRenderer<TBlock extends BaseTemplateBlock>(
    props: ColumnRendererProps<TBlock>,
): JSX.Element {
    const {
        rowIdx, colIdx, column, registry, ctx, preview, selectedSet,
        hoveredBlockId, dragOverZone, isLastColInRow, onSelect, onSetWidth,
        onBlockDragStart, onBlockDragEnd, onBlockDragOver, onBlockDragLeave,
        onBlockDrop, onZoneDragOver, onZoneDrop, onZoneLeave,
    } = props;

    const basis = `${(column.width / 12) * 100}%`;
    const style: CSSProperties = { flexBasis: basis, maxWidth: basis };
    const appendZoneId = `append-${rowIdx}-${colIdx}-${column.blocks.length}`;

    return (
        <>
            <div className="imcrm-row__cell imcrm-relative" style={style}>
                {column.blocks.map((block, posIdx) => (
                    <BlockWithDropZones
                        key={block.id}
                        rowIdx={rowIdx}
                        colIdx={colIdx}
                        posIdx={posIdx}
                        block={block}
                        column={column}
                        registry={registry}
                        ctx={ctx}
                        preview={preview}
                        selected={! preview && selectedSet.has(block.id)}
                        hoveredBlockId={hoveredBlockId}
                        dragOverZone={dragOverZone}
                        onSelect={onSelect}
                        onSetWidth={onSetWidth}
                        onBlockDragStart={onBlockDragStart}
                        onBlockDragEnd={onBlockDragEnd}
                        onBlockDragOver={onBlockDragOver}
                        onBlockDragLeave={onBlockDragLeave}
                        onBlockDrop={onBlockDrop}
                        onZoneDragOver={onZoneDragOver}
                        onZoneDrop={onZoneDrop}
                        onZoneLeave={onZoneLeave}
                    />
                ))}
                {/* Append zone al final de la columna (apilar otro bloque). */}
                {! preview && (
                    <AppendBlockDropZone
                        zoneId={appendZoneId}
                        active={dragOverZone === appendZoneId}
                        onDragOver={onZoneDragOver(appendZoneId)}
                        onDragLeave={onZoneLeave}
                        onDrop={onZoneDrop(
                            { kind: 'append-col', row: rowIdx, col: colIdx, pos: column.blocks.length },
                            appendZoneId,
                        )}
                    />
                )}
            </div>

            {/* Drop zone entre columnas — crea una columna nueva en col+1. */}
            {! preview && (
                <InterColDropZone
                    zoneId={`new-col-${rowIdx}-${colIdx + 1}`}
                    active={dragOverZone === `new-col-${rowIdx}-${colIdx + 1}`}
                    onDragOver={onZoneDragOver(`new-col-${rowIdx}-${colIdx + 1}`)}
                    onDragLeave={onZoneLeave}
                    onDrop={onZoneDrop(
                        { kind: 'new-col', row: rowIdx, col: colIdx + 1 },
                        `new-col-${rowIdx}-${colIdx + 1}`,
                    )}
                    /* Sólo la última inter-col es visible cuando no hay drag.
                     * Las intermedias aparecen sólo cuando se está dragueando. */
                    alwaysVisible={isLastColInRow}
                />
            )}
        </>
    );
}

interface BlockWithDropZonesProps<TBlock extends BaseTemplateBlock> {
    rowIdx: number;
    colIdx: number;
    posIdx: number;
    block: TBlock;
    column: Column<TBlock>;
    registry: BlockRegistry<TBlock>;
    ctx: { listId: number; fields: FieldEntity[]; record: RecordEntity | null };
    preview: boolean;
    selected: boolean;
    hoveredBlockId: string | null;
    dragOverZone: string | null;
    onSelect: (id: string | null, additive?: boolean) => void;
    onSetWidth: (id: string, w: number) => void;
    onBlockDragStart: (id: string) => (e: React.DragEvent) => void;
    onBlockDragEnd: () => void;
    onBlockDragOver: (id: string) => (e: React.DragEvent) => void;
    onBlockDragLeave: (e: React.DragEvent) => void;
    onBlockDrop: (id: string) => (e: React.DragEvent) => void;
    onZoneDragOver: (zoneId: string) => (e: React.DragEvent) => void;
    onZoneDrop: (target: DropTarget, zoneId: string) => (e: React.DragEvent) => void;
    onZoneLeave: () => void;
}

function BlockWithDropZones<TBlock extends BaseTemplateBlock>(
    props: BlockWithDropZonesProps<TBlock>,
): JSX.Element {
    const {
        rowIdx, colIdx, posIdx, block, column, registry, ctx, preview, selected,
        hoveredBlockId, dragOverZone, onSelect, onSetWidth, onBlockDragStart,
        onBlockDragEnd, onBlockDragOver, onBlockDragLeave, onBlockDrop,
        onZoneDragOver, onZoneDrop, onZoneLeave,
    } = props;

    const insertZoneId = `insert-${rowIdx}-${colIdx}-${posIdx}`;
    const isDropTarget = hoveredBlockId === block.id;

    return (
        <>
            {! preview && (
                <InterBlockDropZone
                    zoneId={insertZoneId}
                    active={dragOverZone === insertZoneId}
                    onDragOver={onZoneDragOver(insertZoneId)}
                    onDragLeave={onZoneLeave}
                    onDrop={onZoneDrop(
                        { kind: 'append-col', row: rowIdx, col: colIdx, pos: posIdx },
                        insertZoneId,
                    )}
                />
            )}
            <div
                className={cn(
                    'imcrm-group imcrm-relative imcrm-overflow-visible imcrm-rounded-lg imcrm-bg-card imcrm-shadow-imcrm-sm imcrm-ring-1 imcrm-transition-all',
                    isDropTarget
                        ? 'imcrm-ring-2 imcrm-ring-primary imcrm-ring-offset-2 imcrm-ring-offset-background'
                        : selected
                            ? 'imcrm-ring-2 imcrm-ring-primary'
                            : preview
                                ? 'imcrm-ring-border'
                                : 'imcrm-ring-border hover:imcrm-ring-primary/40 imcrm-cursor-pointer',
                )}
                onClick={(e) => {
                    if (preview) return;
                    e.stopPropagation();
                    onSelect(block.id, e.shiftKey);
                }}
                onDragOver={preview ? undefined : onBlockDragOver(block.id)}
                onDragLeave={preview ? undefined : onBlockDragLeave}
                onDrop={preview ? undefined : onBlockDrop(block.id)}
            >
                {! preview && (
                    <DragHandle
                        onDragStart={onBlockDragStart(block.id)}
                        onDragEnd={onBlockDragEnd}
                    />
                )}
                <div className="imcrm-overflow-hidden">
                    {registry.renderPreview(block, ctx)}
                </div>
                {selected && (
                    <BlockToolbar
                        column={column}
                        onSetWidth={(w) => onSetWidth(block.id, w)}
                    />
                )}
                {isDropTarget && (
                    <div className="imcrm-pointer-events-none imcrm-absolute imcrm-inset-0 imcrm-z-10 imcrm-flex imcrm-items-center imcrm-justify-center imcrm-rounded-lg imcrm-bg-primary/10">
                        <p className="imcrm-rounded imcrm-bg-primary imcrm-px-2 imcrm-py-1 imcrm-text-[11px] imcrm-font-medium imcrm-text-primary-foreground imcrm-shadow-imcrm-sm">
                            {__('Soltar para agregar al grupo')}
                        </p>
                    </div>
                )}
            </div>
        </>
    );
}

function DragHandle({
    onDragStart,
    onDragEnd,
}: {
    onDragStart: (e: React.DragEvent) => void;
    onDragEnd: () => void;
}): JSX.Element {
    return (
        <div
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onClick={(e) => e.stopPropagation()}
            title={__('Arrastrar bloque')}
            className="imcrm-absolute imcrm-left-1 imcrm-top-1 imcrm-z-20 imcrm-flex imcrm-h-6 imcrm-w-6 imcrm-cursor-grab imcrm-items-center imcrm-justify-center imcrm-rounded imcrm-bg-card imcrm-text-muted-foreground imcrm-opacity-0 imcrm-shadow-imcrm-sm imcrm-transition group-hover:imcrm-opacity-100 active:imcrm-cursor-grabbing hover:imcrm-text-foreground"
        >
            <GripVertical className="imcrm-h-3.5 imcrm-w-3.5" />
        </div>
    );
}

interface BlockToolbarProps<TBlock extends BaseTemplateBlock> {
    column: Column<TBlock>;
    onSetWidth: (w: number) => void;
}

function BlockToolbar<TBlock extends BaseTemplateBlock>({
    column,
    onSetWidth,
}: BlockToolbarProps<TBlock>): JSX.Element {
    return (
        <div
            className="imcrm-absolute imcrm-right-1 imcrm-top-1 imcrm-z-20 imcrm-flex imcrm-items-center imcrm-gap-1 imcrm-rounded-md imcrm-border imcrm-border-border imcrm-bg-card imcrm-px-1.5 imcrm-py-1 imcrm-shadow-imcrm-sm"
            onClick={(e) => e.stopPropagation()}
        >
            <span className="imcrm-text-[10px] imcrm-text-muted-foreground">
                {__('Col')}
            </span>
            <select
                value={column.width}
                onChange={(e) => onSetWidth(Number(e.target.value))}
                className="imcrm-h-6 imcrm-rounded imcrm-border imcrm-border-border imcrm-bg-background imcrm-px-1 imcrm-text-[11px] imcrm-text-foreground focus:imcrm-outline-none focus:imcrm-ring-1 focus:imcrm-ring-primary"
                aria-label={__('Ancho de columna')}
            >
                {WIDTH_PRESETS.map((p) => (
                    <option key={p.value} value={p.value}>
                        {p.label}
                    </option>
                ))}
            </select>
        </div>
    );
}

// — Drop zones ──────────────────────────────────────────────────────

interface BaseZoneProps {
    zoneId: string;
    active: boolean;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (e: React.DragEvent) => void;
}

function NewRowDropZone({
    active,
    onDragOver,
    onDragLeave,
    onDrop,
    position,
}: BaseZoneProps & { position: 'between' | 'end' }): JSX.Element {
    return (
        <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={cn(
                'imcrm-relative imcrm-flex imcrm-items-center imcrm-justify-center imcrm-rounded imcrm-transition-all',
                active
                    ? 'imcrm-h-10 imcrm-border-2 imcrm-border-dashed imcrm-border-primary imcrm-bg-primary/10'
                    : position === 'end'
                        ? 'imcrm-h-3 hover:imcrm-h-6 hover:imcrm-border hover:imcrm-border-dashed hover:imcrm-border-border'
                        : 'imcrm-h-2 hover:imcrm-h-5 hover:imcrm-bg-muted/30',
            )}
        >
            {active && (
                <span className="imcrm-pointer-events-none imcrm-text-[11px] imcrm-font-medium imcrm-text-primary">
                    {__('Soltar para crear fila nueva')}
                </span>
            )}
        </div>
    );
}

function InterColDropZone({
    active,
    onDragOver,
    onDragLeave,
    onDrop,
    alwaysVisible,
}: BaseZoneProps & { alwaysVisible?: boolean }): JSX.Element {
    return (
        <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={cn(
                'imcrm-self-stretch imcrm-rounded imcrm-transition-all',
                active
                    ? 'imcrm-w-8 imcrm-border-2 imcrm-border-dashed imcrm-border-primary imcrm-bg-primary/10'
                    : alwaysVisible
                        ? 'imcrm-w-1 hover:imcrm-w-4 hover:imcrm-bg-muted/30'
                        : 'imcrm-w-1 hover:imcrm-w-4 hover:imcrm-bg-muted/30',
            )}
            title={__('Soltar acá para crear columna nueva')}
        />
    );
}

function AppendBlockDropZone({
    active,
    onDragOver,
    onDragLeave,
    onDrop,
}: BaseZoneProps): JSX.Element {
    return (
        <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={cn(
                'imcrm-flex imcrm-items-center imcrm-justify-center imcrm-rounded imcrm-transition-all',
                active
                    ? 'imcrm-min-h-[40px] imcrm-border-2 imcrm-border-dashed imcrm-border-primary imcrm-bg-primary/10'
                    : 'imcrm-min-h-[8px] hover:imcrm-min-h-[24px] hover:imcrm-bg-muted/30',
            )}
        >
            {active && (
                <span className="imcrm-pointer-events-none imcrm-text-[11px] imcrm-font-medium imcrm-text-primary">
                    {__('Apilar en esta columna')}
                </span>
            )}
        </div>
    );
}

function InterBlockDropZone({
    active,
    onDragOver,
    onDragLeave,
    onDrop,
}: BaseZoneProps): JSX.Element {
    return (
        <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={cn(
                'imcrm-rounded imcrm-transition-all',
                active
                    ? 'imcrm-h-8 imcrm-border-2 imcrm-border-dashed imcrm-border-primary imcrm-bg-primary/10'
                    : 'imcrm-h-1 hover:imcrm-h-4 hover:imcrm-bg-muted/30',
            )}
        />
    );
}

// Re-export para no romper TemplateEditorShell que importa GridCanvas.
// El shell ahora también necesita conocer DropTarget para el callback.
export type { Column, Row } from '@/lib/rowsLayout';

// Helper inert para evitar warning de "unused" en interfaces utilitarias.
void INTERNAL_BLOCK_MIME;
