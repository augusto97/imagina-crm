import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowLeft,
    Eye,
    Loader2,
    Maximize2,
    Minimize2,
    Pencil,
    Redo2,
    Save,
    Undo2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { useRecords } from '@/hooks/useRecords';
import { __ } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { FieldEntity } from '@/types/field';
import type { RecordEntity } from '@/types/record';

import { RecordSelector } from '@/admin/lists/template-editor/RecordSelector';

import { BulkActionsPanel } from './BulkActionsPanel';
import {
    CollapsedPanelHandle,
    CollapsePanelButton,
    useCollapsablePanel,
} from './CollapsablePanels';
import { GridCanvas } from './GridCanvas';
import { InspectorPanel } from './InspectorPanel';
import { PalettePanel } from './PalettePanel';
import { useTemplateHistory } from './hooks/useTemplateHistory';
import { type PalettePayload } from './dragPayload';
import type { BaseTemplateBlock, BlockRegistry } from './types';

export interface TemplateEditorShellProps<TBlock extends BaseTemplateBlock> {
    /** Lista en la que se está editando — usada para record selector + preview. */
    listId: number;
    listName: string;
    listSlug: string;
    fields: FieldEntity[];
    /** Block registry específico del consumidor (CRM o portal). */
    registry: BlockRegistry<TBlock>;
    /** Estado inicial de bloques (cargado desde settings). */
    initialBlocks: TBlock[];
    /** Callback cuando el usuario clickea Guardar. */
    onSave: (blocks: TBlock[]) => Promise<void> | void;
    /** Si está pendiente la mutation de guardado. */
    saving?: boolean;

    /** Header copy customizable. */
    headerIcon: LucideIcon;
    headerTitle: string;
    /** A dónde lleva el botón "Volver" del header. */
    backTo: string;
    /** Panel a renderear cuando no hay selección (settings, presets, etc.). Opcional. */
    emptySelectionPanel?: JSX.Element;
    /** Si el record selector / preview deben usar mocks (cuando el preview no soporta records reales). */
    disableRecordSelector?: boolean;
    /** Texto del botón de guardado. Default: "Guardar plantilla". */
    saveLabel?: string;
}

/**
 * Shell genérico del editor de plantillas. Reutilizable entre CRM
 * y portal (y futuros editores de bloques en grid 12-col).
 *
 * Maneja:
 *  - Toolbar (undo/redo + RecordSelector + Editor/Preview + fullscreen + save)
 *  - Layout 3 columnas (paleta / canvas / inspector)
 *  - Selección single + multi (shift-click)
 *  - Drag-from-palette al canvas (drop libre o sobre bloque)
 *  - Bulk actions cuando hay 2+ seleccionados
 *  - Hotkeys (Cmd+S, Cmd+Z, Cmd+Y, Cmd+J, Cmd+P, Esc, ⌫, Cmd+D)
 *
 * Los bloques mismos (tipos, forms, previews) los inyecta el
 * `registry` que pasa el consumidor.
 */
