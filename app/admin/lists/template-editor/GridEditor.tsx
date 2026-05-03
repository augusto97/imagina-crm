import { useMemo, useState } from 'react';
import GridLayout, { WidthProvider } from 'react-grid-layout/legacy';
import type { Layout, LayoutItem } from 'react-grid-layout';
import {
    Activity,
    BarChart3,
    Network,
    Pencil,
    Plus,
    StickyNote as StickyNoteIcon,
    Tag,
    Trash2,
} from 'lucide-react';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { resolveV2, type CustomTemplateConfigV2, type V2Block } from '@/lib/crmTemplates';
import { __ } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { FieldEntity } from '@/types/field';
import type { RecordEntity } from '@/types/record';

import { BlockRenderer } from '@/admin/records/crm/BlockRenderer';
import { BlockConfigDialog } from './blocks/BlockConfigDialog';

const SizedGrid = WidthProvider(GridLayout);

interface GridEditorProps {
    listId: number;
    fields: FieldEntity[];
    config: CustomTemplateConfigV2;
    onChange: (next: CustomTemplateConfigV2) => void;
    sampleRecord: RecordEntity;
}

/**
 * Canvas drag-resize-able del editor visual de plantillas (0.35.0).
 *
 * Misma `react-grid-layout` que el RecordCrmLayout pero en
 * `isDraggable + isResizable`. Cada bloque rendera con
 * `BlockRenderer` (preview real del look final), con un overlay de
 * editar/eliminar al hover y un agarre de "drag handle" arriba.
 *
 * Cambios de posición/tamaño se persisten al estado vía `onChange`
 * (el componente caller se encarga de commit a backend con un
 * Save explícito). NO commiteamos en cada drag — solo en
 * `onDragStop`/`onResizeStop`.
 */
