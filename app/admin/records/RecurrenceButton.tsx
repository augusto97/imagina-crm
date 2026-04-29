import { useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { useFields } from '@/hooks/useFields';
import {
    useDeleteRecurrence,
    useRecurrences,
    useUpsertRecurrence,
} from '@/hooks/useRecurrences';
import { __ } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { FieldEntity } from '@/types/field';
import type {
    Recurrence,
    RecurrenceActionType,
    RecurrenceFrequency,
    RecurrenceMonthlyPattern,
    RecurrenceTriggerType,
} from '@/types/recurrence';

interface RecurrenceButtonProps {
    listId: number;
    recordId: number;
    /** El field date/datetime al que se le configura la recurrencia. */
    field: FieldEntity;
}

/**
 * Icono ↻ inline que muestra el estado de recurrencia de la celda. Si
 * la celda tiene una recurrencia configurada se muestra en verde; al
 * click abre un popover con todo el form (frecuencia, trigger, acción,
 * etc). Match visual con ClickUp.
 */
export function RecurrenceButton({
    listId,
    recordId,
    field,
}: RecurrenceButtonProps): JSX.Element {
    const recurrences = useRecurrences(listId, recordId);
    const existing = (recurrences.data ?? []).find(
        (r) => r.date_field_id === field.id,
    );
    const isActive = existing !== undefined;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        'imcrm-flex imcrm-h-5 imcrm-w-5 imcrm-items-center imcrm-justify-center imcrm-rounded',
                        'imcrm-transition-colors imcrm-duration-150',
                        isActive
                            ? 'imcrm-text-success hover:imcrm-bg-success/10'
                            : 'imcrm-text-muted-foreground/50 hover:imcrm-bg-accent hover:imcrm-text-foreground',
                    )}
                    title={isActive ? __('Editar recurrencia') : __('Configurar recurrencia')}
                    aria-label={isActive ? __('Editar recurrencia') : __('Configurar recurrencia')}
                    onClick={(e) => e.stopPropagation()}
                >
                    <RefreshCw className="imcrm-h-3 imcrm-w-3" />
                </button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                sideOffset={6}
                collisionPadding={16}
                className="imcrm-w-[380px] imcrm-p-0"
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <RecurrenceForm
                    listId={listId}
                    recordId={recordId}
                    field={field}
                    existing={existing ?? null}
                />
            </PopoverContent>
        </Popover>
    );
}

interface RecurrenceFormProps {
    listId: number;
    recordId: number;
    field: FieldEntity;
    existing: Recurrence | null;
}

