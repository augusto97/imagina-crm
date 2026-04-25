import { useCallback, useEffect, useMemo } from 'react';
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
import { GripVertical, Mail, Pencil, Plus, Trash2, Webhook, Workflow, Zap } from 'lucide-react';

import '@xyflow/react/dist/style.css';

import { Button } from '@/components/ui/button';
import { __ } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { ActionMeta, ActionSpec, TriggerMeta } from '@/types/automation';

/**
 * Vista visual de la automatización: trigger arriba y acciones encadenadas
 * verticalmente. Es un complemento al form — el editor de valores sigue
 * viviendo en la pestaña "Formulario". Aquí el usuario:
 *
 * - Ve el flujo de un vistazo (qué dispara, qué hace, en qué orden).
 * - Reordena las acciones arrastrando (la pestaña form se sincroniza).
 * - Añade/elimina acciones con los botones del nodo.
 * - Hace clic en una acción para que el host (dialog) lo lleve a editar
 *   ese ítem en el form.
 *
 * No replicamos la edición de config aquí: duplicaría lógica y los nodos
 * se volverían diálogos anidados. La separación "estructura visual /
 * detalles en form" es la misma que usan Zapier/Make.
 */
interface AutomationVisualBuilderProps {
    triggerType: string;
    triggers: TriggerMeta[];
    actions: ActionSpec[];
    actionsCatalog: ActionMeta[];
    onActionsChange: (next: ActionSpec[]) => void;
    onEditAction?: (index: number) => void;
}

interface TriggerNodeData extends Record<string, unknown> {
    label: string;
    event: string;
}

