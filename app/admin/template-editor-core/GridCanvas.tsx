import { useEffect, useMemo, useRef, useState } from 'react';
import GridLayout, { WidthProvider } from 'react-grid-layout/legacy';
import type { Layout, LayoutItem } from 'react-grid-layout';
import { ArrowDown, LayoutGrid } from 'lucide-react';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import { __ } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { FieldEntity } from '@/types/field';
import type { RecordEntity } from '@/types/record';

import { type PalettePayload, PALETTE_MIME, readDropPayload } from './dragPayload';
import type { BaseTemplateBlock, BlockRegistry } from './types';

const DROPPING_ITEM_ID = '__imcrm_dropping__';
const DROPPING_ITEM: LayoutItem = { i: DROPPING_ITEM_ID, x: 0, y: 0, w: 4, h: 4 };

const SizedGrid = WidthProvider(GridLayout);

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
    onDropFromPalette: (payload: PalettePayload, position: { x: number; y: number }) => void;
    onDropOnBlock: (blockId: string, payload: PalettePayload) => boolean;
}

/**
 * Canvas drag-resize del editor genérico. Soporta:
 *  - Drag/resize del grid (react-grid-layout).
 *  - Selección click (single) y shift-click (additive).
 *  - Drop desde la paleta (a coord libre o sobre bloque existente).
 *  - Modo preview read-only.
 *  - Guías de columnas del grid 12-col en modo editor.
 *
 * Renderea cada bloque vía `registry.renderPreview(block, ctx)`.
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
    const selectedSet = useMemo(() => new Set(selectedBlockIds), [selectedBlockIds]);

    const gridLayout: LayoutItem[] = useMemo(
        () =>
            blocks.map((b) => ({
                i: b.id,
                x: b.x,
                y: b.y,
                w: b.w,
                h: b.h,
                minW: 2,
                minH: 2,
            })),
        [blocks],
    );

    const handleLayoutStop = (next: Layout): void => {
        const byId = new Map(
            next.filter((l) => l.i !== DROPPING_ITEM_ID).map((l) => [l.i, l]),
        );
        const updated = blocks
            .map((b) => {
                const l = byId.get(b.id);
                if (! l) return null;
                if (l.x === b.x && l.y === b.y && l.w === b.w && l.h === b.h) return b;
                return { ...b, x: l.x, y: l.y, w: l.w, h: l.h };
            })
            .filter((b): b is TBlock => b !== null);
        const changed = updated.some((b, i) => b !== blocks[i]);
        if (changed) onBlocksChange(updated);
    };

    const handleDrop = (_layout: Layout, item: LayoutItem | undefined, e: Event): void => {
        if (! item) return;
        const payload = readDropPayload(e as DragEvent);
        if (! payload) return;
        onDropFromPalette(payload, { x: item.x, y: item.y });
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

    const isEmpty = blocks.length === 0;
    const ctx = { listId, fields, record };

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
            {! preview && <GridGuides cols={12} />}

            <SizedGrid
                key={blocks.map((b) => b.id).join(',')}
                className="imcrm-template-editor-grid imcrm-relative imcrm-z-10"
                cols={12}
                // Mismo rowHeight que el front (`grid-auto-rows: 40px`).
                // El zoom visual del editor se controla con el ancho
                // del canvas, no con esta unidad — así un h=4 ocupa
                // 4 * 40 = 160px tanto en editor como en front.
                rowHeight={40}
                margin={[12, 12]}
                containerPadding={[0, 0]}
                layout={gridLayout}
                isDraggable={! preview}
                isResizable={! preview}
                isDroppable={! preview}
                droppingItem={DROPPING_ITEM}
                compactType="vertical"
                draggableCancel=".imcrm-no-drag"
                onDragStop={handleLayoutStop}
                onResizeStop={handleLayoutStop}
                onDrop={handleDrop}
            >
                {blocks.map((b) => {
                    const isSelected = ! preview && selectedSet.has(b.id);
                    const isDropTarget = hoveredBlockId === b.id;
                    return (
                        <BlockSlot
                            key={b.id}
                            block={b}
                            preview={preview}
                            isSelected={isSelected}
                            isDropTarget={isDropTarget}
                            onSelect={onSelectBlock}
                            onDragOver={handleBlockDragOver}
                            onDragLeave={handleBlockDragLeave}
                            onDrop={handleBlockDrop}
                            renderPreview={() => registry.renderPreview(b, ctx)}
                        />
                    );
                })}
            </SizedGrid>

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

/**
 * Slot del bloque en el grid. Encapsula la lógica de:
 *  - Selección / drop / hover.
 *  - Detección de **overflow vertical**: si el contenido renderizado
 *    es más alto que el slot configurado, se muestra un badge sutil
 *    abajo-derecha indicando "+ contenido" con icono. Esto evita que
 *    el usuario se sorprenda al ver el bloque cortado y le insinúa
 *    que debería hacer resize.
 */