function RecurrenceForm({
    listId,
    recordId,
    field,
    existing,
}: RecurrenceFormProps): JSX.Element {
    const fields = useFields(listId);
    const upsert = useUpsertRecurrence(listId, recordId);
    const remove = useDeleteRecurrence(listId, recordId);

    const [frequency, setFrequency] = useState<RecurrenceFrequency>(
        existing?.frequency ?? 'monthly',
    );
    const [interval, setInterval] = useState<number>(existing?.interval_n ?? 1);
    const [monthlyPattern, setMonthlyPattern] = useState<RecurrenceMonthlyPattern>(
        existing?.monthly_pattern ?? 'same_day',
    );
    const [triggerType, setTriggerType] = useState<RecurrenceTriggerType>(
        existing?.trigger_type ?? 'schedule',
    );
    const [triggerStatusFieldId, setTriggerStatusFieldId] = useState<number>(
        existing?.trigger_status_field_id ?? 0,
    );
    const [triggerStatusValue, setTriggerStatusValue] = useState<string>(
        existing?.trigger_status_value ?? '',
    );
    const [actionType, setActionType] = useState<RecurrenceActionType>(
        existing?.action_type ?? 'update',
    );
    const [updateStatusEnabled, setUpdateStatusEnabled] = useState<boolean>(
        existing?.update_status_field_id !== null && existing?.update_status_field_id !== undefined,
    );
    const [updateStatusFieldId, setUpdateStatusFieldId] = useState<number>(
        existing?.update_status_field_id ?? 0,
    );
    const [updateStatusValue, setUpdateStatusValue] = useState<string>(
        existing?.update_status_value ?? '',
    );
    const [repeatUntil, setRepeatUntil] = useState<string>(
        existing?.repeat_until ?? '',
    );
    const [error, setError] = useState<string | null>(null);

    const statusFields = (fields.data ?? []).filter(
        (f) => f.type === 'select' || f.type === 'checkbox',
    );

    const triggerStatusOptions = useStatusOptions(fields.data, triggerStatusFieldId);
    const updateStatusOptions = useStatusOptions(fields.data, updateStatusFieldId);

    const handleSave = async (): Promise<void> => {
        setError(null);
        try {
            await upsert.mutateAsync({
                date_field_id: field.id,
                frequency,
                interval_n: interval,
                monthly_pattern: frequency === 'monthly' ? monthlyPattern : null,
                trigger_type: triggerType,
                trigger_status_field_id:
                    triggerType === 'status_change' ? triggerStatusFieldId : null,
                trigger_status_value:
                    triggerType === 'status_change' ? triggerStatusValue : null,
                action_type: actionType,
                update_status_field_id: updateStatusEnabled ? updateStatusFieldId : null,
                update_status_value: updateStatusEnabled ? updateStatusValue : null,
                repeat_until: repeatUntil !== '' ? repeatUntil : null,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : __('Error'));
        }
    };

    const handleDelete = async (): Promise<void> => {
        if (existing === null) return;
        if (!window.confirm(__('¿Quitar la recurrencia de esta celda?'))) return;
        try {
            await remove.mutateAsync(existing.id);
        } catch (err) {
            setError(err instanceof Error ? err.message : __('Error'));
        }
    };

    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-3 imcrm-p-4">
            <div className="imcrm-flex imcrm-items-center imcrm-justify-between">
                <h3 className="imcrm-flex imcrm-items-center imcrm-gap-1.5 imcrm-text-sm imcrm-font-semibold">
                    <RefreshCw className="imcrm-h-3.5 imcrm-w-3.5 imcrm-text-success" />
                    {__('Recurrente')}
                </h3>
                <span className="imcrm-text-xs imcrm-text-muted-foreground">
                    {field.label}
                </span>
            </div>

            <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                <Label className="imcrm-text-xs">{__('Frecuencia')}</Label>
                <Select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as RecurrenceFrequency)}
                >
                    <option value="daily">{__('Diariamente')}</option>
                    <option value="weekly">{__('Semanal')}</option>
                    <option value="monthly">{__('Mensual')}</option>
                    <option value="yearly">{__('Anual')}</option>
                    <option value="days_after">{__('Días después de…')}</option>
                </Select>
            </div>

            {(frequency === 'daily' ||
                frequency === 'weekly' ||
                frequency === 'monthly' ||
                frequency === 'yearly' ||
                frequency === 'days_after') && (
                <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                    <Label className="imcrm-text-xs">{__('Cada')}</Label>
                    <Input
                        type="number"
                        min={1}
                        value={interval}
                        onChange={(e) => setInterval(Math.max(1, Number(e.target.value) || 1))}
                    />
                </div>
            )}

            {frequency === 'monthly' && (
                <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                    <Label className="imcrm-text-xs">{__('Patrón mensual')}</Label>
                    <Select
                        value={monthlyPattern}
                        onChange={(e) =>
                            setMonthlyPattern(e.target.value as RecurrenceMonthlyPattern)
                        }
                    >
                        <option value="same_day">{__('El mismo día de cada mes')}</option>
                        <option value="weekday">{__('El mismo día de la semana')}</option>
                        <option value="first_day">{__('Primer día del mes')}</option>
                        <option value="last_day">{__('Último día del mes')}</option>
                    </Select>
                </div>
            )}

            <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5 imcrm-border-t imcrm-border-border imcrm-pt-3">
                <Label className="imcrm-text-xs">{__('Cuándo rueda')}</Label>
                <Select
                    value={triggerType}
                    onChange={(e) => setTriggerType(e.target.value as RecurrenceTriggerType)}
                >
                    <option value="schedule">{__('Según un cronograma (cuando llega la fecha)')}</option>
                    <option value="status_change">{__('Cuando cambia el estado a un valor')}</option>
                </Select>
            </div>

            {triggerType === 'status_change' && (
                <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                    <Label className="imcrm-text-xs">{__('Campo de estado')}</Label>
                    <Select
                        value={triggerStatusFieldId}
                        onChange={(e) => setTriggerStatusFieldId(Number(e.target.value))}
                    >
                        <option value={0}>{__('— Selecciona —')}</option>
                        {statusFields.map((f) => (
                            <option key={f.id} value={f.id}>
                                {f.label}
                            </option>
                        ))}
                    </Select>
                    {triggerStatusFieldId > 0 && (
                        <>
                            <Label className="imcrm-mt-1 imcrm-text-xs">{__('Valor target')}</Label>
                            <Select
                                value={triggerStatusValue}
                                onChange={(e) => setTriggerStatusValue(e.target.value)}
                            >
                                <option value="">{__('— Selecciona —')}</option>
                                {triggerStatusOptions.map((o) => (
                                    <option key={o.value} value={o.value}>
                                        {o.label}
                                    </option>
                                ))}
                            </Select>
                        </>
                    )}
                </div>
            )}

            <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5 imcrm-border-t imcrm-border-border imcrm-pt-3">
                <Label className="imcrm-text-xs">{__('Acción al rodar')}</Label>
                <Select
                    value={actionType}
                    onChange={(e) => setActionType(e.target.value as RecurrenceActionType)}
                >
                    <option value="update">{__('Actualizar este registro (avanzar fecha)')}</option>
                    <option value="clone">{__('Crear un registro nuevo (clonar con nueva fecha)')}</option>
                </Select>
            </div>

            <label className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-text-xs">
                <input
                    type="checkbox"
                    checked={updateStatusEnabled}
                    onChange={(e) => setUpdateStatusEnabled(e.target.checked)}
                />
                {__('Actualizar estado a:')}
            </label>

            {updateStatusEnabled && (
                <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5 imcrm-pl-6">
                    <Select
                        value={updateStatusFieldId}
                        onChange={(e) => setUpdateStatusFieldId(Number(e.target.value))}
                    >
                        <option value={0}>{__('— Campo de estado —')}</option>
                        {statusFields.map((f) => (
                            <option key={f.id} value={f.id}>
                                {f.label}
                            </option>
                        ))}
                    </Select>
                    {updateStatusFieldId > 0 && (
                        <Select
                            value={updateStatusValue}
                            onChange={(e) => setUpdateStatusValue(e.target.value)}
                        >
                            <option value="">{__('— Valor —')}</option>
                            {updateStatusOptions.map((o) => (
                                <option key={o.value} value={o.value}>
                                    {o.label}
                                </option>
                            ))}
                        </Select>
                    )}
                </div>
            )}

            <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5 imcrm-border-t imcrm-border-border imcrm-pt-3">
                <Label className="imcrm-text-xs">{__('Repetir hasta (opcional)')}</Label>
                <Input
                    type="date"
                    value={repeatUntil}
                    onChange={(e) => setRepeatUntil(e.target.value)}
                />
                <p className="imcrm-text-[10px] imcrm-text-muted-foreground">
                    {__('Vacío = repetir indefinidamente.')}
                </p>
            </div>

            {error !== null && (
                <p className="imcrm-rounded imcrm-border imcrm-border-destructive/40 imcrm-bg-destructive/10 imcrm-px-2 imcrm-py-1.5 imcrm-text-xs imcrm-text-destructive">
                    {error}
                </p>
            )}

            <div className="imcrm-flex imcrm-items-center imcrm-justify-between imcrm-gap-2 imcrm-border-t imcrm-border-border imcrm-pt-3">
                {existing !== null ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleDelete()}
                        className="imcrm-text-destructive hover:imcrm-bg-destructive/10"
                    >
                        {__('No repetir')}
                    </Button>
                ) : (
                    <span />
                )}
                <Button
                    size="sm"
                    onClick={() => void handleSave()}
                    disabled={upsert.isPending}
                    className="imcrm-gap-1.5"
                >
                    {upsert.isPending ? (
                        <Loader2 className="imcrm-h-3.5 imcrm-w-3.5 imcrm-animate-spin" />
                    ) : null}
                    {__('Guardar')}
                </Button>
            </div>
        </div>
    );
}

/**
 * Las opciones del select que está como "valor target" del trigger
 * (cuando el field es select) o "Marcado/No" (cuando es checkbox).
 */
function useStatusOptions(
    allFields: FieldEntity[] | undefined,
    fieldId: number,
): Array<{ value: string; label: string }> {
    if (!allFields || fieldId <= 0) return [];
    const f = allFields.find((x) => x.id === fieldId);
    if (!f) return [];
    if (f.type === 'checkbox') {
        return [
            { value: '1', label: __('Marcado') },
            { value: '0', label: __('No marcado') },
        ];
    }
    const options = (f.config as { options?: Array<{ value: string; label?: string }> })
        .options;
    if (!Array.isArray(options)) return [];
    return options.map((o) => ({
        value: String(o.value),
        label: o.label ?? String(o.value),
    }));
}
