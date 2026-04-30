import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type {
    RecordEntity,
    RecordGroupsResponse,
    RecordListResponse,
    RecordsQuery,
} from '@/types/record';

interface GroupsKeyParams {
    groupBy: number;
    filter?: RecordsQuery['filter'];
    filterTree?: unknown;
    search?: string;
}

export const recordsKeys = {
    all: ['records'] as const,
    forList: (listId: string | number) => [...recordsKeys.all, String(listId)] as const,
    list: (listId: string | number, query: RecordsQuery) =>
        [...recordsKeys.forList(listId), 'list', query] as const,
    item: (listId: string | number, recordId: number) =>
        [...recordsKeys.forList(listId), 'item', recordId] as const,
    groups: (listId: string | number, params: GroupsKeyParams) =>
        [...recordsKeys.forList(listId), 'groups', params] as const,
    groupedBundle: (listId: string | number, params: Record<string, unknown>) =>
        [...recordsKeys.forList(listId), 'grouped-bundle', params] as const,
};

/**
 * Bundle endpoint para vista agrupada: una sola request retorna
 * (buckets + counts) + (records de cada bucket expandido) +
 * (aggregates de cada bucket expandido). Reemplaza el patrón de
 * 1 + N + N requests que tenía GroupedTableView.
 */
interface GroupedBundleResponse {
    buckets: Array<{ value: string | null; count: number }>;
    meta: {
        group_by_field_id: number;
        group_by_slug: string;
        group_by_type: string;
        total_groups: number;
        total_records: number;
    };
    expanded: Record<string, {
        records: { data: RecordEntity[]; meta: Record<string, unknown> };
        aggregates?: Record<string, unknown>;
    }>;
}

interface UseGroupedBundleArgs {
    listId: string | number | undefined;
    groupBy: number | undefined;
    expanded: string[];
    filterTree?: unknown;
    search?: string;
    perPage?: number;
    aggregateFieldIds?: number[];
}

export function useRecordsGroupedBundle({
    listId,
    groupBy,
    expanded,
    filterTree,
    search,
    perPage = 50,
    aggregateFieldIds = [],
}: UseGroupedBundleArgs) {
    const params: Record<string, unknown> = {
        group_by: groupBy,
        per_page: perPage,
    };
    // Stable order in expanded → stable key (avoid useless refetch
    // cuando el user toggles otro bucket en otro orden).
    const sortedExpanded = [...expanded].sort();
    if (sortedExpanded.length > 0) {
        params.expanded = sortedExpanded;
    }
    if (filterTree) {
        params.filter_tree = JSON.stringify(filterTree);
    }
    if (search && search.trim() !== '') {
        params.search = search.trim();
    }
    if (aggregateFieldIds.length > 0) {
        params.aggregate_fields = aggregateFieldIds.join(',');
    }

    return useQuery({
        queryKey: recordsKeys.groupedBundle(listId ?? '', params),
        queryFn: async () => {
            const res = await api.get<GroupedBundleResponse>(
                `/lists/${listId}/records/grouped-bundle`,
                { query: params },
            );
            return res.data;
        },
        enabled: listId !== undefined && listId !== '' && groupBy !== undefined && groupBy > 0,
        placeholderData: keepPreviousData,
    });
}

export function useRecords(listId: string | number | undefined, query: RecordsQuery) {
    const qc = useQueryClient();
    const result = useQuery({
        queryKey: recordsKeys.list(listId ?? '', query),
        queryFn: async () => {
            const res = await api.get<RecordEntity[]>(`/lists/${listId}/records`, {
                query: query as Record<string, unknown>,
            });
            // El endpoint devuelve { data, meta } sin envolver en .data extra.
            return { data: res.data, meta: res.meta } as unknown as RecordListResponse;
        },
        enabled: listId !== undefined && listId !== '',
        placeholderData: keepPreviousData,
    });

    // Prefetch de la siguiente página: cuando recibimos data de la
    // página actual y todavía hay más, pre-disparamos el fetch de
    // page+1 en background. React Query lo cachea por queryKey
    // distinto, así que cuando el user scrollea o avanza de página,
    // los datos ya están listos. Cero pausa visible.
    //
    // Solo aplica cuando hay paginación activa y `next_cursor` o
    // page < total_pages. Sin filtros pesados ni fetch extra inútil
    // — `staleTime` de React Query lo coloca en cache aunque no se
    // use.
    const meta = result.data?.meta;
    if (
        listId !== undefined && listId !== '' &&
        meta !== undefined &&
        result.isSuccess
    ) {
        const currentPage = (query.page as number | undefined) ?? 1;
        const totalPages = (meta as { total_pages?: number }).total_pages ?? 1;
        if (currentPage < totalPages) {
            const nextQuery: RecordsQuery = { ...query, page: currentPage + 1 };
            // prefetchQuery es idempotente — si la key ya está
            // cacheada, no re-fetcha.
            void qc.prefetchQuery({
                queryKey: recordsKeys.list(listId, nextQuery),
                queryFn: async () => {
                    const res = await api.get<RecordEntity[]>(`/lists/${listId}/records`, {
                        query: nextQuery as Record<string, unknown>,
                    });
                    return { data: res.data, meta: res.meta } as unknown as RecordListResponse;
                },
            });
        }
    }

    return result;
}

