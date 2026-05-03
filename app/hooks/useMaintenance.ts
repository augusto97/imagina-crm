import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';

/**
 * Hooks de admin para Tier 3 (search engine + composite indexes +
 * purge). Consumen los endpoints de `SearchAdminController.php`.
 */

export interface SearchStatus {
    enabled: boolean;
    doc_count: number;
}

export interface IndexSuggestion {
    columns: string[];
    index_name: string;
    reason: string;
    uses: number;
    ddl: string;
    already_exists: boolean;
}

const searchStatusKey = (listId: number | string) => ['search-status', String(listId)] as const;
const indexSuggestionsKey = (listId: number | string) =>
    ['index-suggestions', String(listId)] as const;

export function useSearchStatus(listId: number | string | undefined) {
    return useQuery({
        queryKey: searchStatusKey(listId ?? ''),
        queryFn: async () => {
            const res = await api.get<SearchStatus>(`/lists/${listId}/search/status`);
            return res.data;
        },
        enabled: listId !== undefined && listId !== '',
        // Polling suave mientras hay re-index activo: si doc_count crece
        // entre fetches, el user ve el progreso sin recargar la página.
        refetchInterval: (query) => {
            const data = query.state.data as SearchStatus | undefined;
            return data?.enabled ? 5000 : false;
        },
    });
}

export function useEnableSearch(listId: number | string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            const res = await api.post<{ enabled: boolean; reindex_scheduled: boolean }>(
                `/lists/${listId}/search/enable`,
            );
            return res.data;
        },
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: searchStatusKey(listId) });
        },
    });
}

export function useDisableSearch(listId: number | string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            const res = await api.post<{ enabled: boolean }>(`/lists/${listId}/search/disable`);
            return res.data;
        },
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: searchStatusKey(listId) });
        },
    });
}

export function useReindexSearch(listId: number | string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            const res = await api.post<{ reindex_scheduled: boolean }>(
                `/lists/${listId}/search/reindex`,
            );
            return res.data;
        },
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: searchStatusKey(listId) });
        },
    });
}

export function useIndexSuggestions(listId: number | string | undefined) {
    return useQuery({
        queryKey: indexSuggestionsKey(listId ?? ''),
        queryFn: async () => {
            const res = await api.get<IndexSuggestion[]>(`/lists/${listId}/indexes/suggest`);
            return res.data;
        },
        enabled: listId !== undefined && listId !== '',
    });
}

export function useApplyIndex(listId: number | string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ columns, indexName }: { columns: string[]; indexName: string }) => {
            const res = await api.post<{ applied: boolean; index_name: string }>(
                `/lists/${listId}/indexes/apply`,
                { columns, index_name: indexName },
            );
            return res.data;
        },
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: indexSuggestionsKey(listId) });
        },
    });
}

export function useDropIndex(listId: number | string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (indexName: string) => {
            const res = await api.post<{ dropped: boolean }>(
                `/lists/${listId}/indexes/drop`,
                { index_name: indexName },
            );
            return res.data;
        },
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: indexSuggestionsKey(listId) });
        },
    });
}

export function useRunPurge() {
    return useMutation({
        mutationFn: async () => {
            const res = await api.post<{ rows_deleted: number }>(`/system/maintenance/purge`);
            return res.data;
        },
    });
}
