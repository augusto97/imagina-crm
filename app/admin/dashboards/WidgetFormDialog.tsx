import { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useFields } from '@/hooks/useFields';
import { useLists } from '@/hooks/useLists';
import { __ } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { KpiMetric, WidgetSpec, WidgetType } from '@/types/dashboard';

interface WidgetFormDialogProps {
    initial: WidgetSpec | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (widget: WidgetSpec) => void;
}

const GROUPABLE_TYPES = [
    'select', 'multi_select',
    'text', 'email', 'url',
    'date', 'datetime',
    'checkbox',
];

export function WidgetFormDialog({
    initial,
    open,
    onOpenChange,
    onSave,
}: WidgetFormDialogProps): JSX.Element {
    const lists = useLists();

    const [title, setTitle] = useState('');
    const [type, setType] = useState<WidgetType>('kpi');
    const [listId, setListId] = useState<number>(0);
    const [metric, setMetric] = useState<KpiMetric>('count');
    const [metricFieldId, setMetricFieldId] = useState<number>(0);
    const [groupByFieldId, setGroupByFieldId] = useState<number>(0);
    const [dateFieldId, setDateFieldId] = useState<number>(0);
    const [periodDays, setPeriodDays] = useState<number>(30);
    const [sortFieldId, setSortFieldId] = useState<number>(0);
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [tableLimit, setTableLimit] = useState<number>(10);
    const [visibleFieldIds, setVisibleFieldIds] = useState<number[]>([]);

    const fields = useFields(listId === 0 ? undefined : listId);
    const numericFields = useMemo(
        () => (fields.data ?? []).filter((f) => f.type === 'number' || f.type === 'currency'),
        [fields.data],
    );
    const groupableFields = useMemo(
        () => (fields.data ?? []).filter((f) => GROUPABLE_TYPES.includes(f.type)),
        [fields.data],
    );
    const dateFields = useMemo(
        () => (fields.data ?? []).filter((f) => f.type === 'date' || f.type === 'datetime'),
        [fields.data],
    );
    const allUsableFields = useMemo(
        () => (fields.data ?? []).filter((f) => f.type !== 'relation'),
        [fields.data],
    );

    useEffect(() => {
        if (!open) return;
        if (initial) {
            setTitle(initial.title);
            setType(initial.type);
            setListId(initial.list_id);
            setMetric((initial.config.metric as KpiMetric) ?? 'count');
            setMetricFieldId((initial.config.metric_field_id as number) ?? 0);
            setGroupByFieldId((initial.config.group_by_field_id as number) ?? 0);
            setDateFieldId((initial.config.date_field_id as number) ?? 0);
            setPeriodDays((initial.config.period_days as number) ?? 30);
            setSortFieldId((initial.config.sort_field_id as number) ?? 0);
            setSortDir((initial.config.sort_dir as 'asc' | 'desc') ?? 'desc');
            setTableLimit((initial.config.limit as number) ?? 10);
            setVisibleFieldIds(
                Array.isArray(initial.config.visible_field_ids)
                    ? (initial.config.visible_field_ids as number[])
                    : [],
            );
        } else {
            setTitle('');
            setType('kpi');
            setListId(lists.data?.[0]?.id ?? 0);
            setMetric('count');
            setMetricFieldId(0);
            setGroupByFieldId(0);
            setDateFieldId(0);
            setPeriodDays(30);
            setSortFieldId(0);
            setSortDir('desc');
            setTableLimit(10);
            setVisibleFieldIds([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, initial?.id]);

    const handleSubmit = (e: React.FormEvent): void => {
        e.preventDefault();
        const widget: WidgetSpec = {
            id: initial?.id ?? generateWidgetId(),
            type,
            list_id: listId,
            title: title.trim(),
            config: buildConfig(type, {
                metric,
                metricFieldId,
                groupByFieldId,
                dateFieldId,
                periodDays,
                sortFieldId,
                sortDir,
                tableLimit,
                visibleFieldIds,
            }),
            layout: initial?.layout ?? { x: 0, y: 0, w: 4, h: 3 },
        };
        onSave(widget);
        onOpenChange(false);
    };

    const canSubmit = useMemo(() => {
        if (listId <= 0) return false;
        if (type === 'kpi') {
            if (metric === 'sum' || metric === 'avg') return metricFieldId > 0;
            return true;
        }
        if (type === 'chart_bar' || type === 'chart_pie') return groupByFieldId > 0;
        if (type === 'chart_line' || type === 'chart_area') return dateFieldId > 0;
        if (type === 'stat_delta') {
            if (dateFieldId <= 0) return false;
            if ((metric === 'sum' || metric === 'avg') && metricFieldId <= 0) return false;
            return true;
        }
        if (type === 'table') return true;
        return false;
    }, [type, listId, metric, metricFieldId, groupByFieldId, dateFieldId]);

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
                        'imcrm-fixed imcrm-left-1/2 imcrm-top-1/2 imcrm-z-50 imcrm-w-full imcrm-max-w-lg',
                        'imcrm--translate-x-1/2 imcrm--translate-y-1/2',
                        'imcrm-rounded-lg imcrm-border imcrm-border-border imcrm-bg-card imcrm-p-6 imcrm-shadow-imcrm-lg',
                        'imcrm-max-h-[90vh] imcrm-overflow-y-auto',
                    )}
                >
                    <div className="imcrm-flex imcrm-items-start imcrm-justify-between imcrm-gap-2">
                        <Dialog.Title className="imcrm-text-base imcrm-font-semibold">
                            {initial ? __('Editar widget') : __('Nuevo widget')}
                        </Dialog.Title>
                        <Dialog.Close asChild>
                            <Button variant="ghost" size="icon" aria-label={__('Cerrar')}>
                                <X className="imcrm-h-4 imcrm-w-4" />
                            </Button>
                        </Dialog.Close>
                    </div>

                    <form onSubmit={handleSubmit} className="imcrm-mt-4 imcrm-flex imcrm-flex-col imcrm-gap-4">
                        <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                            <Label htmlFor="w-title">{__('Título')}</Label>
                            <Input
                                id="w-title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder={__('Ej. Leads activos')}
                            />
                        </div>

                        <div className="imcrm-grid imcrm-grid-cols-2 imcrm-gap-3">
                            <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                                <Label htmlFor="w-type">{__('Tipo')}</Label>
                                <Select
                                    id="w-type"
                                    value={type}
                                    onChange={(e) => setType(e.target.value as WidgetType)}
                                >
                                    <option value="kpi">{__('KPI · Número')}</option>
                                    <option value="stat_delta">{__('KPI · Delta vs período')}</option>
                                    <option value="chart_bar">{__('Gráfico de barras')}</option>
                                    <option value="chart_pie">{__('Gráfico de torta')}</option>
                                    <option value="chart_line">{__('Línea (tendencia mensual)')}</option>
                                    <option value="chart_area">{__('Area (tendencia mensual)')}</option>
                                    <option value="table">{__('Tabla · Top N')}</option>
                                </Select>
                            </div>
                            <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                                <Label htmlFor="w-list">{__('Lista')}</Label>
                                <Select
                                    id="w-list"
                                    value={listId}
                                    onChange={(e) => {
                                        setListId(Number(e.target.value));
                                        setMetricFieldId(0);
                                        setGroupByFieldId(0);
                                        setDateFieldId(0);
                                        setSortFieldId(0);
                                        setVisibleFieldIds([]);
                                    }}
                                >
                                    <option value={0}>{__('— Selecciona —')}</option>
                                    {(lists.data ?? []).map((l) => (
                                        <option key={l.id} value={l.id}>
                                            {l.name}
                                        </option>
                                    ))}
                                </Select>
                            </div>
                        </div>

                        {type === 'kpi' && (
                            <KpiConfig
                                metric={metric}
                                metricFieldId={metricFieldId}
                                numericFields={numericFields}
                                onMetricChange={setMetric}
                                onMetricFieldChange={setMetricFieldId}
                            />
                        )}

                        {(type === 'chart_bar' || type === 'chart_pie') && (
                            <FieldPicker
                                label={__('Agrupar por')}
                                value={groupByFieldId}
                                fields={groupableFields}
                                onChange={setGroupByFieldId}
                                emptyHint={__('La lista no tiene campos agrupables (select, multi_select, text, email, url, date, datetime, checkbox).')}
                            />
                        )}

                        {(type === 'chart_line' || type === 'chart_area') && (
                            <FieldPicker
                                label={__('Campo de fecha')}
                                value={dateFieldId}
                                fields={dateFields}
                                onChange={setDateFieldId}
                                emptyHint={__('La lista no tiene campos Date/DateTime.')}
                            />
                        )}

                        {type === 'stat_delta' && (
                            <StatDeltaConfig
                                metric={metric}
                                metricFieldId={metricFieldId}
                                dateFieldId={dateFieldId}
                                periodDays={periodDays}
                                numericFields={numericFields}
                                dateFields={dateFields}
                                onMetricChange={setMetric}
                                onMetricFieldChange={setMetricFieldId}
                                onDateFieldChange={setDateFieldId}
                                onPeriodDaysChange={setPeriodDays}
                            />
                        )}

                        {type === 'table' && (
                            <TableConfig
                                fields={allUsableFields}
                                sortFieldId={sortFieldId}
                                sortDir={sortDir}
                                limit={tableLimit}
                                visibleFieldIds={visibleFieldIds}
                                onSortFieldChange={setSortFieldId}
                                onSortDirChange={setSortDir}
                                onLimitChange={setTableLimit}
                                onVisibleFieldsChange={setVisibleFieldIds}
                            />
                        )}

                        <div className="imcrm-flex imcrm-justify-end imcrm-gap-2 imcrm-border-t imcrm-border-border imcrm-pt-4">
                            <Dialog.Close asChild>
                                <Button type="button" variant="outline">
                                    {__('Cancelar')}
                                </Button>
                            </Dialog.Close>
                            <Button type="submit" disabled={!canSubmit}>
                                {initial ? __('Guardar cambios') : __('Añadir widget')}
                            </Button>
                        </div>
                    </form>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

interface KpiConfigProps {
    metric: KpiMetric;
    metricFieldId: number;
    numericFields: Array<{ id: number; label: string }>;
    onMetricChange: (metric: KpiMetric) => void;
    onMetricFieldChange: (id: number) => void;
}

function KpiConfig({
    metric,
    metricFieldId,
    numericFields,
    onMetricChange,
    onMetricFieldChange,
}: KpiConfigProps): JSX.Element {
    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-3">
            <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                <Label htmlFor="w-metric">{__('Métrica')}</Label>
                <Select
                    id="w-metric"
                    value={metric}
                    onChange={(e) => onMetricChange(e.target.value as KpiMetric)}
                >
                    <option value="count">{__('Contar registros')}</option>
                    <option value="sum">{__('Sumar campo')}</option>
                    <option value="avg">{__('Promediar campo')}</option>
                </Select>
            </div>
            {(metric === 'sum' || metric === 'avg') && (
                <FieldPicker
                    label={__('Campo numérico')}
                    value={metricFieldId}
                    fields={numericFields}
                    onChange={onMetricFieldChange}
                    emptyHint={__('La lista no tiene campos numéricos.')}
                />
            )}
        </div>
    );
}

interface StatDeltaConfigProps {
    metric: KpiMetric;
    metricFieldId: number;
    dateFieldId: number;
    periodDays: number;
    numericFields: Array<{ id: number; label: string }>;
    dateFields: Array<{ id: number; label: string }>;
    onMetricChange: (metric: KpiMetric) => void;
    onMetricFieldChange: (id: number) => void;
    onDateFieldChange: (id: number) => void;
    onPeriodDaysChange: (n: number) => void;
}

function StatDeltaConfig({
    metric,
    metricFieldId,
    dateFieldId,
    periodDays,
    numericFields,
    dateFields,
    onMetricChange,
    onMetricFieldChange,
    onDateFieldChange,
    onPeriodDaysChange,
}: StatDeltaConfigProps): JSX.Element {
    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-3">
            <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                <Label htmlFor="w-sd-metric">{__('Métrica')}</Label>
                <Select
                    id="w-sd-metric"
                    value={metric}
                    onChange={(e) => onMetricChange(e.target.value as KpiMetric)}
                >
                    <option value="count">{__('Contar registros')}</option>
                    <option value="sum">{__('Sumar campo')}</option>
                    <option value="avg">{__('Promediar campo')}</option>
                </Select>
            </div>
            {(metric === 'sum' || metric === 'avg') && (
                <FieldPicker
                    label={__('Campo numérico')}
                    value={metricFieldId}
                    fields={numericFields}
                    onChange={onMetricFieldChange}
                    emptyHint={__('La lista no tiene campos numéricos.')}
                />
            )}
            <FieldPicker
                label={__('Campo de fecha (define períodos)')}
                value={dateFieldId}
                fields={dateFields}
                onChange={onDateFieldChange}
                emptyHint={__('La lista no tiene campos Date/DateTime.')}
            />
            <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                <Label htmlFor="w-sd-period">{__('Período actual (días)')}</Label>
                <Select
                    id="w-sd-period"
                    value={periodDays}
                    onChange={(e) => onPeriodDaysChange(Number(e.target.value))}
                >
                    <option value={7}>{__('Últimos 7 días')}</option>
                    <option value={14}>{__('Últimos 14 días')}</option>
                    <option value={30}>{__('Últimos 30 días')}</option>
                    <option value={90}>{__('Últimos 90 días')}</option>
                    <option value={180}>{__('Últimos 180 días')}</option>
                </Select>
                <p className="imcrm-text-[11px] imcrm-text-muted-foreground">
                    {__('Compara contra el período anterior de la misma duración.')}
                </p>
            </div>
        </div>
    );
}

