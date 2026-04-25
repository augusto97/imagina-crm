import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus, Settings } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useFields } from '@/hooks/useFields';
import { useList } from '@/hooks/useLists';
import { useRecords } from '@/hooks/useRecords';

import { RecordCreateDialog } from './RecordCreateDialog';
import { TableView } from './views/TableView';

export function RecordsPage(): JSX.Element {
    const { listSlug } = useParams<{ listSlug: string }>();
    const navigate = useNavigate();
    const list = useList(listSlug);
    const fields = useFields(list.data?.id);
    const records = useRecords(list.data?.id, { page: 1, per_page: 50 });
    const [createOpen, setCreateOpen] = useState(false);

    if (list.isLoading || fields.isLoading) {
        return (
            <div className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-py-12 imcrm-text-sm imcrm-text-muted-foreground">
                <Loader2 className="imcrm-h-4 imcrm-w-4 imcrm-animate-spin" />
                Cargando…
            </div>
        );
    }

    if (!list.data) {
        return (
            <div className="imcrm-flex imcrm-flex-col imcrm-items-start imcrm-gap-3">
                <Button variant="ghost" size="sm" onClick={() => navigate('/lists')} className="imcrm-gap-2">
                    <ArrowLeft className="imcrm-h-4 imcrm-w-4" />
                    Volver
                </Button>
                <p className="imcrm-text-sm imcrm-text-destructive">Lista no encontrada.</p>
            </div>
        );
    }

    const meta = records.data?.meta;

    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-4">
            <header className="imcrm-flex imcrm-items-start imcrm-justify-between imcrm-gap-4">
                <div className="imcrm-flex imcrm-flex-col imcrm-gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/lists')}
                        className="imcrm-gap-2 imcrm-self-start imcrm-text-muted-foreground"
                    >
                        <ArrowLeft className="imcrm-h-4 imcrm-w-4" />
                        Listas
                    </Button>
                    <h1 className="imcrm-text-2xl imcrm-font-semibold imcrm-tracking-tight">
                        {list.data.name}
                    </h1>
                    {meta && (
                        <p className="imcrm-text-xs imcrm-text-muted-foreground">
                            {meta.total} registro{meta.total === 1 ? '' : 's'}
                            {meta.total_pages > 1 && ` · página ${meta.page} de ${meta.total_pages}`}
                        </p>
                    )}
                </div>
                <div className="imcrm-flex imcrm-gap-2">
                    <Button asChild variant="outline" className="imcrm-gap-2">
                        <Link to={`/lists/${list.data.slug}/edit`}>
                            <Settings className="imcrm-h-4 imcrm-w-4" />
                            Configurar lista
                        </Link>
                    </Button>
                    <Button
                        onClick={() => setCreateOpen(true)}
                        disabled={!fields.data || fields.data.length === 0}
                        className="imcrm-gap-2"
                    >
                        <Plus className="imcrm-h-4 imcrm-w-4" />
                        Nuevo registro
                    </Button>
                </div>
            </header>

            {fields.data && fields.data.length === 0 && (
                <div className="imcrm-rounded-lg imcrm-border imcrm-border-dashed imcrm-border-border imcrm-bg-card imcrm-p-8 imcrm-text-center">
                    <p className="imcrm-text-sm imcrm-text-muted-foreground">
                        Esta lista aún no tiene campos. Configúralos primero para poder crear
                        registros.
                    </p>
                    <Button asChild variant="outline" className="imcrm-mt-3 imcrm-gap-2">
                        <Link to={`/lists/${list.data.slug}/edit`}>
                            <Settings className="imcrm-h-4 imcrm-w-4" />
                            Configurar campos
                        </Link>
                    </Button>
                </div>
            )}

            {fields.data && fields.data.length > 0 && (
                <>
                    {records.isLoading ? (
                        <div className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-py-6 imcrm-text-sm imcrm-text-muted-foreground">
                            <Loader2 className="imcrm-h-4 imcrm-w-4 imcrm-animate-spin" />
                            Cargando registros…
                        </div>
                    ) : records.isError ? (
                        <p className="imcrm-text-sm imcrm-text-destructive">
                            Error: {(records.error as Error).message}
                        </p>
                    ) : (
                        <TableView fields={fields.data} records={records.data?.data ?? []} />
                    )}

                    <RecordCreateDialog
                        listId={list.data.id}
                        fields={fields.data}
                        open={createOpen}
                        onOpenChange={setCreateOpen}
                    />
                </>
            )}
        </div>
    );
}
