import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Background,
    BackgroundVariant,
    Controls,
    Handle,
    Position,
    ReactFlow,
    ReactFlowProvider,
    useNodesState,
    type Edge,
    type Node,
    type NodeProps,
} from '@xyflow/react';
import {
    GripVertical,
    Mail,
    Plus,
    Trash2,
    Webhook,
    Workflow,
    X,
    Zap,
} from 'lucide-react';

import '@xyflow/react/dist/style.css';

import {
    ActionConfigEditor,
    TriggerConfigEditor,
} from '@/admin/automations/AutomationDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useFields } from '@/hooks/useFields';
import { __ } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type {
    ActionMeta,
    ActionSpec,
    TriggerConfig,
    TriggerMeta,
} from '@/types/automation';

/**
 * Visual Builder funcional para automatizaciones (rework 0.2.0).
 *
 * Layout dos columnas:
 *  - Izquierda: ReactFlow con el trigger arriba + acciones encadenadas
 *    abajo. Click en cualquier nodo lo selecciona; arrastrar reordena.
 *  - Derecha: panel de configuración del nodo seleccionado. Trigger →
 *    `<TriggerConfigEditor />`. Acción → selector de tipo + título +
 *    `<ActionConfigEditor />` específico.
 *
 * Botón "+" abre type picker para elegir qué acción agregar (en lugar
 * de defaultar al primer tipo del catálogo). Botón "Eliminar" desde el
 * panel lateral (cuando un nodo está seleccionado).
 *
 * Es feature-parity con la pestaña Formulario, pero con UX más visual.
 */
interface AutomationVisualBuilderProps {
    listId: number;
    triggerType: string;
    triggerConfig: TriggerConfig;
    onTriggerTypeChange: (next: string) => void;
    onTriggerConfigChange: (next: TriggerConfig) => void;
    triggers: TriggerMeta[];
    actions: ActionSpec[];
    actionsCatalog: ActionMeta[];
    onActionsChange: (next: ActionSpec[]) => void;
}

interface TriggerNodeData extends Record<string, unknown> {
    label: string;
    event: string;
    selected: boolean;
}

interface ActionNodeData extends Record<string, unknown> {
    index: number;
    type: string;
    title: string;
    label: string;
    selected: boolean;
}

type SelectedNode = { kind: 'trigger' } | { kind: 'action'; index: number } | null;

const NODE_WIDTH = 280;
const NODE_GAP_Y = 130;

export function AutomationVisualBuilder(props: AutomationVisualBuilderProps): JSX.Element {
    return (
        <ReactFlowProvider>
            <Inner {...props} />
        </ReactFlowProvider>
    );
}

