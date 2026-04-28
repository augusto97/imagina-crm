import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Database, Plus, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { useLists } from '@/hooks/useLists';
import { __, sprintf } from '@/lib/i18n';
import { ListCreateDialog } from '@/admin/lists/ListCreateDialog';

export function ListsIndexPage(): JSX.Element {
    const lists = useLists();
    const [dialogOpen, setDialogOpen] = useState(false);

    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-6">
            <header className="imcrm-flex imcrm-items-start imcrm-justify-between imcrm-gap-4">
                <div>
                    <h1 className="imcrm-text-2xl imcrm-font-semibold imcrm-tracking-tight">
                        {__('Listas')}
                    </h1>
                    <p className="imcrm-mt-1 imcrm-text-sm imcrm-text-muted-foreground">
                        {__('Cada lista es un contenedor de registros con campos y vistas configurables.')}
                    </p>
                </div>
                <Button className="imcrm-gap-2" onClick={() => setDialogOpen(true)}>
                    <Plus className="imcrm-h-4 imcrm-w-4" />
                    {__('Nueva lista')}
                </Button>
            </header>

            {lists.isError && (
                <div className="imcrm-flex imcrm-items-start imcrm-gap-2 imcrm-rounded-md imcrm-border imcrm-border-destructive/40 imcrm-bg-destructive/10 imcrm-p-3 imcrm-text-sm imcrm-text-destructive">
                    <AlertCircle className="imcrm-h-4 imcrm-w-4 imcrm-mt-0.5" />
                    <span>
                        {sprintf(
                            /* translators: %s: error message */
                            __('No se pudieron cargar las listas: %s'),
                            (lists.error as Error).message,
                        )}
                    </span>
                </div>
            )}

            {lists.isLoading ? (
                <SkeletonGrid />
            ) : lists.data && lists.data.length > 0 ? (
                <div className="imcrm-grid imcrm-grid-cols-1 imcrm-gap-3 sm:imcrm-grid-cols-2 lg:imcrm-grid-cols-3">
                    {lists.data.map((list) => (
                        <Link
                            key={list.id}
                            to={`/lists/${list.slug}/records`}
                            className="imcrm-block imcrm-rounded-lg imcrm-transition-colors hover:imcrm-bg-accent/30"
                        >
                            <Card>
                                <CardHeader>
                                    <CardTitle className="imcrm-flex imcrm-items-center imcrm-gap-2">
                                        <Database className="imcrm-h-4 imcrm-w-4 imcrm-text-muted-foreground" />
                                        {list.name}
                                    </CardTitle>
                                    {list.description && (
                                        <CardDescription>{list.description}</CardDescription>
                                    )}
                                </CardHeader>
                                <CardContent className="imcrm-flex imcrm-items-center imcrm-justify-between imcrm-text-xs imcrm-text-muted-foreground">
                                    <code className="imcrm-font-mono">/{list.slug}</code>
                                    <span>
                                        {sprintf(
                                            /* translators: %s: localized date */
                                            __('Editado %s'),
                                            new Date(list.updated_at + 'Z').toLocaleDateString(),
                                        )}
                                    </span>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            ) : (
                <ListsEmpty onCreate={() => setDialogOpen(true)} />
            )}

            <ListCreateDialog open={dialogOpen} onOpenChange={setDialogOpen} />
        </div>
    );
}

function SkeletonGrid(): JSX.Element {
    return (
        <div className="imcrm-grid imcrm-grid-cols-1 imcrm-gap-3 sm:imcrm-grid-cols-2 lg:imcrm-grid-cols-3">
            {[0, 1, 2].map((i) => (
                <div
                    key={i}
                    className="imcrm-h-32 imcrm-animate-pulse imcrm-rounded-lg imcrm-border imcrm-border-border imcrm-bg-muted/40"
                />
            ))}
        </div>
    );
}

function ListsEmpty({ onCreate }: { onCreate: () => void }): JSX.Element {
    return (
        <EmptyState
            icon={Database}
            title={__('Aún no hay listas')}
            description={__('Crea tu primera lista para empezar a capturar registros.')}
            action={
                <Button onClick={onCreate} className="imcrm-gap-2">
                    <Plus className="imcrm-h-4 imcrm-w-4" />
                    {__('Nueva lista')}
                </Button>
            }
        />
    );
}
