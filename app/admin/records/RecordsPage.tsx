import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus, Search, Settings } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFields } from '@/hooks/useFields';
import { useList } from '@/hooks/useLists';
import { useRecords } from '@/hooks/useRecords';

import { FiltersBar } from './FiltersBar';
import { Pagination } from './Pagination';
import { RecordCreateDialog } from './RecordCreateDialog';
import {
    INITIAL_STATE,
    buildRecordsQuery,
    toggleSort,
    type ActiveFilter,
    type RecordsState,
} from './recordsState';
import { TableView } from './views/TableView';

export function RecordsPage(): JSX.Element {
    const { listSlug } = useParams<{ listSlug: string }>();
    const navigate = useNavigate();
    const list = useList(listSlug);
    const fields = useFields(list.data?.id);
    const [state, setState] = useState<RecordsState>(INITIAL_STATE);
    const query = useMemo(() => buildRecordsQuery(state), [state]);
    const records = useRecords(list.data?.id, query);
    const [createOpen, setCreateOpen] = useState(false);

    const setFilters = (filters: ActiveFilter[]): void => {
        setState((s) => ({ ...s, filters, page: 1 }));
    };

    const setSearch = (search: string): void => {
        setState((s) => ({ ...s, search, page: 1 }));
    };

    const setPage = (page: number): void => {
        setState((s) => ({ ...s, page }));
    };

    const handleSortChange = (fieldId: number, multi: boolean): void => {
        setState((s) => ({
            ...s,
            sort: toggleSort(s.sort, fieldId, multi),
            page: 1,
        }));
    };

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
                    <div className="imcrm-flex imcrm-flex-wrap imcrm-items-center imcrm-justify-between imcrm-gap-3">
                        <div className="imcrm-flex imcrm-flex-1 imcrm-flex-wrap imcrm-items-center imcrm-gap-3">
                            <div className="imcrm-relative imcrm-w-72">
                                <Search className="imcrm-pointer-events-none imcrm-absolute imcrm-left-2.5 imcrm-top-2 imcrm-h-4 imcrm-w-4 imcrm-text-muted-foreground" />
                                <Input
                                    value={state.search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Buscar…"
                                    className="imcrm-pl-8"
                                />
                            </div>
                            <FiltersBar
                                fields={fields.data}
                                filters={state.filters}
                                onFiltersChange={setFilters}
                            />
                        </div>
                        {records.isFetching && !records.isLoading && (
                            <Loader2 className="imcrm-h-4 imcrm-w-4 imcrm-animate-spin imcrm-text-muted-foreground" />
                        )}
                    </div>

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
                        <TableView
                            listId={list.data.id}
                            fields={fields.data}
                            records={records.data?.data ?? []}
                            sort={state.sort}
                            onSortChange={handleSortChange}
                        />
                    )}

                    {meta && <Pagination meta={meta} onPageChange={setPage} />}

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