function Inner({
    listId,
    triggerType,
    triggerConfig,
    onTriggerTypeChange,
    onTriggerConfigChange,
    triggers,
    actions,
    actionsCatalog,
    onActionsChange,
}: AutomationVisualBuilderProps): JSX.Element {
    const fields = useFields(listId);
    const [selected, setSelected] = useState<SelectedNode>(null);
    const [pickerOpen, setPickerOpen] = useState(false);

    const triggerMeta = triggers.find((t) => t.slug === triggerType);

    const initialNodes = useMemo<Node[]>(
        () => buildNodes(triggerMeta, actions, actionsCatalog, selected),
        [triggerMeta, actions, actionsCatalog, selected],
    );
    const edges = useMemo<Edge[]>(() => buildEdges(actions.length), [actions.length]);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);

    useEffect(() => {
        setNodes(initialNodes);
    }, [initialNodes, setNodes]);

    const handleNodeDragStop = useCallback(
        (_event: React.MouseEvent, dragged: Node) => {
            if (dragged.type !== 'action') return;
            const positions = nodes
                .filter((n) => n.type === 'action')
                .map((n) => ({
                    index: (n.data as ActionNodeData).index,
                    y: n.id === dragged.id ? dragged.position.y : n.position.y,
                }))
                .sort((a, b) => a.y - b.y);

            const newOrder = positions
                .map((p) => actions[p.index])
                .filter((a): a is ActionSpec => a !== undefined);
            if (newOrder.length !== actions.length) return;
            const changed = newOrder.some((a, i) => a !== actions[i]);
            if (changed) {
                onActionsChange(newOrder);
            } else {
                setNodes(initialNodes);
            }
        },
        [nodes, actions, onActionsChange, initialNodes, setNodes],
    );

    const handleNodeClick = useCallback(
        (_event: React.MouseEvent, node: Node) => {
            if (node.type === 'trigger') {
                setSelected({ kind: 'trigger' });
            } else if (node.type === 'action') {
                const idx = (node.data as ActionNodeData).index;
                setSelected({ kind: 'action', index: idx });
            }
        },
        [],
    );

    const handleAdd = (typeSlug: string): void => {
        onActionsChange([...actions, { type: typeSlug, config: {} }]);
        setSelected({ kind: 'action', index: actions.length });
        setPickerOpen(false);
    };

    const handleDeleteSelected = (): void => {
        if (selected?.kind === 'action') {
            onActionsChange(actions.filter((_, j) => j !== selected.index));
            setSelected(null);
        }
    };

    return (
        <div className="imcrm-grid imcrm-grid-cols-1 imcrm-gap-3 lg:imcrm-grid-cols-[2fr_1fr]">
            {/* Flow canvas */}
            <div className="imcrm-flex imcrm-flex-col imcrm-gap-2">
                <div className="imcrm-relative imcrm-h-[480px] imcrm-rounded-md imcrm-border imcrm-border-border imcrm-bg-muted/20">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onNodeDragStop={handleNodeDragStop}
                        onNodeClick={handleNodeClick}
                        onPaneClick={() => setSelected(null)}
                        nodeTypes={NODE_TYPES}
                        nodesConnectable={false}
                        edgesFocusable={false}
                        fitView
                        fitViewOptions={{ padding: 0.2 }}
                        proOptions={{ hideAttribution: true }}
                    >
                        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
                        <Controls showInteractive={false} />
                    </ReactFlow>

                    {/* Floating + button con type picker */}
                    <div className="imcrm-absolute imcrm-bottom-3 imcrm-right-3 imcrm-z-10">
                        {pickerOpen && (
                            <div className="imcrm-absolute imcrm-bottom-12 imcrm-right-0 imcrm-min-w-[220px] imcrm-rounded-md imcrm-border imcrm-border-border imcrm-bg-card imcrm-shadow-imcrm-lg">
                                <header className="imcrm-flex imcrm-items-center imcrm-justify-between imcrm-border-b imcrm-border-border imcrm-px-3 imcrm-py-2">
                                    <span className="imcrm-text-xs imcrm-font-medium imcrm-text-muted-foreground">
                                        {__('Tipo de acción')}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setPickerOpen(false)}
                                        className="imcrm-text-muted-foreground hover:imcrm-text-foreground"
                                        aria-label={__('Cerrar')}
                                    >
                                        <X className="imcrm-h-3.5 imcrm-w-3.5" />
                                    </button>
                                </header>
                                <ul className="imcrm-flex imcrm-flex-col imcrm-py-1">
                                    {actionsCatalog.map((a) => (
                                        <li key={a.slug}>
                                            <button
                                                type="button"
                                                onClick={() => handleAdd(a.slug)}
                                                className="imcrm-flex imcrm-w-full imcrm-items-center imcrm-gap-2 imcrm-px-3 imcrm-py-1.5 imcrm-text-sm imcrm-text-left hover:imcrm-bg-accent"
                                            >
                                                <span className="imcrm-flex imcrm-h-5 imcrm-w-5 imcrm-items-center imcrm-justify-center imcrm-text-muted-foreground">
                                                    {iconForActionType(a.slug)}
                                                </span>
                                                {a.label}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        <Button
                            type="button"
                            onClick={() => setPickerOpen((p) => !p)}
                            disabled={actionsCatalog.length === 0}
                            className="imcrm-gap-2 imcrm-shadow-imcrm-md"
                        >
                            <Plus className="imcrm-h-4 imcrm-w-4" />
                            {__('Añadir acción')}
                        </Button>
                    </div>
                </div>

                <p className="imcrm-text-xs imcrm-text-muted-foreground">
                    {__('Click en un nodo para configurarlo en el panel derecho. Arrastra una acción para cambiar su orden.')}
                </p>
            </div>

            {/* Side panel: editor del nodo seleccionado */}
            <aside className="imcrm-flex imcrm-flex-col imcrm-gap-3 imcrm-rounded-md imcrm-border imcrm-border-border imcrm-bg-card imcrm-p-3">
                {selected === null ? (
                    <EmptyPanel />
                ) : selected.kind === 'trigger' ? (
                    <TriggerEditorPanel
                        triggerType={triggerType}
                        triggerConfig={triggerConfig}
                        triggers={triggers}
                        fields={fields.data ?? []}
                        onTypeChange={onTriggerTypeChange}
                        onConfigChange={onTriggerConfigChange}
                    />
                ) : (
                    <ActionEditorPanel
                        spec={actions[selected.index]!}
                        actionsCatalog={actionsCatalog}
                        fields={fields.data ?? []}
                        onChange={(next) => {
                            const arr = [...actions];
                            arr[selected.index] = next;
                            onActionsChange(arr);
                        }}
                        onDelete={handleDeleteSelected}
                    />
                )}
            </aside>
        </div>
    );
}

function EmptyPanel(): JSX.Element {
    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-items-center imcrm-justify-center imcrm-gap-2 imcrm-py-12 imcrm-text-center">
            <Workflow className="imcrm-h-6 imcrm-w-6 imcrm-text-muted-foreground" />
            <p className="imcrm-text-sm imcrm-font-medium">{__('Selecciona un nodo')}</p>
            <p className="imcrm-text-xs imcrm-text-muted-foreground">
                {__('Click en el trigger o en una acción para editarla.')}
            </p>
        </div>
    );
}

interface TriggerEditorPanelProps {
    triggerType: string;
    triggerConfig: TriggerConfig;
    triggers: TriggerMeta[];
    fields: Parameters<typeof TriggerConfigEditor>[0]['fields'];
    onTypeChange: (next: string) => void;
    onConfigChange: (next: TriggerConfig) => void;
}

function TriggerEditorPanel({
    triggerType,
    triggerConfig,
    triggers,
    fields,
    onTypeChange,
    onConfigChange,
}: TriggerEditorPanelProps): JSX.Element {
    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-3">
            <header className="imcrm-flex imcrm-items-center imcrm-gap-2">
                <span className="imcrm-flex imcrm-h-7 imcrm-w-7 imcrm-items-center imcrm-justify-center imcrm-rounded-full imcrm-bg-primary imcrm-text-primary-foreground">
                    <Zap className="imcrm-h-4 imcrm-w-4" />
                </span>
                <div>
                    <span className="imcrm-text-[11px] imcrm-uppercase imcrm-tracking-wide imcrm-text-primary">
                        {__('Trigger')}
                    </span>
                    <h3 className="imcrm-text-sm imcrm-font-medium">{__('Cuándo dispara')}</h3>
                </div>
            </header>

            <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                <Label htmlFor="visual-trigger-type">{__('Tipo')}</Label>
                <Select
                    id="visual-trigger-type"
                    value={triggerType}
                    onChange={(e) => {
                        onTypeChange(e.target.value);
                        // Reset config al cambiar tipo (las shapes son distintas).
                        onConfigChange({});
                    }}
                >
                    {triggers.map((t) => (
                        <option key={t.slug} value={t.slug}>
                            {t.label}
                        </option>
                    ))}
                </Select>
            </div>

            <TriggerConfigEditor
                triggerType={triggerType}
                config={triggerConfig}
                onChange={onConfigChange}
                fields={fields}
            />
        </div>
    );
}

interface ActionEditorPanelProps {
    spec: ActionSpec;
    actionsCatalog: ActionMeta[];
    fields: Parameters<typeof ActionConfigEditor>[0]['fields'];
    onChange: (next: ActionSpec) => void;
    onDelete: () => void;
}

function ActionEditorPanel({
    spec,
    actionsCatalog,
    fields,
    onChange,
    onDelete,
}: ActionEditorPanelProps): JSX.Element {
    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-3">
            <header className="imcrm-flex imcrm-items-start imcrm-justify-between imcrm-gap-2">
                <div className="imcrm-flex imcrm-items-center imcrm-gap-2">
                    <span className="imcrm-flex imcrm-h-7 imcrm-w-7 imcrm-items-center imcrm-justify-center imcrm-rounded-full imcrm-bg-muted imcrm-text-muted-foreground">
                        {iconForActionType(spec.type)}
                    </span>
                    <div>
                        <span className="imcrm-text-[11px] imcrm-uppercase imcrm-tracking-wide imcrm-text-muted-foreground">
                            {__('Acción')}
                        </span>
                        <h3 className="imcrm-text-sm imcrm-font-medium">
                            {actionsCatalog.find((a) => a.slug === spec.type)?.label ?? spec.type}
                        </h3>
                    </div>
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onDelete}
                    aria-label={__('Eliminar acción')}
                    className="imcrm-text-destructive hover:imcrm-text-destructive"
                >
                    <Trash2 className="imcrm-h-4 imcrm-w-4" />
                </Button>
            </header>

            <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                <Label htmlFor="visual-action-title">{__('Título (opcional)')}</Label>
                <Input
                    id="visual-action-title"
                    value={typeof spec.config.title === 'string' ? spec.config.title : ''}
                    onChange={(e) =>
                        onChange({
                            ...spec,
                            config: { ...spec.config, title: e.target.value },
                        })
                    }
                    placeholder={__('Ej. Marcar como vencido')}
                />
            </div>

            <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                <Label htmlFor="visual-action-type">{__('Tipo')}</Label>
                <Select
                    id="visual-action-type"
                    value={spec.type}
                    onChange={(e) => {
                        // Reset config al cambiar tipo.
                        onChange({ ...spec, type: e.target.value, config: {} });
                    }}
                >
                    {actionsCatalog.map((a) => (
                        <option key={a.slug} value={a.slug}>
                            {a.label}
                        </option>
                    ))}
                </Select>
            </div>

            <ActionConfigEditor spec={spec} onChange={onChange} fields={fields} />
        </div>
    );
}

