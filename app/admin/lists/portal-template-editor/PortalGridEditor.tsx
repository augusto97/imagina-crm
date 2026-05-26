import { useMemo, useState } from 'react';
import GridLayout, { WidthProvider } from 'react-grid-layout/legacy';
import type { Layout, LayoutItem } from 'react-grid-layout';
import { Code, Plus, Trash2, X } from 'lucide-react';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useFields } from '@/hooks/useFields';
import { __ } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import {
    PORTAL_BLOCK_TYPES,
    type PortalBlockType,
    type PortalTemplate,
} from '@/types/portal';

import { PortalBlockForm } from './PortalBlockForms';
import { PortalBlockPreview } from './PortalBlockPreview';
import {
    createPortalBlock,
    resolvePortalBlocks,
    toPortalTemplate,
    type ResolvedPortalBlock,
} from './portalLayout';

const SizedGrid = WidthProvider(GridLayout);

interface Props {
    listId: number;
    template: PortalTemplate;
    onChange: (template: PortalTemplate) => void;
    advancedMode: boolean;
    onAdvancedToggle: (advanced: boolean) => void;
}

/**
 * Editor visual del portal del cliente con grid 12-col, drag-and-drop,
 * resize, palette de bloques y panel de inspector — paridad con el
 * editor de "Apariencia del registro" (CRM panel).
 *
 * Hasta 0.54.1 el editor era una lista vertical primitiva con flechas
 * up/down y `<input type="text">` para los slugs. Ahora:
 *
 *  - Grid 12-col con drag-and-drop (via `react-grid-layout`, misma
 *    libería que el editor CRM).
 *  - Palette colapsable a la izquierda con los 9 tipos de bloque.
 *  - Click "+" en cada item de la palette para agregar al grid.
 *  - Inspector a la derecha al seleccionar un bloque, con field
 *    pickers reales (selects de campos, no inputs de slugs).
 *  - Modo "Avanzado": switchea a textarea JSON crudo para copy-paste.
 *
 * Layout backward-compat: si el template existente no tiene
 * x/y/w/h por bloque, el resolver auto-asigna layout vertical
 * full-width y al primer guardado se persisten las posiciones.
 */
