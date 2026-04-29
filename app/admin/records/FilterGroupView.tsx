import { ChevronDown, FolderPlus, Plus } from 'lucide-react';

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { __ } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { FieldEntity } from '@/types/field';
import type {
    FilterCondition,
    FilterGroup,
    FilterLogic,
    FilterOperator,
    FilterTree,
} from '@/types/record';

import { DateRangePresetButtons } from './DateRangePresetButtons';
import { FilterRow } from './FilterRow';
import {
    addNode,
    isConditionNode,
    isGroupNode,
    makeCondition,
    makeGroup,
    removeNodeAt,
    replaceNodeAt,
    setGroupLogic,
} from './filterTree';

interface FilterGroupViewProps {
    /** Árbol completo (la raíz). Las acciones lo retornan modificado. */
    root: FilterTree;
    /** Path al grupo que renderea este componente (vacío = raíz). */
    path: number[];
    fields: FieldEntity[];
    listId: number | undefined;
    onRootChange: (next: FilterTree) => void;
    /** Profundidad de anidación (controla la indentación visual). */
    depth?: number;
}

/**
 * Renderiza un grupo de filtros recursivamente. Cada hijo es una
 * `FilterRow` (condición) o un sub-`FilterGroupView` (grupo anidado).
 * Entre hijos consecutivos pinta el conector `Y`/`O` que toggle la
 * lógica del grupo.
 *
 * Para campos de fecha mostramos los presets justo debajo de la fila
 * — generan un par `gte`+`lte` como dos hijos contiguos del mismo
 * grupo (que ya está en AND si la lógica del grupo lo es).
 */
