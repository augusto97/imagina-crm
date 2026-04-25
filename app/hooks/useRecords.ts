import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { RecordEntity, RecordListResponse, RecordsQuery } from '@/types/record';

export const recordsKeys = {
    all: ['records'] as const,
    list: (listId: string | number, query: RecordsQuery) =>
        [...recordsKeys.all, String(listId), query] as const,
    item: (listId: string | number, recordId: number) =>
        [...recordsKeys.all, String(listId), 'item', recordId] as const,
};

export function useRecords(listId: string | number | undefined, query: RecordsQuery) {
    return useQuery({
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
}

export function useCreateRecord(listId: string | number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (values: Record<string, unknown>) => {
            const res = await api.post<RecordEntity>(`/lists/${listId}/records`, { fields: values });
            return res.data;
        },
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: [...recordsKeys.all, String(listId)] });
        },
    });
}

export function useUpdateRecord(listId: string | number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, values }: { id: number; values: Record<string, unknown> }) => {
            const res = await api.patch<RecordEntity>(`/lists/${listId}/records/${id}`, {
                fields: values,
            });
            return res.data;
        },
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: [...recordsKeys.all, String(listId)] });
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
            void qc.invalidateQueries({ queryKey: [...recordsKeys.all, String(listId)] });
        },
    });
}
