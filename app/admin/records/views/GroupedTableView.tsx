import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Inbox, KeyRound, Loader2 } from 'lucide-react';

import { EmptyState } from '@/components/ui/empty-state';
import { useRecordGroups, useRecords } from '@/hooks/useRecords';
import { __, sprintf } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { FieldEntity } from '@/types/field';
import type {
    FilterCondition,
    FilterOperator,
    FilterTree,
    RecordEntity,
    RecordGroupBucket,
    RecordsQuery,
} from '@/types/record';

import { EditableCell } from '@/admin/records/EditableCell';
import { renderCellValue } from '@/admin/records/renderCellValue';
import { addNode, isFlatAndTree } from '@/admin/records/filterTree';

interface GroupedTableViewProps {
    listId: number;
    fields: FieldEntity[];
    groupByField: FieldEntity;
    /** Árbol de filtros activos (sin contar el de agrupación). Se
     * reusa en la query de groups y en la expansión de cada bucket. */
    filterTree: FilterTree;
    search: string;
    selectedIds: number[];
    onSelectionChange: (ids: number[]) => void;
    onRowClick?: (record: RecordEntity) => void;
    /** Visibilidad por column id. `false` = oculta. Compartida con
     * `TableView` para que el ColumnsMenu funcione igual en ambos
     * modos. */
    columnVisibility: Record<string, boolean>;
    /**
     * Anchos persistidos del flat view (px). Si está vacío, usamos
     * `defaultSizeForType`. Sin esto el user perdía sus ajustes de
     * width al agrupar.
     */
    columnSizing?: Record<string, number>;
    /**
     * Orden custom del flat view (column ids). Si está vacío, usamos
     * `field.position`. Sin esto el user perdía su reordenamiento al
     * agrupar.
     */
    columnOrder?: string[];
}

/**
 * Tabla con grouping ClickUp/Airtable-style. Hace dos llamadas al
 * backend:
 *
 * 1. `/records/groups` para los buckets (value + count) — una sola vez,
 *    cacheada por TanStack Query.
 * 2. `/records?filter=...` por cada grupo expandido — lazy, sólo dispara
 *    cuando el usuario hace click en el chevron del grupo.
 *
 * Por simplicidad de la primera iteración no usamos TanStack Table aquí
 * (sí se usa en `TableView`). Las columnas se renderean directamente —
 * no perdemos features porque dentro de los grupos no hace falta resize
 * ni column visibility (ya están aplicados por la vista madre).
 */
