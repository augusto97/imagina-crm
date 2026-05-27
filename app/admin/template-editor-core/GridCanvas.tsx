import { useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, LayoutGrid, Plus } from 'lucide-react';

import { __ } from '@/lib/i18n';
import { groupBlocksByRow, WIDTH_PRESETS, type Row } from '@/lib/rowsLayout';
import { cn } from '@/lib/utils';
import type { FieldEntity } from '@/types/field';
import type { RecordEntity } from '@/types/record';

import { type PalettePayload, PALETTE_MIME, readDropPayload } from './dragPayload';
import type { BaseTemplateBlock, BlockRegistry } from './types';

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
     * Drop desde la paleta. `position.x` = índice de columna dentro de
     * la fila, `position.y` = índice de fila. Si `options.shiftRowsFrom`
     * está presente, el shell debe shiftear las filas >= ese valor +1
     * ANTES de insertar el bloque (operación atómica para crear fila
     * nueva intercalada).
     */
    onDropFromPalette: (
        payload: PalettePayload,
        position: { x: number; y: number },
        options?: { shiftRowsFrom?: number },
    ) => void;
    onDropOnBlock: (blockId: string, payload: PalettePayload) => boolean;
}

/**
 * Canvas del editor — modelo unificado por filas (0.57.23).
 *
 * Reemplaza el grid libre de react-grid-layout por un layout explícito
 * de filas con columnas adentro. Beneficios:
 *  - WYSIWYG real: el editor y el front usan EXACTAMENTE el mismo HTML
 *    y CSS para posicionar bloques (clase `imcrm-rows-layout` /
 *    `imcrm-row` / `imcrm-row__cell`).
 *  - Altura siempre auto del contenido. Sin huecos.
 *  - Sin dependencia de react-grid-layout en el bundle.
 *
 * Interacciones:
 *  - **Seleccionar**: click en bloque.
 *  - **Mover entre filas**: botones ↑/↓ del toolbar flotante.
 *  - **Mover dentro de fila**: botones ←/→.
 *  - **Cambiar ancho**: dropdown de presets (1/4, 1/3, 1/2, 2/3, 3/4, full).
 *  - **Agregar bloque**: drag desde paleta → drop en una zona "fila".
 *    Si se dropea en la zona "entre filas", se crea fila nueva.
 *  - **Drop sobre bloque** (paleta → bloque existente, ej. field sobre
 *    properties_group): handler `onDropOnBlock`.
 *
 * Mantiene el nombre `GridCanvas` por compat con imports existentes.
 * Conceptualmente es `RowsCanvas`.
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
    const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
    const [dropZone, setDropZone] = useState<DropZone | null>(null);

    const rows = groupBlocksByRow(blocks);
    const ctx = { listId, fields, record };
    const isEmpty = blocks.length === 0;
    const selectedSet = new Set(selectedBlockIds);

    // — Mutaciones de layout ────────────────────────────────────────

    const moveBlockToCell = (blockId: string, targetRow: number, targetCol: number): void => {
        const block = blocks.find((b) => b.id === blockId);
        if (! block) return;

        // Trabajo sobre matriz de filas; meto el block en (targetRow,
        // targetCol) y al final aplano reasignando x/y consecutivos.
        const without = blocks.filter((b) => b.id !== blockId);
        const grouped = groupBlocksByRow(without).map((r) => r.blocks);
        while (grouped.length <= targetRow) grouped.push([]);
        const arr = grouped[targetRow] ?? [];
        const insertIdx = Math.max(0, Math.min(targetCol, arr.length));
        arr.splice(insertIdx, 0, block);
        grouped[targetRow] = arr;

        const next: TBlock[] = [];
        grouped.forEach((row, rowIdx) => {
            row.forEach((b, colIdx) => {
                next.push({ ...b, x: colIdx, y: rowIdx, h: 0 });
            });
        });
        onBlocksChange(next);
    };

    const setBlockWidth = (blockId: string, w: number): void => {
        const clamped = Math.max(1, Math.min(12, Math.round(w)));
        const next = blocks.map((b) => (b.id === blockId ? { ...b, w: clamped } : b));
        onBlocksChange(next);
    };

    const findBlockCell = (blockId: string): { rowIdx: number; colIdx: number } | null => {
        const grouped = groupBlocksByRow(blocks);
        for (let r = 0; r < grouped.length; r += 1) {
            const inRow = grouped[r];
            if (! inRow) continue;
            const c = inRow.blocks.findIndex((b) => b.id === blockId);
            if (c >= 0) return { rowIdx: r, colIdx: c };
        }
        return null;
    };

    const moveUp = (blockId: string): void => {
        const pos = findBlockCell(blockId);
        if (! pos || pos.rowIdx === 0) return;
        moveBlockToCell(blockId, pos.rowIdx - 1, pos.colIdx);
    };

    const moveDown = (blockId: string): void => {
        const pos = findBlockCell(blockId);
        if (! pos) return;
        moveBlockToCell(blockId, pos.rowIdx + 1, pos.colIdx);
    };

    const moveLeft = (blockId: string): void => {
        const pos = findBlockCell(blockId);
        if (! pos || pos.colIdx === 0) return;
        moveBlockToCell(blockId, pos.rowIdx, pos.colIdx - 1);
    };

    const moveRight = (blockId: string): void => {
        const pos = findBlockCell(blockId);
        if (! pos) return;
        moveBlockToCell(blockId, pos.rowIdx, pos.colIdx + 1);
    };

    // — Drop handling ───────────────────────────────────────────────
    //
    // 0.57.23 — Los drops desde la paleta SIEMPRE crean una fila nueva
    // (intercalada entre filas existentes o al final). Esto evita
    // confusión por overflow de widths (la suma de la fila destino
    // podría exceder 12 cols si dropearas en una fila ya llena).
    //
    // Para mover un bloque a una fila existente, el user usa los
    // botones ←/→/↑/↓ del toolbar flotante.

    const handleNewRowDragOver = (rowIdx: number, e: React.DragEvent): void => {
        if (! Array.from(e.dataTransfer.types).includes(PALETTE_MIME)) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
        setDropZone({ kind: 'new-row', rowIdx });
    };

    const handleNewRowDrop = (rowIdx: number, e: React.DragEvent): void => {
        const payload = readDropPayload(e);
        setDropZone(null);
        if (! payload) return;
        e.preventDefault();
        e.stopPropagation();
        // Operación atómica: el shell debe shiftear filas >= rowIdx
        // ANTES de crear el bloque nuevo en (x=0, y=rowIdx).
        onDropFromPalette(payload, { x: 0, y: rowIdx }, { shiftRowsFrom: rowIdx });
    };

    const handleBlockDragOver = (blockId: string, e: React.DragEvent): void => {
        if (! Array.from(e.dataTransfer.types).includes(PALETTE_MIME)) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
        setHoveredBlockId(blockId);
    };

    const handleBlockDragLeave = (e: React.DragEvent): void => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setHoveredBlockId(null);
    };

    const handleBlockDrop = (blockId: string, e: React.DragEvent): void => {
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
                {rows.map((row, rowIdx) => (
                    <RowGroup
                        key={`row-${row.index}`}
                        rowIdx={rowIdx}
                        row={row}
                        registry={registry}
                        ctx={ctx}
                        preview={preview}
                        selectedSet={selectedSet}
                        hoveredBlockId={hoveredBlockId}
                        dropZone={dropZone}
                        onSelect={onSelectBlock}
                        onMoveUp={moveUp}
                        onMoveDown={moveDown}
                        onMoveLeft={moveLeft}
                        onMoveRight={moveRight}
                        onSetWidth={setBlockWidth}
                        onNewRowDragOver={handleNewRowDragOver}
                        onNewRowDrop={handleNewRowDrop}
                        onBlockDragOver={handleBlockDragOver}
                        onBlockDragLeave={handleBlockDragLeave}
                        onBlockDrop={handleBlockDrop}
                    />
                ))}

                {/* Drop zone para crear una fila NUEVA al final. */}
                {! preview && (
                    <DropZoneRow
                        active={dropZone?.kind === 'new-row' && dropZone.rowIdx === rows.length}
                        onDragOver={(e) => handleNewRowDragOver(rows.length, e)}
                        onDragLeave={() => setDropZone(null)}
                        onDrop={(e) => handleNewRowDrop(rows.length, e)}
                        label={rows.length === 0 ? '' : __('+ Nueva fila')}
                    />
                )}
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

