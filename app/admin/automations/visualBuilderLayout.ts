import type { Edge, Node } from '@xyflow/react';

import {
    elseOf,
    pathKey,
    slotKey,
    thenOf,
    type ActionPath,
} from '@/admin/automations/actionPath';
import type { ActionMeta, ActionSpec } from '@/types/automation';

/**
 * Layout en árbol recursivo para el visual builder. Cada subtree
 * computa su ancho propio y los branches `then` / `else` se centran
 * bajo el nodo `if_else` padre, con un gap horizontal — evita
 * solapamientos a cualquier profundidad de anidamiento.
 *
 * Diseñado para acompañar `AutomationVisualBuilder.tsx`. Los nodos
 * resultantes usan `path` (ActionPath) como identidad — ver
 * `actionPath.ts`.
 *
 * Slots de inserción: entre cada par de acciones consecutivas y al
 * final de cada chain (root, then-branch, else-branch) emitimos un
 * nodo `slot` con un path que indica DÓNDE insertar al hacer click.
 * Esto permite armar el flujo libre (no forzado a apilar al final
 * del array de root como antes).
 */

export const NODE_WIDTH = 280;
export const NODE_GAP_Y = 120;
export const SLOT_HEIGHT = 24;
export const SLOT_AFTER = 8; // gap entre el slot y la siguiente acción
export const BRANCH_GAP_X = 80;

export interface ActionNodeData extends Record<string, unknown> {
    path: ActionPath;
    type: string;
    title: string;
    label: string;
    selected: boolean;
    branchKind: 'normal' | 'if_else';
    depth: number;
}

export interface SlotNodeData extends Record<string, unknown> {
    /** Path al slot (donde se insertará la nueva acción al click). */
    insertPath: ActionPath;
}

/** Ancho (px) que ocupa este subtree en el canvas. */
function computeWidth(actions: ActionSpec[]): number {
    let max = NODE_WIDTH;
    for (const action of actions) {
        if (action.type === 'if_else') {
            const thenW = computeWidth(thenOf(action));
            const elseW = computeWidth(elseOf(action));
            const branchW = thenW + elseW + BRANCH_GAP_X;
            if (branchW > max) max = branchW;
        }
    }
    return max;
}

interface LayoutOutput {
    nodes: Node[];
    edges: Edge[];
    firstNodeId: string | null;
    endY: number;
}

interface LayoutCtx {
    catalog: ActionMeta[];
    selectedKey: string | null;
}

/**
 * Genera nodos y edges para una secuencia lineal de acciones que viven
 * bajo un mismo branch o el root. Recursa en sub-branches al toparse
 * con un `if_else`. Retorna el primer nodeId (para que el caller
 * conecte desde su trigger / parent) y la `endY` final (para que el
 * caller siga apilando hacia abajo si hay más actions hermanas).
 */
