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

/**
 * Dialog para crear o editar un widget. Selecciona tipo, lista y los
 * campos requeridos según el tipo. La validación final la hace el
 * backend cuando se guarda el dashboard completo.
 */
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

    const fields = useFields(listId === 0 ? undefined : listId);
    const numericFields = useMemo(
        () => (fields.data ?? []).filter((f) => f.type === 'number' || f.type === 'currency'),
        [fields.data],
    );
    const selectFields = useMemo(
        () => (fields.data ?? []).filter((f) => f.type === 'select'),
        [fields.data],
    );
    const dateFields = useMemo(
        () => (fields.data ?? []).filter((f) => f.type === 'date' || f.type === 'datetime'),
        [fields.data],
    );

    useEffect(() => {
        if (!open) return;
        if (initial) {
            setTitle(initial.title);
            setType(initial.type);
            setListId(initial.list_id);
            setMetric((initial.config.metric as KpiMetric) ?? 'count');
            setMetricFieldId(initial.config.metric_field_id ?? 0);
            setGroupByFieldId(initial.config.group_by_field_id ?? 0);
            setDateFieldId(initial.config.date_field_id ?? 0);
        } else {
            setTitle('');
            setType('kpi');
            setListId(lists.data?.[0]?.id ?? 0);
            setMetric('count');
            setMetricFieldId(0);
            setGroupByFieldId(0);
            setDateFieldId(0);
        }
    }, [open, initial, lists.data]);

    const handleSubmit = (e: React.FormEvent): void => {
        e.preventDefault();
        const widget: WidgetSpec = {
            id: initial?.id ?? generateWidgetId(),
            type,
            list_id: listId,
            title: title.trim(),
            config: buildConfig(type, { metric, metricFieldId, groupByFieldId, dateFieldId }),
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
        if (type === 'chart_bar') return groupByFieldId > 0;
        if (type === 'chart_line') return dateFieldId > 0;
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
                                    <option value="kpi">{__('KPI (número)')}</option>
                                    <option value="chart_bar">{__('Barras')}</option>
                                    <option value="chart_line">{__('Línea (mensual)')}</option>
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

                        {type === 'chart_bar' && (
                            <FieldPicker
                                label={__('Agrupar por (Select)')}
                                value={groupByFieldId}
                                fields={selectFields}
                                onChange={setGroupByFieldId}
                                emptyHint={__('La lista no tiene campos Select.')}
                            />
                        )}

                        {type === 'chart_line' && (
                            <FieldPicker
                                label={__('Campo de fecha')}
                                value={dateFieldId}
                                fields={dateFields}
                                onChange={setDateFieldId}
                                emptyHint={__('La lista no tiene campos Date/DateTime.')}
                            />
                        )}

                        <div className="imcrm-flex imcrm-justify-end imcrm-gap-2">
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
    },
): WidgetSpec['config'] {
    if (type === 'kpi') {
        if (state.metric === 'sum' || state.metric === 'avg') {
            return { metric: state.metric, metric_field_id: state.metricFieldId };
        }
        return { metric: state.metric };
    }
    if (type === 'chart_bar') {
        return { group_by_field_id: state.groupByFieldId };
    }
    return { date_field_id: state.dateFieldId };
}

function generateWidgetId(): string {
    return 'w_' + Math.random().toString(36).slice(2, 10);
}