interface TableConfigProps {
    fields: Array<{ id: number; label: string }>;
    sortFieldId: number;
    sortDir: 'asc' | 'desc';
    limit: number;
    visibleFieldIds: number[];
    onSortFieldChange: (id: number) => void;
    onSortDirChange: (dir: 'asc' | 'desc') => void;
    onLimitChange: (n: number) => void;
    onVisibleFieldsChange: (ids: number[]) => void;
}

function TableConfig({
    fields,
    sortFieldId,
    sortDir,
    limit,
    visibleFieldIds,
    onSortFieldChange,
    onSortDirChange,
    onLimitChange,
    onVisibleFieldsChange,
}: TableConfigProps): JSX.Element {
    const toggleField = (id: number): void => {
        if (visibleFieldIds.includes(id)) {
            onVisibleFieldsChange(visibleFieldIds.filter((x) => x !== id));
        } else {
            onVisibleFieldsChange([...visibleFieldIds, id]);
        }
    };

    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-3">
            <div className="imcrm-grid imcrm-grid-cols-2 imcrm-gap-3">
                <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                    <Label htmlFor="w-tb-sort">{__('Ordenar por')}</Label>
                    <Select
                        id="w-tb-sort"
                        value={sortFieldId}
                        onChange={(e) => onSortFieldChange(Number(e.target.value))}
                    >
                        <option value={0}>{__('Más reciente')}</option>
                        {fields.map((f) => (
                            <option key={f.id} value={f.id}>
                                {f.label}
                            </option>
                        ))}
                    </Select>
                </div>
                <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                    <Label htmlFor="w-tb-dir">{__('Dirección')}</Label>
                    <Select
                        id="w-tb-dir"
                        value={sortDir}
                        onChange={(e) => onSortDirChange(e.target.value as 'asc' | 'desc')}
                    >
                        <option value="desc">{__('Descendente')}</option>
                        <option value="asc">{__('Ascendente')}</option>
                    </Select>
                </div>
            </div>
            <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                <Label htmlFor="w-tb-limit">{__('Cantidad')}</Label>
                <Select
                    id="w-tb-limit"
                    value={limit}
                    onChange={(e) => onLimitChange(Number(e.target.value))}
                >
                    <option value={5}>{__('Top 5')}</option>
                    <option value={10}>{__('Top 10')}</option>
                    <option value={20}>{__('Top 20')}</option>
                    <option value={50}>{__('Top 50')}</option>
                </Select>
            </div>
            <div className="imcrm-flex imcrm-flex-col imcrm-gap-2">
                <Label>{__('Columnas visibles')}</Label>
                {fields.length === 0 ? (
                    <p className="imcrm-text-xs imcrm-text-warning">{__('Esta lista no tiene campos.')}</p>
                ) : (
                    <div className="imcrm-flex imcrm-flex-wrap imcrm-gap-1.5">
                        {fields.map((f) => {
                            const checked = visibleFieldIds.includes(f.id);
                            return (
                                <label
                                    key={f.id}
                                    className={cn(
                                        'imcrm-flex imcrm-cursor-pointer imcrm-items-center imcrm-gap-1.5 imcrm-rounded-md imcrm-border imcrm-px-2 imcrm-py-1 imcrm-text-[12px] imcrm-transition-colors',
                                        checked
                                            ? 'imcrm-border-primary/40 imcrm-bg-primary/10 imcrm-text-primary'
                                            : 'imcrm-border-border imcrm-bg-card hover:imcrm-bg-canvas',
                                    )}
                                >
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleField(f.id)}
                                    />
                                    {f.label}
                                </label>
                            );
                        })}
                    </div>
                )}
                <p className="imcrm-text-[11px] imcrm-text-muted-foreground">
                    {__('Si no seleccionas ninguna, mostramos las primeras 4 de la lista.')}
                </p>
            </div>
        </div>
    );
}

