import { useEffect, useMemo, useRef, useState } from 'react';
import GridLayout, { WidthProvider } from 'react-grid-layout/legacy';
import type { Layout, LayoutItem } from 'react-grid-layout';
import {
    Activity,
    Code,
    Copy,
    Download,
    ExternalLink as ExternalLinkIcon,
    FileText,
    LayoutList,
    MessageSquare,
    PenLine,
    Redo2,
    Table,
    Trash2,
    TrendingUp,
    Undo2,
    User as UserIcon,
    X,
} from 'lucide-react';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useFields } from '@/hooks/useFields';
import { __ } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { PortalBlockType, PortalTemplate } from '@/types/portal';

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
 * Editor visual del portal del cliente, paridad con el editor de
 * "Apariencia del registro" (TemplateEditorPage del CRM):
 *
 *  - Top toolbar: undo/redo + modo avanzado JSON.
 *  - Palette izquierda categorizada: cada bloque con icono, nombre y
 *    descripción (no items pelados con "+").
 *  - Grid central 12-col con drag-and-drop + resize. Cada celda
 *    muestra un preview visual estilizado del bloque (mockup real,
 *    no wireframe placeholder).
 *  - Inspector derecho con secciones: descripción del bloque,
 *    variante visual (selector), elementos visibles, color de acento
 *    cuando aplica. Footer con Duplicar + Eliminar.
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

    // Historial undo/redo (stack en memoria de la sesión). Reset al
    // unmount del editor — no se persiste.
    const historyRef = useRef<PortalTemplate[]>([template]);
    const cursorRef = useRef<number>(0);
    const [, forceTick] = useState(0);

    const pushHistory = (t: PortalTemplate): void => {
        const next = historyRef.current.slice(0, cursorRef.current + 1);
        next.push(t);
        // Limitamos a 30 entries para no crecer indefinido.
        if (next.length > 30) next.shift();
        historyRef.current = next;
        cursorRef.current = next.length - 1;
        forceTick((x) => x + 1);
    };

    const canUndo = cursorRef.current > 0;
    const canRedo = cursorRef.current < historyRef.current.length - 1;

    const undo = (): void => {
        if (! canUndo) return;
        cursorRef.current -= 1;
        const t = historyRef.current[cursorRef.current]!;
        onChange(t);
        forceTick((x) => x + 1);
    };
    const redo = (): void => {
        if (! canRedo) return;
        cursorRef.current += 1;
        const t = historyRef.current[cursorRef.current]!;
        onChange(t);
        forceTick((x) => x + 1);
    };

    const commit = (next: ResolvedPortalBlock[]): void => {
        const t = toPortalTemplate(next);
        onChange(t);
        pushHistory(t);
    };

    // ─── Advanced (JSON) mode ────────────────────────────────────────

    const [jsonDraft, setJsonDraft] = useState<string>(() => JSON.stringify(template, null, 2));
    const [jsonError, setJsonError] = useState<string | null>(null);

    useEffect(() => {
        // Mantiene el draft JSON sincronizado cuando la prop template cambia
        // desde fuera (ej. tras un commit del editor visual).
        setJsonDraft(JSON.stringify(template, null, 2));
    }, [template]);

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
                                pushHistory(parsed);
                                setJsonError(null);
                                onAdvancedToggle(false);
                            } catch (err) {
                                setJsonError(
                                    err instanceof Error ? err.message : __('JSON inválido.'),
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

    // ─── Visual mode ─────────────────────────────────────────────────

    const layout: LayoutItem[] = resolved.map((b) => ({
        i: b.id,
        x: b.x,
        y: b.y,
        w: b.w,
        h: b.h,
        minW: 2,
        minH: 2,
    }));

    const handleLayoutStop = (next: Layout): void => {
        const byId = new Map(next.map((l) => [l.i, l]));
        const updated = resolved
            .map((b) => {
                const l = byId.get(b.id);
                if (!l) return null;
                if (l.x === b.x && l.y === b.y && l.w === b.w && l.h === b.h) return b;
                return { ...b, x: l.x, y: l.y, w: l.w, h: l.h };
            })
            .filter((b): b is ResolvedPortalBlock => b !== null);
        // Solo commit si algo cambió.
        const changed = updated.some((b, i) => b !== resolved[i]);
        if (changed) commit(updated);
    };

    const addBlock = (type: PortalBlockType): void => {
        const block = createPortalBlock(type, resolved);
        commit([...resolved, block]);
        setSelectedId(block.id);
    };

    const duplicateBlock = (id: string): void => {
        const orig = resolved.find((b) => b.id === id);
        if (! orig) return;
        const dup: ResolvedPortalBlock = {
            ...orig,
            id: `${orig.type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            y: orig.y + orig.h,
        };
        commit([...resolved, dup]);
        setSelectedId(dup.id);
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
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-2">
            {/* Top toolbar ───────────────────────────────────────── */}
            <div className="imcrm-flex imcrm-items-center imcrm-justify-between imcrm-gap-2 imcrm-rounded-md imcrm-border imcrm-border-border imcrm-bg-card imcrm-px-2 imcrm-py-1.5">
                <div className="imcrm-flex imcrm-items-center imcrm-gap-1">
                    <button
                        type="button"
                        onClick={undo}
                        disabled={! canUndo}
                        title={__('Deshacer')}
                        className="imcrm-rounded imcrm-p-1.5 imcrm-text-muted-foreground hover:imcrm-bg-muted disabled:imcrm-opacity-30"
                    >
                        <Undo2 className="imcrm-h-3.5 imcrm-w-3.5" />
                    </button>
                    <button
                        type="button"
                        onClick={redo}
                        disabled={! canRedo}
                        title={__('Rehacer')}
                        className="imcrm-rounded imcrm-p-1.5 imcrm-text-muted-foreground hover:imcrm-bg-muted disabled:imcrm-opacity-30"
                    >
                        <Redo2 className="imcrm-h-3.5 imcrm-w-3.5" />
                    </button>
                    <span className="imcrm-mx-2 imcrm-h-4 imcrm-w-px imcrm-bg-border" />
                    <span className="imcrm-text-xs imcrm-text-muted-foreground">
                        {resolved.length === 0
                            ? __('Sin bloques')
                            : `${resolved.length} ${resolved.length === 1 ? __('bloque') : __('bloques')}`}
                    </span>
                </div>
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

            {/* 3 columnas: palette | canvas | inspector ──────────── */}
            <div className="imcrm-grid imcrm-grid-cols-[220px_1fr_300px] imcrm-gap-2 imcrm-min-h-[520px]">
                <PalettePanel onAdd={addBlock} />
                <CanvasPanel
                    isEmpty={isEmpty}
                    resolved={resolved}
                    layout={layout}
                    fields={fields.data ?? []}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    onLayoutStop={handleLayoutStop}
                />
                <InspectorPanel
                    block={selected ?? null}
                    fields={fields.data ?? []}
                    onConfigChange={(c) => selected && updateBlockConfig(selected.id, c)}
                    onDuplicate={() => selected && duplicateBlock(selected.id)}
                    onDelete={() => selected && removeBlock(selected.id)}
                    onClose={() => setSelectedId(null)}
                />
            </div>
        </div>
    );
}

// ─── Palette ──────────────────────────────────────────────────────────

interface PaletteItem {
    type: PortalBlockType;
    label: string;
    description: string;
    icon: typeof UserIcon;
}

const PALETTE_CATEGORIES: Array<{ id: string; label: string; items: PaletteItem[] }> = [
    {
        id: 'data',
        label: __('Datos'),
        items: [
            { type: 'client_data', label: __('Datos del cliente'), description: __('Campos del record actual.'), icon: UserIcon },
            { type: 'related_records_table', label: __('Tabla relacionada'), description: __('Records conectados vía relation field.'), icon: Table },
            { type: 'kpi_widget', label: __('KPI / métrica'), description: __('Número grande con label.'), icon: TrendingUp },
        ],
    },
    {
        id: 'input',
        label: __('Entrada'),
        items: [
            { type: 'editable_form', label: __('Formulario editable'), description: __('Cliente actualiza sus propios datos.'), icon: PenLine },
            { type: 'comments_thread', label: __('Hilo de comentarios'), description: __('Conversación cliente ↔ operador.'), icon: MessageSquare },
        ],
    },
    {
        id: 'display',
        label: __('Visualización'),
        items: [
            { type: 'activity_timeline', label: __('Timeline de actividad'), description: __('Cambios recientes del record.'), icon: Activity },
            { type: 'download_files', label: __('Archivos descargables'), description: __('Adjuntos del record para descargar.'), icon: Download },
        ],
    },
    {
        id: 'content',
        label: __('Contenido'),
        items: [
            { type: 'static_text', label: __('Texto / HTML'), description: __('Bienvenida, instrucciones, anuncios.'), icon: FileText },
            { type: 'external_link', label: __('Enlace externo'), description: __('CTA a URL externa.'), icon: ExternalLinkIcon },
        ],
    },
];

function PalettePanel({ onAdd }: { onAdd: (type: PortalBlockType) => void }): JSX.Element {
    return (
        <aside className="imcrm-flex imcrm-flex-col imcrm-gap-3 imcrm-overflow-y-auto imcrm-rounded-md imcrm-border imcrm-border-border imcrm-bg-card imcrm-p-3">
            <div className="imcrm-flex imcrm-flex-col imcrm-gap-0.5 imcrm-border-b imcrm-border-border imcrm-pb-2">
                <p className="imcrm-text-[10px] imcrm-font-medium imcrm-uppercase imcrm-tracking-wider imcrm-text-muted-foreground">
                    {__('Paleta')}
                </p>
                <h3 className="imcrm-text-sm imcrm-font-semibold imcrm-tracking-tight">
                    {__('Bloques')}
                </h3>
                <p className="imcrm-text-[11px] imcrm-text-muted-foreground">
                    {__('Click para agregar al canvas.')}
                </p>
            </div>
            {PALETTE_CATEGORIES.map((cat) => (
                <div key={cat.id} className="imcrm-flex imcrm-flex-col imcrm-gap-1">
                    <p className="imcrm-px-1 imcrm-text-[10px] imcrm-font-semibold imcrm-uppercase imcrm-tracking-wider imcrm-text-muted-foreground">
                        {cat.label}
                    </p>
                    {cat.items.map((item) => (
                        <button
                            key={item.type}
                            type="button"
                            onClick={() => onAdd(item.type)}
                            className="imcrm-flex imcrm-items-start imcrm-gap-2 imcrm-rounded imcrm-border imcrm-border-border imcrm-bg-background imcrm-px-2 imcrm-py-1.5 imcrm-text-left imcrm-transition-colors hover:imcrm-border-primary/40 hover:imcrm-bg-accent/30"
                        >
                            <div className="imcrm-mt-0.5 imcrm-flex imcrm-h-6 imcrm-w-6 imcrm-shrink-0 imcrm-items-center imcrm-justify-center imcrm-rounded imcrm-bg-primary/10 imcrm-text-primary">
                                <item.icon className="imcrm-h-3.5 imcrm-w-3.5" aria-hidden />
                            </div>
                            <div className="imcrm-min-w-0 imcrm-flex-1">
                                <p className="imcrm-text-xs imcrm-font-medium imcrm-text-foreground">
                                    {item.label}
                                </p>
                                <p className="imcrm-text-[10px] imcrm-text-muted-foreground imcrm-leading-tight">
                                    {item.description}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>
            ))}
        </aside>
    );
}

// ─── Canvas ───────────────────────────────────────────────────────────

function CanvasPanel({
    isEmpty,
    resolved,
    layout,
    fields,
    selectedId,
    onSelect,
    onLayoutStop,
}: {
    isEmpty: boolean;
    resolved: ResolvedPortalBlock[];
    layout: LayoutItem[];
    fields: ResolvedPortalBlock extends never ? never : Parameters<typeof PortalBlockPreview>[0]['fields'];
    selectedId: string | null;
    onSelect: (id: string | null) => void;
    onLayoutStop: (next: Layout) => void;
}): JSX.Element {
    return (
        <div
            className={cn(
                'imcrm-relative imcrm-rounded-md imcrm-border imcrm-border-dashed imcrm-border-border imcrm-bg-muted/10 imcrm-p-3',
                isEmpty && 'imcrm-flex imcrm-min-h-[480px] imcrm-items-center imcrm-justify-center',
            )}
            onClick={(e) => {
                if (e.target === e.currentTarget) onSelect(null);
            }}
        >
            {isEmpty ? (
                <div className="imcrm-flex imcrm-max-w-xs imcrm-flex-col imcrm-items-center imcrm-gap-2 imcrm-text-center">
                    <div className="imcrm-flex imcrm-h-10 imcrm-w-10 imcrm-items-center imcrm-justify-center imcrm-rounded-full imcrm-bg-muted imcrm-text-muted-foreground">
                        <LayoutList className="imcrm-h-5 imcrm-w-5" />
                    </div>
                    <p className="imcrm-text-sm imcrm-font-medium imcrm-text-foreground">
                        {__('Empezá agregando bloques')}
                    </p>
                    <p className="imcrm-text-xs imcrm-text-muted-foreground">
                        {__('Click en cualquier bloque de la paleta para agregarlo al portal. Arrastrá las esquinas para redimensionar.')}
                    </p>
                </div>
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
                    onDragStop={onLayoutStop}
                    onResizeStop={onLayoutStop}
                >
                    {resolved.map((b) => {
                        const isSelected = b.id === selectedId;
                        return (
                            <div
                                key={b.id}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSelect(b.id);
                                }}
                                className={cn(
                                    'imcrm-relative imcrm-cursor-pointer imcrm-overflow-hidden imcrm-rounded-md imcrm-ring-2 imcrm-transition-shadow',
                                    isSelected
                                        ? 'imcrm-ring-primary'
                                        : 'imcrm-ring-transparent hover:imcrm-ring-primary/30',
                                )}
                            >
                                <div className="imcrm-pointer-events-none imcrm-h-full">
                                    <PortalBlockPreview block={b} fields={fields} />
                                </div>
                            </div>
                        );
                    })}
                </SizedGrid>
            )}
        </div>
    );
}

// ─── Inspector ────────────────────────────────────────────────────────

function InspectorPanel({
    block,
    fields,
    onConfigChange,
    onDuplicate,
    onDelete,
    onClose,
}: {
    block: ResolvedPortalBlock | null;
    fields: Parameters<typeof PortalBlockPreview>[0]['fields'];
    onConfigChange: (c: Record<string, unknown>) => void;
    onDuplicate: () => void;
    onDelete: () => void;
    onClose: () => void;
}): JSX.Element {
    if (! block) {
        return (
            <aside className="imcrm-flex imcrm-flex-col imcrm-rounded-md imcrm-border imcrm-border-border imcrm-bg-card imcrm-p-3">
                <p className="imcrm-text-[10px] imcrm-font-medium imcrm-uppercase imcrm-tracking-wider imcrm-text-muted-foreground">
                    {__('Inspector')}
                </p>
                <div className="imcrm-flex imcrm-flex-1 imcrm-items-center imcrm-justify-center">
                    <p className="imcrm-text-center imcrm-text-xs imcrm-text-muted-foreground">
                        {__('Click en un bloque del canvas para configurarlo.')}
                    </p>
                </div>
            </aside>
        );
    }

    return (
        <aside className="imcrm-flex imcrm-flex-col imcrm-overflow-hidden imcrm-rounded-md imcrm-border imcrm-border-border imcrm-bg-card">
            <header className="imcrm-flex imcrm-items-start imcrm-justify-between imcrm-gap-2 imcrm-border-b imcrm-border-border imcrm-px-3 imcrm-py-3">
                <div>
                    <p className="imcrm-text-[10px] imcrm-font-medium imcrm-uppercase imcrm-tracking-wider imcrm-text-muted-foreground">
                        {__('Bloque')}
                    </p>
                    <h3 className="imcrm-text-sm imcrm-font-semibold imcrm-tracking-tight">
                        {labelForType(block.type)}
                    </h3>
                    <p className="imcrm-text-[11px] imcrm-text-muted-foreground">
                        {descriptionForType(block.type)}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    title={__('Cerrar inspector')}
                    className="imcrm-rounded imcrm-p-0.5 imcrm-text-muted-foreground hover:imcrm-bg-muted"
                >
                    <X className="imcrm-h-3.5 imcrm-w-3.5" />
                </button>
            </header>

            <div className="imcrm-flex-1 imcrm-overflow-y-auto imcrm-px-3 imcrm-py-3">
                <PortalBlockForm block={block} fields={fields} onConfigChange={onConfigChange} />
            </div>

            <footer className="imcrm-flex imcrm-items-center imcrm-justify-between imcrm-gap-2 imcrm-border-t imcrm-border-border imcrm-bg-muted/20 imcrm-px-3 imcrm-py-2">
                <span className="imcrm-truncate imcrm-text-[10px] imcrm-text-muted-foreground" title={block.id}>
                    {block.id}
                </span>
                <div className="imcrm-flex imcrm-gap-1.5">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="imcrm-h-7 imcrm-gap-1.5 imcrm-px-2 imcrm-text-xs"
                        onClick={onDuplicate}
                        title={__('Duplicar bloque')}
                    >
                        <Copy className="imcrm-h-3 imcrm-w-3" />
                        {__('Duplicar')}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="imcrm-h-7 imcrm-gap-1.5 imcrm-px-2 imcrm-text-xs imcrm-text-destructive hover:imcrm-bg-destructive/10 hover:imcrm-text-destructive"
                        onClick={onDelete}
                        title={__('Eliminar bloque')}
                    >
                        <Trash2 className="imcrm-h-3 imcrm-w-3" />
                        {__('Eliminar')}
                    </Button>
                </div>
            </footer>
        </aside>
    );
}

function labelForType(type: PortalBlockType): string {
    const map: Record<PortalBlockType, string> = {
        static_text: __('Texto / HTML'),
        client_data: __('Datos del cliente'),
        related_records_table: __('Tabla relacionada'),
        editable_form: __('Formulario editable'),
        external_link: __('Enlace externo'),
        kpi_widget: __('KPI / métrica'),
        activity_timeline: __('Timeline de actividad'),
        download_files: __('Archivos descargables'),
        comments_thread: __('Hilo de comentarios'),
    };
    return map[type];
}

function descriptionForType(type: PortalBlockType): string {
    const map: Record<PortalBlockType, string> = {
        static_text: __('Texto custom con HTML básico (bienvenida, instrucciones).'),
        client_data: __('Muestra los datos del record del cliente como lista o cards.'),
        related_records_table: __('Tabla de records conectados vía relation field.'),
        editable_form: __('El cliente actualiza sus propios datos via formulario.'),
        external_link: __('CTA a URL externa (pagos, soporte, etc.).'),
        kpi_widget: __('Métrica destacada como número grande con label.'),
        activity_timeline: __('Cronología de cambios recientes del record.'),
        download_files: __('Adjuntos del record disponibles para descarga.'),
        comments_thread: __('Conversación cliente ↔ operador.'),
    };
    return map[type];
}
