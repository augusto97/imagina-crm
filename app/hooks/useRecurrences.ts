import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { Recurrence, RecurrenceUpsertInput } from '@/types/recurrence';

const keys = {
    forRecord: (listId: number, recordId: number) =>
        ['recurrences', listId, recordId] as const,
};

export function useRecurrences(listId: number | undefined, recordId: number | undefined) {
    return useQuery({
        queryKey: keys.forRecord(listId ?? 0, recordId ?? 0),
        queryFn: async () => {
            const res = await api.get<Recurrence[]>(
                `/lists/${listId}/records/${recordId}/recurrences`,
            );
            return res.data;
        },
        enabled: listId !== undefined && listId > 0 && recordId !== undefined && recordId > 0,
    });
}

export function useUpsertRecurrence(listId: number, recordId: number) {
    const qc = useQueryClient();
    return useMutation<Recurrence, Error, RecurrenceUpsertInput>({
        mutationFn: async (input) => {
            const res = await api.post<Recurrence>(
                `/lists/${listId}/records/${recordId}/recurrences`,
                input,
            );
            return res.data;
        },
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: keys.forRecord(listId, recordId) });
        },
    });
}

export function useDeleteRecurrence(listId: number, recordId: number) {
    const qc = useQueryClient();
    return useMutation<void, Error, number>({
        mutationFn: async (id) => {
            await api.delete(
                `/lists/${listId}/records/${recordId}/recurrences/${id}`,
            );
        },
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: keys.forRecord(listId, recordId) });
        },
    });
}