export function GroupedTableView({
    listId,
    fields,
    groupByField,
    filterTree,
    search,
    selectedIds,
    onSelectionChange,
    onRowClick,
    columnVisibility,
    columnSizing,
    columnOrder,
}: GroupedTableViewProps): JSX.Element {
    // Si el árbol es AND-plano, usamos el shortcut `filter[...]` (más
    // amigable para cache keys y URLs cortas). Si tiene OR/nesting,
    // pasamos el `filter_tree` JSON-encoded.
    const filterParam = useMemo(() => buildFilterParam(filterTree), [filterTree]);
    const filterTreeParam = useMemo(
        () => (isFlatAndTree(filterTree) ? undefined : filterTree),
        [filterTree],
    );

    const groups = useRecordGroups(listId, {
        groupBy: groupByField.id,
        filter: filterParam,
        filterTree: filterTreeParam,
        search,
    });

    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    const toggleGroup = (key: string): void => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const visibleColumns = useMemo(
        () => sortByOrder(buildColumns(fields), columnOrder ?? [])
            .filter((c) => columnVisibility[c.id] !== false),
        [fields, columnVisibility, columnOrder],
    );

    if (groups.isLoading) {
        return (
            <div className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-py-6 imcrm-text-sm imcrm-text-muted-foreground">
                <Loader2 className="imcrm-h-4 imcrm-w-4 imcrm-animate-spin" />
                {__('Cargando grupos…')}
            </div>
        );
    }

    if (groups.isError) {
        return (
            <p className="imcrm-text-sm imcrm-text-destructive">
                {sprintf(__('Error: %s'), (groups.error as Error).message)}
            </p>
        );
    }

    const buckets = groups.data?.data ?? [];

    if (buckets.length === 0) {
        return (
            <div className="imcrm-rounded-xl imcrm-border imcrm-border-border imcrm-bg-card imcrm-px-4 imcrm-py-8">
                <EmptyState
                    icon={Inbox}
                    title={__('No hay registros')}
                    description={__('Esta lista no tiene registros que coincidan con los filtros actuales.')}
                    variant="bare"
                />
            </div>
        );
    }

    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-3">
            <div className="imcrm-flex imcrm-items-center imcrm-justify-between imcrm-text-xs imcrm-text-muted-foreground">
                <span>
                    {sprintf(
                        /* translators: %1$d total groups, %2$d total records */
                        __('%1$d grupos · %2$d registros'),
                        groups.data?.meta.total_groups ?? 0,
                        groups.data?.meta.total_records ?? 0,
                    )}
                </span>
            </div>

            {buckets.map((bucket) => {
                const key = bucketKey(bucket);
                const isOpen = expanded.has(key);
                return (
                    <GroupBucketSection
                        key={key}
                        listId={listId}
                        groupByField={groupByField}
                        bucket={bucket}
                        isOpen={isOpen}
                        onToggle={() => toggleGroup(key)}
                        columns={visibleColumns}
                        columnSizing={columnSizing ?? {}}
                        baseTree={filterTree}
                        search={search}
                        selectedIds={selectedIds}
                        onSelectionChange={onSelectionChange}
                        onRowClick={onRowClick}
                    />
                );
            })}
        </div>
    );
}

interface ColumnDef {
    id: string;
    label: string;
    field: FieldEntity | null;
    isPrimary: boolean;
}

/**
 * Aplica el `columnOrder` persistido (mismo formato que TanStack:
 * array de column ids) sobre un set de columnas. Las columnas no
 * incluidas en `order` quedan al final en su orden original — esto
 * cubre el caso "el user reordenó algunas pero no todas, después
 * agregó un campo nuevo, y queremos que el campo nuevo aparezca al
 * final sin romper el orden custom".
 */
function sortByOrder(columns: ColumnDef[], order: string[]): ColumnDef[] {
    if (order.length === 0) return columns;
    const byId = new Map(columns.map((c) => [c.id, c]));
    const seen = new Set<string>();
    const out: ColumnDef[] = [];
    for (const id of order) {
        const c = byId.get(id);
        if (c && ! seen.has(id)) {
            out.push(c);
            seen.add(id);
        }
    }
    for (const c of columns) {
        if (! seen.has(c.id)) out.push(c);
    }
    return out;
}

/**
 * Default si el user no ha resizeado todavía. Mismos valores que
 * `TableView.defaultSizeForType` para que el visual sea consistente
 * entre flat y grouped.
 */
function defaultSizeForColumn(c: ColumnDef): number {
    if (c.id === 'id') return 70;
    if (c.id === 'updated_at') return 170;
    const t = c.field?.type ?? 'text';
    switch (t) {
        case 'checkbox':     return 90;
        case 'number':
        case 'currency':     return 120;
        case 'date':         return 130;
        case 'datetime':     return 170;
        case 'select':       return 140;
        case 'multi_select': return 200;
        case 'email':
        case 'url':          return 220;
        case 'long_text':    return 280;
        default:             return 180;
    }
}

function buildColumns(fields: FieldEntity[]): ColumnDef[] {
    const dynamic = fields
        .filter((f) => f.type !== 'relation')
        .sort((a, b) => a.position - b.position)
        .map<ColumnDef>((f) => ({
            id: f.slug,
            label: f.label,
            field: f,
            isPrimary: f.is_primary,
        }));
    return [
        { id: 'id', label: __('ID'), field: null, isPrimary: false },
        ...dynamic,
        { id: 'updated_at', label: __('Actualizado'), field: null, isPrimary: false },
    ];
}

