import { forwardRef, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import GridLayout, { WidthProvider } from 'react-grid-layout/legacy';
import type { Layout, LayoutItem } from 'react-grid-layout';
import { LayoutGrid } from 'lucide-react';

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

    // Auto-height: rows necesarias medidas del contenido natural de cada
    // bloque. La altura del bloque es SIEMPRE el contenido natural —
    // `block.h` solo se usa como hint inicial mientras el ResizeObserver
    // hace la primera medición, después autoRows manda.
    //
    //   effectiveH = autoRows[id] ?? b.h
    //
    // Esto elimina espacios vacíos: si el contenido es más chico que
    // el `block.h` heredado de plantillas viejas, el slot se contrae.
    // Si es más grande, expande. El user no puede hacer slot más grande
    // que el contenido manualmente — para más espacio visual hay que
    // usar padding/margin internos del config del bloque (decisión de
    // diseño tomada en 0.57.22 ante feedback de espacios desperdiciados).
    const [autoRows, setAutoRows] = useState<Record<string, number>>({});

    const reportMeasure = useCallback((blockId: string, rows: number): void => {
        setAutoRows((prev) => {
            if (prev[blockId] === rows) return prev;
            return { ...prev, [blockId]: rows };
        });
    }, []);

    // Cleanup de entries huérfanas cuando un bloque se elimina.
    useEffect(() => {
        setAutoRows((prev) => {
            const live = new Set(blocks.map((b) => b.id));
            let dirty = false;
            const next: Record<string, number> = {};
            for (const [id, h] of Object.entries(prev)) {
                if (live.has(id)) next[id] = h;
                else dirty = true;
            }
            return dirty ? next : prev;
        });
    }, [blocks]);

    const gridLayout: LayoutItem[] = useMemo(
        () =>
            blocks.map((b) => ({
                i: b.id,
                x: b.x,
                y: b.y,
                w: b.w,
                h: autoRows[b.id] ?? b.h,
                minW: 2,
                minH: 2,
            })),
        [blocks, autoRows],
    );

    const handleLayoutStop = (next: Layout): void => {
        // Persistimos solo cambios de posición (x, y) y ancho (w) — la
        // altura `h` es siempre derivada del contenido (autoRows), así
        // que ignoramos `l.h` del library. Si el user hizo resize
        // vertical, el resize se "deshace" al próximo render porque
        // effectiveH vuelve a autoRows[id].
        const byId = new Map(
            next.filter((l) => l.i !== DROPPING_ITEM_ID).map((l) => [l.i, l]),
        );
        const updated = blocks
            .map((b) => {
                const l = byId.get(b.id);
                if (! l) return null;
                if (l.x === b.x && l.y === b.y && l.w === b.w) return b;
                return { ...b, x: l.x, y: l.y, w: l.w };
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
                // Solo handle del este → resize horizontal. La altura
                // es siempre auto del contenido (autoRows), así que un
                // handle vertical sería engañoso (cambia el `h` que se
                // descarta al próximo render).
                resizeHandles={['e']}
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
                            blockId={b.id}
                            preview={preview}
                            isSelected={isSelected}
                            isDropTarget={isDropTarget}
                            onSelect={onSelectBlock}
                            onDragOver={handleBlockDragOver}
                            onDragLeave={handleBlockDragLeave}
                            onDrop={handleBlockDrop}
                            onMeasure={reportMeasure}
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

interface BlockSlotProps {
    blockId: string;
    preview: boolean;
    isSelected: boolean;
    isDropTarget: boolean;
    onSelect: (id: string | null, additive?: boolean) => void;
    onDragOver: (id: string, e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (id: string, e: React.DragEvent) => void;
    onMeasure: (id: string, rows: number) => void;
    renderPreview: () => ReactNode;
    /** Props inyectadas por react-grid-layout via cloneElement. */
    style?: CSSProperties;
    className?: string;
    children?: ReactNode;
}

// Mismos valores que el `SizedGrid`: rowHeight=40, margin[1]=12. Cada
// row ocupa `40 + 12` excepto la última (sin margin bottom). Si
// `naturalPx` es el alto natural del contenido, el número de rows
// requeridas es `ceil((naturalPx + 12) / 52)`.
const ROW_HEIGHT_PX = 40;
const ROW_MARGIN_PX = 12;
const MIN_ROWS = 2; // mismo `minH` del library
const MAX_AUTO_ROWS = 24; // cap defensivo para bloques con contenido enorme (timeline con muchos items, etc.)

function pxToRows(naturalPx: number): number {
    const rows = Math.ceil((naturalPx + ROW_MARGIN_PX) / (ROW_HEIGHT_PX + ROW_MARGIN_PX));
    return Math.max(MIN_ROWS, Math.min(MAX_AUTO_ROWS, rows));
}

/**
 * Slot del bloque en el grid.
 *
 * **CRÍTICO — children de react-grid-layout deben spreadear props
 * inyectadas y forwardear ref**: el library clona cada child para
 * agregarle `style` (position absolute + transform), `className`
 * (`react-grid-item`), `ref` (para medición) y handlers de mouse
 * para el drag. Si el child no propaga estas al outer DOM node, los
 * bloques quedan sin posicionamiento ni interactividad. Por eso este
 * componente:
 *  - Usa `forwardRef` para que react-grid-layout pueda medir el nodo.
 *  - Acepta `style` / `className` / `children` (los resize handles
 *    vienen como children del clone) y los aplica al outer div.
 *  - Compone su propio className con el del library en vez de pisarlo.
 *
 * **Auto-height**: mide el `scrollHeight` del contenido renderizado
 * y lo reporta al padre via `onMeasure(rows)`. El padre expande
 * efectivamente el slot al alto necesario para que el contenido
 * nunca se vea recortado.
 */
const BlockSlot = forwardRef<HTMLDivElement, BlockSlotProps>(function BlockSlot(
    {
        blockId,
        preview,
        isSelected,
        isDropTarget,
        onSelect,
        onDragOver,
        onDragLeave,
        onDrop,
        onMeasure,
        renderPreview,
        style,
        className,
        children,
        ...rest
    },
    ref,
) {
    const innerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const el = innerRef.current;
        if (! el) return;
        const measure = (): void => {
            onMeasure(blockId, pxToRows(el.scrollHeight));
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, [blockId, onMeasure]);

    return (
        <div
            ref={ref}
            style={style}
            {...rest}
            onClickCapture={(e) => {
                if (preview) return;
                e.stopPropagation();
                onSelect(blockId, e.shiftKey);
            }}
            onDragOver={preview ? undefined : (e) => onDragOver(blockId, e)}
            onDragLeave={preview ? undefined : onDragLeave}
            onDrop={preview ? undefined : (e) => onDrop(blockId, e)}
            className={cn(
                className,
                'imcrm-group imcrm-overflow-hidden imcrm-rounded-lg imcrm-bg-card imcrm-shadow-imcrm-sm imcrm-ring-1 imcrm-transition-all',
                isDropTarget
                    ? 'imcrm-ring-2 imcrm-ring-primary imcrm-ring-offset-2 imcrm-ring-offset-background'
                    : isSelected
                        ? 'imcrm-ring-2 imcrm-ring-primary'
                        : preview
                            ? 'imcrm-ring-border'
                            : 'imcrm-ring-border hover:imcrm-ring-primary/40',
            )}
        >
            <div
                ref={innerRef}
                className="imcrm-pointer-events-none imcrm-absolute imcrm-inset-0 imcrm-overflow-hidden"
            >
                {renderPreview()}
            </div>
            {isDropTarget && (
                <div className="imcrm-pointer-events-none imcrm-absolute imcrm-inset-0 imcrm-z-10 imcrm-flex imcrm-items-center imcrm-justify-center imcrm-bg-primary/10">
                    <p className="imcrm-rounded imcrm-bg-primary imcrm-px-2 imcrm-py-1 imcrm-text-[11px] imcrm-font-medium imcrm-text-primary-foreground imcrm-shadow-imcrm-sm">
                        {__('Soltar para agregar al grupo')}
                    </p>
                </div>
            )}
            {/* `children` viene de react-grid-layout (resize handles).
                Debe ir al final para superponerse sobre el preview. */}
            {children}
        </div>
    );
});

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
