import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { LayoutList, Loader2, Plus, Trash2, Workflow, X } from 'lucide-react';

// Code-split: React Flow es ~60KB gzipped. La mayoría de usuarios edita
// en la vista form; sólo cargamos el bundle del diagrama cuando lo piden.
const AutomationVisualBuilder = lazy(() =>
    import('@/admin/automations/AutomationVisualBuilder').then((m) => ({
        default: m.AutomationVisualBuilder,
    })),
);

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
    useCreateAutomation,
    useUpdateAutomation,
} from '@/hooks/useAutomations';
import { useFields } from '@/hooks/useFields';
import { ApiError } from '@/lib/api';
import { __ } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type {
    ActionMeta,
    ActionSpec,
    AutomationEntity,
    CreateAutomationInput,
    TriggerConfig,
    TriggerMeta,
} from '@/types/automation';
import type { FieldEntity } from '@/types/field';

/**
 * Dialog modal para crear o editar una automatización.
 *
 * El form-based builder cubre el 95% de los casos típicos del MVP:
 * - elegir trigger (record_created / record_updated)
 * - filtros simples por slug = valor
 * - lista ordenada de acciones (update_field / call_webhook)
 *
 * El builder visual con React Flow llega en commit posterior; para entonces
 * éste seguirá siendo útil como modo "form simple".
 */
interface AutomationDialogProps {
    listId: number;
    triggers: TriggerMeta[];
    actions: ActionMeta[];
    automation: AutomationEntity | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface FormState {
    name: string;
    description: string;
    triggerType: string;
    triggerConfig: TriggerConfig;
    actions: ActionSpec[];
    isActive: boolean;
}

const EMPTY_STATE: FormState = {
    name: '',
    description: '',
    triggerType: 'record_created',
    triggerConfig: {},
    actions: [],
    isActive: true,
};

function fromAutomation(a: AutomationEntity): FormState {
    return {
        name: a.name,
        description: a.description ?? '',
        triggerType: a.trigger_type,
        triggerConfig: { ...a.trigger_config },
        actions: a.actions.map((s) => ({ type: s.type, config: { ...s.config } })),
        isActive: a.is_active,
    };
}

export function AutomationDialog({
    listId,
    triggers,
    actions,
    automation,
    open,
    onOpenChange,
}: AutomationDialogProps): JSX.Element {
    const create = useCreateAutomation(listId);
    const update = useUpdateAutomation(listId);
    const fields = useFields(listId);

    const [state, setState] = useState<FormState>(
        automation ? fromAutomation(automation) : EMPTY_STATE,
    );
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [view, setView] = useState<'form' | 'visual'>('form');
    const actionsListRef = useRef<HTMLOListElement | null>(null);

    // OJO: los hooks de TanStack Query (create, update) cambian de
    // referencia en cada render. Si los incluimos en las deps, el
    // efecto re-corre tras cada keystroke y resetea el state que el
    // usuario está editando. Por eso dependemos sólo de `[open,
    // automation?.id]` y disable la regla exhaustive-deps.
    useEffect(() => {
        if (!open) {
            return;
        }
        setState(automation ? fromAutomation(automation) : EMPTY_STATE);
        setError(null);
        setFieldErrors({});
        // Reset idempotente de errores previos del último submit.
        create.reset();
        update.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, automation?.id]);

    const triggerMeta = triggers.find((t) => t.slug === state.triggerType);

    const handleSubmit = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        setError(null);
        setFieldErrors({});

        const payload: CreateAutomationInput = {
            name: state.name.trim(),
            description: state.description.trim() === '' ? null : state.description.trim(),
            trigger_type: state.triggerType,
            trigger_config: cleanTriggerConfig(state.triggerConfig),
            actions: state.actions,
            is_active: state.isActive,
        };

        try {
            if (automation) {
                await update.mutateAsync({ id: automation.id, input: payload });
            } else {
                await create.mutateAsync(payload);
            }
            onOpenChange(false);
        } catch (err) {
            if (err instanceof ApiError) {
                setError(err.message);
                setFieldErrors(err.errors);
            } else if (err instanceof Error) {
                setError(err.message);
            }
        }
    };