type DropZone = { kind: 'new-row'; rowIdx: number };

interface RowGroupProps<TBlock extends BaseTemplateBlock> {
    rowIdx: number;
    row: Row<TBlock>;
    registry: BlockRegistry<TBlock>;
    ctx: { listId: number; fields: FieldEntity[]; record: RecordEntity | null };
    preview: boolean;
    selectedSet: Set<string>;
    hoveredBlockId: string | null;
    dropZone: DropZone | null;
    onSelect: (id: string | null, additive?: boolean) => void;
    onMoveUp: (id: string) => void;
    onMoveDown: (id: string) => void;
    onMoveLeft: (id: string) => void;
    onMoveRight: (id: string) => void;
    onSetWidth: (id: string, w: number) => void;
    onNewRowDragOver: (rowIdx: number, e: React.DragEvent) => void;
    onNewRowDrop: (rowIdx: number, e: React.DragEvent) => void;
    onBlockDragOver: (id: string, e: React.DragEvent) => void;
    onBlockDragLeave: (e: React.DragEvent) => void;
    onBlockDrop: (id: string, e: React.DragEvent) => void;
}

function RowGroup<TBlock extends BaseTemplateBlock>(props: RowGroupProps<TBlock>): JSX.Element {
    const {
        rowIdx,
        row,
        registry,
        ctx,
        preview,
        selectedSet,
        hoveredBlockId,
        dropZone,
        onSelect,
        onMoveUp,
        onMoveDown,
        onMoveLeft,
        onMoveRight,
        onSetWidth,
        onNewRowDragOver,
        onNewRowDrop,
        onBlockDragOver,
        onBlockDragLeave,
        onBlockDrop,
    } = props;

    return (
        <>
            {/* Drop zone para crear una nueva fila ANTES de esta fila. */}
            {! preview && rowIdx === 0 && (
                <DropZoneRow
                    active={dropZone?.kind === 'new-row' && dropZone.rowIdx === 0}
                    onDragOver={(e) => onNewRowDragOver(0, e)}
                    onDragLeave={() => null}
                    onDrop={(e) => onNewRowDrop(0, e)}
                />
            )}

            <div className="imcrm-row imcrm-relative imcrm-rounded-md">
                {row.blocks.map((b) => {
                    const w = b.w ?? 12;
                    const basis = `${(w / 12) * 100}%`;
                    const style: CSSProperties = { flexBasis: basis, maxWidth: basis };
                    const isSelected = ! preview && selectedSet.has(b.id);
                    const isDropTarget = hoveredBlockId === b.id;
                    return (
                        <div
                            key={b.id}
                            className="imcrm-row__cell imcrm-relative"
                            style={style}
                        >
                            <BlockSlot
                                preview={preview}
                                isSelected={isSelected}
                                isDropTarget={isDropTarget}
                                onClick={(e) => {
                                    if (preview) return;
                                    e.stopPropagation();
                                    onSelect(b.id, e.shiftKey);
                                }}
                                onDragOver={preview ? undefined : (e) => onBlockDragOver(b.id, e)}
                                onDragLeave={preview ? undefined : onBlockDragLeave}
                                onDrop={preview ? undefined : (e) => onBlockDrop(b.id, e)}
                            >
                                {registry.renderPreview(b, ctx)}
                            </BlockSlot>
                            {isSelected && (
                                <BlockToolbar
                                    block={b}
                                    rowIdx={rowIdx}
                                    colIdx={row.blocks.indexOf(b)}
                                    rowLen={row.blocks.length}
                                    onMoveUp={() => onMoveUp(b.id)}
                                    onMoveDown={() => onMoveDown(b.id)}
                                    onMoveLeft={() => onMoveLeft(b.id)}
                                    onMoveRight={() => onMoveRight(b.id)}
                                    onSetWidth={(w) => onSetWidth(b.id, w)}
                                />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Drop zone para crear una nueva fila DESPUÉS de esta fila. */}
            {! preview && (
                <DropZoneRow
                    active={dropZone?.kind === 'new-row' && dropZone.rowIdx === rowIdx + 1}
                    onDragOver={(e) => onNewRowDragOver(rowIdx + 1, e)}
                    onDragLeave={() => null}
                    onDrop={(e) => onNewRowDrop(rowIdx + 1, e)}
                />
            )}
        </>
    );
}

interface BlockSlotProps {
    preview: boolean;
    isSelected: boolean;
    isDropTarget: boolean;
    onClick: (e: React.MouseEvent) => void;
    onDragOver?: (e: React.DragEvent) => void;
    onDragLeave?: (e: React.DragEvent) => void;
    onDrop?: (e: React.DragEvent) => void;
    children: ReactNode;
}

function BlockSlot({
    preview,
    isSelected,
    isDropTarget,
    onClick,
    onDragOver,
    onDragLeave,
    onDrop,
    children,
}: BlockSlotProps): JSX.Element {
    return (
        <div
            onClick={onClick}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={cn(
                'imcrm-group imcrm-relative imcrm-flex-1 imcrm-overflow-hidden imcrm-rounded-lg imcrm-bg-card imcrm-shadow-imcrm-sm imcrm-ring-1 imcrm-transition-all',
                isDropTarget
                    ? 'imcrm-ring-2 imcrm-ring-primary imcrm-ring-offset-2 imcrm-ring-offset-background'
                    : isSelected
                        ? 'imcrm-ring-2 imcrm-ring-primary'
                        : preview
                            ? 'imcrm-ring-border'
                            : 'imcrm-ring-border hover:imcrm-ring-primary/40 imcrm-cursor-pointer',
            )}
        >
            {children}
            {isDropTarget && (
                <div className="imcrm-pointer-events-none imcrm-absolute imcrm-inset-0 imcrm-z-10 imcrm-flex imcrm-items-center imcrm-justify-center imcrm-bg-primary/10">
                    <p className="imcrm-rounded imcrm-bg-primary imcrm-px-2 imcrm-py-1 imcrm-text-[11px] imcrm-font-medium imcrm-text-primary-foreground imcrm-shadow-imcrm-sm">
                        {__('Soltar para agregar al grupo')}
                    </p>
                </div>
            )}
        </div>
    );
}

interface BlockToolbarProps {
    block: BaseTemplateBlock;
    rowIdx: number;
    colIdx: number;
    rowLen: number;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onMoveLeft: () => void;
    onMoveRight: () => void;
    onSetWidth: (w: number) => void;
}

function BlockToolbar({
    block,
    colIdx,
    rowLen,
    onMoveUp,
    onMoveDown,
    onMoveLeft,
    onMoveRight,
    onSetWidth,
}: BlockToolbarProps): JSX.Element {
    const currentW = block.w ?? 12;
    return (
        <div
            className="imcrm-absolute imcrm-right-1 imcrm-top-1 imcrm-z-20 imcrm-flex imcrm-items-center imcrm-gap-1 imcrm-rounded-md imcrm-border imcrm-border-border imcrm-bg-card imcrm-px-1 imcrm-py-1 imcrm-shadow-imcrm-sm"
            onClick={(e) => e.stopPropagation()}
        >
            <ToolbarBtn onClick={onMoveUp} title={__('Subir fila')}>
                <ArrowUp className="imcrm-h-3.5 imcrm-w-3.5" />
            </ToolbarBtn>
            <ToolbarBtn onClick={onMoveDown} title={__('Bajar fila')}>
                <ArrowDown className="imcrm-h-3.5 imcrm-w-3.5" />
            </ToolbarBtn>
            <ToolbarBtn onClick={onMoveLeft} disabled={colIdx === 0} title={__('Mover a la izquierda')}>
                <ArrowLeft className="imcrm-h-3.5 imcrm-w-3.5" />
            </ToolbarBtn>
            <ToolbarBtn onClick={onMoveRight} disabled={colIdx === rowLen - 1} title={__('Mover a la derecha')}>
                <ArrowRight className="imcrm-h-3.5 imcrm-w-3.5" />
            </ToolbarBtn>
            <div className="imcrm-mx-1 imcrm-h-4 imcrm-w-px imcrm-bg-border" />
            <select
                value={currentW}
                onChange={(e) => onSetWidth(Number(e.target.value))}
                className="imcrm-h-6 imcrm-rounded imcrm-border imcrm-border-border imcrm-bg-background imcrm-px-1 imcrm-text-[11px] imcrm-text-foreground focus:imcrm-outline-none focus:imcrm-ring-1 focus:imcrm-ring-primary"
                aria-label={__('Ancho del bloque')}
            >
                {WIDTH_PRESETS.map((p) => (
                    <option key={p.value} value={p.value}>
                        {p.label} ({p.value}/12)
                    </option>
                ))}
            </select>
        </div>
    );
}

function ToolbarBtn({
    onClick,
    title,
    disabled,
    children,
}: {
    onClick: () => void;
    title: string;
    disabled?: boolean;
    children: ReactNode;
}): JSX.Element {
    return (
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                if (! disabled) onClick();
            }}
            disabled={disabled}
            title={title}
            className={cn(
                'imcrm-flex imcrm-h-6 imcrm-w-6 imcrm-items-center imcrm-justify-center imcrm-rounded imcrm-text-muted-foreground imcrm-transition',
                disabled
                    ? 'imcrm-opacity-30'
                    : 'hover:imcrm-bg-muted hover:imcrm-text-foreground',
            )}
        >
            {children}
        </button>
    );
}

interface DropZoneRowProps {
    active: boolean;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (e: React.DragEvent) => void;
    label?: string;
}

function DropZoneRow({
    active,
    onDragOver,
    onDragLeave,
    onDrop,
    label,
}: DropZoneRowProps): JSX.Element {
    return (
        <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={cn(
                'imcrm-relative imcrm-flex imcrm-items-center imcrm-justify-center imcrm-transition-all',
                active
                    ? 'imcrm-h-12 imcrm-rounded-md imcrm-border-2 imcrm-border-dashed imcrm-border-primary imcrm-bg-primary/5'
                    : 'imcrm-h-2 hover:imcrm-h-8 hover:imcrm-rounded-md hover:imcrm-border hover:imcrm-border-dashed hover:imcrm-border-border hover:imcrm-bg-muted/20',
            )}
        >
            {(active || label) && (
                <span className="imcrm-pointer-events-none imcrm-flex imcrm-items-center imcrm-gap-1 imcrm-text-[11px] imcrm-text-muted-foreground">
                    <Plus className="imcrm-h-3 imcrm-w-3" />
                    {active ? __('Soltar para crear fila') : label ?? ''}
                </span>
            )}
        </div>
    );
}