interface ActionNodeData extends Record<string, unknown> {
    index: number;
    type: string;
    label: string;
    onEdit: () => void;
    onDelete: () => void;
}

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
    triggerType,
    triggers,
    actions,
    actionsCatalog,
    onActionsChange,
    onEditAction,
}: AutomationVisualBuilderProps): JSX.Element {
    const triggerMeta = triggers.find((t) => t.slug === triggerType);

    const initialNodes = useMemo<Node[]>(
        () => buildNodes(triggerMeta, actions, actionsCatalog, onActionsChange, onEditAction),
        [triggerMeta, actions, actionsCatalog, onActionsChange, onEditAction],
    );
    const edges = useMemo<Edge[]>(() => buildEdges(actions.length), [actions.length]);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);

    // Re-syncroniza cuando el upstream cambia el state del form (ej.
    // añadir acción desde la pestaña form). Los nodos son derivados.
    useEffect(() => {
        setNodes(initialNodes);
    }, [initialNodes, setNodes]);

    // Drag de un nodo de acción → si se cruzó verticalmente con otro,
    // reordenamos. Trigger es fijo (no draggable).
    const handleNodeDragStop = useCallback(
        (_event: React.MouseEvent, dragged: Node) => {
            if (dragged.type !== 'action') return;
            const draggedIdx = (dragged.data as ActionNodeData).index;
            const positions = nodes
                .filter((n) => n.type === 'action')
                .map((n) => ({
                    index: (n.data as ActionNodeData).index,
                    y: n.id === dragged.id ? dragged.position.y : n.position.y,
                }))
                .sort((a, b) => a.y - b.y);

            const newOrder = positions.map((p) => actions[p.index]).filter((a): a is ActionSpec => a !== undefined);
            if (newOrder.length !== actions.length) return;
            // Si nada cambió, no propagues.
            const changed = newOrder.some((a, i) => a !== actions[i]);
            if (changed) {
                onActionsChange(newOrder);
            } else {
                // Snap back: el effect re-pondrá las Y originales en el siguiente render.
                setNodes(initialNodes);
            }
            void draggedIdx;
        },
        [nodes, actions, onActionsChange, initialNodes, setNodes],
    );

    const handleAdd = (): void => {
        const first = actionsCatalog[0];
        if (!first) return;
        onActionsChange([...actions, { type: first.slug, config: {} }]);
    };

    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-3">
            <div className="imcrm-h-[480px] imcrm-rounded-md imcrm-border imcrm-border-border imcrm-bg-muted/20">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onNodeDragStop={handleNodeDragStop}
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
            </div>

            <div className="imcrm-flex imcrm-items-center imcrm-justify-between">
                <p className="imcrm-text-xs imcrm-text-muted-foreground">
                    {__('Arrastra una acción para cambiar su orden. Haz clic en el lápiz para editarla en el formulario.')}
                </p>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAdd}
                    disabled={actionsCatalog.length === 0}
                    className="imcrm-gap-2"
                >
                    <Plus className="imcrm-h-3.5 imcrm-w-3.5" />
                    {__('Añadir acción')}
                </Button>
            </div>
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
    onActionsChange: (next: ActionSpec[]) => void,
    onEditAction: ((index: number) => void) | undefined,
): Node[] {
    const nodes: Node[] = [];
    nodes.push({
        id: 'trigger',
        type: 'trigger',
        position: { x: 0, y: 0 },
        draggable: false,
        selectable: false,
        data: {
            label: triggerMeta?.label ?? __('Trigger sin definir'),
            event: triggerMeta?.event ?? '',
        } satisfies TriggerNodeData,
    });

    actions.forEach((action, i) => {
        const meta = catalog.find((a) => a.slug === action.type);
        nodes.push({
            id: `action-${i}`,
            type: 'action',
            position: { x: 0, y: (i + 1) * NODE_GAP_Y },
            draggable: true,
            data: {
                index: i,
                type: action.type,
                label: meta?.label ?? action.type,
                onEdit: () => onEditAction?.(i),
                onDelete: () => onActionsChange(actions.filter((_, j) => j !== i)),
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
                'imcrm-rounded-lg imcrm-border imcrm-border-primary imcrm-bg-primary/5 imcrm-px-4 imcrm-py-3 imcrm-shadow-imcrm-md',
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
                'imcrm-rounded-lg imcrm-border imcrm-border-border imcrm-bg-card imcrm-px-3 imcrm-py-2 imcrm-shadow-imcrm-sm',
            )}
            style={{ width: NODE_WIDTH }}
        >
            <Handle type="target" position={Position.Top} className="!imcrm-bg-muted-foreground" />
            <div className="imcrm-flex imcrm-items-center imcrm-gap-2">
                <GripVertical className="imcrm-h-4 imcrm-w-4 imcrm-text-muted-foreground imcrm-cursor-grab" />
                <span className="imcrm-flex imcrm-h-6 imcrm-w-6 imcrm-items-center imcrm-justify-center imcrm-rounded-full imcrm-bg-muted imcrm-text-muted-foreground">
                    {iconForActionType(d.type)}
                </span>
                <div className="imcrm-flex imcrm-min-w-0 imcrm-flex-1 imcrm-flex-col">
                    <span className="imcrm-text-[10px] imcrm-uppercase imcrm-tracking-wide imcrm-text-muted-foreground">
                        {__('Acción')} {d.index + 1}
                    </span>
                    <span className="imcrm-truncate imcrm-text-sm imcrm-font-medium">{d.label}</span>
                </div>
                <button
                    type="button"
                    onClick={d.onEdit}
                    className="imcrm-flex imcrm-h-6 imcrm-w-6 imcrm-items-center imcrm-justify-center imcrm-rounded imcrm-text-muted-foreground hover:imcrm-bg-accent hover:imcrm-text-foreground"
                    aria-label={__('Editar')}
                >
                    <Pencil className="imcrm-h-3.5 imcrm-w-3.5" />
                </button>
                <button
                    type="button"
                    onClick={d.onDelete}
                    className="imcrm-flex imcrm-h-6 imcrm-w-6 imcrm-items-center imcrm-justify-center imcrm-rounded imcrm-text-muted-foreground hover:imcrm-bg-destructive/10 hover:imcrm-text-destructive"
                    aria-label={__('Eliminar')}
                >
                    <Trash2 className="imcrm-h-3.5 imcrm-w-3.5" />
                </button>
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