    const isPending = create.isPending || update.isPending;

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
                        'imcrm-fixed imcrm-left-1/2 imcrm-top-1/2 imcrm-z-50 imcrm-w-full imcrm-max-w-2xl',
                        'imcrm--translate-x-1/2 imcrm--translate-y-1/2',
                        'imcrm-rounded-lg imcrm-border imcrm-border-border imcrm-bg-card imcrm-p-6 imcrm-shadow-imcrm-lg',
                        'imcrm-max-h-[90vh] imcrm-overflow-y-auto',
                    )}
                >
                    <div className="imcrm-flex imcrm-items-start imcrm-justify-between imcrm-gap-2">
                        <div>
                            <Dialog.Title className="imcrm-text-base imcrm-font-semibold">
                                {automation
                                    ? __('Editar automatización')
                                    : __('Nueva automatización')}
                            </Dialog.Title>
                            <Dialog.Description className="imcrm-text-sm imcrm-text-muted-foreground">
                                {__('Define cuándo se dispara y qué acciones se ejecutan.')}
                            </Dialog.Description>
                        </div>
                        <Dialog.Close asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label={__('Cerrar')}
                            >
                                <X className="imcrm-h-4 imcrm-w-4" />
                            </Button>
                        </Dialog.Close>
                    </div>

                    {error && (
                        <div className="imcrm-mt-4 imcrm-rounded-md imcrm-border imcrm-border-destructive/40 imcrm-bg-destructive/10 imcrm-p-3 imcrm-text-sm imcrm-text-destructive">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="imcrm-mt-4 imcrm-flex imcrm-flex-col imcrm-gap-5">
                        <FieldGroup error={fieldErrors.name}>
                            <Label htmlFor="auto-name">{__('Nombre')}</Label>
                            <Input
                                id="auto-name"
                                required
                                value={state.name}
                                onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
                            />
                        </FieldGroup>

                        <FieldGroup>
                            <Label htmlFor="auto-desc">{__('Descripción (opcional)')}</Label>
                            <Textarea
                                id="auto-desc"
                                rows={2}
                                value={state.description}
                                onChange={(e) => setState((s) => ({ ...s, description: e.target.value }))}
                            />
                        </FieldGroup>

                        <FieldGroup error={fieldErrors.trigger_type}>
                            <Label htmlFor="auto-trigger">{__('Trigger')}</Label>
                            <Select
                                id="auto-trigger"
                                value={state.triggerType}
                                onChange={(e) =>
                                    setState((s) => ({
                                        ...s,
                                        triggerType: e.target.value,
                                        triggerConfig: {},
                                    }))
                                }
                            >
                                {triggers.map((t) => (
                                    <option key={t.slug} value={t.slug}>
                                        {t.label}
                                    </option>
                                ))}
                            </Select>
                            {triggerMeta && (
                                <p className="imcrm-text-xs imcrm-text-muted-foreground">
                                    <code className="imcrm-font-mono">{triggerMeta.event}</code>
                                </p>
                            )}
                        </FieldGroup>

                        <TriggerConfigEditor
                            triggerType={state.triggerType}
                            config={state.triggerConfig}
                            onChange={(triggerConfig) => setState((s) => ({ ...s, triggerConfig }))}
                            fields={fields.data ?? []}
                        />

                        <ViewSwitcher view={view} onChange={setView} />

                        {view === 'form' ? (
                            <ActionsEditor
                                value={state.actions}
                                onChange={(next) => setState((s) => ({ ...s, actions: next }))}
                                actionsCatalog={actions}
                                fields={fields.data ?? []}
                                error={fieldErrors.actions}
                                listRef={actionsListRef}
                            />
                        ) : (
                            <Suspense
                                fallback={
                                    <div className="imcrm-flex imcrm-h-[480px] imcrm-items-center imcrm-justify-center imcrm-rounded-md imcrm-border imcrm-border-border imcrm-bg-muted/20 imcrm-text-sm imcrm-text-muted-foreground">
                                        <Loader2 className="imcrm-mr-2 imcrm-h-4 imcrm-w-4 imcrm-animate-spin" />
                                        {__('Cargando diagrama…')}
                                    </div>
                                }
                            >
                                <AutomationVisualBuilder
                                    triggerType={state.triggerType}
                                    triggers={triggers}
                                    actions={state.actions}
                                    actionsCatalog={actions}
                                    onActionsChange={(next) => setState((s) => ({ ...s, actions: next }))}
                                    onEditAction={(idx) => {
                                        setView('form');
                                        // Esperamos al re-render del form para scrollear.
                                        requestAnimationFrame(() => {
                                            const target = actionsListRef.current?.querySelector(
                                                `[data-action-index="${idx}"]`,
                                            );
                                            if (target instanceof HTMLElement) {
                                                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            }
                                        });
                                    }}
                                />
                            </Suspense>
                        )}

                        <label className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-text-sm">
                            <input
                                type="checkbox"
                                checked={state.isActive}
                                onChange={(e) => setState((s) => ({ ...s, isActive: e.target.checked }))}
                            />
                            {__('Activa al guardar')}
                        </label>

                        <footer className="imcrm-flex imcrm-justify-end imcrm-gap-2 imcrm-border-t imcrm-border-border imcrm-pt-4">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => onOpenChange(false)}
                                disabled={isPending}
                            >
                                {__('Cancelar')}
                            </Button>
                            <Button type="submit" disabled={isPending}>
                                {isPending ? __('Guardando…') : __('Guardar')}
                            </Button>
                        </footer>
                    </form>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

function ViewSwitcher({
    view,
    onChange,
}: {
    view: 'form' | 'visual';
    onChange: (next: 'form' | 'visual') => void;
}): JSX.Element {
    return (
        <div
            className="imcrm-inline-flex imcrm-self-start imcrm-rounded-md imcrm-border imcrm-border-border imcrm-bg-card imcrm-p-0.5 imcrm-text-xs"
            role="tablist"
            aria-label={__('Vista del editor')}
        >
            <button
                type="button"
                role="tab"
                aria-selected={view === 'form'}
                onClick={() => onChange('form')}
                className={cn(
                    'imcrm-flex imcrm-items-center imcrm-gap-1.5 imcrm-rounded imcrm-px-2.5 imcrm-py-1 imcrm-transition-colors',
                    view === 'form'
                        ? 'imcrm-bg-primary imcrm-text-primary-foreground'
                        : 'imcrm-text-muted-foreground hover:imcrm-bg-accent',
                )}
            >
                <LayoutList className="imcrm-h-3.5 imcrm-w-3.5" />
                {__('Formulario')}
            </button>
            <button
                type="button"
                role="tab"
                aria-selected={view === 'visual'}
                onClick={() => onChange('visual')}
                className={cn(
                    'imcrm-flex imcrm-items-center imcrm-gap-1.5 imcrm-rounded imcrm-px-2.5 imcrm-py-1 imcrm-transition-colors',
                    view === 'visual'
                        ? 'imcrm-bg-primary imcrm-text-primary-foreground'
                        : 'imcrm-text-muted-foreground hover:imcrm-bg-accent',
                )}
            >
                <Workflow className="imcrm-h-3.5 imcrm-w-3.5" />
                {__('Diagrama')}
            </button>
        </div>
    );
}

function FieldGroup({
    children,
    error,
}: {
    children: React.ReactNode;
    error?: string;
}): JSX.Element {
    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
            {children}
            {error && <p className="imcrm-text-xs imcrm-text-destructive">{error}</p>}
        </div>
    );
}

