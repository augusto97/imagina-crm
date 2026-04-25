import { Trash2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useBulkRecords } from '@/hooks/useRecords';
import { __, _n, sprintf } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface BulkActionsToolbarProps {
    listId: number;
    selectedIds: number[];
    onClear: () => void;
}

/**
 * Barra contextual que aparece cuando hay registros seleccionados.
 * Muestra el conteo, acciones bulk (delete por ahora) y botón de
 * limpiar selección.
 */
export function BulkActionsToolbar({
    listId,
    selectedIds,
    onClear,
}: BulkActionsToolbarProps): JSX.Element | null {
    const bulk = useBulkRecords(listId);

    if (selectedIds.length === 0) return null;

    const handleDelete = async (): Promise<void> => {
        const ok = confirm(
            sprintf(
                /* translators: %d: number of selected records */
                _n(
                    'Eliminar %d registro? Los datos se preservan (soft delete).',
                    'Eliminar %d registros? Los datos se preservan (soft delete).',
                    selectedIds.length,
                ),
                selectedIds.length,
            ),
        );
        if (!ok) return;
        const result = await bulk.mutateAsync({ action: 'delete', ids: selectedIds });
        onClear();
        if (result.failed.length > 0) {
            // Reportar los fallidos. UX simple por ahora — un toast llegaría en
            // el commit de notificaciones.
            alert(
                sprintf(
                    /* translators: %d: number of records successfully deleted */
                    __('Se eliminaron %d registros.'),
                    result.succeeded.length,
                ) +
                    '\n' +
                    sprintf(
                        /* translators: %d: number of records that failed to delete */
                        __('Fallaron %d:'),
                        result.failed.length,
                    ) +
                    '\n' +
                    result.failed
                        .map((f) =>
                            sprintf(
                                /* translators: 1: record id, 2: error message */
                                __('  #%1$d: %2$s'),
                                f.id,
                                f.message,
                            ),
                        )
                        .join('\n'),
            );
        }
    };

    return (
        <div
            className={cn(
                'imcrm-sticky imcrm-bottom-0 imcrm-z-10 imcrm-flex imcrm-items-center imcrm-justify-between imcrm-gap-3',
                'imcrm-rounded-lg imcrm-border imcrm-border-border imcrm-bg-card imcrm-px-4 imcrm-py-2 imcrm-shadow-imcrm-md',
            )}
        >
            <div className="imcrm-flex imcrm-items-center imcrm-gap-3">
                <span className="imcrm-text-sm imcrm-font-medium">
                    {sprintf(
                        /* translators: %d: number of selected records */
                        _n('%d seleccionado', '%d seleccionados', selectedIds.length),
                        selectedIds.length,
                    )}
                </span>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClear}
                    className="imcrm-gap-1 imcrm-text-muted-foreground"
                >
                    <X className="imcrm-h-3.5 imcrm-w-3.5" />
                    {__('Limpiar selección')}
                </Button>
            </div>
            <div className="imcrm-flex imcrm-items-center imcrm-gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDelete}
                    disabled={bulk.isPending}
                    className="imcrm-gap-1.5 imcrm-text-destructive hover:imcrm-text-destructive"
                >
                    <Trash2 className="imcrm-h-3.5 imcrm-w-3.5" />
                    {bulk.isPending ? __('Eliminando…') : __('Eliminar')}
                </Button>
            </div>
        </div>
    );
}