export function layoutChain(
    actions: ActionSpec[],
    centerX: number,
    startY: number,
    parentPath: ActionPath,
    ctx: LayoutCtx,
): LayoutOutput {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    let prevId: string | null = null;
    let firstNodeId: string | null = null;
    let curY = startY;

    /**
     * Emite un slot de inserción. `slotIdx` es la posición dentro de
     * esta chain (0 = antes del primer action, actions.length = al
     * final). Conecta el slot al nodo previo con una edge "fantasma"
     * y deja el slot id como prevId para que la próxima acción
     * conecte desde el slot.
     */
    const emitSlot = (slotIdx: number): void => {
        const slotPath: ActionPath = [...parentPath, slotIdx];
        const id = slotKey(slotPath);
        nodes.push({
            id,
            type: 'slot',
            position: { x: centerX - 16, y: curY },
            draggable: false,
            selectable: false,
            data: { insertPath: slotPath } satisfies SlotNodeData,
        });
        firstNodeId ??= id;
        if (prevId !== null) {
            edges.push({
                id: `e-${prevId}-${id}`,
                source: prevId,
                target: id,
                style: { strokeDasharray: '4 4', opacity: 0.6 },
            });
        }
        prevId = id;
        curY += SLOT_HEIGHT + SLOT_AFTER;
    };

    for (let i = 0; i < actions.length; i++) {
        emitSlot(i);

        const action = actions[i]!;
        const path: ActionPath = [...parentPath, i];
        const id = `action-${pathKey(path)}`;
        const meta = ctx.catalog.find((a) => a.slug === action.type);
        const title =
            typeof action.config.title === 'string' ? action.config.title : '';
        const isSelected = ctx.selectedKey === pathKey(path);
        // depth = cantidad de saltos de branch en el path (cada vez
        // que entramos a un then/else, +1).
        const depth = parentPath.filter((p) => typeof p === 'string').length;

        if (action.type === 'if_else') {
            nodes.push({
                id,
                type: 'action',
                position: { x: centerX - NODE_WIDTH / 2, y: curY },
                draggable: false,
                data: {
                    path,
                    type: action.type,
                    title,
                    label: meta?.label ?? action.type,
                    selected: isSelected,
                    branchKind: 'if_else',
                    depth,
                } satisfies ActionNodeData,
            });
            firstNodeId ??= id;
            if (prevId !== null) {
                edges.push({
                    id: `e-${prevId}-${id}`,
                    source: prevId,
                    target: id,
                });
            }

            const branchY = curY + NODE_GAP_Y;
            const thenActions = thenOf(action);
            const elseActions = elseOf(action);
            const thenW = computeWidth(thenActions);
            const elseW = computeWidth(elseActions);
            const totalW = thenW + elseW + BRANCH_GAP_X;
            // Centro de cada sub-branch relativo al padre.
            const thenCenterX = centerX - totalW / 2 + thenW / 2;
            const elseCenterX = centerX + totalW / 2 - elseW / 2;

            const thenLayout = layoutChain(
                thenActions,
                thenCenterX,
                branchY,
                [...path, 'then'],
                ctx,
            );
            const elseLayout = layoutChain(
                elseActions,
                elseCenterX,
                branchY,
                [...path, 'else'],
                ctx,
            );

            nodes.push(...thenLayout.nodes, ...elseLayout.nodes);
            edges.push(...thenLayout.edges, ...elseLayout.edges);

            if (thenLayout.firstNodeId !== null) {
                edges.push({
                    id: `e-${id}-then`,
                    source: id,
                    sourceHandle: 'then',
                    target: thenLayout.firstNodeId,
                    label: 'Sí',
                    animated: true,
                    style: { stroke: 'hsl(var(--imcrm-success))', strokeWidth: 2 },
                    labelStyle: { fontSize: 11, fontWeight: 600, fill: 'hsl(var(--imcrm-success))' },
                    labelBgPadding: [6, 3],
                    labelBgBorderRadius: 6,
                    labelBgStyle: { fill: 'hsl(var(--imcrm-card))', fillOpacity: 1 },
                });
            }
            if (elseLayout.firstNodeId !== null) {
                edges.push({
                    id: `e-${id}-else`,
                    source: id,
                    sourceHandle: 'else',
                    target: elseLayout.firstNodeId,
                    label: 'No',
                    animated: true,
                    style: { stroke: 'hsl(var(--imcrm-warning))', strokeWidth: 2 },
                    labelStyle: { fontSize: 11, fontWeight: 600, fill: 'hsl(var(--imcrm-warning))' },
                    labelBgPadding: [6, 3],
                    labelBgBorderRadius: 6,
                    labelBgStyle: { fill: 'hsl(var(--imcrm-card))', fillOpacity: 1 },
                });
            }

            curY = Math.max(thenLayout.endY, elseLayout.endY) + NODE_GAP_Y;
            // Action posterior en la misma chain conecta desde el
            // if_else node (no desde los tails de los branches —
            // semántica simplificada para v1).
            prevId = id;
        } else {
            nodes.push({
                id,
                type: 'action',
                position: { x: centerX - NODE_WIDTH / 2, y: curY },
                draggable: false,
                data: {
                    path,
                    type: action.type,
                    title,
                    label: meta?.label ?? action.type,
                    selected: isSelected,
                    branchKind: 'normal',
                    depth,
                } satisfies ActionNodeData,
            });
            firstNodeId ??= id;
            if (prevId !== null) {
                edges.push({
                    id: `e-${prevId}-${id}`,
                    source: prevId,
                    target: id,
                });
            }
            prevId = id;
            curY += NODE_GAP_Y;
        }
    }

    // Slot final (al término de la chain — para appender). También
    // cubre el caso de chain vacía: si actions.length === 0, este
    // slot es el único nodo emitido y firstNodeId apunta a él.
    emitSlot(actions.length);

    return { nodes, edges, firstNodeId, endY: curY };
}