interface TriggerConfigEditorProps {
    triggerType: string;
    config: TriggerConfig;
    onChange: (next: TriggerConfig) => void;
    fields: FieldEntity[];
}

/**
 * Editor del trigger_config: filtros simples por slug=valor y, para
 * `record_updated`, lista de campos cuyo cambio dispara la regla.
 */
function helpForTrigger(triggerType: string): string {
    switch (triggerType) {
        case 'record_created':
            return __('Se ejecuta cada vez que se crea un nuevo registro en esta lista. Útil para asignaciones automáticas, notificaciones de bienvenida, etc.');
        case 'record_updated':
            return __('Se ejecuta cada vez que se modifica un registro de esta lista. Si configuras "Disparar solo si cambian estos campos", solo dispara cuando alguno de los campos elegidos efectivamente cambió.');
        case 'field_changed':
            return __('Se ejecuta cuando un campo específico cambia, opcionalmente con condiciones sobre el valor previo o nuevo. Ejemplo: "cuando status pasa de lead a won".');
        case 'scheduled':
            return __('Se ejecuta de forma recurrente (cada hora, dos veces al día, diario o semanal). En cada tick recorre todos los registros activos de la lista — útil para reportes periódicos o limpieza programada.');
        case 'due_date_reached':
            return __('Se ejecuta cuando un campo de fecha del registro entra en una ventana relativa al "ahora". Ejemplo: "1 día antes del vencimiento" → offset = -1440 minutos. Tolerancia define la ventana alrededor del target para no perder registros por jitter del cron.');
        default:
            return '';
    }
}

