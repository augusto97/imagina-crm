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

const SizedGrid = WidthProvider(GridLayout);

interface GridEditorProps {
    listId: number;
    fields: FieldEntity[];
    config: CustomTemplateConfigV2;
    onChange: (next: CustomTemplateConfigV2) => void;
    sampleRecord: RecordEntity;
    selectedBlockId: string | null;
    onSelectBlock: (id: string | null) => void;
}

/**
 * Canvas drag-resize-able del editor visual de plantillas
 * (Fase 11.A+).
 *
 * Cambios desde la 11.0:
 *  - La selección de bloque ahora la controla el parent
 *    (`TemplateEditorPage`) — un click selecciona, otro click en el
 *    canvas vacío deselecciona. Eso permite que el inspector lateral
 *    quede sincronizado.
 *  - Se removió el dropdown "Agregar bloque" (vive en la paleta
 *    izquierda) y el botón ✏ de cada bloque (selección = inspector).
 *  - Se removió el `BlockConfigDialog` modal (su contenido vive en
 *    `BlockInspectorPanel`).
 *
 * El componente sigue siendo responsable del drag/resize del grid y
 * del rendering visual de los bloques con `BlockRenderer`.
 */
export function GridEditor({
    listId,
    fields,
    config,
    onChange,
    sampleRecord,
    selectedBlockId,
    onSelectBlock,
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
        const byId = new Map(next.map((l) => [l.i, l]));
        const updated = config.blocks
            .map((b) => {
                const l = byId.get(b.id);
                if (! l) return null;
                return { ...b, x: l.x, y: l.y, w: l.w, h: l.h };
            })
            .filter((b): b is V2Block => b !== null);
        onChange({ ...config, blocks: updated });
    };

    if (config.blocks.length === 0) {
        return (
            <div
                className="imcrm-flex imcrm-h-full imcrm-min-h-[420px] imcrm-flex-col imcrm-items-center imcrm-justify-center imcrm-rounded-lg imcrm-border imcrm-border-dashed imcrm-border-border imcrm-px-6 imcrm-py-12 imcrm-text-center"
                onClick={() => onSelectBlock(null)}
            >
                <p className="imcrm-max-w-sm imcrm-text-sm imcrm-text-muted-foreground">
                    {__('Canvas vacío. Agregá bloques desde la paleta de la izquierda o usá "Restaurar desde plantilla" en el panel derecho.')}
                </p>
            </div>
        );
    }

    return (
        <div
            className="imcrm-rounded-lg imcrm-border imcrm-border-dashed imcrm-border-border imcrm-bg-muted/10 imcrm-p-3"
            onClick={(e) => {
                // Click en el background vacío deselecciona.
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
                compactType="vertical"
                draggableCancel=".imcrm-no-drag"
                onDragStop={handleLayoutStop}
                onResizeStop={handleLayoutStop}
            >
                {resolved.blocks.map((b) => {
                    const isSelected = selectedBlockId === b.id;
                    return (
                        <div
                            key={b.id}
                            onClickCapture={(e) => {
                                // Solo selecciona en click directo (no drag).
                                // react-grid-layout cancela onClick si fue drag.
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
        </div>
    );
}