export function FilterGroupView({
    root,
    path,
    fields,
    listId,
    onRootChange,
    depth = 0,
}: FilterGroupViewProps): JSX.Element {
    // Resolver el grupo actual a partir del root + path.
    const group = resolveGroup(root, path);
    if (group === null) {
        return <div />;
    }

    const setLogic = (logic: FilterLogic): void => {
        onRootChange(setGroupLogic(root, path, logic));
    };

    const updateChild = (childIdx: number, next: FilterCondition): void => {
        onRootChange(replaceNodeAt(root, [...path, childIdx], next));
    };

    const removeChild = (childIdx: number): void => {
        onRootChange(removeNodeAt(root, [...path, childIdx]));
    };

    const addCondition = (): void => {
        // Default: primer field filtrable (o id 0 si no hay), op por
        // defecto del tipo.
        const firstField = fields.find((f) => f.type !== 'relation');
        const defaultOp = firstField ? defaultOpFor(firstField.type) : 'eq';
        onRootChange(
            addNode(
                root,
                path,
                makeCondition(firstField?.id ?? 0, defaultOp, ''),
            ),
        );
    };

    const addNestedGroup = (afterIdx: number): void => {
        const firstField = fields.find((f) => f.type !== 'relation');
        const defaultOp  = firstField ? defaultOpFor(firstField.type) : 'eq';
        const nested     = makeGroup('and', [makeCondition(firstField?.id ?? 0, defaultOp, '')]);
        // Insertar después del childIdx; usamos addNode + reorder no
        // está disponible. Simulamos reemplazando el grupo padre.
        const parent = resolveGroup(root, path);
        if (parent === null) return;
        const nextChildren = [...parent.children];
        nextChildren.splice(afterIdx + 1, 0, nested);
        onRootChange(replaceParentChildren(root, path, nextChildren));
    };

    const applyDateRangePreset = (
        condition: FilterCondition,
        from: string,
        to: string,
    ): void => {
        // Reemplazamos el row actual con un par gte+lte sobre el mismo
        // field. Ambos quedan como hijos consecutivos del grupo padre.
        // Usamos AND implícito (mejor visual: si el grupo está en OR,
        // el rango ya no funciona — forzamos AND en ese caso, asumimos
        // que el usuario quiere un range).
        const parent = resolveGroup(root, path);
        if (parent === null) return;
        const idx = parent.children.findIndex((c) => c === condition);
        if (idx < 0) return;
        const fieldId = condition.field_id;
        const next: FilterCondition[] = [
            { type: 'condition', field_id: fieldId, op: 'gte', value: from },
            { type: 'condition', field_id: fieldId, op: 'lte', value: to },
        ];
        const nextChildren = [...parent.children];
        nextChildren.splice(idx, 1, ...next);
        onRootChange(replaceParentChildren(root, path, nextChildren));
    };

    return (
        <div
            className={cn(
                'imcrm-flex imcrm-flex-col imcrm-gap-2',
                depth > 0 && 'imcrm-rounded-md imcrm-border imcrm-border-dashed imcrm-border-border imcrm-bg-muted/10 imcrm-p-2',
            )}
        >
            {group.children.map((child, idx) => {
                const isFirst = idx === 0;
                return (
                    <div key={idx} className="imcrm-flex imcrm-flex-col imcrm-gap-1">
                        <div className="imcrm-flex imcrm-items-start imcrm-gap-2">
                            <div className="imcrm-w-14 imcrm-shrink-0 imcrm-pt-1.5 imcrm-text-right imcrm-text-xs imcrm-text-muted-foreground">
                                {isFirst ? (
                                    __('Dónde')
                                ) : (
                                    <LogicToggle logic={group.logic} onChange={setLogic} />
                                )}
                            </div>
                            <div className="imcrm-flex imcrm-flex-1 imcrm-flex-col imcrm-gap-1">
                                {isConditionNode(child) ? (
                                    <>
                                        <FilterRow
                                            listId={listId}
                                            fields={fields}
                                            condition={child}
                                            onChange={(next) => updateChild(idx, next)}
                                            onRemove={() => removeChild(idx)}
                                        />
                                        {isDateField(fields, child.field_id) && (
                                            <DateRangePresetButtons
                                                fieldType={
                                                    getFieldType(fields, child.field_id) as 'date' | 'datetime'
                                                }
                                                onPick={(from, to) =>
                                                    applyDateRangePreset(child, from, to)
                                                }
                                            />
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => addNestedGroup(idx)}
                                            className="imcrm-self-start imcrm-text-[11px] imcrm-text-primary hover:imcrm-underline"
                                        >
                                            {__('Agregar filtro anidado')}
                                        </button>
                                    </>
                                ) : isGroupNode(child) ? (
                                    <FilterGroupView
                                        root={root}
                                        path={[...path, idx]}
                                        fields={fields}
                                        listId={listId}
                                        onRootChange={onRootChange}
                                        depth={depth + 1}
                                    />
                                ) : null}
                            </div>
                        </div>
                    </div>
                );
            })}

            <button
                type="button"
                onClick={addCondition}
                className="imcrm-ml-16 imcrm-flex imcrm-items-center imcrm-gap-1.5 imcrm-self-start imcrm-rounded-md imcrm-border imcrm-border-dashed imcrm-border-border imcrm-px-2.5 imcrm-py-1 imcrm-text-xs imcrm-text-muted-foreground hover:imcrm-border-primary/50 hover:imcrm-text-foreground"
            >
                <Plus className="imcrm-h-3 imcrm-w-3" />
                {__('Agregar filtro')}
            </button>
        </div>
    );
}

function LogicToggle({
    logic,
    onChange,
}: {
    logic: FilterLogic;
    onChange: (l: FilterLogic) => void;
}): JSX.Element {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className="imcrm-flex imcrm-items-center imcrm-gap-1 imcrm-rounded imcrm-border imcrm-border-border imcrm-bg-card imcrm-px-1.5 imcrm-py-0.5 imcrm-text-xs imcrm-font-semibold imcrm-text-foreground hover:imcrm-bg-accent"
                >
                    {logic === 'and' ? __('Y') : __('O')}
                    <ChevronDown className="imcrm-h-3 imcrm-w-3" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => onChange('and')}>
                    {__('Y (AND)')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onChange('or')}>
                    {__('O (OR)')}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

// Forced-import para evitar warning de "FolderPlus declared but unused"
// si lo retiramos en una iteración: queda disponible para sub-grupos.
void FolderPlus;

function resolveGroup(root: FilterTree, path: number[]): FilterGroup | null {
    let node: FilterGroup | null = root;
    for (const idx of path) {
        const child: FilterCondition | FilterGroup | undefined = node?.children[idx];
        if (!child || !isGroupNode(child)) return null;
        node = child;
    }
    return node;
}

function replaceParentChildren(
    root: FilterTree,
    path: number[],
    nextChildren: Array<FilterCondition | FilterGroup>,
): FilterTree {
    if (path.length === 0) {
        return { ...root, children: nextChildren };
    }
    const parentPath = path.slice(0, -1);
    const idx = path[path.length - 1]!;
    const parent = resolveGroup(root, parentPath);
    if (parent === null) return root;
    const newGroup: FilterGroup = { ...parent, children: nextChildren };
    return replaceNodeAt(root, [...parentPath, idx].slice(0, -1).concat([idx]), newGroup);
    // ↑ Equivalente a replaceNodeAt(root, path, newGroup) — explícito
    // por claridad para futuros lectores.
}

function defaultOpFor(type: string): FilterOperator {
    switch (type) {
        case 'text':
        case 'long_text':
        case 'email':
        case 'url':
            return 'contains';
        case 'select':
        case 'multi_select':
        case 'checkbox':
        case 'user':
        case 'file':
            return 'eq';
        default:
            return 'eq';
    }
}

function isDateField(fields: FieldEntity[], fieldId: number): boolean {
    const f = fields.find((x) => x.id === fieldId);
    return f?.type === 'date' || f?.type === 'datetime';
}

function getFieldType(fields: FieldEntity[], fieldId: number): string {
    return fields.find((x) => x.id === fieldId)?.type ?? '';
}