function TriggerConfigEditor({
    triggerType,
    config,
    onChange,
    fields,
}: TriggerConfigEditorProps): JSX.Element {
    const filters = useMemo(() => {
        const raw = config.field_filters;
        if (!raw || typeof raw !== 'object') return [];
        return Object.entries(raw).map(([slug, value]) => ({ slug, value }));
    }, [config.field_filters]);

    const changed = Array.isArray(config.changed_fields) ? config.changed_fields : [];

    const updateFilters = (next: Array<{ slug: string; value: unknown }>): void => {
        const out: Record<string, unknown> = {};
        for (const f of next) {
            if (f.slug.trim() === '') continue;
            out[f.slug.trim()] = f.value;
        }
        onChange({ ...config, field_filters: out });
    };

    const updateChanged = (next: string[]): void => {
        onChange({ ...config, changed_fields: next });
    };

    const addFilter = (): void => updateFilters([...filters, { slug: '', value: '' }]);

    const help = helpForTrigger(triggerType);

    return (
        <fieldset className="imcrm-flex imcrm-flex-col imcrm-gap-3 imcrm-rounded-md imcrm-border imcrm-border-border imcrm-bg-muted/20 imcrm-p-3">
            <legend className="imcrm-px-1 imcrm-text-xs imcrm-font-medium imcrm-uppercase imcrm-text-muted-foreground">
                {__('Configuración del trigger')}
            </legend>

            {help !== '' && (
                <p className="imcrm-rounded-md imcrm-border imcrm-border-info/30 imcrm-bg-info/10 imcrm-p-2 imcrm-text-xs imcrm-text-foreground">
                    {help}
                </p>
            )}

            <div className="imcrm-flex imcrm-flex-col imcrm-gap-2">
                <p className="imcrm-text-xs imcrm-text-muted-foreground">
                    {__('Solo dispara si el registro cumple TODOS estos pares slug = valor.')}
                </p>
                {filters.map((f, i) => (
                    <div key={i} className="imcrm-flex imcrm-items-center imcrm-gap-2">
                        <Select
                            value={f.slug}
                            onChange={(e) => {
                                const next = [...filters];
                                next[i] = { ...next[i]!, slug: e.target.value };
                                updateFilters(next);
                            }}
                            aria-label={__('Campo')}
                            className="imcrm-flex-1"
                        >
                            <option value="">{__('— Selecciona campo —')}</option>
                            {fields.map((field) => (
                                <option key={field.id} value={field.slug}>
                                    {field.label} ({field.slug})
                                </option>
                            ))}
                        </Select>
                        <Input
                            placeholder={__('Valor')}
                            value={typeof f.value === 'string' ? f.value : String(f.value ?? '')}
                            onChange={(e) => {
                                const next = [...filters];
                                next[i] = { ...next[i]!, value: e.target.value };
                                updateFilters(next);
                            }}
                            className="imcrm-flex-1"
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => updateFilters(filters.filter((_, j) => j !== i))}
                            aria-label={__('Eliminar filtro')}
                        >
                            <Trash2 className="imcrm-h-4 imcrm-w-4" />
                        </Button>
                    </div>
                ))}
                <Button type="button" variant="ghost" size="sm" onClick={addFilter} className="imcrm-self-start imcrm-gap-2">
                    <Plus className="imcrm-h-3.5 imcrm-w-3.5" />
                    {__('Añadir filtro')}
                </Button>
            </div>

            {triggerType === 'record_updated' && (
                <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5 imcrm-border-t imcrm-border-border imcrm-pt-3">
                    <Label>{__('Disparar solo si cambian estos campos')}</Label>
                    <p className="imcrm-text-xs imcrm-text-muted-foreground">
                        {__('Vacío = cualquier cambio dispara la regla.')}
                    </p>
                    <div className="imcrm-flex imcrm-flex-wrap imcrm-gap-2">
                        {fields.map((field) => {
                            const checked = changed.includes(field.slug);
                            return (
                                <label key={field.id} className="imcrm-flex imcrm-items-center imcrm-gap-1 imcrm-rounded-md imcrm-border imcrm-border-border imcrm-bg-card imcrm-px-2 imcrm-py-1 imcrm-text-xs">
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(e) =>
                                            updateChanged(
                                                e.target.checked
                                                    ? [...changed, field.slug]
                                                    : changed.filter((s) => s !== field.slug),
                                            )
                                        }
                                    />
                                    {field.label}
                                </label>
                            );
                        })}
                        {fields.length === 0 && (
                            <span className="imcrm-text-xs imcrm-text-muted-foreground">
                                {__('No hay campos.')}
                            </span>
                        )}
                    </div>
                </div>
            )}

            {triggerType === 'field_changed' && (
                <FieldChangedConfig config={config} onChange={onChange} fields={fields} />
            )}

            {triggerType === 'scheduled' && (
                <ScheduledConfig config={config} onChange={onChange} />
            )}

            {triggerType === 'due_date_reached' && (
                <DueDateConfig config={config} onChange={onChange} fields={fields} />
            )}
        </fieldset>
    );
}