const NODE_TYPES = {
    trigger: TriggerNode,
    action: ActionNode,
};

function buildNodes(
    triggerMeta: TriggerMeta | undefined,
    actions: ActionSpec[],
    catalog: ActionMeta[],
    selected: SelectedNode,
): Node[] {
    const nodes: Node[] = [];
    nodes.push({
        id: 'trigger',
        type: 'trigger',
        position: { x: 0, y: 0 },
        draggable: false,
        data: {
            label: triggerMeta?.label ?? __('Trigger sin definir'),
            event: triggerMeta?.event ?? '',
            selected: selected?.kind === 'trigger',
        } satisfies TriggerNodeData,
    });

    actions.forEach((action, i) => {
        const meta = catalog.find((a) => a.slug === action.type);
        const title = typeof action.config.title === 'string' ? action.config.title : '';
        nodes.push({
            id: `action-${i}`,
            type: 'action',
            position: { x: 0, y: (i + 1) * NODE_GAP_Y },
            draggable: true,
            data: {
                index: i,
                type: action.type,
                title,
                label: meta?.label ?? action.type,
                selected: selected?.kind === 'action' && selected.index === i,
            } satisfies ActionNodeData,
        });
    });

    return nodes;
}

function buildEdges(actionCount: number): Edge[] {
    const edges: Edge[] = [];
    if (actionCount === 0) return edges;
    edges.push({ id: 'e-trigger-0', source: 'trigger', target: 'action-0', animated: true });
    for (let i = 0; i < actionCount - 1; i++) {
        edges.push({
            id: `e-${i}-${i + 1}`,
            source: `action-${i}`,
            target: `action-${i + 1}`,
        });
    }
    return edges;
}