/**
 * Trae los buckets agrupados (count por valor) para alimentar la
 * vista de tabla con grouping estilo ClickUp/Airtable. La expansión
 * lazy de cada bucket reutiliza `useRecords` con un filtro extra.
 *
 * Cuando `groupBy` es null, la query queda disabled — el frontend
 * vuelve a la vista plana.
 */
export function useRecordGroups(
    listId: string | number | undefined,
    params: {
        groupBy: number | null;
        filter?: RecordsQuery['filter'];
        filterTree?: unknown;
        search?: string;
    },
) {
    const enabled =
        listId !== undefined && listId !== '' && params.groupBy !== null && params.groupBy > 0;

    return useQuery({
        queryKey: recordsKeys.groups(listId ?? '', {
            groupBy: params.groupBy ?? 0,
            filter: params.filter,
            filterTree: params.filterTree,
            search: params.search,
        }),
        queryFn: async () => {
            const query: Record<string, unknown> = { group_by: params.groupBy };
            if (params.filter !== undefined) query.filter = params.filter;
            if (params.filterTree !== undefined) {
                query.filter_tree = JSON.stringify(params.filterTree);
            }
            if (params.search !== undefined && params.search !== '') query.search = params.search;
            const res = await api.get(`/lists/${listId}/records/groups`, { query });
            return res as unknown as RecordGroupsResponse;
        },
        enabled,
        placeholderData: keepPreviousData,
    });
}

/**
 * Trae un record individual por id. Útil para la página de Card
 * (ruta /lists/:slug/records/:id) — el drawer puede operar contra
 * la cache de la list query, pero la card abierta directo necesita
 * fetch propio.
 */
export function useRecord(listId: string | number | undefined, recordId: number | undefined) {
    return useQuery({
        queryKey: recordsKeys.item(listId ?? '', recordId ?? 0),
        queryFn: async () => {
            const res = await api.get<RecordEntity>(`/lists/${listId}/records/${recordId}`);
            return res.data;
        },
        enabled:
            listId !== undefined && listId !== '' && recordId !== undefined && recordId > 0,
    });
}

export function useCreateRecord(listId: string | number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (values: Record<string, unknown>) => {
            const res = await api.post<RecordEntity>(`/lists/${listId}/records`, { fields: values });
            return res.data;
        },
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: recordsKeys.forList(listId) });
        },
    });
}

interface UpdateRecordVars {
    id: number;
    values: Record<string, unknown>;
}

interface UpdateRecordContext {
    snapshots: Array<[readonly unknown[], unknown]>;
}

/**
 * Mutación con optimistic update. Recorremos todas las queries de records
 * para esta lista y mutamos en caché las filas que coincidan con el id —
 * así la celda editada se actualiza al instante. Si el server falla,
 * restauramos el snapshot.
 */
export function useUpdateRecord(listId: string | number) {
    const qc = useQueryClient();
    return useMutation<RecordEntity, Error, UpdateRecordVars, UpdateRecordContext>({
        mutationFn: async ({ id, values }) => {
            const res = await api.patch<RecordEntity>(`/lists/${listId}/records/${id}`, {
                fields: values,
            });
            return res.data;
        },
        onMutate: async ({ id, values }) => {
            await qc.cancelQueries({ queryKey: recordsKeys.forList(listId) });

            const queries = qc.getQueriesData<RecordListResponse>({
                queryKey: recordsKeys.forList(listId),
            });
            const snapshots: Array<[readonly unknown[], unknown]> = [];

            for (const [key, data] of queries) {
                if (!data || !Array.isArray(data.data)) continue;
                snapshots.push([key, data]);

                const next: RecordListResponse = {
                    ...data,
                    data: data.data.map((rec) =>
                        rec.id === id
                            ? { ...rec, fields: { ...rec.fields, ...values } }
                            : rec,
                    ),
                };
                qc.setQueryData(key, next);
            }

            return { snapshots };
        },
        onError: (_err, _vars, ctx) => {
            if (!ctx) return;
            for (const [key, snap] of ctx.snapshots) {
                qc.setQueryData(key, snap);
            }
        },
        onSettled: () => {
            void qc.invalidateQueries({ queryKey: recordsKeys.forList(listId) });
        },
    });
}

export function useDeleteRecord(listId: string | number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, purge }: { id: number; purge?: boolean }) => {
            await api.delete(`/lists/${listId}/records/${id}`, {
                query: { purge: purge ?? false },
            });
        },
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: recordsKeys.forList(listId) });
        },
    });
}

interface BulkResponse {
    succeeded: number[];
    failed: Array<{ id: number; message: string }>;
}

interface BulkVars {
    action: 'delete' | 'update';
    ids: number[];
    values?: Record<string, unknown>;
}

export function useBulkRecords(listId: string | number) {
    const qc = useQueryClient();
    return useMutation<BulkResponse, Error, BulkVars>({
        mutationFn: async ({ action, ids, values }) => {
            const res = await api.post<BulkResponse>(`/lists/${listId}/records/bulk`, {
                action,
                ids,
                values: values ?? {},
            });
            return res.data;
        },
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: recordsKeys.forList(listId) });
        },
    });
}