export function PortalGridEditor({
    listId,
    template,
    onChange,
    advancedMode,
    onAdvancedToggle,
}: Props): JSX.Element {
    const fields = useFields(listId);
    const resolved = useMemo(() => resolvePortalBlocks(template.blocks), [template.blocks]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [jsonDraft, setJsonDraft] = useState<string>(() => JSON.stringify(template, null, 2));
    const [jsonError, setJsonError] = useState<string | null>(null);

    if (advancedMode) {
        return (
            <div className="imcrm-flex imcrm-flex-col imcrm-gap-2">
                <div className="imcrm-flex imcrm-items-center imcrm-justify-between">
                    <p className="imcrm-text-xs imcrm-text-muted-foreground">
                        {__('Modo avanzado: editá el JSON crudo del template.')}
                    </p>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            try {
                                const parsed = JSON.parse(jsonDraft) as PortalTemplate;
                                onChange(parsed);
                                setJsonError(null);
                                onAdvancedToggle(false);
                            } catch (err) {
                                setJsonError(
                                    err instanceof Error
                                        ? err.message
                                        : __('JSON inválido.'),
                                );
                            }
                        }}
                    >
                        {__('Volver al editor visual')}
                    </Button>
                </div>
                <Textarea
                    rows={20}
                    value={jsonDraft}
                    onChange={(e) => setJsonDraft(e.target.value)}
                    className="imcrm-font-mono imcrm-text-xs"
                />
                {jsonError !== null && (
                    <p className="imcrm-text-xs imcrm-text-destructive">{jsonError}</p>
                )}
            </div>
        );
    }

    const layout: LayoutItem[] = resolved.map((b) => ({
        i: b.id,
        x: b.x,
        y: b.y,
        w: b.w,
        h: b.h,
        minW: 2,
        minH: 2,
    }));

    const commit = (next: ResolvedPortalBlock[]): void => {
        onChange(toPortalTemplate(next));
        setJsonDraft(JSON.stringify(toPortalTemplate(next), null, 2));
    };

    const handleLayoutStop = (next: Layout): void => {
        const byId = new Map(next.map((l) => [l.i, l]));
        const updated = resolved
            .map((b) => {
                const l = byId.get(b.id);
                if (!l) return null;
                return { ...b, x: l.x, y: l.y, w: l.w, h: l.h };
            })
            .filter((b): b is ResolvedPortalBlock => b !== null);
        commit(updated);
    };

    const addBlock = (type: PortalBlockType): void => {
        const block = createPortalBlock(type, resolved);
        commit([...resolved, block]);
        setSelectedId(block.id);
    };

    const removeBlock = (id: string): void => {
        commit(resolved.filter((b) => b.id !== id));
        if (selectedId === id) setSelectedId(null);
    };

    const updateBlockConfig = (id: string, config: Record<string, unknown>): void => {
        commit(resolved.map((b) => (b.id === id ? { ...b, config } : b)));
    };

    const selected = selectedId ? resolved.find((b) => b.id === selectedId) : null;
    const isEmpty = resolved.length === 0;

    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-3">
            <div className="imcrm-flex imcrm-items-center imcrm-justify-between imcrm-gap-2">
                <p className="imcrm-text-xs imcrm-text-muted-foreground">
                    {__('Arrastrá para mover · esquina inferior derecha para redimensionar · click para configurar')}
                </p>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="imcrm-gap-1.5 imcrm-text-xs"
                    onClick={() => {
                        setJsonDraft(JSON.stringify(template, null, 2));
                        onAdvancedToggle(true);
                    }}
                >
                    <Code className="imcrm-h-3 imcrm-w-3" />
                    {__('Modo avanzado (JSON)')}
                </Button>
            </div>

            <div className="imcrm-grid imcrm-grid-cols-[180px_1fr_280px] imcrm-gap-3 imcrm-min-h-[480px]">
                {/* Palette (columna izq) ──────────────────────────── */}
                <aside className="imcrm-flex imcrm-flex-col imcrm-gap-1 imcrm-rounded-lg imcrm-border imcrm-border-border imcrm-bg-muted/20 imcrm-p-2">
                    <p className="imcrm-px-1 imcrm-py-0.5 imcrm-text-[10px] imcrm-font-medium imcrm-uppercase imcrm-tracking-wider imcrm-text-muted-foreground">
                        {__('Bloques')}
                    </p>
                    {PORTAL_BLOCK_TYPES.map((bt) => (
                        <button
                            key={bt.value}
                            type="button"
                            onClick={() => addBlock(bt.value)}
                            className="imcrm-flex imcrm-items-center imcrm-gap-1.5 imcrm-rounded imcrm-border imcrm-border-transparent imcrm-px-2 imcrm-py-1.5 imcrm-text-left imcrm-text-xs hover:imcrm-border-border hover:imcrm-bg-card"
                        >
                            <Plus className="imcrm-h-3 imcrm-w-3 imcrm-text-muted-foreground" />
                            <span className="imcrm-truncate">{bt.label}</span>
                        </button>
                    ))}
                </aside>

                {/* Grid (columna central) ─────────────────────────── */}
                <div
                    className={cn(
                        'imcrm-relative imcrm-rounded-lg imcrm-border imcrm-border-dashed imcrm-border-border imcrm-bg-muted/10 imcrm-p-3',
                        isEmpty && 'imcrm-flex imcrm-min-h-[420px] imcrm-items-center imcrm-justify-center',
                    )}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setSelectedId(null);
                    }}
                >
                    {isEmpty ? (
                        <p className="imcrm-text-sm imcrm-text-muted-foreground imcrm-text-center">
                            {__('Agregá bloques desde la palette de la izquierda para diseñar el portal.')}
                        </p>
                    ) : (
                        <SizedGrid
                            key={resolved.map((b) => b.id).join(',')}
                            className="imcrm-portal-editor-grid"
                            cols={12}
                            rowHeight={40}
                            margin={[12, 12]}
                            containerPadding={[0, 0]}
                            layout={layout}
                            isDraggable
                            isResizable
                            compactType="vertical"
                            draggableCancel=".imcrm-no-drag"
                            onDragStop={handleLayoutStop}
                            onResizeStop={handleLayoutStop}
                        >
                            {resolved.map((b) => {
                                const isSelected = b.id === selectedId;
                                return (
                                    <div
                                        key={b.id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedId(b.id);
                                        }}
                                        className={cn(
                                            'imcrm-relative imcrm-cursor-pointer imcrm-rounded-md imcrm-ring-2 imcrm-transition-shadow',
                                            isSelected
                                                ? 'imcrm-ring-primary'
                                                : 'imcrm-ring-border hover:imcrm-ring-primary/40',
                                        )}
                                    >
                                        <div className="imcrm-pointer-events-none imcrm-h-full">
                                            <PortalBlockPreview block={b} />
                                        </div>
                                        {isSelected && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeBlock(b.id);
                                                }}
                                                title={__('Eliminar bloque')}
                                                className="imcrm-no-drag imcrm-absolute imcrm-right-1 imcrm-top-1 imcrm-rounded imcrm-bg-destructive/10 imcrm-p-1 imcrm-text-destructive hover:imcrm-bg-destructive hover:imcrm-text-destructive-foreground"
                                            >
                                                <Trash2 className="imcrm-h-3 imcrm-w-3" />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </SizedGrid>
                    )}
                </div>

                {/* Inspector (columna derecha) ─────────────────────── */}
                <aside className="imcrm-flex imcrm-flex-col imcrm-gap-2 imcrm-rounded-lg imcrm-border imcrm-border-border imcrm-bg-card imcrm-p-3">
                    {selected ? (
                        <>
                            <div className="imcrm-flex imcrm-items-start imcrm-justify-between imcrm-gap-2 imcrm-border-b imcrm-border-border imcrm-pb-2">
                                <div>
                                    <p className="imcrm-text-[10px] imcrm-font-medium imcrm-uppercase imcrm-tracking-wider imcrm-text-muted-foreground">
                                        {__('Bloque')}
                                    </p>
                                    <h3 className="imcrm-text-sm imcrm-font-semibold">
                                        {labelFor(selected.type)}
                                    </h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedId(null)}
                                    className="imcrm-rounded imcrm-p-0.5 imcrm-text-muted-foreground hover:imcrm-bg-muted"
                                    title={__('Cerrar')}
                                >
                                    <X className="imcrm-h-3.5 imcrm-w-3.5" />
                                </button>
                            </div>
                            <div className="imcrm-flex-1 imcrm-overflow-y-auto">
                                <PortalBlockForm
                                    block={selected}
                                    fields={fields.data ?? []}
                                    onConfigChange={(c) => updateBlockConfig(selected.id, c)}
                                />
                            </div>
                        </>
                    ) : (
                        <p className="imcrm-text-xs imcrm-text-muted-foreground imcrm-text-center imcrm-py-8">
                            {__('Click en un bloque del grid para configurarlo.')}
                        </p>
                    )}
                </aside>
            </div>
        </div>
    );
}

function labelFor(type: PortalBlockType): string {
    const entry = PORTAL_BLOCK_TYPES.find((bt) => bt.value === type);
    return entry?.label ?? type;
}