function TriggerNode({ data }: NodeProps): JSX.Element {
    const d = data as TriggerNodeData;
    return (
        <div
            className={cn(
                'imcrm-rounded-lg imcrm-border-2 imcrm-bg-primary/5 imcrm-px-4 imcrm-py-3 imcrm-shadow-imcrm-md imcrm-cursor-pointer',
                d.selected
                    ? 'imcrm-border-primary imcrm-ring-2 imcrm-ring-primary/30'
                    : 'imcrm-border-primary/40 hover:imcrm-border-primary',
            )}
            style={{ width: NODE_WIDTH }}
        >
            <div className="imcrm-flex imcrm-items-center imcrm-gap-2">
                <span className="imcrm-flex imcrm-h-7 imcrm-w-7 imcrm-items-center imcrm-justify-center imcrm-rounded-full imcrm-bg-primary imcrm-text-primary-foreground">
                    <Zap className="imcrm-h-4 imcrm-w-4" />
                </span>
                <div className="imcrm-flex imcrm-min-w-0 imcrm-flex-col">
                    <span className="imcrm-text-[11px] imcrm-uppercase imcrm-tracking-wide imcrm-text-primary">
                        {__('Trigger')}
                    </span>
                    <span className="imcrm-truncate imcrm-text-sm imcrm-font-medium">{d.label}</span>
                </div>
            </div>
            {d.event !== '' && (
                <code className="imcrm-mt-2 imcrm-block imcrm-text-[10px] imcrm-text-muted-foreground">
                    {d.event}
                </code>
            )}
            <Handle type="source" position={Position.Bottom} className="!imcrm-bg-primary" />
        </div>
    );
}

