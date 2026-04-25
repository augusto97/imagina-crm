import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { CreateFieldInput, FieldEntity, UpdateFieldInput } from '@/types/field';

export const fieldsKeys = {
    all: ['fields'] as const,
    forList: (listId: string | number) => [...fieldsKeys.all, 'list', String(listId)] as const,
};

export function useFields(listId: string | number | undefined) {
    return useQuery({
        queryKey: fieldsKeys.forList(listId ?? ''),
        queryFn: async () => {
            const res = await api.get<FieldEntity[]>(`/lists/${listId}/fields`);
            return res.data;
        },
        enabled: listId !== undefined && listId !== '',
    });
}

export function useCreateField(listId: string | number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (input: CreateFieldInput) => {
            const res = await api.post<FieldEntity>(`/lists/${listId}/fields`, input);
            return res.data;
        },
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: fieldsKeys.forList(listId) });
        },
    });
}

export function useUpdateField(listId: string | number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, input }: { id: number | string; input: UpdateFieldInput }) => {
            const res = await api.patch<FieldEntity>(`/lists/${listId}/fields/${id}`, input);
            return res.data;
        },
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: fieldsKeys.forList(listId) });
        },
    });
}

export function useDeleteField(listId: string | number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, purge }: { id: number | string; purge?: boolean }) => {
            await api.delete(`/lists/${listId}/fields/${id}`, {
                query: { purge: purge ?? false },
            });
        },
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: fieldsKeys.forList(listId) });
        },
    });
}

export function useReorderFields(listId: string | number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (order: Array<{ id: number; position: number }>) => {
            await api.post(`/lists/${listId}/fields/reorder`, { order });
        },
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: fieldsKeys.forList(listId) });
        },
    });
}
