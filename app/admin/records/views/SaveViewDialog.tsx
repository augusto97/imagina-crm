import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateSavedView } from '@/hooks/useSavedViews';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { SavedViewConfig, SavedViewEntity } from '@/types/view';

interface SaveViewDialogProps {
    listId: number;
    config: SavedViewConfig;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated?: (view: SavedViewEntity) => void;
}

/**
 * Dialog que captura el `config` actual (filters/sort/search) y lo
 * persiste como una nueva vista guardada. Es la UX detrás del botón "+"
 * en `ViewsTabs`.
 */
export function SaveViewDialog({
    listId,
    config,
    open,
    onOpenChange,
    onCreated,
}: SaveViewDialogProps): JSX.Element {
    const create = useCreateSavedView(listId);
    const [name, setName] = useState('');
    const [setDefault, setSetDefault] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) {
            setName('');
            setSetDefault(false);
            setError(null);
            create.reset();
        }
    }, [open, create]);

    const handleSubmit = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        setError(null);
        try {
            const view = await create.mutateAsync({
                name: name.trim(),
                type: 'table',
                config,
                is_default: setDefault,
            });
            onCreated?.(view);
            onOpenChange(false);
        } catch (err) {
            setError(err instanceof ApiError || err instanceof Error ? err.message : 'Error');
        }
    };

    const summary = describeConfig(config);

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay
                    className={cn(
                        'imcrm-fixed imcrm-inset-0 imcrm-z-50 imcrm-bg-black/40 imcrm-backdrop-blur-sm',
                    )}
                />
                <Dialog.Content
                    className={cn(
                        'imcrm-fixed imcrm-left-1/2 imcrm-top-1/2 imcrm-z-50 imcrm-w-full imcrm-max-w-md',
                        'imcrm--translate-x-1/2 imcrm--translate-y-1/2',
                        'imcrm-rounded-lg imcrm-border imcrm-border-border imcrm-bg-card imcrm-p-6 imcrm-shadow-imcrm-lg',
                    )}
                >
                    <div className="imcrm-flex imcrm-items-start imcrm-justify-between imcrm-gap-2">
                        <div>
                            <Dialog.Title className="imcrm-text-base imcrm-font-semibold">
                                Guardar como vista
                            </Dialog.Title>
                            <Dialog.Description className="imcrm-text-sm imcrm-text-muted-foreground">
                                Captura los filtros, sort y búsqueda actuales en una vista nombrada.
                            </Dialog.Description>
                        </div>
                        <Dialog.Close asChild>
                            <Button variant="ghost" size="icon" aria-label="Cerrar">
                                <X className="imcrm-h-4 imcrm-w-4" />
                            </Button>
                        </Dialog.Close>
                    </div>

                    <form onSubmit={handleSubmit} className="imcrm-mt-4 imcrm-flex imcrm-flex-col imcrm-gap-4">
                        <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                            <Label htmlFor="view-name">Nombre</Label>
                            <Input
                                id="view-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Ej. Vencidos esta semana"
                                autoFocus
                            />
                        </div>

                        <label className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-text-sm">
                            <input
                                type="checkbox"
                                checked={setDefault}
                                onChange={(e) => setSetDefault(e.target.checked)}
                            />
                            Establecer como vista por defecto
                        </label>

                        <div className="imcrm-rounded-md imcrm-border imcrm-border-dashed imcrm-border-border imcrm-bg-muted/30 imcrm-px-3 imcrm-py-2 imcrm-text-xs imcrm-text-muted-foreground">
                            <span className="imcrm-font-medium imcrm-text-foreground">
                                Se guardará:
                            </span>{' '}
                            {summary}
                        </div>

                        {error !== null && (
                            <div className="imcrm-rounded-md imcrm-border imcrm-border-destructive/40 imcrm-bg-destructive/10 imcrm-p-3 imcrm-text-sm imcrm-text-destructive">
                                {error}
                            </div>
                        )}

                        <div className="imcrm-flex imcrm-justify-end imcrm-gap-2">
                            <Dialog.Close asChild>
                                <Button type="button" variant="outline">
                                    Cancelar
                                </Button>
                            </Dialog.Close>
                            <Button type="submit" disabled={name.trim() === '' || create.isPending}>
                                {create.isPending ? 'Guardando…' : 'Guardar vista'}
                            </Button>
                        </div>
                    </form>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

function describeConfig(config: SavedViewConfig): string {
    const parts: string[] = [];
    if (config.filters && config.filters.length > 0) {
        parts.push(`${config.filters.length} filtro${config.filters.length === 1 ? '' : 's'}`);
    }
    if (config.sort && config.sort.length > 0) {
        parts.push(`${config.sort.length} columna${config.sort.length === 1 ? '' : 's'} ordenadas`);
    }
    if (config.search && config.search.trim() !== '') {
        parts.push(`búsqueda "${config.search}"`);
    }
    if (parts.length === 0) return 'sin configuración (vista vacía).';
    return parts.join(', ') + '.';
}
