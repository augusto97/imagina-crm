import { useMemo, useState } from 'react';
import GridLayout, { WidthProvider } from 'react-grid-layout/legacy';
import type { Layout, LayoutItem } from 'react-grid-layout';
import { LayoutGrid } from 'lucide-react';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import { resolveV2, type CustomTemplateConfigV2, type V2Block } from '@/lib/crmTemplates';
import { __ } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { FieldEntity } from '@/types/field';
import type { RecordEntity } from '@/types/record';

import { BlockRenderer } from '@/admin/records/crm/BlockRenderer';

import { type PalettePayload, readDropPayload } from './utils/dragPayload';

const SizedGrid = WidthProvider(GridLayout);

interface GridEditorProps {
    listId: number;
    fields: FieldEntity[];
    config: CustomTemplateConfigV2;
    onChange: (next: CustomTemplateConfigV2) => void;
    sampleRecord: RecordEntity;
    selectedBlockIds: string[];
    onSelectBlock: (id: string | null, additive?: boolean) => void;
    onDropFromPalette: (payload: PalettePayload, position: { x: number; y: number }) => void;
    onDropOnBlock: (blockId: string, payload: PalettePayload) => boolean;
    preview?: boolean;
}

const DROPPING_ITEM_ID = '__imcrm_dropping__';
const DROPPING_ITEM: LayoutItem = { i: DROPPING_ITEM_ID, x: 0, y: 0, w: 4, h: 4 };

/**
 * Canvas drag-resize-able del editor visual de plantillas
 * (Fase 11.A+, drop-from-palette agregado en 11.B, drop-on-block
 * + grid guides + modo preview agregados en 11.C).
 *
 * Responsabilidades:
 *  1. Drag/resize del grid (vía react-grid-layout).
 *  2. Selección por click — el bloque activo recibe ring `primary`.
 *  3. Aceptar drops desde la paleta a coords libres (`onDropFromPalette`)
 *     o sobre un bloque existente (`onDropOnBlock`). El parent
 *     decide qué payload acepta cada bloque y retorna true/false.
 *  4. Modo preview (read-only) que deshabilita drag/resize/drop
 *     para una vista WYSIWYG del template final.
 *
 * Grid guides (Fase 11.C): líneas verticales sutiles cada columna
 * del grid (12 cols) para que el user sepa donde se alinearán
 * los bloques. Solo visibles en modo editor, no en preview.
 */
export function GridEditor({
    listId,
    fields,
    config,
    onChange,
    sampleRecord,
    selectedBlockIds,
    onSelectBlock,
    onDropFromPalette,
    onDropOnBlock,
    preview = false,
}: GridEditorProps): JSX.Element {
    const resolved = useMemo(() => resolveV2(config, fields), [config, fields]);
    const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
    const selectedSet = useMemo(() => new Set(selectedBlockIds), [selectedBlockIds]);

    const gridLayout: LayoutItem[] = useMemo(
        () =>
            config.blocks.map((b) => ({
                i: b.id,
                x: b.x,
                y: b.y,
                w: b.w,
                h: b.h,
                minW: 2,
                minH: 2,
            })),
        [config.blocks],
    );

    const handleLayoutStop = (next: Layout): void => {
        const byId = new Map(
            next.filter((l) => l.i !== DROPPING_ITEM_ID).map((l) => [l.i, l]),
        );
        const updated = config.blocks
            .map((b) => {
                const l = byId.get(b.id);
                if (! l) return null;
                return { ...b, x: l.x, y: l.y, w: l.w, h: l.h };
            })
            .filter((b): b is V2Block => b !== null);
        onChange({ ...config, blocks: updated });
    };

    const handleDrop = (_layout: Layout, item: LayoutItem | undefined, e: Event): void => {
        if (! item) return;
        const payload = readDropPayload(e as DragEvent);
        if (! payload) return;
        onDropFromPalette(payload, { x: item.x, y: item.y });
    };

    const handleBlockDragOver = (blockId: string, e: React.DragEvent): void => {
        // Tipos del DataTransfer durante dragover solo expone los MIMEs
        // (no el contenido). Validamos por MIME para evitar feedback
        // visual sobre drags ajenos al editor.
        if (! Array.from(e.dataTransfer.types).includes('application/x-imcrm-palette')) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
        setHoveredBlockId(blockId);
    };

    const handleBlockDragLeave = (e: React.DragEvent): void => {
        // currentTarget changes per element; usamos relatedTarget para
        // distinguir drag-leave-block vs drag-cross-children.
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

    const isEmpty = config.blocks.length === 0;

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
                key={config.blocks.map((b) => b.id).join(',')}
                className="imcrm-template-editor-grid imcrm-relative imcrm-z-10"
                cols={12}
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
                {resolved.blocks.map((b) => {
                    const isSelected = ! preview && selectedSet.has(b.id);
                    const isDropTarget = hoveredBlockId === b.id;
                    return (
                        <div
                            key={b.id}
                            onClickCapture={(e) => {
                                if (preview) return;
                                e.stopPropagation();
                                onSelectBlock(b.id, e.shiftKey);
                            }}
                            onDragOver={preview ? undefined : (e) => handleBlockDragOver(b.id, e)}
                            onDragLeave={preview ? undefined : handleBlockDragLeave}
                            onDrop={preview ? undefined : (e) => handleBlockDrop(b.id, e)}
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
                            <div className="imcrm-pointer-events-none imcrm-flex-1 imcrm-overflow-hidden">
                                <BlockRenderer
                                    block={b}
                                    listId={listId}
                                    recordId={sampleRecord.id}
                                    currentUserId={0}
                                    isAdmin={false}
                                    values={sampleRecord.fields}
                                    onChange={() => undefined}
                                    record={sampleRecord}
                                />
                            </div>
                            {isDropTarget && (
                                <div className="imcrm-pointer-events-none imcrm-absolute imcrm-inset-0 imcrm-flex imcrm-items-center imcrm-justify-center imcrm-bg-primary/10">
                                    <p className="imcrm-rounded imcrm-bg-primary imcrm-px-2 imcrm-py-1 imcrm-text-[11px] imcrm-font-medium imcrm-text-primary-foreground imcrm-shadow-imcrm-sm">
                                        {__('Soltar para agregar al grupo')}
                                    </p>
                                </div>
                            )}
                        </div>
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
                            : __('Canvas vacío. Arrastrá un bloque desde la paleta de la izquierda o restaurá una plantilla built-in desde el panel derecho.')}
                    </p>
                </div>
            )}
        </div>
    );
}

/**
 * Líneas verticales sutiles para guías de columnas del grid (12).
 * Posicionadas absolutamente debajo del grid (`z-0`), para no
 * interferir con clicks ni drags. Solo visibles en modo editor.
 */
function GridGuides({ cols }: { cols: number }): JSX.Element {
    return (
        <div
            aria-hidden
            className="imcrm-pointer-events-none imcrm-absolute imcrm-inset-3 imcrm-z-0 imcrm-flex imcrm-justify-between"
        >
            {Array.from({ length: cols + 1 }, (_, i) => (
                <div
                    key={i}
                    className="imcrm-h-full imcrm-w-px imcrm-bg-border/40"
                />
            ))}
        </div>
    );
}
