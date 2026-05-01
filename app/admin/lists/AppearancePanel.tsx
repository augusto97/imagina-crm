import { LayoutDashboard, Loader2, UserSquare2 } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { useUpdateList } from '@/hooks/useLists';
import { __ } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { ListSummary } from '@/types/list';

interface AppearancePanelProps {
    list: ListSummary;
}

type RecordLayout = 'classic' | 'crm';

/**
 * Panel "Apariencia": elige cómo se renderea la página individual
 * de cada registro de esta lista. Persiste en
 * `list.settings.record_layout`.
 *
 *  - **Lista (default)**: form lineal — todos los campos en orden
 *    de creación, con sidebar de Comentarios/Actividad. Apropiado
 *    para listas tipo base de datos (inventario, productos,
 *    proyectos sin componente social).
 *
 *  - **CRM panel**: header con avatar + badges de estado + acciones
 *    rápidas (mailto/tel) · sidebar con propiedades agrupadas
 *    colapsables · timeline central que mezcla comentarios y
 *    cambios. Apropiado para listas tipo contactos, ventas, leads.
 */
export function AppearancePanel({ list }: AppearancePanelProps): JSX.Element {
    const update = useUpdateList(list.id);
    const toast = useToast();

    const current = (list.settings as { record_layout?: RecordLayout }).record_layout ?? 'classic';

    const setLayout = async (next: RecordLayout): Promise<void> => {
        if (next === current) return;
        try {
            await update.mutateAsync({
                settings: { ...list.settings, record_layout: next },
            });
            toast.success(
                next === 'crm'
                    ? __('Layout CRM activado')
                    : __('Layout Lista activado'),
            );
        } catch (err) {
            if (err instanceof Error) toast.error(__('No se pudo cambiar el layout'), err.message);
        }
    };

    return (
        <Card>
            <CardHeader className="imcrm-pb-3">
                <CardTitle className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-text-base">
                    <LayoutDashboard className="imcrm-h-4 imcrm-w-4 imcrm-text-primary" />
                    {__('Apariencia del registro')}
                </CardTitle>
                <CardDescription>
                    {__(
                        'Define cómo se ve la página individual de cada registro de esta lista. El layout CRM es ideal para contactos, ventas o leads; el clásico para listas tipo base de datos.',
                    )}
                </CardDescription>
            </CardHeader>
            <CardContent className="imcrm-pt-0">
                <div className="imcrm-grid imcrm-grid-cols-1 imcrm-gap-3 sm:imcrm-grid-cols-2">
                    <LayoutOption
                        active={current === 'classic'}
                        disabled={update.isPending}
                        title={__('Lista')}
                        description={__('Form lineal con todos los campos. Default.')}
                        Icon={LayoutDashboard}
                        onClick={() => void setLayout('classic')}
                    />
                    <LayoutOption
                        active={current === 'crm'}
                        disabled={update.isPending}
                        title={__('Panel CRM')}
                        description={__('Header con avatar, badges, sidebar colapsable y timeline.')}
                        Icon={UserSquare2}
                        onClick={() => void setLayout('crm')}
                    />
                </div>
                {update.isPending && (
                    <p className="imcrm-mt-2 imcrm-flex imcrm-items-center imcrm-gap-1.5 imcrm-text-xs imcrm-text-muted-foreground">
                        <Loader2 className="imcrm-h-3 imcrm-w-3 imcrm-animate-spin" />
                        {__('Guardando…')}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

interface LayoutOptionProps {
    active: boolean;
    disabled: boolean;
    title: string;
    description: string;
    Icon: typeof LayoutDashboard;
    onClick: () => void;
}

function LayoutOption({
    active,
    disabled,
    title,
    description,
    Icon,
    onClick,
}: LayoutOptionProps): JSX.Element {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={cn(
                'imcrm-flex imcrm-flex-col imcrm-items-start imcrm-gap-1 imcrm-rounded-lg imcrm-border imcrm-px-4 imcrm-py-3 imcrm-text-left imcrm-transition-all',
                active
                    ? 'imcrm-border-primary imcrm-bg-primary/5 imcrm-shadow-imcrm-sm'
                    : 'imcrm-border-border imcrm-bg-card hover:imcrm-border-primary/40 hover:imcrm-bg-accent/30',
                disabled && 'imcrm-opacity-50 imcrm-cursor-not-allowed',
            )}
        >
            <span className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-text-sm imcrm-font-semibold">
                <Icon
                    className={cn(
                        'imcrm-h-4 imcrm-w-4',
                        active ? 'imcrm-text-primary' : 'imcrm-text-muted-foreground',
                    )}
                />
                {title}
            </span>
            <span className="imcrm-text-xs imcrm-text-muted-foreground">{description}</span>
        </button>
    );
}