function FieldChangedConfig({
    config,
    onChange,
    fields,
}: {
    config: TriggerConfig;
    onChange: (next: TriggerConfig) => void;
    fields: FieldEntity[];
}): JSX.Element {
    const field = typeof config.field === 'string' ? config.field : '';
    const fromValue =
        typeof config.from_value === 'string' ? config.from_value : '';
    const toValue = typeof config.to_value === 'string' ? config.to_value : '';

    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-2 imcrm-border-t imcrm-border-border imcrm-pt-3">
            <Label>{__('Campo a observar')}</Label>
            <Select
                value={field}
                onChange={(e) => onChange({ ...config, field: e.target.value })}
                aria-label={__('Campo')}
            >
                <option value="">{__('— Selecciona campo —')}</option>
                {fields.map((f) => (
                    <option key={f.id} value={f.slug}>
                        {f.label} ({f.slug})
                    </option>
                ))}
            </Select>
            <div className="imcrm-flex imcrm-gap-2">
                <Input
                    placeholder={__('Valor previo (opcional)')}
                    value={fromValue}
                    onChange={(e) =>
                        onChange({
                            ...config,
                            from_value: e.target.value === '' ? null : e.target.value,
                        })
                    }
                    className="imcrm-flex-1"
                />
                <Input
                    placeholder={__('Valor nuevo (opcional)')}
                    value={toValue}
                    onChange={(e) =>
                        onChange({
                            ...config,
                            to_value: e.target.value === '' ? null : e.target.value,
                        })
                    }
                    className="imcrm-flex-1"
                />
            </div>
            <p className="imcrm-text-xs imcrm-text-muted-foreground">
                {__('Si los valores quedan vacíos, dispara con cualquier cambio del campo.')}
            </p>
        </div>
    );
}

function ScheduledConfig({
    config,
    onChange,
}: {
    config: TriggerConfig;
    onChange: (next: TriggerConfig) => void;
}): JSX.Element {
    const frequency = typeof config.frequency === 'string' ? config.frequency : 'daily';
    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-2 imcrm-border-t imcrm-border-border imcrm-pt-3">
            <Label>{__('Frecuencia')}</Label>
            <Select
                value={frequency}
                onChange={(e) => onChange({ ...config, frequency: e.target.value })}
            >
                <option value="hourly">{__('Cada hora')}</option>
                <option value="twicedaily">{__('Dos veces al día')}</option>
                <option value="daily">{__('Diariamente')}</option>
                <option value="weekly">{__('Semanalmente')}</option>
            </Select>
            <p className="imcrm-text-xs imcrm-text-muted-foreground">
                {__('La automatización se evalúa en cada tick contra todos los registros activos de la lista.')}
            </p>
        </div>
    );
}

function DueDateConfig({
    config,
    onChange,
    fields,
}: {
    config: TriggerConfig;
    onChange: (next: TriggerConfig) => void;
    fields: FieldEntity[];
}): JSX.Element {
    const dueField = typeof config.due_field === 'string' ? config.due_field : '';
    const offset =
        typeof config.offset_minutes === 'number'
            ? config.offset_minutes
            : Number(config.offset_minutes ?? 0);
    const tolerance =
        typeof config.tolerance_minutes === 'number'
            ? config.tolerance_minutes
            : Number(config.tolerance_minutes ?? 30);

    const dateFields = fields.filter((f) => f.type === 'date' || f.type === 'datetime');

    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-2 imcrm-border-t imcrm-border-border imcrm-pt-3">
            <Label>{__('Campo de fecha')}</Label>
            <Select
                value={dueField}
                onChange={(e) => onChange({ ...config, due_field: e.target.value })}
            >
                <option value="">{__('— Selecciona campo —')}</option>
                {dateFields.map((f) => (
                    <option key={f.id} value={f.slug}>
                        {f.label}
                    </option>
                ))}
            </Select>
            {dateFields.length === 0 && (
                <p className="imcrm-text-xs imcrm-text-warning">
                    {__('No hay campos de tipo fecha en esta lista.')}
                </p>
            )}
            <div className="imcrm-flex imcrm-gap-2">
                <div className="imcrm-flex imcrm-flex-1 imcrm-flex-col imcrm-gap-1">
                    <Label className="imcrm-text-xs imcrm-text-muted-foreground">
                        {__('Offset (minutos: negativo=antes, positivo=después)')}
                    </Label>
                    <Input
                        type="number"
                        value={offset}
                        onChange={(e) =>
                            onChange({ ...config, offset_minutes: Number(e.target.value) })
                        }
                    />
                </div>
                <div className="imcrm-flex imcrm-flex-1 imcrm-flex-col imcrm-gap-1">
                    <Label className="imcrm-text-xs imcrm-text-muted-foreground">
                        {__('Tolerancia (minutos)')}
                    </Label>
                    <Input
                        type="number"
                        min={1}
                        value={tolerance}
                        onChange={(e) =>
                            onChange({
                                ...config,
                                tolerance_minutes: Math.max(1, Number(e.target.value)),
                            })
                        }
                    />
                </div>
            </div>
        </div>
    );
}

