import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus, Search, Settings, Zap } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFields } from '@/hooks/useFields';
import { useList } from '@/hooks/useLists';
import { useRecord, useRecords } from '@/hooks/useRecords';
import { useSavedViews } from '@/hooks/useSavedViews';
import { __, sprintf } from '@/lib/i18n';
import type { RecordEntity } from '@/types/record';
import type { SavedViewEntity } from '@/types/view';

import { BulkActionsToolbar } from './BulkActionsToolbar';
import { FiltersPanel } from './FiltersPanel';
import { Pagination } from './Pagination';
import { RecordCreateDialog } from './RecordCreateDialog';
import { RecordDetailDrawer } from './RecordDetailDrawer';
import {
    INITIAL_STATE,
    buildRecordsQuery,
    toggleSort,
    type RecordsState,
} from './recordsState';
import { CalendarView } from './views/CalendarView';
import { KanbanView } from './views/KanbanView';
import { ColumnsMenu } from './views/ColumnsMenu';
import { GroupSelector } from './views/GroupSelector';
import { GroupedTableView } from './views/GroupedTableView';
import { TableView } from './views/TableView';
import { SaveViewDialog } from './views/SaveViewDialog';
import { ViewsTabs } from './views/ViewsTabs';
import {
    hasChangesVsView,
    stateToViewConfig,
    viewConfigToState,
} from './views/savedViewMapping';