interface GroupBucketSectionProps {
    listId: number;
    groupByField: FieldEntity;
    bucket: RecordGroupBucket;
    isOpen: boolean;
    onToggle: () => void;
    columns: ColumnDef[];
    columnSizing: Record<string, number>;
    baseTree: FilterTree;
    search: string;
    selectedIds: number[];
    onSelectionChange: (ids: number[]) => void;
    onRowClick?: (record: RecordEntity) => void;
}

/**
 * Una sección por bucket: header siempre visible + tabla colapsable.
 * Cuando se expande dispara el fetch de los registros filtrados a
 * `value`. La paginación dentro del grupo está limitada a la primera
 * página (50 registros) — si el grupo es más grande aparece un "Ver
 * más" abajo. Suficiente para MVP; iteraremos.
 */
function GroupBucketSection({
    listId,
    groupByField,
    bucket,
    isOpen,
    onToggle,
    columns,
    columnSizing,
    baseTree,
    search,
    selectedIds,
    onSelectionChange,
    onRowClick,
}: GroupBucketSectionProps): JSX.Element {
    const [page, setPage] = useState(1);
    const perPage = 50;

    // Construimos la query del grupo: árbol base + condición del bucket
    // como hijo más del root. Si el árbol resultante es AND-plano usamos
    // el shortcut `filter[...]`; si tiene OR o nesting, mandamos el
    // árbol completo en `filter_tree`.
    const query: RecordsQuery = useMemo(() => {
        const op = filterOpForBucket(groupByField.type, bucket.value);
        const bucketCondition: FilterCondition = {
            type: 'condition',
            field_id: groupByField.id,
            op: op.op,
            value: op.value,
        };
        const merged: FilterTree = addNode(baseTree, [], bucketCondition);

        const q: RecordsQuery = { page, per_page: perPage };
        if (isFlatAndTree(merged)) {
            const filter: NonNullable<RecordsQuery['filter']> = {};
            for (const c of merged.children) {
                if (c.type !== 'condition') continue;
                const key = `field_${c.field_id}`;
                const existing = (filter[key] as Partial<Record<FilterOperator, unknown>> | undefined) ?? {};
                existing[c.op] = c.value;
                filter[key] = existing;
            }
            q.filter = filter;
        } else {
            q.filter_tree = JSON.stringify(merged);
        }
        if (search.trim() !== '') q.search = search.trim();
        return q;
    }, [baseTree, groupByField.id, groupByField.type, bucket.value, page, search]);

    const records = useRecords(isOpen ? listId : undefined, query);

    const colorAccent = bucket.value === null ? 'imcrm-bg-muted' : 'imcrm-bg-primary/10';
    const labelText = formatBucketLabel(groupByField, bucket.value);

    const allRecordsSelected =
        records.data?.data.every((r) => selectedIds.includes(r.id)) ?? false;
    const selectedSet = new Set(selectedIds);

    const toggleAllInGroup = (): void => {
        const ids = records.data?.data.map((r) => r.id) ?? [];
        if (allRecordsSelected) {
            onSelectionChange(selectedIds.filter((id) => !ids.includes(id)));
        } else {
            const next = new Set(selectedIds);
            ids.forEach((id) => next.add(id));
            onSelectionChange([...next]);
        }
    };

    const toggleOne = (id: number): void => {
        if (selectedSet.has(id)) {
            onSelectionChange(selectedIds.filter((x) => x !== id));
        } else {
            onSelectionChange([...selectedIds, id]);
        }
    };

    const total = records.data?.meta.total ?? 0;
    const hasMore = isOpen && total > page * perPage;

    return (
        <section
            className="imcrm-overflow-hidden imcrm-rounded-xl imcrm-border imcrm-border-border imcrm-bg-card imcrm-shadow-imcrm-sm"
            aria-expanded={isOpen}
        >
            <button
                type="button"
                onClick={onToggle}
                className="imcrm-flex imcrm-w-full imcrm-items-center imcrm-gap-3 imcrm-px-4 imcrm-py-3 imcrm-text-left imcrm-transition-colors hover:imcrm-bg-accent/40"
            >
                {isOpen ? (
                    <ChevronDown className="imcrm-h-4 imcrm-w-4 imcrm-text-muted-foreground" />
                ) : (
                    <ChevronRight className="imcrm-h-4 imcrm-w-4 imcrm-text-muted-foreground" />
                )}
                <span
                    className={cn(
                        'imcrm-rounded-md imcrm-px-2.5 imcrm-py-1 imcrm-text-xs imcrm-font-semibold',
                        colorAccent,
                    )}
                >
                    {labelText}
                </span>
                <span className="imcrm-text-xs imcrm-text-muted-foreground">
                    {sprintf(
                        /* translators: %d count */
                        __('%d registros'),
                        bucket.count,
                    )}
                </span>
            </button>

            {isOpen && (
                <div className="imcrm-border-t imcrm-border-border imcrm-overflow-x-auto">
                    {records.isLoading ? (
                        <div className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-px-4 imcrm-py-4 imcrm-text-sm imcrm-text-muted-foreground">
                            <Loader2 className="imcrm-h-4 imcrm-w-4 imcrm-animate-spin" />
                            {__('Cargando…')}
                        </div>
                    ) : records.isError ? (
                        <p className="imcrm-px-4 imcrm-py-3 imcrm-text-sm imcrm-text-destructive">
                            {(records.error as Error).message}
                        </p>
                    ) : (
                        <table className="imcrm-w-full imcrm-text-sm" aria-label={labelText}>
                            <thead className="imcrm-bg-muted/30">
                                <tr className="imcrm-border-b imcrm-border-border">
                                    <th scope="col" className="imcrm-w-10 imcrm-px-3 imcrm-py-2.5">
                                        <input
                                            type="checkbox"
                                            checked={allRecordsSelected}
                                            onChange={toggleAllInGroup}
                                            aria-label={__('Seleccionar todos en grupo')}
                                        />
                                    </th>
                                    {columns.map((c) => {
                                        const w = columnSizing[c.id] ?? defaultSizeForColumn(c);
                                        return (
                                            <th
                                                key={c.id}
                                                scope="col"
                                                style={{ width: w, minWidth: w }}
                                                className="imcrm-whitespace-nowrap imcrm-px-3 imcrm-py-2.5 imcrm-text-left imcrm-text-[11px] imcrm-font-semibold imcrm-text-muted-foreground imcrm-uppercase imcrm-tracking-[0.06em]"
                                            >
                                                <span className="imcrm-flex imcrm-items-center imcrm-gap-1.5">
                                                    {c.isPrimary && (
                                                        <KeyRound
                                                            className="imcrm-h-3 imcrm-w-3 imcrm-text-primary"
                                                            aria-hidden="true"
                                                        />
                                                    )}
                                                    {c.label}
                                                </span>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {(records.data?.data ?? []).map((record) => {
                                    const isSelected = selectedSet.has(record.id);
                                    return (
                                        <tr
                                            key={record.id}
                                            className={cn(
                                                'imcrm-border-t imcrm-border-border/50 imcrm-transition-colors imcrm-duration-100',
                                                isSelected
                                                    ? 'imcrm-bg-primary/5'
                                                    : 'hover:imcrm-bg-accent/40',
                                            )}
                                        >
                                            <td
                                                className="imcrm-w-10 imcrm-px-3 imcrm-py-2.5 imcrm-align-middle"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleOne(record.id)}
                                                    aria-label={sprintf(
                                                        /* translators: %d id */
                                                        __('Seleccionar registro %d'),
                                                        record.id,
                                                    )}
                                                />
                                            </td>
                                            {columns.map((c, ci) => {
                                                const w = columnSizing[c.id] ?? defaultSizeForColumn(c);
                                                return (
                                                    <td
                                                        key={c.id}
                                                        style={{ width: w, maxWidth: w }}
                                                        className={cn(
                                                            'imcrm-overflow-hidden imcrm-px-3 imcrm-py-2.5 imcrm-align-middle',
                                                            ci === 0 &&
                                                                onRowClick &&
                                                                'imcrm-cursor-pointer imcrm-font-medium',
                                                        )}
                                                        onClick={
                                                            ci === 0 && onRowClick
                                                                ? () => onRowClick(record)
                                                                : undefined
                                                        }
                                                    >
                                                        {renderColumnCell(c, record, listId)}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}

                    {hasMore && (
                        <div className="imcrm-flex imcrm-items-center imcrm-justify-center imcrm-border-t imcrm-border-border imcrm-px-4 imcrm-py-2">
                            <button
                                type="button"
                                onClick={() => setPage((p) => p + 1)}
                                className="imcrm-text-xs imcrm-font-medium imcrm-text-primary hover:imcrm-underline"
                            >
                                {__('Cargar siguiente página')}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}

function renderColumnCell(
    column: ColumnDef,
    record: RecordEntity,
    listId: number,
): JSX.Element | null {
    if (column.id === 'id') {
        return (
            <span className="imcrm-font-mono imcrm-text-xs imcrm-text-muted-foreground">
                #{record.id}
            </span>
        );
    }
    if (column.id === 'updated_at') {
        if (!record.updated_at) return null;
        const d = new Date(record.updated_at + 'Z');
        return (
            <span className="imcrm-text-xs imcrm-text-muted-foreground">
                {d.toLocaleString()}
            </span>
        );
    }
    if (column.field === null) {
        return null;
    }
    return (
        <EditableCell
            listId={listId}
            recordId={record.id}
            field={column.field}
            value={record.fields[column.field.slug]}
        />
    );
}

function bucketKey(bucket: RecordGroupBucket): string {
    return bucket.value === null ? '__null__' : `v:${bucket.value}`;
}

/**
 * Para reportar correctamente el filtro al backend cuando el usuario
 * expande un bucket: `multi_select` necesita `contains` (la columna es
 * un JSON array y `eq` nunca matchearía un valor individual). Los demás
 * tipos van con `eq`. Un bucket con `value=null` se traduce a
 * `is_null`.
 */
function filterOpForBucket(
    type: string,
    value: string | null,
): { op: FilterOperator; value: unknown } {
    if (value === null) {
        return { op: 'is_null', value: true };
    }
    if (type === 'multi_select') {
        return { op: 'contains', value };
    }
    return { op: 'eq', value };
}

/**
 * Convierte el árbol al shortcut plano `filter[...]` cuando es
 * AND-plano. Devuelve `undefined` si está vacío o tiene OR/nesting
 * (en ese caso el caller manda `filter_tree` JSON aparte).
 */
function buildFilterParam(tree: FilterTree): RecordsQuery['filter'] | undefined {
    if (tree.children.length === 0) return undefined;
    if (!isFlatAndTree(tree)) return undefined;
    const out: NonNullable<RecordsQuery['filter']> = {};
    for (const c of tree.children) {
        if (c.type !== 'condition') continue;
        const key = `field_${c.field_id}`;
        const existing = (out[key] as Partial<Record<FilterOperator, unknown>> | undefined) ?? {};
        existing[c.op] = c.value;
        out[key] = existing;
    }
    return out;
}

/**
 * Etiqueta visible del bucket. Para `user` resolvería el display name
 * idealmente, pero aún no tenemos hook de users — mostramos el id por
 * ahora. Iteraremos.
 */
function formatBucketLabel(field: FieldEntity, value: string | null): string {
    if (value === null) return __('(Sin valor)');
    if (field.type === 'checkbox') {
        return value === '1' || value === 'true' ? __('Sí') : __('No');
    }
    if (field.type === 'select' || field.type === 'multi_select') {
        // Buscar label en field.config.options
        const options = (field.config as { options?: Array<{ value: string; label: string }> })
            .options;
        if (Array.isArray(options)) {
            const match = options.find((o) => o.value === value);
            if (match) return match.label;
        }
        return value;
    }
    if (field.type === 'date' || field.type === 'datetime') {
        const d = new Date(field.type === 'date' ? value : value + 'Z');
        if (!Number.isNaN(d.getTime())) return d.toLocaleDateString();
        return value;
    }
    return value;
}

export { renderCellValue };
