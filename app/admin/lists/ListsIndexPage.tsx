import { Database, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function ListsIndexPage(): JSX.Element {
    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-6">
            <header className="imcrm-flex imcrm-items-start imcrm-justify-between imcrm-gap-4">
                <div>
                    <h1 className="imcrm-text-2xl imcrm-font-semibold imcrm-tracking-tight">
                        Listas
                    </h1>
                    <p className="imcrm-mt-1 imcrm-text-sm imcrm-text-muted-foreground">
                        Aún no hay listas. Las listas son contenedores de registros con
                        campos personalizados, vistas y automatizaciones.
                    </p>
                </div>
                <Button disabled className="imcrm-gap-2">
                    <Plus className="imcrm-h-4 imcrm-w-4" />
                    Nueva lista
                </Button>
            </header>

            <div className="imcrm-flex imcrm-flex-col imcrm-items-center imcrm-justify-center imcrm-gap-3 imcrm-rounded-lg imcrm-border imcrm-border-dashed imcrm-border-border imcrm-bg-card imcrm-p-12 imcrm-text-center">
                <span className="imcrm-flex imcrm-h-12 imcrm-w-12 imcrm-items-center imcrm-justify-center imcrm-rounded-full imcrm-bg-muted imcrm-text-muted-foreground">
                    <Database className="imcrm-h-6 imcrm-w-6" />
                </span>
                <h2 className="imcrm-text-base imcrm-font-medium">Bootstrap completo</h2>
                <p className="imcrm-max-w-md imcrm-text-sm imcrm-text-muted-foreground">
                    El shell del admin SPA está montado. La gestión de listas, campos y
                    registros llega en la Fase 1.
                </p>
            </div>
        </div>
    );
}