export function GridEditor({
    listId,
    fields,
    config,
    onChange,
    sampleRecord,
}: GridEditorProps): JSX.Element {
    const confirm = useConfirm();
    const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

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
        // Mapeamos `next` (array de LayoutItem) sobre los blocks
        // existentes — actualizamos x/y/w/h pero conservamos type y
        // config. Los blocks que el grid eliminó por algún motivo
        // (no debería pasar) se pierden — defensivo.
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

    const handleAddBlock = (type: V2Block['type']): void => {
        const id = `${type}-${Date.now()}`;
        const newBlock = createBlock(id, type, fields, config.blocks);
        if (! newBlock) return;
        onChange({ ...config, blocks: [...config.blocks, newBlock] });
        // Abre el dialog de config para que el user lo termine de
        // configurar (label, fields, content, etc.).
        if (type === 'properties_group' || type === 'notes' || type === 'related') {
            setEditingBlockId(id);
        }
    };

    const handleDeleteBlock = async (id: string): Promise<void> => {
        const ok = await confirm({
            title: __('Eliminar bloque'),
            description: __('Lo podés volver a agregar después desde el menú.'),
            destructive: true,
            confirmLabel: __('Eliminar'),
        });
        if (! ok) return;
        onChange({ ...config, blocks: config.blocks.filter((b) => b.id !== id) });
    };

    const handleUpdateBlock = (id: string, patch: Partial<V2Block>): void => {
        onChange({
            ...config,
            blocks: config.blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as V2Block) : b)),
        });
    };

    const editingBlock = editingBlockId
        ? config.blocks.find((b) => b.id === editingBlockId) ?? null
        : null;

    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-3">
            <div className="imcrm-flex imcrm-items-center imcrm-justify-between imcrm-gap-2">
                <p className="imcrm-text-xs imcrm-text-muted-foreground">
                    {__('Arrastrá bloques para reorganizar. Estirá las esquinas para cambiar tamaño. Click ✏ para editar contenido.')}
                </p>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button size="sm" className="imcrm-gap-1.5">
                            <Plus className="imcrm-h-3.5 imcrm-w-3.5" />
                            {__('Agregar bloque')}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="imcrm-min-w-[220px]">
                        <DropdownMenuItem onSelect={() => handleAddBlock('properties_group')}>
                            <Tag className="imcrm-mr-2 imcrm-h-3.5 imcrm-w-3.5" />
                            {__('Grupo de propiedades')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleAddBlock('notes')}>
                            <StickyNoteIcon className="imcrm-mr-2 imcrm-h-3.5 imcrm-w-3.5" />
                            {__('Notas (texto custom)')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onSelect={() => handleAddBlock('timeline')}
                            disabled={config.blocks.some((b) => b.type === 'timeline')}
                        >
                            <Activity className="imcrm-mr-2 imcrm-h-3.5 imcrm-w-3.5" />
                            {__('Timeline (1 sola permitida)')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onSelect={() => handleAddBlock('stats')}
                            disabled={config.blocks.some((b) => b.type === 'stats')}
                        >
                            <BarChart3 className="imcrm-mr-2 imcrm-h-3.5 imcrm-w-3.5" />
                            {__('Resumen (1 solo permitido)')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleAddBlock('related')}>
                            <Network className="imcrm-mr-2 imcrm-h-3.5 imcrm-w-3.5" />
                            {__('Records relacionados')}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {config.blocks.length === 0 ? (
                <div className="imcrm-rounded-lg imcrm-border imcrm-border-dashed imcrm-border-border imcrm-px-6 imcrm-py-12 imcrm-text-center">
                    <p className="imcrm-text-sm imcrm-text-muted-foreground">
                        {__('Canvas vacío. Agregá bloques con el botón "Agregar bloque" o usá "Restaurar desde…" para empezar de una plantilla built-in.')}
                    </p>
                </div>
            ) : (
                <div className="imcrm-rounded-lg imcrm-border imcrm-border-dashed imcrm-border-border imcrm-bg-muted/10 imcrm-p-3">
                    <SizedGrid
                        className="imcrm-template-editor-grid"
                        cols={12}
                        rowHeight={48}
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
                        {resolved.blocks.map((b) => (
                            <div
                                key={b.id}
                                className="imcrm-relative imcrm-flex imcrm-flex-col imcrm-overflow-hidden imcrm-rounded-lg imcrm-bg-card imcrm-shadow-imcrm-sm imcrm-ring-1 imcrm-ring-border"
                            >
                                <div className="imcrm-absolute imcrm-right-2 imcrm-top-2 imcrm-z-10 imcrm-flex imcrm-gap-1 imcrm-no-drag">
                                    <button
                                        type="button"
                                        onClick={() => setEditingBlockId(b.id)}
                                        className={cn(
                                            'imcrm-flex imcrm-h-7 imcrm-w-7 imcrm-items-center imcrm-justify-center imcrm-rounded-md imcrm-border imcrm-border-border imcrm-bg-card/95 imcrm-text-muted-foreground imcrm-shadow-imcrm-sm',
                                            'hover:imcrm-bg-accent hover:imcrm-text-foreground',
                                        )}
                                        aria-label={__('Editar bloque')}
                                    >
                                        <Pencil className="imcrm-h-3.5 imcrm-w-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void handleDeleteBlock(b.id)}
                                        className={cn(
                                            'imcrm-flex imcrm-h-7 imcrm-w-7 imcrm-items-center imcrm-justify-center imcrm-rounded-md imcrm-border imcrm-border-border imcrm-bg-card/95 imcrm-text-muted-foreground imcrm-shadow-imcrm-sm',
                                            'hover:imcrm-border-destructive/50 hover:imcrm-bg-destructive/10 hover:imcrm-text-destructive',
                                        )}
                                        aria-label={__('Eliminar bloque')}
                                    >
                                        <Trash2 className="imcrm-h-3.5 imcrm-w-3.5" />
                                    </button>
                                </div>
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
                        ))}
                    </SizedGrid>
                </div>
            )}

            {editingBlock && (
                <BlockConfigDialog
                    block={editingBlock}
                    fields={fields}
                    onUpdate={(patch) => handleUpdateBlock(editingBlock.id, patch)}
                    onClose={() => setEditingBlockId(null)}
                />
            )}
        </div>
    );
}

/**
 * Crea un bloque nuevo con defaults razonables. Para los que no
 * dependen de fields (timeline, stats, notes), usa valores seguros.
 * Para los que sí (properties_group, related), pre-rellena el
 * primer field/relation disponible.
 */
function createBlock(
    id: string,
    type: V2Block['type'],
    fields: FieldEntity[],
    existing: V2Block[],
): V2Block | null {
    // Position default: nuevo bloque al final de la primera columna
    // libre, w=4 h=4 (ajusta automáticamente cuando el grid compacta).
    const maxY = existing.reduce((m, b) => Math.max(m, b.y + b.h), 0);
    const base = { id, x: 0, y: maxY, w: 4, h: 4 };

    if (type === 'properties_group') {
        return { ...base, type, config: { label: __('Grupo nuevo'), icon_key: 'database', field_slugs: [], collapsed_by_default: false } };
    }
    if (type === 'timeline') {
        return { ...base, w: 8, h: 12, type, config: {} };
    }
    if (type === 'stats') {
        return { ...base, w: 4, h: 4, type, config: {} };
    }
    if (type === 'notes') {
        return { ...base, w: 4, h: 3, type, config: { title: __('Nota'), content: '' } };
    }
    if (type === 'related') {
        const firstRelation = fields.find((f) => f.type === 'relation');
        if (! firstRelation) return null;
        return { ...base, w: 4, h: 4, type, config: { field_slug: firstRelation.slug } };
    }
    return null;
}