export function RecordsPage(): JSX.Element {
    const { listSlug } = useParams<{ listSlug: string }>();
    const navigate = useNavigate();
    const list = useList(listSlug);
    const fields = useFields(list.data?.id);
    const views = useSavedViews(list.data?.id);

    const [state, setState] = useState<RecordsState>(INITIAL_STATE);
    const [activeViewId, setActiveViewId] = useState<number | null>(null);
    const initialViewAppliedRef = useRef<number | null>(null);

    // Para Kanban y Calendar traemos hasta 500 registros (el back-end
    // limita el máximo per_page; 500 cubre la mayoría de tableros y
    // calendarios mensuales sin paginar).
    const query = useMemo(() => {
        const base = buildRecordsQuery(state);
        if (activeViewId !== null) {
            const v = views.data?.find((x) => x.id === activeViewId);
            if (v?.type === 'kanban' || v?.type === 'calendar') {
                return { ...base, per_page: 500, page: 1 };
            }
        }
        return base;
    }, [state, activeViewId, views.data]);
    const records = useRecords(list.data?.id, query);
    const [createOpen, setCreateOpen] = useState(false);
    const [saveViewOpen, setSaveViewOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [drawerRecordId, setDrawerRecordId] = useState<number | null>(null);

    // Reset al cambiar de lista.
    useEffect(() => {
        setSelectedIds([]);
        setDrawerRecordId(null);
        setActiveViewId(null);
        setState(INITIAL_STATE);
        initialViewAppliedRef.current = null;
    }, [list.data?.id]);

    const applyView = (view: SavedViewEntity | null): void => {
        if (view === null) {
            setActiveViewId(null);
            setState(INITIAL_STATE);
            return;
        }
        setActiveViewId(view.id);
        setState(viewConfigToState(view.config, INITIAL_STATE.perPage));
    };

    // Auto-aplicar la vista default la primera vez que llegan las vistas
    // para esta lista. Usamos un ref para evitar re-aplicarla cuando el
    // usuario decida explícitamente ir a "Todos" o cambiar de tab.
    useEffect(() => {
        if (!views.data || !list.data) return;
        if (initialViewAppliedRef.current === list.data.id) return;
        initialViewAppliedRef.current = list.data.id;

        const def = views.data.find((v) => v.is_default);
        if (def) {
            applyView(def);
        }
    }, [views.data, list.data?.id]);

    const setFilterTree = (filterTree: import('@/types/record').FilterTree): void => {
        setState((s) => ({ ...s, filterTree, page: 1 }));
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

    // En vista plana el record vive en `records.data`. En vista agrupada
    // ese flat list está vacío (cada grupo tiene su propia query) — caemos
    // a un fetch directo por id como fallback.
    const flatDrawerRecord =
        drawerRecordId !== null
            ? records.data?.data.find((r) => r.id === drawerRecordId) ?? null
            : null;
    const fallbackRecord = useRecord(
        list.data?.id,
        flatDrawerRecord === null && drawerRecordId !== null ? drawerRecordId : undefined,
    );
    const drawerRecord: RecordEntity | null =
        flatDrawerRecord ?? (fallbackRecord.data ?? null);

    const activeView = activeViewId !== null
        ? views.data?.find((v) => v.id === activeViewId) ?? null
        : null;
    const isKanban = activeView?.type === 'kanban';
    const isCalendar = activeView?.type === 'calendar';
    const isAlternativeView = isKanban || isCalendar;
    const isTableGrouped = !isAlternativeView && state.groupByFieldId !== null;
    const tableGroupByField =
        isTableGrouped && fields.data
            ? fields.data.find((f) => f.id === state.groupByFieldId)
            : undefined;
    // Para vistas no-tabla, "dirty" no se compara con filters/sort.
    const isDirty = isAlternativeView
        ? false
        : activeView !== null
          ? hasChangesVsView(state, activeView.config)
          : state.filterTree.children.length > 0 || state.sort.length > 0 || state.search.trim() !== '';

    // Resolver el campo de agrupación de la vista kanban activa.
    const groupByField = useMemo(() => {
        if (!isKanban || !fields.data) return undefined;
        const id = activeView?.config.group_by_field_id;
        if (!id) return undefined;
        return fields.data.find((f) => f.id === id);
    }, [isKanban, fields.data, activeView?.config.group_by_field_id]);

    const dateField = useMemo(() => {
        if (!isCalendar || !fields.data) return undefined;
        const id = activeView?.config.date_field_id;
        if (!id) return undefined;
        return fields.data.find((f) => f.id === id);
    }, [isCalendar, fields.data, activeView?.config.date_field_id]);

    if (list.isLoading || fields.isLoading) {
        return (
            <div className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-py-12 imcrm-text-sm imcrm-text-muted-foreground">
                <Loader2 className="imcrm-h-4 imcrm-w-4 imcrm-animate-spin" />
                {__('Cargando…')}
            </div>
        );
    }

    if (!list.data) {
        return (
            <div className="imcrm-flex imcrm-flex-col imcrm-items-start imcrm-gap-3">
                <Button variant="ghost" size="sm" onClick={() => navigate('/lists')} className="imcrm-gap-2">
                    <ArrowLeft className="imcrm-h-4 imcrm-w-4" />
                    {__('Volver')}
                </Button>
                <p className="imcrm-text-sm imcrm-text-destructive">{__('Lista no encontrada.')}</p>
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
                        {__('Listas')}
                    </Button>
                    <h1 className="imcrm-text-2xl imcrm-font-semibold imcrm-tracking-tight">
                        {list.data.name}
                    </h1>
                </div>
                <div className="imcrm-flex imcrm-gap-2">
                    <Button asChild variant="outline" className="imcrm-gap-2">
                        <Link to={`/lists/${list.data.slug}/automations`}>
                            <Zap className="imcrm-h-4 imcrm-w-4" />
                            {__('Automatizaciones')}
                        </Link>
                    </Button>
                    <Button asChild variant="outline" className="imcrm-gap-2">
                        <Link to={`/lists/${list.data.slug}/edit`}>
                            <Settings className="imcrm-h-4 imcrm-w-4" />
                            {__('Configurar lista')}
                        </Link>
                    </Button>
                    <Button
                        onClick={() => setCreateOpen(true)}
                        disabled={!fields.data || fields.data.length === 0}
                        className="imcrm-gap-2"
                    >
                        <Plus className="imcrm-h-4 imcrm-w-4" />
                        {__('Nuevo registro')}
                    </Button>
                </div>
            </header>

            {fields.data && fields.data.length === 0 && (
                <div className="imcrm-rounded-lg imcrm-border imcrm-border-dashed imcrm-border-border imcrm-bg-card imcrm-p-8 imcrm-text-center">
                    <p className="imcrm-text-sm imcrm-text-muted-foreground">
                        {__('Esta lista aún no tiene campos. Configúralos primero para poder crear registros.')}
                    </p>
                    <Button asChild variant="outline" className="imcrm-mt-3 imcrm-gap-2">
                        <Link to={`/lists/${list.data.slug}/edit`}>
                            <Settings className="imcrm-h-4 imcrm-w-4" />
                            {__('Configurar campos')}
                        </Link>
                    </Button>
                </div>
            )}

            {fields.data && fields.data.length > 0 && (
                <>
                    <ViewsTabs
                        listId={list.data.id}
                        views={views.data ?? []}
                        activeViewId={activeViewId}
                        onSelectView={applyView}
                        isDirty={isDirty}
                        currentConfig={stateToViewConfig(state)}
                        onAskCreateView={() => setSaveViewOpen(true)}
                    />

                    <div className="imcrm-flex imcrm-flex-wrap imcrm-items-center imcrm-justify-between imcrm-gap-3">
                        <div className="imcrm-flex imcrm-flex-1 imcrm-flex-wrap imcrm-items-center imcrm-gap-3">
                            <div className="imcrm-relative imcrm-w-72">
                                <Search className="imcrm-pointer-events-none imcrm-absolute imcrm-left-2.5 imcrm-top-2 imcrm-h-4 imcrm-w-4 imcrm-text-muted-foreground" />
                                <Input
                                    value={state.search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder={__('Buscar…')}
                                    className="imcrm-pl-8"
                                />
                            </div>
                            <FiltersPanel
                                listId={list.data?.id}
                                fields={fields.data}
                                tree={state.filterTree}
                                onChange={setFilterTree}
                            />
                            <ColumnsMenu
                                fields={fields.data}
                                visibility={state.columnVisibility}
                                onChange={(next) =>
                                    setState((s) => ({ ...s, columnVisibility: next }))
                                }
                            />
                            {!isAlternativeView && (
                                <GroupSelector
                                    fields={fields.data}
                                    value={state.groupByFieldId}
                                    onChange={(next) =>
                                        setState((s) => ({
                                            ...s,
                                            groupByFieldId: next,
                                            page: 1,
                                        }))
                                    }
                                />
                            )}
                        </div>
                        {records.isFetching && !records.isLoading && (
                            <Loader2 className="imcrm-h-4 imcrm-w-4 imcrm-animate-spin imcrm-text-muted-foreground" />
                        )}
                    </div>

                    {records.isLoading ? (
                        <div className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-py-6 imcrm-text-sm imcrm-text-muted-foreground">
                            <Loader2 className="imcrm-h-4 imcrm-w-4 imcrm-animate-spin" />
                            {__('Cargando registros…')}
                        </div>
                    ) : records.isError ? (
                        <p className="imcrm-text-sm imcrm-text-destructive">
                            {sprintf(
                                /* translators: %s: error message */
                                __('Error: %s'),
                                (records.error as Error).message,
                            )}
                        </p>
                    ) : isKanban && groupByField ? (
                        <KanbanView
                            listId={list.data.id}
                            fields={fields.data}
                            records={records.data?.data ?? []}
                            groupByField={groupByField}
                            onCardClick={(record) => setDrawerRecordId(record.id)}
                        />
                    ) : isCalendar && dateField ? (
                        <CalendarView
                            fields={fields.data}
                            records={records.data?.data ?? []}
                            dateField={dateField}
                            onCardClick={(record) => setDrawerRecordId(record.id)}
                        />
                    ) : isTableGrouped && tableGroupByField ? (
                        <GroupedTableView
                            listId={list.data.id}
                            fields={fields.data}
                            groupByField={tableGroupByField}
                            filterTree={state.filterTree}
                            search={state.search}
                            selectedIds={selectedIds}
                            onSelectionChange={setSelectedIds}
                            onRowClick={(record) => setDrawerRecordId(record.id)}
                            columnVisibility={state.columnVisibility}
                        />
                    ) : (
                        <TableView
                            listId={list.data.id}
                            fields={fields.data}
                            records={records.data?.data ?? []}
                            sort={state.sort}
                            onSortChange={handleSortChange}
                            selectedIds={selectedIds}
                            onSelectionChange={setSelectedIds}
                            onRowClick={(record) => setDrawerRecordId(record.id)}
                            columnVisibility={state.columnVisibility}
                            onColumnVisibilityChange={(next) =>
                                setState((s) => ({ ...s, columnVisibility: next }))
                            }
                            columnSizing={state.columnSizing}
                            onColumnSizingChange={(next) =>
                                setState((s) => ({ ...s, columnSizing: next }))
                            }
                        />
                    )}

                    {meta && !isAlternativeView && !isTableGrouped && (
                        <Pagination meta={meta} onPageChange={setPage} />
                    )}

                    <BulkActionsToolbar
                        listId={list.data.id}
                        selectedIds={selectedIds}
                        onClear={() => setSelectedIds([])}
                    />

                    <RecordCreateDialog
                        listId={list.data.id}
                        fields={fields.data}
                        open={createOpen}
                        onOpenChange={setCreateOpen}
                    />

                    <RecordDetailDrawer
                        listId={list.data.id}
                        listSlug={list.data.slug}
                        fields={fields.data}
                        record={drawerRecord}
                        open={drawerRecordId !== null}
                        onOpenChange={(open) => !open && setDrawerRecordId(null)}
                    />

                    <SaveViewDialog
                        listId={list.data.id}
                        config={stateToViewConfig(state)}
                        open={saveViewOpen}
                        onOpenChange={setSaveViewOpen}
                        onCreated={(view) => {
                            setActiveViewId(view.id);
                        }}
                    />
                </>
            )}
        </div>
    );
}