function ActionNode({ data }: NodeProps): JSX.Element {
    const d = data as ActionNodeData;
    return (
        <div
            className={cn(
                'imcrm-rounded-lg imcrm-border-2 imcrm-bg-card imcrm-px-3 imcrm-py-2 imcrm-shadow-imcrm-sm imcrm-cursor-pointer',
                d.selected
                    ? 'imcrm-border-primary imcrm-ring-2 imcrm-ring-primary/30'
                    : 'imcrm-border-border hover:imcrm-border-muted-foreground',
            )}
            style={{ width: NODE_WIDTH }}
        >
            <Handle type="target" position={Position.Top} className="!imcrm-bg-muted-foreground" />
            <div className="imcrm-flex imcrm-items-center imcrm-gap-2">
                <GripVertical
                    className="imcrm-h-3.5 imcrm-w-3.5 imcrm-text-muted-foreground imcrm-cursor-grab"
                    aria-hidden
                />
                <span className="imcrm-flex imcrm-h-6 imcrm-w-6 imcrm-items-center imcrm-justify-center imcrm-rounded-full imcrm-bg-muted imcrm-text-muted-foreground">
                    {iconForActionType(d.type)}
                </span>
                <div className="imcrm-flex imcrm-min-w-0 imcrm-flex-1 imcrm-flex-col">
                    <span className="imcrm-text-[10px] imcrm-uppercase imcrm-tracking-wide imcrm-text-muted-foreground">
                        {__('Acción')} {d.index + 1}
                    </span>
                    <span className="imcrm-truncate imcrm-text-sm imcrm-font-medium">
                        {d.title || d.label}
                    </span>
                </div>
            </div>
            <Handle type="source" position={Position.Bottom} className="!imcrm-bg-muted-foreground" />
        </div>
    );
}

function iconForActionType(type: string): JSX.Element {
    switch (type) {
        case 'send_email':
            return <Mail className="imcrm-h-3.5 imcrm-w-3.5" />;
        case 'call_webhook':
            return <Webhook className="imcrm-h-3.5 imcrm-w-3.5" />;
        case 'update_field':
        default:
            return <Workflow className="imcrm-h-3.5 imcrm-w-3.5" />;
    }
}