export function TemplateEditorShell<TBlock extends BaseTemplateBlock>({
    listId,
    listName,
    listSlug,
    fields,
    registry,
    initialBlocks,
    onSave,
    saving = false,
    headerIcon: HeaderIcon,
    headerTitle,
    backTo,
    emptySelectionPanel,
    disableRecordSelector = false,
    saveLabel,
}: TemplateEditorShellProps<TBlock>): JSX.Element {
    const toast = useToast();
    const confirm = useConfirm();

    const {
        config: blocks,
        setConfig: setBlocks,
        undo,
        redo,
        canUndo,
        canRedo,
    } = useTemplateHistory<TBlock[]>(initialBlocks);

    const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);

    // Estado collapsed de los paneles laterales. Persistido en
    // localStorage para que el editor recuerde la preferencia entre
    // sesiones. Las storage keys son compartidas con el editor de
    // CRM (TemplateEditorPage) — al usuario le importa una sola
    // preferencia de layout, no una por editor.
    const [paletteCollapsed, setPaletteCollapsed] = useCollapsablePanel(
        'imcrm:editor:palette-collapsed',
    );
    const [inspectorCollapsed, setInspectorCollapsed] = useCollapsablePanel(
        'imcrm:editor:inspector-collapsed',
    );
    const [preview, setPreview] = useState(false);
    const [fullScreen, setFullScreen] = useState(false);
    const [previewRecord, setPreviewRecord] = useState<RecordEntity | null>(null);

    // Sample real para preview cuando se elige "Datos reales".
    const sample = useRecords(listId, { per_page: 1, page: 1 });
    const sampleRecord: RecordEntity | null = sample.data?.data[0] ?? null;
    const effectiveRecord = previewRecord ?? sampleRecord;

    // Body class para chrome de WP en full-screen.
    useEffect(() => {
        if (! fullScreen) return;
        document.body.classList.add('imcrm-template-editor-fullscreen');
        return () => {
            document.body.classList.remove('imcrm-template-editor-fullscreen');
        };
    }, [fullScreen]);

    // ─── Operaciones sobre bloques ───────────────────────────────────

    const handleSave = async (): Promise<void> => {
        try {
            await onSave(blocks);
            toast.success(__('Plantilla guardada'));
        } catch (err) {
            const msg = err instanceof Error ? err.message : __('Error desconocido');
            toast.error(__('No se pudo guardar'), msg);
        }
    };

    const handleAddBlock = (
        type: string,
        position?: { x: number; y: number },
        baseBlocks?: TBlock[],
    ): void => {
        const base = baseBlocks ?? blocks;
        const created = registry.createBlock(type, base, { fields }, position);
        if (! created) {
            const msg = registry.createBlockErrorMessage?.(type, { fields })
                ?? __('No se pudo crear el bloque.');
            toast.warning(msg);
            return;
        }
        setBlocks([...base, created]);
        setSelectedBlockIds([created.id]);
    };

    const handleAddField = (
        slug: string,
        position?: { x: number; y: number },
        baseBlocks?: TBlock[],
    ): void => {
        if (! registry.fieldAsBlock) return;
        const field = fields.find((f) => f.slug === slug);
        if (! field) {
            toast.error(__('Campo no encontrado.'));
            return;
        }
        const base = baseBlocks ?? blocks;
        const created = registry.fieldAsBlock.createBlock(field, base, position);
        if (! created) return;
        setBlocks([...base, created]);
        setSelectedBlockIds([created.id]);
    };

    const handleDropFromPalette = (
        payload: PalettePayload,
        position: { x: number; y: number },
        options?: { shiftRowsFrom?: number },
    ): void => {
        // Si el drop crea una fila nueva intercalada, shifteamos los
        // bloques existentes con `y >= shiftRowsFrom` hacia abajo +1.
        // El nuevo bloque se inserta en (x=position.x, y=position.y)
        // sin chocar con nadie.
        const base = options?.shiftRowsFrom !== undefined
            ? (blocks.map((b) =>
                (b.y ?? 0) >= options.shiftRowsFrom!
                    ? { ...b, y: (b.y ?? 0) + 1 }
                    : b,
            ) as TBlock[])
            : undefined;

        if (payload.kind === 'block-type') {
            handleAddBlock(payload.type, position, base);
            return;
        }
        if (payload.kind === 'field') {
            handleAddField(payload.slug, position, base);
        }
    };

    const handleDropOnBlock = (blockId: string, payload: PalettePayload): boolean => {
        if (payload.kind !== 'field') return false;
        if (! registry.fieldDrop) return false;
        const target = blocks.find((b) => b.id === blockId);
        if (! target) return false;
        const result = registry.fieldDrop.handle(target, payload.slug);
        if (! result) return false;
        if (result.alreadyPresent) {
            toast.info(__('Este campo ya está en el bloque.'));
            return true;
        }
        setBlocks(blocks.map((b) => (b.id === blockId ? result.block : b)));
        setSelectedBlockIds([blockId]);
        return true;
    };

    const handleUpdateBlock = (id: string, patch: Partial<TBlock>): void => {
        setBlocks(blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as TBlock) : b)));
    };

    const handleDeleteBlocks = (ids: string[]): void => {
        const idSet = new Set(ids);
        setBlocks(blocks.filter((b) => ! idSet.has(b.id)));
        setSelectedBlockIds((prev) => prev.filter((id) => ! idSet.has(id)));
    };

    const handleDuplicateBlocks = (ids: string[]): void => {
        const idSet = new Set(ids);
        const toDup = blocks.filter((b) => idSet.has(b.id));
        if (toDup.length === 0) return;
        const fallbackY = blocks.reduce((m, b) => Math.max(m, b.y + b.h), 0);
        let offset = 0;
        const newBlocks = toDup.map((b) => {
            const out: TBlock = {
                ...b,
                id: `${b.type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                y: fallbackY + offset,
            };
            offset += b.h;
            return out;
        });
        setBlocks([...blocks, ...newBlocks]);
        setSelectedBlockIds(newBlocks.map((b) => b.id));
    };

    const handleSelectBlock = (id: string | null, additive = false): void => {
        if (id === null) {
            setSelectedBlockIds([]);
            return;
        }
        // Auto-abrir el inspector cuando el usuario clickea un bloque.
        // Si lo había colapsado para tener más espacio, igual queremos
        // que vea las opciones del bloque que acaba de seleccionar.
        // No tocamos `paletteCollapsed` — esa preferencia se respeta
        // porque seleccionar un bloque no implica querer la paleta.
        if (inspectorCollapsed) {
            setInspectorCollapsed(false);
        }
        setSelectedBlockIds((prev) => {
            if (! additive) return [id];
            return prev.includes(id) ? prev.filter((bid) => bid !== id) : [...prev, id];
        });
    };

    // ─── Hotkeys ─────────────────────────────────────────────────────

    useEffect(() => {
        const isEditable = (target: EventTarget | null): boolean => {
            if (! (target instanceof HTMLElement)) return false;
            const tag = target.tagName;
            return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
        };

        const onKeyDown = (e: KeyboardEvent): void => {
            const mod = e.metaKey || e.ctrlKey;

            if (mod && e.key.toLowerCase() === 'j' && ! isEditable(e.target)) {
                e.preventDefault();
                setFullScreen((v) => ! v);
                return;
            }
            if (e.key === 'Escape' && fullScreen && selectedBlockIds.length === 0 && ! isEditable(e.target)) {
                e.preventDefault();
                setFullScreen(false);
                return;
            }
            if (mod && e.key.toLowerCase() === 's') {
                e.preventDefault();
                void handleSave();
                return;
            }
            if (mod && ! e.shiftKey && e.key.toLowerCase() === 'z') {
                if (! isEditable(e.target)) {
                    e.preventDefault();
                    undo();
                }
                return;
            }
            if (mod && ((e.shiftKey && e.key.toLowerCase() === 'z') || e.key.toLowerCase() === 'y')) {
                if (! isEditable(e.target)) {
                    e.preventDefault();
                    redo();
                }
                return;
            }
            if (mod && e.key.toLowerCase() === 'p' && ! isEditable(e.target)) {
                e.preventDefault();
                setPreview((v) => {
                    if (! v) setSelectedBlockIds([]);
                    return ! v;
                });
                return;
            }

            // Atajos por-bloque
            if (preview || selectedBlockIds.length === 0 || isEditable(e.target)) return;

            if (mod && e.key.toLowerCase() === 'd') {
                e.preventDefault();
                handleDuplicateBlocks(selectedBlockIds);
                return;
            }
            if (e.key === 'Backspace' || e.key === 'Delete') {
                e.preventDefault();
                if (selectedBlockIds.length > 1) {
                    void confirm({
                        title: __('Eliminar bloques'),
                        description: __('Se eliminarán %d bloques.').replace('%d', String(selectedBlockIds.length)),
                        destructive: true,
                        confirmLabel: __('Eliminar'),
                    }).then((ok) => {
                        if (ok) handleDeleteBlocks(selectedBlockIds);
                    });
                } else {
                    handleDeleteBlocks(selectedBlockIds);
                }
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setSelectedBlockIds([]);
            }
        };

        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [preview, selectedBlockIds, blocks, fullScreen]);

    // ─── Selected block resolution ────────────────────────────────────

    const selectedBlock = useMemo<TBlock | null>(
        () =>
            selectedBlockIds.length === 1
                ? blocks.find((b) => b.id === selectedBlockIds[0]) ?? null
                : null,
        [selectedBlockIds, blocks],
    );

    // ─── Render ───────────────────────────────────────────────────────

    return (
        <div className="imcrm-template-editor-root imcrm-flex imcrm-h-[calc(100vh-8rem)] imcrm-min-h-[640px] imcrm-flex-col imcrm-gap-3">
            <header className="imcrm-flex imcrm-items-center imcrm-justify-between imcrm-gap-4">
                <div className="imcrm-flex imcrm-flex-col imcrm-gap-0.5">
                    <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="imcrm-gap-2 imcrm-self-start imcrm-text-muted-foreground"
                    >
                        <Link to={backTo}>
                            <ArrowLeft className="imcrm-h-4 imcrm-w-4" />
                            {listName}
                        </Link>
                    </Button>
                    <h1 className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-text-xl imcrm-font-semibold imcrm-tracking-tight">
                        <HeaderIcon className="imcrm-h-5 imcrm-w-5 imcrm-text-primary" />
                        {headerTitle}
                    </h1>
                </div>
                <div className="imcrm-flex imcrm-items-center imcrm-gap-2">
                    <div className="imcrm-flex imcrm-gap-0.5">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={undo}
                            disabled={! canUndo || preview}
                            title={__('Deshacer (⌘Z)')}
                            aria-label={__('Deshacer')}
                            className="imcrm-h-8 imcrm-w-8 imcrm-p-0"
                        >
                            <Undo2 className="imcrm-h-3.5 imcrm-w-3.5" />
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={redo}
                            disabled={! canRedo || preview}
                            title={__('Rehacer (⌘⇧Z)')}
                            aria-label={__('Rehacer')}
                            className="imcrm-h-8 imcrm-w-8 imcrm-p-0"
                        >
                            <Redo2 className="imcrm-h-3.5 imcrm-w-3.5" />
                        </Button>
                    </div>
                    {! disableRecordSelector && (
                        <RecordSelector
                            listId={listId}
                            fields={fields}
                            value={previewRecord}
                            onChange={setPreviewRecord}
                        />
                    )}
                    <div className="imcrm-flex imcrm-rounded-md imcrm-bg-muted imcrm-p-0.5">
                        <button
                            type="button"
                            onClick={() => setPreview(false)}
                            className={cn(
                                'imcrm-flex imcrm-items-center imcrm-gap-1.5 imcrm-rounded imcrm-px-2.5 imcrm-py-1 imcrm-text-xs imcrm-font-medium imcrm-transition-colors',
                                ! preview
                                    ? 'imcrm-bg-card imcrm-text-foreground imcrm-shadow-imcrm-sm'
                                    : 'imcrm-text-muted-foreground hover:imcrm-text-foreground',
                            )}
                        >
                            <Pencil className="imcrm-h-3 imcrm-w-3" />
                            {__('Editor')}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setPreview(true);
                                setSelectedBlockIds([]);
                            }}
                            className={cn(
                                'imcrm-flex imcrm-items-center imcrm-gap-1.5 imcrm-rounded imcrm-px-2.5 imcrm-py-1 imcrm-text-xs imcrm-font-medium imcrm-transition-colors',
                                preview
                                    ? 'imcrm-bg-card imcrm-text-foreground imcrm-shadow-imcrm-sm'
                                    : 'imcrm-text-muted-foreground hover:imcrm-text-foreground',
                            )}
                        >
                            <Eye className="imcrm-h-3 imcrm-w-3" />
                            {__('Preview')}
                        </button>
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setFullScreen((v) => ! v)}
                        title={fullScreen ? __('Salir de full-screen (⌘J o Esc)') : __('Full-screen (⌘J)')}
                        aria-label={fullScreen ? __('Salir de full-screen') : __('Full-screen')}
                        className="imcrm-h-8 imcrm-w-8 imcrm-p-0"
                    >
                        {fullScreen ? (
                            <Minimize2 className="imcrm-h-3.5 imcrm-w-3.5" />
                        ) : (
                            <Maximize2 className="imcrm-h-3.5 imcrm-w-3.5" />
                        )}
                    </Button>
                    <Button
                        size="sm"
                        className="imcrm-gap-2"
                        onClick={() => void handleSave()}
                        disabled={saving}
                        title={__('Guardar (⌘S)')}
                    >
                        {saving ? (
                            <Loader2 className="imcrm-h-3.5 imcrm-w-3.5 imcrm-animate-spin" />
                        ) : (
                            <Save className="imcrm-h-3.5 imcrm-w-3.5" />
                        )}
                        {saveLabel ?? __('Guardar plantilla')}
                    </Button>
                </div>
            </header>

            <div
                className={cn(
                    'imcrm-grid imcrm-flex-1 imcrm-gap-3 imcrm-overflow-hidden',
                    // Columnas dinámicas: cuando un panel está colapsado
                    // queda un sliver de 28px (el handle de re-expansión)
                    // y el canvas crece para tomar el espacio. Cuando
                    // ambos están colapsados el canvas usa casi todo el
                    // ancho disponible.
                    preview
                        ? 'imcrm-grid-cols-1'
                        : cn(
                            'imcrm-grid-cols-[var(--imcrm-palette-w)_1fr_var(--imcrm-inspector-w)]',
                        ),
                )}
                style={
                    preview
                        ? undefined
                        : ({
                            '--imcrm-palette-w': paletteCollapsed ? '28px' : '260px',
                            '--imcrm-inspector-w': inspectorCollapsed ? '28px' : '320px',
                        } as React.CSSProperties)
                }
            >
                {! preview && (
                    paletteCollapsed ? (
                        <CollapsedPanelHandle
                            side="left"
                            label={__('Mostrar paleta')}
                            onClick={() => setPaletteCollapsed(false)}
                        />
                    ) : (
                        <aside className="imcrm-relative imcrm-overflow-hidden imcrm-rounded-lg imcrm-border imcrm-border-border imcrm-bg-card">
                            <CollapsePanelButton
                                side="left"
                                label={__('Ocultar paleta')}
                                onClick={() => setPaletteCollapsed(true)}
                            />
                            <PalettePanel
                                registry={registry}
                                existingBlocks={blocks}
                                fields={fields}
                                onAddBlock={(type) => handleAddBlock(type)}
                                onAddField={(slug) => handleAddField(slug)}
                            />
                        </aside>
                    )
                )}

                <main
                    className={cn(
                        'imcrm-overflow-y-auto imcrm-rounded-lg imcrm-border imcrm-border-border imcrm-p-3',
                        preview ? 'imcrm-bg-card' : 'imcrm-bg-background',
                    )}
                >
                    <GridCanvas
                        listId={listId}
                        fields={fields}
                        blocks={blocks}
                        record={effectiveRecord}
                        registry={registry}
                        selectedBlockIds={selectedBlockIds}
                        preview={preview}
                        onBlocksChange={setBlocks}
                        onSelectBlock={handleSelectBlock}
                        onDropFromPalette={handleDropFromPalette}
                        onDropOnBlock={handleDropOnBlock}
                    />
                </main>

                {! preview && (
                    inspectorCollapsed ? (
                        <CollapsedPanelHandle
                            side="right"
                            label={__('Mostrar opciones')}
                            onClick={() => setInspectorCollapsed(false)}
                        />
                    ) : (
                        <aside className="imcrm-relative imcrm-overflow-hidden imcrm-rounded-lg imcrm-border imcrm-border-border imcrm-bg-card">
                            <CollapsePanelButton
                                side="right"
                                label={__('Ocultar opciones')}
                                onClick={() => setInspectorCollapsed(true)}
                            />
                            {selectedBlockIds.length > 1 ? (
                                <BulkActionsPanel
                                    count={selectedBlockIds.length}
                                    onDuplicate={() => handleDuplicateBlocks(selectedBlockIds)}
                                    onDelete={() => {
                                        void confirm({
                                            title: __('Eliminar bloques'),
                                            description: __('Se eliminarán %d bloques.').replace('%d', String(selectedBlockIds.length)),
                                            destructive: true,
                                            confirmLabel: __('Eliminar'),
                                        }).then((ok) => {
                                            if (ok) handleDeleteBlocks(selectedBlockIds);
                                        });
                                    }}
                                    onDeselect={() => setSelectedBlockIds([])}
                                />
                            ) : selectedBlock ? (
                                <InspectorPanel
                                    block={selectedBlock}
                                    fields={fields}
                                    registry={registry}
                                    onUpdate={(patch) => handleUpdateBlock(selectedBlock.id, patch)}
                                    onDelete={() => handleDeleteBlocks([selectedBlock.id])}
                                    onDuplicate={() => handleDuplicateBlocks([selectedBlock.id])}
                                />
                            ) : (
                                emptySelectionPanel ?? <DefaultEmptyPanel listSlug={listSlug} />
                            )}
                        </aside>
                    )
                )}
            </div>
        </div>
    );
}

function DefaultEmptyPanel({ listSlug }: { listSlug: string }): JSX.Element {
    void listSlug;
    return (
        <div className="imcrm-flex imcrm-h-full imcrm-flex-col imcrm-items-center imcrm-justify-center imcrm-gap-2 imcrm-px-4 imcrm-py-6 imcrm-text-center">
            <p className="imcrm-text-xs imcrm-font-medium imcrm-text-foreground">
                {__('Sin selección')}
            </p>
            <p className="imcrm-text-[11px] imcrm-text-muted-foreground">
                {__('Click en un bloque del canvas para editar sus opciones, o arrastrá uno desde la paleta.')}
            </p>
        </div>
    );
}
