import { useMemo } from 'react';
import GridLayout, { WidthProvider } from 'react-grid-layout/legacy';
import type { Layout, LayoutItem } from 'react-grid-layout';

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
    selectedBlockId: string | null;
    onSelectBlock: (id: string | null) => void;
    onDropFromPalette: (payload: PalettePayload, position: { x: number; y: number }) => void;
}

const DROPPING_ITEM_ID = '__imcrm_dropping__';
// `x` y `y` son placeholders — rgl los recalcula según donde se
// suelte el item. El shape los requiere por tipo (LayoutItem).
const DROPPING_ITEM: LayoutItem = { i: DROPPING_ITEM_ID, x: 0, y: 0, w: 4, h: 4 };

/**
 * Canvas drag-resize-able del editor visual de plantillas
 * (Fase 11.A+, drop-from-palette agregado en 11.B).
 *
 * El componente expone tres responsabilidades:
 *  1. Drag/resize del grid (vía react-grid-layout).
 *  2. Selección por click — el bloque activo recibe ring `primary`.
 *  3. Aceptar drops desde la paleta — el parent recibe el payload
 *     decodeado y la posición `{ x, y }` calculada por el grid.
 *
 * El placeholder visual del drop (ghost) viene del `droppingItem`
 * prop de rgl. Cuando el drop ocurre, el handler `onDrop` recibe
 * el ítem con `x, y` ya calculadas según donde se soltó.
 */
export function GridEditor({
    listId,
    fields,
    config,
    onChange,
    sampleRecord,
    selectedBlockId,
    onSelectBlock,
    onDropFromPalette,
}: GridEditorProps): JSX.Element {
    const resolved = useMemo(() => resolveV2(config, fields), [config, fields]);

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
        // Ignoramos el item placeholder del drop si está presente
        // (rgl lo agrega temporalmente al layout durante el drag).
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
            <SizedGrid
                key={config.blocks.map((b) => b.id).join(',')}
                className="imcrm-template-editor-grid"
                cols={12}
                rowHeight={40}
                margin={[12, 12]}
                containerPadding={[0, 0]}
                layout={gridLayout}
                isDraggable
                isResizable
                isDroppable
                droppingItem={DROPPING_ITEM}
                compactType="vertical"
                draggableCancel=".imcrm-no-drag"
                onDragStop={handleLayoutStop}
                onResizeStop={handleLayoutStop}
                onDrop={handleDrop}
            >
                {resolved.blocks.map((b) => {
                    const isSelected = selectedBlockId === b.id;
                    return (
                        <div
                            key={b.id}
                            onClickCapture={(e) => {
                                e.stopPropagation();
                                onSelectBlock(b.id);
                            }}
                            className={cn(
                                'imcrm-group imcrm-relative imcrm-flex imcrm-flex-col imcrm-overflow-hidden imcrm-rounded-lg imcrm-bg-card imcrm-shadow-imcrm-sm imcrm-ring-1 imcrm-transition-shadow',
                                isSelected
                                    ? 'imcrm-ring-2 imcrm-ring-primary'
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
                        </div>
                    );
                })}
            </SizedGrid>

            {isEmpty && (
                <div className="imcrm-pointer-events-none imcrm-absolute imcrm-inset-3 imcrm-flex imcrm-flex-col imcrm-items-center imcrm-justify-center imcrm-rounded-md imcrm-px-6 imcrm-text-center">
                    <p className="imcrm-max-w-sm imcrm-text-sm imcrm-text-muted-foreground">
                        {__('Canvas vacío. Arrastrá un bloque desde la paleta de la izquierda o usá "Restaurar desde plantilla" en el panel derecho.')}
                    </p>
                </div>
            )}
        </div>
    );
}
