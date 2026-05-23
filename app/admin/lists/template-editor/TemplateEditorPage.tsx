import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Eye, Loader2, Pencil, Save, SlidersHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { useFields } from '@/hooks/useFields';
import { useList, useUpdateList } from '@/hooks/useLists';
import { useRecords } from '@/hooks/useRecords';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
    CUSTOM_TEMPLATE_ID,
    customConfigV2FromBuiltin,
    emptyCustomConfigV2,
    ensureV2,
    type CustomTemplateConfigV2,
    type V2BlockType,
    type V2Block,
} from '@/lib/crmTemplates';
import { __ } from '@/lib/i18n';
import type { FieldEntity } from '@/types/field';
import type { RecordEntity } from '@/types/record';

import { EditorCommandPalette } from './EditorCommandPalette';
import { GridEditor } from './GridEditor';
import { RecordSelector } from './RecordSelector';
import { BlockInspectorPanel } from './panels/BlockInspectorPanel';
import { BlockPalettePanel } from './panels/BlockPalettePanel';
import { BulkActionsPanel } from './panels/BulkActionsPanel';
import { TemplateSettingsPanel } from './panels/TemplateSettingsPanel';
import { appendBlock, appendFieldAsGroup } from './utils/createBlock';
import type { PalettePayload } from './utils/dragPayload';

/**
 * Editor visual de la plantilla CRM custom de una lista
 * (Fase 11.A — layout 3 columnas).
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ Topbar: breadcrumb + Guardar                              │
 *   ├──────────┬─────────────────────────────────┬─────────────┤
 *   │ Paleta   │            Canvas                │  Inspector  │
 *   │ (left)   │   (drag-resize del grid)        │   (right)   │
 *   │          │                                  │             │
 *   │ Bloques  │                                  │ Bloque/     │
 *   │ por      │                                  │ Settings    │
 *   │ categoría│                                  │             │
 *   └──────────┴─────────────────────────────────┴─────────────┘
 *
 * El config persiste en `list.settings.crm_template_custom` como
 * `CustomTemplateConfigV2`. Auto-migra V1 → V2 al cargar.
 */
