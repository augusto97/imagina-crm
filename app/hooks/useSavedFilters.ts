import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { FilterTree } from '@/types/record';

export interface SavedFilter {
    id: number;
    list_id: number;
    user_id: number | null;
    name: string;
    filter_tree: FilterTree;
    created_at: string;
    updated_at: string;
}

const keys = {
    forList: (listId: number) => ['saved-filters', listId] as const,
};

export function useSavedFilters(listId: number) {
    return useQuery({
        queryKey: keys.forList(listId),
        queryFn: async () => {
            const res = await api.get<SavedFilter[]>(`/lists/${listId}/saved-filters`);
            return res.data;
        },
        enabled: listId > 0,
    });
}

interface SaveVars {
    name: string;
    scope: 'personal' | 'shared';
    filter_tree: FilterTree;
}

export function useSaveFilter(listId: number) {
    const qc = useQueryClient();
    return useMutation<SavedFilter, Error, SaveVars>({
        mutationFn: async (vars) => {
            const res = await api.post<SavedFilter>(`/lists/${listId}/saved-filters`, vars);
            return res.data;
        },
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: keys.forList(listId) });
        },
    });
}

export function useDeleteSavedFilter(listId: number) {
    const qc = useQueryClient();
    return useMutation<void, Error, number>({
        mutationFn: async (id) => {
            await api.delete(`/lists/${listId}/saved-filters/${id}`);
        },
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: keys.forList(listId) });
        },
    });
}