interface FieldPickerProps {
    label: string;
    value: number;
    fields: Array<{ id: number; label: string }>;
    onChange: (id: number) => void;
    emptyHint: string;
}

function FieldPicker({ label, value, fields, onChange, emptyHint }: FieldPickerProps): JSX.Element {
    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
            <Label>{label}</Label>
            {fields.length === 0 ? (
                <p className="imcrm-text-xs imcrm-text-warning">{emptyHint}</p>
            ) : (
                <Select value={value} onChange={(e) => onChange(Number(e.target.value))}>
                    <option value={0}>{__('— Selecciona —')}</option>
                    {fields.map((f) => (
                        <option key={f.id} value={f.id}>
                            {f.label}
                        </option>
                    ))}
                </Select>
            )}
        </div>
    );
}

function buildConfig(
    type: WidgetType,
    state: {
        metric: KpiMetric;
        metricFieldId: number;
        groupByFieldId: number;
        dateFieldId: number;
        periodDays: number;
        sortFieldId: number;
        sortDir: 'asc' | 'desc';
        tableLimit: number;
        visibleFieldIds: number[];
    },
): WidgetSpec['config'] {
    if (type === 'kpi') {
        if (state.metric === 'sum' || state.metric === 'avg') {
            return { metric: state.metric, metric_field_id: state.metricFieldId };
        }
        return { metric: state.metric };
    }
    if (type === 'chart_bar' || type === 'chart_pie') {
        return { group_by_field_id: state.groupByFieldId };
    }
    if (type === 'chart_line' || type === 'chart_area') {
        return { date_field_id: state.dateFieldId };
    }
    if (type === 'stat_delta') {
        const c: WidgetSpec['config'] = {
            metric: state.metric,
            date_field_id: state.dateFieldId,
            period_days: state.periodDays,
        };
        if (state.metric === 'sum' || state.metric === 'avg') {
            c.metric_field_id = state.metricFieldId;
        }
        return c;
    }
    if (type === 'table') {
        const c: WidgetSpec['config'] = {
            limit: state.tableLimit,
            sort_dir: state.sortDir,
            visible_field_ids: state.visibleFieldIds,
        };
        if (state.sortFieldId > 0) {
            c.sort_field_id = state.sortFieldId;
        }
        return c;
    }
    return {};
}

function generateWidgetId(): string {
    return 'w_' + Math.random().toString(36).slice(2, 10);
}