interface ActionsEditorProps {
    value: ActionSpec[];
    onChange: (next: ActionSpec[]) => void;
    actionsCatalog: ActionMeta[];
    fields: FieldEntity[];
    error?: string;
    listRef?: React.RefObject<HTMLOListElement>;
}

function ActionsEditor({
    value,
    onChange,
    actionsCatalog,
    fields,
    error,
    listRef,
}: ActionsEditorProps): JSX.Element {
    const addAction = (): void => {
        const first = actionsCatalog[0];
        if (!first) return;
        onChange([...value, { type: first.slug, config: {} }]);
    };

    return (
        <fieldset className="imcrm-flex imcrm-flex-col imcrm-gap-3 imcrm-rounded-md imcrm-border imcrm-border-border imcrm-bg-muted/20 imcrm-p-3">
            <legend className="imcrm-px-1 imcrm-text-xs imcrm-font-medium imcrm-uppercase imcrm-text-muted-foreground">
                {__('Acciones')}
            </legend>

            {error && <p className="imcrm-text-xs imcrm-text-destructive">{error}</p>}

            {value.length === 0 ? (
                <p className="imcrm-text-xs imcrm-text-muted-foreground">
                    {__('Aún no hay acciones. Añade al menos una.')}
                </p>
            ) : (
                <ol ref={listRef} className="imcrm-flex imcrm-flex-col imcrm-gap-2">
                    {value.map((spec, i) => (
                        <li
                            key={i}
                            data-action-index={i}
                            className="imcrm-flex imcrm-flex-col imcrm-gap-2 imcrm-rounded-md imcrm-border imcrm-border-border imcrm-bg-card imcrm-p-3"
                        >
                            <div className="imcrm-flex imcrm-items-center imcrm-gap-2">
                                <span className="imcrm-flex imcrm-h-6 imcrm-w-6 imcrm-items-center imcrm-justify-center imcrm-rounded-full imcrm-bg-primary/10 imcrm-text-xs imcrm-font-semibold imcrm-text-primary">
                                    {i + 1}
                                </span>
                                <Select
                                    value={spec.type}
                                    onChange={(e) => {
                                        const next = [...value];
                                        next[i] = { type: e.target.value, config: {} };
                                        onChange(next);
                                    }}
                                    className="imcrm-flex-1"
                                    aria-label={__('Tipo de acción')}
                                >
                                    {actionsCatalog.map((a) => (
                                        <option key={a.slug} value={a.slug}>
                                            {a.label}
                                        </option>
                                    ))}
                                </Select>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => onChange(value.filter((_, j) => j !== i))}
                                    aria-label={__('Eliminar acción')}
                                >
                                    <Trash2 className="imcrm-h-4 imcrm-w-4" />
                                </Button>
                            </div>

                            <ActionConfigEditor
                                spec={spec}
                                onChange={(next) => {
                                    const arr = [...value];
                                    arr[i] = next;
                                    onChange(arr);
                                }}
                                fields={fields}
                            />
                        </li>
                    ))}
                </ol>
            )}

            <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addAction}
                disabled={actionsCatalog.length === 0}
                className="imcrm-self-start imcrm-gap-2"
            >
                <Plus className="imcrm-h-3.5 imcrm-w-3.5" />
                {__('Añadir acción')}
            </Button>
        </fieldset>
    );
}

interface ActionConfigEditorProps {
    spec: ActionSpec;
    onChange: (next: ActionSpec) => void;
    fields: FieldEntity[];
}

/**
 * Editor del config de una acción concreta. Conoce las dos acciones del
 * MVP (update_field, call_webhook); para tipos custom registrados por
 * terceros, fallback a editor JSON crudo.
 */
function ActionConfigEditor({
    spec,
    onChange,
    fields,
}: ActionConfigEditorProps): JSX.Element {
    if (spec.type === 'update_field') {
        return <UpdateFieldConfig spec={spec} onChange={onChange} fields={fields} />;
    }
    if (spec.type === 'call_webhook') {
        return <CallWebhookConfig spec={spec} onChange={onChange} />;
    }
    if (spec.type === 'send_email') {
        return <SendEmailConfig spec={spec} onChange={onChange} />;
    }
    return <JsonConfigFallback spec={spec} onChange={onChange} />;
}

