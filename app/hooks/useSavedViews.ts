import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { SavedViewConfig, SavedViewEntity, SavedViewType } from '@/types/view';

export const viewsKeys = {
    all: ['views'] as const,
    forList: (listId: string | number) => [...viewsKeys.all, String(listId)] as const,
};

export function useSavedViews(listId: string | number | undefined) {
    return useQuery({
        queryKey: viewsKeys.forList(listId ?? ''),
        queryFn: async () => {
            const res = await api.get<SavedViewEntity[]>(`/lists/${listId}/views`);
            return res.data;
        },
        enabled: listId !== undefined && listId !== '',
        // Vistas guardadas rara vez cambian en una sesión. (Fase 16.D)
        staleTime: 60_000,
    });
}

interface CreateViewVars {
    name: string;
    type?: SavedViewType;
    config: SavedViewConfig;
    is_default?: boolean;
}

export function useCreateSavedView(listId: string | number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (input: CreateViewVars) => {
            const res = await api.post<SavedViewEntity>(`/lists/${listId}/views`, input);
            return res.data;
        },
        onSuccess: () => {
            // Invalidamos TODAS las queries de views — no podemos filtrar
            // por listId porque las queries activas usan `slug` y este
            // hook recibe `id` numérico (mismo bug que useUpdateRecord,
            // arreglado en 0.57.31).
            void qc.invalidateQueries({ queryKey: viewsKeys.all });
        },
    });
}

interface UpdateViewVars {
    id: number;
    name?: string;
    config?: SavedViewConfig;
    is_default?: boolean;
}

export function useUpdateSavedView(listId: string | number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, ...patch }: UpdateViewVars) => {
            const res = await api.patch<SavedViewEntity>(`/lists/${listId}/views/${id}`, patch);
            return res.data;
        },
        onSuccess: () => {
            // Invalidamos TODAS las queries de views — no podemos filtrar
            // por listId porque las queries activas usan `slug` y este
            // hook recibe `id` numérico (mismo bug que useUpdateRecord,
            // arreglado en 0.57.31).
            void qc.invalidateQueries({ queryKey: viewsKeys.all });
        },
    });
}

export function useDeleteSavedView(listId: string | number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (id: number) => {
            await api.delete(`/lists/${listId}/views/${id}`);
        },
        onSuccess: () => {
            // Invalidamos TODAS las queries de views — no podemos filtrar
            // por listId porque las queries activas usan `slug` y este
            // hook recibe `id` numérico (mismo bug que useUpdateRecord,
            // arreglado en 0.57.31).
            void qc.invalidateQueries({ queryKey: viewsKeys.all });
        },
    });
}