function BlockSlot<TBlock extends BaseTemplateBlock>({
    block,
    preview,
    isSelected,
    isDropTarget,
    onSelect,
    onDragOver,
    onDragLeave,
    onDrop,
    renderPreview,
}: {
    block: TBlock;
    preview: boolean;
    isSelected: boolean;
    isDropTarget: boolean;
    onSelect: (id: string | null, additive?: boolean) => void;
    onDragOver: (id: string, e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (id: string, e: React.DragEvent) => void;
    renderPreview: () => React.ReactNode;
}): JSX.Element {
    const innerRef = useRef<HTMLDivElement | null>(null);
    const [overflows, setOverflows] = useState(false);

    useEffect(() => {
        const el = innerRef.current;
        if (! el) return;
        const check = (): void => {
            // scrollHeight > clientHeight indica que el contenido es
            // más alto que el contenedor (overflow vertical).
            setOverflows(el.scrollHeight - 1 > el.clientHeight);
        };
        check();
        const ro = new ResizeObserver(check);
        ro.observe(el);
        return () => ro.disconnect();
    }, [block.w, block.h]);

    return (
        <div
            onClickCapture={(e) => {
                if (preview) return;
                e.stopPropagation();
                onSelect(block.id, e.shiftKey);
            }}
            onDragOver={preview ? undefined : (e) => onDragOver(block.id, e)}
            onDragLeave={preview ? undefined : onDragLeave}
            onDrop={preview ? undefined : (e) => onDrop(block.id, e)}
            className={cn(
                'imcrm-group imcrm-relative imcrm-flex imcrm-flex-col imcrm-overflow-hidden imcrm-rounded-lg imcrm-bg-card imcrm-shadow-imcrm-sm imcrm-ring-1 imcrm-transition-all',
                isDropTarget
                    ? 'imcrm-ring-2 imcrm-ring-primary imcrm-ring-offset-2 imcrm-ring-offset-background'
                    : isSelected
                        ? 'imcrm-ring-2 imcrm-ring-primary'
                        : preview
                            ? 'imcrm-ring-border'
                            : 'imcrm-ring-border hover:imcrm-ring-primary/40',
            )}
        >
            <div ref={innerRef} className="imcrm-pointer-events-none imcrm-flex-1 imcrm-overflow-hidden">
                {renderPreview()}
            </div>
            {overflows && ! isDropTarget && (
                <div
                    className="imcrm-pointer-events-none imcrm-absolute imcrm-bottom-1.5 imcrm-right-1.5 imcrm-flex imcrm-items-center imcrm-gap-1 imcrm-rounded imcrm-bg-amber-500/95 imcrm-px-2 imcrm-py-0.5 imcrm-text-[10px] imcrm-font-medium imcrm-text-white imcrm-shadow-imcrm-sm"
                    title={__('El contenido excede la altura del bloque. En el front se mostrará completo pero el bloque tendrá altura mayor. Hacé resize para evitar desfase.')}
                >
                    <ArrowDown className="imcrm-h-2.5 imcrm-w-2.5" aria-hidden />
                    {__('contenido excede')}
                </div>
            )}
            {isDropTarget && (
                <div className="imcrm-pointer-events-none imcrm-absolute imcrm-inset-0 imcrm-flex imcrm-items-center imcrm-justify-center imcrm-bg-primary/10">
                    <p className="imcrm-rounded imcrm-bg-primary imcrm-px-2 imcrm-py-1 imcrm-text-[11px] imcrm-font-medium imcrm-text-primary-foreground imcrm-shadow-imcrm-sm">
                        {__('Soltar para agregar al grupo')}
                    </p>
                </div>
            )}
        </div>
    );
}

function GridGuides({ cols }: { cols: number }): JSX.Element {
    return (
        <div
            aria-hidden
            className="imcrm-pointer-events-none imcrm-absolute imcrm-inset-3 imcrm-z-0 imcrm-flex imcrm-justify-between"
        >
            {Array.from({ length: cols + 1 }, (_, i) => (
                <div key={i} className="imcrm-h-full imcrm-w-px imcrm-bg-border/40" />
            ))}
        </div>
    );
}