function UpdateFieldConfig({
    spec,
    onChange,
    fields,
}: ActionConfigEditorProps): JSX.Element {
    const rawValues = spec.config.values;
    const values = useMemo<Array<{ slug: string; value: string }>>(() => {
        if (!rawValues || typeof rawValues !== 'object') return [];
        return Object.entries(rawValues as Record<string, unknown>).map(([slug, v]) => ({
            slug,
            value: typeof v === 'string' ? v : String(v ?? ''),
        }));
    }, [rawValues]);

    const setValues = (next: Array<{ slug: string; value: string }>): void => {
        const out: Record<string, string> = {};
        for (const v of next) {
            if (v.slug.trim() === '') continue;
            out[v.slug.trim()] = v.value;
        }
        onChange({ ...spec, config: { ...spec.config, values: out } });
    };

    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-2">
            <p className="imcrm-text-xs imcrm-text-muted-foreground">
                {__('Setea pares campo → valor en el registro que disparó el trigger. Soporta merge tags como {{slug}} o {{record.id}}.')}
            </p>
            {values.map((v, i) => (
                <div key={i} className="imcrm-flex imcrm-items-center imcrm-gap-2">
                    <Select
                        value={v.slug}
                        onChange={(e) => {
                            const next = [...values];
                            next[i] = { ...next[i]!, slug: e.target.value };
                            setValues(next);
                        }}
                        aria-label={__('Campo a actualizar')}
                        className="imcrm-flex-1"
                    >
                        <option value="">{__('— Campo —')}</option>
                        {fields.map((field) => (
                            <option key={field.id} value={field.slug}>
                                {field.label}
                            </option>
                        ))}
                    </Select>
                    <Input
                        placeholder={__('Valor o {{slug}}')}
                        value={v.value}
                        onChange={(e) => {
                            const next = [...values];
                            next[i] = { ...next[i]!, value: e.target.value };
                            setValues(next);
                        }}
                        className="imcrm-flex-1"
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setValues(values.filter((_, j) => j !== i))}
                        aria-label={__('Eliminar')}
                    >
                        <Trash2 className="imcrm-h-4 imcrm-w-4" />
                    </Button>
                </div>
            ))}
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setValues([...values, { slug: '', value: '' }])}
                className="imcrm-self-start imcrm-gap-2"
            >
                <Plus className="imcrm-h-3.5 imcrm-w-3.5" />
                {__('Añadir valor')}
            </Button>
        </div>
    );
}

function CallWebhookConfig({ spec, onChange }: { spec: ActionSpec; onChange: (next: ActionSpec) => void }): JSX.Element {
    const url = typeof spec.config.url === 'string' ? spec.config.url : '';
    const method = typeof spec.config.method === 'string' ? spec.config.method : 'POST';
    const body = typeof spec.config.body_template === 'string' ? spec.config.body_template : '';

    const set = (patch: Record<string, unknown>): void => {
        onChange({ ...spec, config: { ...spec.config, ...patch } });
    };

    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-2">
            <div className="imcrm-flex imcrm-gap-2">
                <Select
                    value={method}
                    onChange={(e) => set({ method: e.target.value })}
                    aria-label={__('Método HTTP')}
                    className="imcrm-w-28"
                >
                    {['POST', 'GET', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                        <option key={m} value={m}>
                            {m}
                        </option>
                    ))}
                </Select>
                <Input
                    placeholder="https://example.com/hook"
                    value={url}
                    onChange={(e) => set({ url: e.target.value })}
                    className="imcrm-flex-1"
                />
            </div>
            <Label className="imcrm-text-xs imcrm-text-muted-foreground">
                {__('Body (opcional, soporta merge tags)')}
            </Label>
            <Textarea
                rows={3}
                value={body}
                onChange={(e) => set({ body_template: e.target.value })}
                placeholder='{"id": {{record.id}}, "name": "{{name}}"}'
            />
        </div>
    );
}