export function TemplateEditorPage(): JSX.Element {
    const { listSlug } = useParams<{ listSlug: string }>();
    const list = useList(listSlug);
    const fields = useFields(list.data?.id);
    const update = useUpdateList(list.data?.id ?? listSlug ?? '');
    const toast = useToast();
    const confirm = useConfirm();

    const [config, setConfig] = useState<CustomTemplateConfigV2>(emptyCustomConfigV2());
    const [initialized, setInitialized] = useState(false);
    const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
    const [preview, setPreview] = useState(false);
    const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
    // Record real elegido como dato de preview. Si null, usa el mock
    // generado desde el schema (mockSample, ver abajo).
    const [previewRecord, setPreviewRecord] = useState<RecordEntity | null>(null);

    const sample = useRecords(list.data?.id, { per_page: 1, page: 1 });
    const sampleRecord: RecordEntity | null = sample.data?.data[0] ?? null;

    // Atajos de teclado globales del editor. Cmd+S / Cmd+P están
    // activos siempre (incluso desde inputs) porque overridean
    // shortcuts del browser. Los atajos por-bloque (D, Backspace,
    // Esc) solo si el foco NO está en un input editable y hay
    // selección.
    useEffect(() => {
        const isEditableTarget = (target: EventTarget | null): boolean => {
            if (! (target instanceof HTMLElement)) return false;
            const tag = target.tagName;
            return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
        };

        const onKeyDown = (e: KeyboardEvent): void => {
            const mod = e.metaKey || e.ctrlKey;

            // Command palette: Cmd/Ctrl + K (siempre activo).
            if (mod && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setCommandPaletteOpen((v) => ! v);
                return;
            }

            // Guardar: Cmd/Ctrl + S (siempre activo).
            if (mod && e.key.toLowerCase() === 's') {
                e.preventDefault();
                void handleSave();
                return;
            }
            // Toggle Preview: Cmd/Ctrl + P (no en inputs porque
            // sino el user no puede tipear "p" en el inspector).
            if (mod && e.key.toLowerCase() === 'p' && ! isEditableTarget(e.target)) {
                e.preventDefault();
                setPreview((v) => {
                    if (! v) setSelectedBlockIds([]);
                    return ! v;
                });
                return;
            }

            // Atajos por-bloque (requieren selección + no en input).
            if (preview || selectedBlockIds.length === 0 || isEditableTarget(e.target)) {
                return;
            }

            // Duplicar: Cmd/Ctrl + D
            if (mod && e.key.toLowerCase() === 'd') {
                e.preventDefault();
                handleDuplicateBlocks(selectedBlockIds);
                return;
            }
            // Eliminar: Backspace o Delete
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
            // Deseleccionar: Escape
            if (e.key === 'Escape') {
                e.preventDefault();
                setSelectedBlockIds([]);
            }
        };

        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [preview, selectedBlockIds, config.blocks]);

    useEffect(() => {
        if (! list.data || ! fields.data || initialized) return;
        const settings = list.data.settings as {
            crm_template_id?: string;
            crm_template_custom?: unknown;
        };
        if (settings.crm_template_custom) {
            setConfig(ensureV2(settings.crm_template_custom));
        } else {
            setConfig(customConfigV2FromBuiltin(settings.crm_template_id ?? 'auto', fields.data));
        }
        setInitialized(true);
    }, [list.data, fields.data, initialized]);

    const mockSample = useMemo<RecordEntity>(
        () => sampleRecord ?? buildMockRecord(fields.data ?? []),
        [sampleRecord, fields.data],
    );

    // Record que recibe el BlockRenderer: el explícitamente
    // seleccionado en el RecordSelector, o el mock por default.
    const effectiveRecord: RecordEntity = previewRecord ?? mockSample;

    /**
     * Cuando hay exactamente 1 bloque seleccionado, el inspector
     * muestra su form normal. Cuando hay 0, muestra Template
     * Settings. Cuando hay 2+, muestra bulk actions panel.
     */
    const selectedBlock = useMemo<V2Block | null>(
        () =>
            selectedBlockIds.length === 1
                ? config.blocks.find((b) => b.id === selectedBlockIds[0]) ?? null
                : null,
        [selectedBlockIds, config.blocks],
    );

    const handleSelectBlock = (id: string | null, additive = false): void => {
        if (id === null) {
            setSelectedBlockIds([]);
            return;
        }
        setSelectedBlockIds((prev) => {
            if (! additive) return [id];
            return prev.includes(id) ? prev.filter((bid) => bid !== id) : [...prev, id];
        });
    };

    const handleSave = async (): Promise<void> => {
        if (! list.data) return;
        try {
            await update.mutateAsync({
                settings: {
                    ...list.data.settings,
                    record_layout: 'crm',
                    crm_template_id: CUSTOM_TEMPLATE_ID,
                    crm_template_custom: config,
                },
            });
            toast.success(__('Plantilla guardada'));
        } catch (err) {
            const msg = err instanceof ApiError || err instanceof Error ? err.message : 'Error';
            toast.error(__('No se pudo guardar'), msg);
        }
    };

    const handleResetFromBuiltin = async (builtinId: string): Promise<void> => {
        if (! fields.data) return;
        const ok = await confirm({
            title: __('Restaurar desde plantilla'),
            description: __('Reemplazará todos los cambios actuales con la plantilla seleccionada.'),
            destructive: true,
            confirmLabel: __('Restaurar'),
        });
        if (! ok) return;
        setConfig(customConfigV2FromBuiltin(builtinId, fields.data));
        setSelectedBlockIds([]);
        toast.info(__('Restaurada — recordá guardar para aplicar.'));
    };

    const handleAddBlock = (type: V2BlockType, position?: { x: number; y: number }): void => {
        if (! fields.data) return;
        const result = appendBlock(config, type, fields.data, position);
        if (! result) {
            toast.warning(__('Este bloque necesita un relation field en la lista.'));
            return;
        }
        setConfig(result.config);
        setSelectedBlockIds([result.addedId]);
    };

    const handleAddFieldAsGroup = (slug: string, position?: { x: number; y: number }): void => {
        if (! fields.data) return;
        const field = fields.data.find((f) => f.slug === slug);
        if (! field) {
            toast.error(__('Campo no encontrado.'));
            return;
        }
        const result = appendFieldAsGroup(config, field, position);
        setConfig(result.config);
        setSelectedBlockIds([result.addedId]);
    };

    const handleDropFromPalette = (
        payload: PalettePayload,
        position: { x: number; y: number },
    ): void => {
        if (payload.kind === 'block-type') {
            handleAddBlock(payload.type, position);
            return;
        }
        if (payload.kind === 'field') {
            handleAddFieldAsGroup(payload.slug, position);
        }
    };

    /**
     * Drop sobre un bloque existente del canvas. Solo respondemos
     * al caso "field sobre properties_group" — el field se agrega
     * al `field_slugs` del grupo si no estaba ya. Retornamos true
     * cuando el drop fue manejado (el GridEditor lo usa para
     * prevenir que se propague al drop handler del grid).
     */
    const handleDropOnBlock = (blockId: string, payload: PalettePayload): boolean => {
        if (payload.kind !== 'field') return false;
        const target = config.blocks.find((b) => b.id === blockId);
        if (! target || target.type !== 'properties_group') return false;
        if (target.config.field_slugs.includes(payload.slug)) {
            toast.info(__('Este campo ya está en el grupo.'));
            return true;
        }
        const nextBlocks = config.blocks.map((b) =>
            b.id === blockId && b.type === 'properties_group'
                ? {
                    ...b,
                    config: {
                        ...b.config,
                        field_slugs: [...b.config.field_slugs, payload.slug],
                    },
                }
                : b,
        );
        setConfig({ ...config, blocks: nextBlocks });
        setSelectedBlockIds([blockId]);
        return true;
    };

    const handleUpdateBlock = (id: string, patch: Partial<V2Block>): void => {
        setConfig({
            ...config,
            blocks: config.blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as V2Block) : b)),
        });
    };

    const handleDeleteBlocks = (ids: string[]): void => {
        const idSet = new Set(ids);
        setConfig({ ...config, blocks: config.blocks.filter((b) => ! idSet.has(b.id)) });
        setSelectedBlockIds((prev) => prev.filter((id) => ! idSet.has(id)));
    };

    const handleDuplicateBlocks = (ids: string[]): void => {
        const idSet = new Set(ids);
        const toDup = config.blocks.filter((b) => idSet.has(b.id));
        if (toDup.length === 0) return;
        const fallbackY = config.blocks.reduce((m, b) => Math.max(m, b.y + b.h), 0);
        const newBlocks: V2Block[] = toDup.map((b) => ({
            ...b,
            id: `${b.type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            // Offset visual: dup va abajo del último bloque. Si son
            // múltiples se distribuyen vertical para que sean visibles.
            y: fallbackY,
        }));
        // Distribuimos verticalmente con offset acumulado.
        let offset = 0;
        const offseted = newBlocks.map((b) => {
            const out = { ...b, y: fallbackY + offset };
            offset += b.h;
            return out;
        });
        setConfig({ ...config, blocks: [...config.blocks, ...offseted] });
        setSelectedBlockIds(offseted.map((b) => b.id));
    };

    if (list.isLoading || fields.isLoading || ! initialized) {
        return (
            <div className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-py-12 imcrm-text-sm imcrm-text-muted-foreground">
                <Loader2 className="imcrm-h-4 imcrm-w-4 imcrm-animate-spin" />
                {__('Cargando editor…')}
            </div>
        );
    }

    if (! list.data || ! fields.data) {
        return (
            <div className="imcrm-flex imcrm-flex-col imcrm-items-start imcrm-gap-3">
                <Button asChild variant="ghost" size="sm" className="imcrm-gap-2">
                    <Link to="/lists">
                        <ArrowLeft className="imcrm-h-4 imcrm-w-4" />
                        {__('Listas')}
                    </Link>
                </Button>
                <p className="imcrm-text-sm imcrm-text-destructive">{__('Lista no encontrada.')}</p>
            </div>
        );
    }

    return (
        <div className="imcrm-flex imcrm-h-[calc(100vh-8rem)] imcrm-min-h-[640px] imcrm-flex-col imcrm-gap-3">
            <header className="imcrm-flex imcrm-items-center imcrm-justify-between imcrm-gap-4">
                <div className="imcrm-flex imcrm-flex-col imcrm-gap-0.5">
                    <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="imcrm-gap-2 imcrm-self-start imcrm-text-muted-foreground"
                    >
                        <Link to={`/lists/${list.data.slug}/edit`}>
                            <ArrowLeft className="imcrm-h-4 imcrm-w-4" />
                            {list.data.name}
                        </Link>
                    </Button>
                    <h1 className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-text-xl imcrm-font-semibold imcrm-tracking-tight">
                        <SlidersHorizontal className="imcrm-h-5 imcrm-w-5 imcrm-text-primary" />
                        {__('Editor de plantilla CRM')}
                    </h1>
                </div>
                <div className="imcrm-flex imcrm-items-center imcrm-gap-2">
                    <RecordSelector
                        listId={list.data.id}
                        fields={fields.data}
                        value={previewRecord}
                        onChange={setPreviewRecord}
                    />
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
                        size="sm"
                        className="imcrm-gap-2"
                        onClick={() => void handleSave()}
                        disabled={update.isPending}
                        title={__('Guardar (⌘S)')}
                    >
                        {update.isPending ? (
                            <Loader2 className="imcrm-h-3.5 imcrm-w-3.5 imcrm-animate-spin" />
                        ) : (
                            <Save className="imcrm-h-3.5 imcrm-w-3.5" />
                        )}
                        {__('Guardar plantilla')}
                    </Button>
                </div>
            </header>

            <div
                className={cn(
                    'imcrm-grid imcrm-flex-1 imcrm-gap-3 imcrm-overflow-hidden',
                    preview
                        ? 'imcrm-grid-cols-1'
                        : 'imcrm-grid-cols-[260px_1fr_320px]',
                )}
            >
                {! preview && (
                    <aside className="imcrm-overflow-hidden imcrm-rounded-lg imcrm-border imcrm-border-border imcrm-bg-card">
                        <BlockPalettePanel
                            config={config}
                            fields={fields.data}
                            onAddBlock={(type) => handleAddBlock(type)}
                            onAddFieldAsGroup={(slug) => handleAddFieldAsGroup(slug)}
                        />
                    </aside>
                )}

                <main
                    className={cn(
                        'imcrm-overflow-y-auto imcrm-rounded-lg imcrm-border imcrm-border-border imcrm-p-3',
                        preview ? 'imcrm-bg-card' : 'imcrm-bg-background',
                    )}
                >
                    <GridEditor
                        listId={list.data.id}
                        fields={fields.data}
                        config={config}
                        onChange={setConfig}
                        sampleRecord={effectiveRecord}
                        selectedBlockIds={selectedBlockIds}
                        onSelectBlock={handleSelectBlock}
                        onDropFromPalette={handleDropFromPalette}
                        onDropOnBlock={handleDropOnBlock}
                        preview={preview}
                    />
                </main>

                {! preview && (
                    <aside className="imcrm-overflow-hidden imcrm-rounded-lg imcrm-border imcrm-border-border imcrm-bg-card">
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
                            <BlockInspectorPanel
                                block={selectedBlock}
                                fields={fields.data}
                                onUpdate={(patch) => handleUpdateBlock(selectedBlock.id, patch)}
                                onDelete={() => handleDeleteBlocks([selectedBlock.id])}
                                onDuplicate={() => handleDuplicateBlocks([selectedBlock.id])}
                            />
                        ) : (
                            <TemplateSettingsPanel
                                fields={fields.data}
                                config={config}
                                onChange={setConfig}
                                onResetFromBuiltin={(id) => void handleResetFromBuiltin(id)}
                            />
                        )}
                    </aside>
                )}
            </div>

            <EditorCommandPalette
                open={commandPaletteOpen}
                onOpenChange={setCommandPaletteOpen}
                config={config}
                selectedBlockIds={selectedBlockIds}
                preview={preview}
                onAddBlock={(type) => handleAddBlock(type)}
                onSelectBlock={(id) => handleSelectBlock(id)}
                onDeleteSelected={() => {
                    if (selectedBlockIds.length === 0) return;
                    handleDeleteBlocks(selectedBlockIds);
                }}
                onDuplicateSelected={() => {
                    if (selectedBlockIds.length === 0) return;
                    handleDuplicateBlocks(selectedBlockIds);
                }}
                onTogglePreview={() => {
                    setPreview((v) => {
                        if (! v) setSelectedBlockIds([]);
                        return ! v;
                    });
                }}
                onSave={() => void handleSave()}
                onResetFromBuiltin={(id) => void handleResetFromBuiltin(id)}
            />
        </div>
    );
}

function buildMockRecord(fields: FieldEntity[]): RecordEntity {
    const sampleByType: Record<string, unknown> = {
        text: 'Ejemplo',
        long_text: 'Texto largo de muestra para previsualizar el campo.',
        email: 'cliente@ejemplo.com',
        url: 'https://ejemplo.com',
        number: 42,
        currency: 1500,
        date: new Date().toISOString().slice(0, 10),
        datetime: new Date().toISOString().slice(0, 19),
        checkbox: true,
        select: '',
        multi_select: [],
        user: 0,
        file: 0,
    };

    const fieldsBlob: Record<string, unknown> = {};
    for (const f of fields) {
        if (f.type === 'relation') continue;
        if (f.type === 'select') {
            const opts = (f.config as { options?: Array<{ value: string }> }).options;
            fieldsBlob[f.slug] = Array.isArray(opts) && opts[0] ? opts[0].value : '';
        } else if (f.type === 'multi_select') {
            const opts = (f.config as { options?: Array<{ value: string }> }).options;
            fieldsBlob[f.slug] = Array.isArray(opts) && opts[0] ? [opts[0].value] : [];
        } else {
            fieldsBlob[f.slug] = sampleByType[f.type] ?? '';
        }
    }

    return {
        id: 0,
        fields: fieldsBlob,
        relations: {},
        created_by: 0,
        created_at: new Date().toISOString().replace('Z', '').replace('T', ' '),
        updated_at: new Date().toISOString().replace('Z', '').replace('T', ' '),
    };
}