function SendEmailConfig({
    spec,
    onChange,
}: {
    spec: ActionSpec;
    onChange: (next: ActionSpec) => void;
}): JSX.Element {
    const to = typeof spec.config.to === 'string' ? spec.config.to : '';
    const subject = typeof spec.config.subject === 'string' ? spec.config.subject : '';
    const body = typeof spec.config.body === 'string' ? spec.config.body : '';
    const isHtml = Boolean(spec.config.is_html);
    const fromName = typeof spec.config.from_name === 'string' ? spec.config.from_name : '';
    const fromEmail = typeof spec.config.from_email === 'string' ? spec.config.from_email : '';
    const cc = typeof spec.config.cc === 'string' ? spec.config.cc : '';
    const bcc = typeof spec.config.bcc === 'string' ? spec.config.bcc : '';

    const set = (patch: Record<string, unknown>): void => {
        onChange({ ...spec, config: { ...spec.config, ...patch } });
    };

    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-2">
            <Label className="imcrm-text-xs imcrm-text-muted-foreground">
                {__('Para (acepta merge tags y múltiples emails separados por coma)')}
            </Label>
            <Input
                placeholder="{{email}} o user@example.com"
                value={to}
                onChange={(e) => set({ to: e.target.value })}
            />

            <Label className="imcrm-text-xs imcrm-text-muted-foreground">{__('Asunto')}</Label>
            <Input
                placeholder={__('Hola {{name}}')}
                value={subject}
                onChange={(e) => set({ subject: e.target.value })}
            />

            <Label className="imcrm-text-xs imcrm-text-muted-foreground">{__('Cuerpo')}</Label>
            <Textarea
                rows={4}
                placeholder={__('Tu mensaje. Usa {{slug}} para insertar valores del registro.')}
                value={body}
                onChange={(e) => set({ body: e.target.value })}
            />

            <label className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-text-xs">
                <input
                    type="checkbox"
                    checked={isHtml}
                    onChange={(e) => set({ is_html: e.target.checked })}
                />
                {__('Enviar como HTML')}
            </label>

            <details className="imcrm-mt-1 imcrm-rounded-md imcrm-border imcrm-border-border imcrm-bg-card imcrm-px-3 imcrm-py-2">
                <summary className="imcrm-cursor-pointer imcrm-text-xs imcrm-text-muted-foreground">
                    {__('Avanzado: From, Cc, Bcc')}
                </summary>
                <div className="imcrm-mt-2 imcrm-flex imcrm-flex-col imcrm-gap-2">
                    <div className="imcrm-flex imcrm-gap-2">
                        <Input
                            placeholder={__('Nombre remitente')}
                            value={fromName}
                            onChange={(e) => set({ from_name: e.target.value })}
                            className="imcrm-flex-1"
                        />
                        <Input
                            placeholder="noreply@example.com"
                            value={fromEmail}
                            onChange={(e) => set({ from_email: e.target.value })}
                            className="imcrm-flex-1"
                        />
                    </div>
                    <Input
                        placeholder={__('Cc (separados por coma)')}
                        value={cc}
                        onChange={(e) => set({ cc: e.target.value })}
                    />
                    <Input
                        placeholder={__('Bcc (separados por coma)')}
                        value={bcc}
                        onChange={(e) => set({ bcc: e.target.value })}
                    />
                </div>
            </details>
        </div>
    );
}

function JsonConfigFallback({
    spec,
    onChange,
}: {
    spec: ActionSpec;
    onChange: (next: ActionSpec) => void;
}): JSX.Element {
    const [text, setText] = useState(() => JSON.stringify(spec.config, null, 2));
    const [parseError, setParseError] = useState<string | null>(null);

    const commit = (): void => {
        try {
            const parsed = JSON.parse(text);
            if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
                throw new Error('config debe ser un objeto JSON');
            }
            onChange({ ...spec, config: parsed as Record<string, unknown> });
            setParseError(null);
        } catch (err) {
            if (err instanceof Error) setParseError(err.message);
        }
    };

    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-2">
            <Label className="imcrm-text-xs imcrm-text-muted-foreground">
                {__('Configuración (JSON)')}
            </Label>
            <Textarea
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onBlur={commit}
                spellCheck={false}
                className="imcrm-font-mono imcrm-text-xs"
            />
            {parseError && <p className="imcrm-text-xs imcrm-text-destructive">{parseError}</p>}
        </div>
    );
}

function cleanTriggerConfig(c: TriggerConfig): TriggerConfig {
    const out: TriggerConfig = {};
    if (c.field_filters && typeof c.field_filters === 'object') {
        const ff = c.field_filters as Record<string, unknown>;
        if (Object.keys(ff).length > 0) out.field_filters = ff;
    }
    if (Array.isArray(c.changed_fields) && c.changed_fields.length > 0) {
        out.changed_fields = c.changed_fields;
    }
    // field_changed
    if (typeof c.field === 'string' && c.field !== '') out.field = c.field;
    if (c.from_value !== undefined && c.from_value !== null && c.from_value !== '') {
        out.from_value = c.from_value;
    }
    if (c.to_value !== undefined && c.to_value !== null && c.to_value !== '') {
        out.to_value = c.to_value;
    }
    // scheduled
    if (typeof c.frequency === 'string' && c.frequency !== '') out.frequency = c.frequency;
    // due_date_reached
    if (typeof c.due_field === 'string' && c.due_field !== '') out.due_field = c.due_field;
    if (typeof c.offset_minutes === 'number') out.offset_minutes = c.offset_minutes;
    if (typeof c.tolerance_minutes === 'number') out.tolerance_minutes = c.tolerance_minutes;
    return out;
}
