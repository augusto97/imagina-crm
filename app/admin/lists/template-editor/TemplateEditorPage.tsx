import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Eye, Loader2, RotateCcw, Save, SlidersHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { useFields } from '@/hooks/useFields';
import { useList, useUpdateList } from '@/hooks/useLists';
import { useRecords } from '@/hooks/useRecords';
import { ApiError } from '@/lib/api';
import {
    CRM_TEMPLATES,
    CUSTOM_TEMPLATE_ID,
    customConfigFromBuiltin,
    emptyCustomConfig,
    resolveCustomTemplate,
    type CustomTemplateConfig,
} from '@/lib/crmTemplates';
import { __ } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { RecordEntity } from '@/types/record';

import { SlotsPanel } from './SlotsPanel';
import { TemplatePreview } from './TemplatePreview';

/**
 * Editor visual de la plantilla CRM custom de una lista.
 *
 * URL: `/lists/:listSlug/template-editor`
 *
 * Layout: 2 columnas — slots panel (controles) izquierda, preview en
 * vivo a la derecha. Cada cambio en los slots recompone el
 * `ResolvedLayout` y la preview reacciona.
 *
 * Persiste en `list.settings.crm_template_custom` + cambia
 * `crm_template_id` a 'custom' al guardar — así el
 * `RecordCrmLayout` lo levanta sin más.
 */
export function TemplateEditorPage(): JSX.Element {
    const { listSlug } = useParams<{ listSlug: string }>();
    const list = useList(listSlug);
    const fields = useFields(list.data?.id);
    const update = useUpdateList(list.data?.id ?? listSlug ?? '');
    const toast = useToast();
    const confirm = useConfirm();

    const [config, setConfig] = useState<CustomTemplateConfig>(emptyCustomConfig());
    const [initialized, setInitialized] = useState(false);
    const [showPreview, setShowPreview] = useState(true);

    // Sample record para la preview: tomamos el primero de la lista.
    // Si no hay records, la preview muestra placeholders.
    const sample = useRecords(list.data?.id, { per_page: 1, page: 1 });
    const sampleRecord: RecordEntity | null = sample.data?.data[0] ?? null;

    // Inicialización: si la lista YA tiene un custom guardado, lo
    // cargamos. Sino, clonamos desde la plantilla built-in que
    // tenían seleccionada (o 'auto' por default).
    useEffect(() => {
        if (! list.data || ! fields.data || initialized) return;
        const settings = list.data.settings as {
            crm_template_id?: string;
            crm_template_custom?: CustomTemplateConfig;
        };
        if (settings.crm_template_custom && settings.crm_template_id === CUSTOM_TEMPLATE_ID) {
            setConfig(settings.crm_template_custom);
        } else {
            setConfig(customConfigFromBuiltin(settings.crm_template_id ?? 'auto', fields.data));
        }
        setInitialized(true);
    }, [list.data, fields.data, initialized]);

    const layout = useMemo(
        () => (fields.data ? resolveCustomTemplate(config, fields.data) : null),
        [config, fields.data],
    );

    const handleSave = async (): Promise<void> => {
        if (! list.data) return;
        try {
            await update.mutateAsync({
                settings: {
                    ...list.data.settings,
                    record_layout: 'crm',
                    crm_template_id: CUSTOM_TEMPLATE_ID,
                    crm_template_custom: config,
                },
            });
            toast.success(__('Plantilla guardada'));
        } catch (err) {
            const msg = err instanceof ApiError || err instanceof Error ? err.message : 'Error';
            toast.error(__('No se pudo guardar'), msg);
        }
    };

    const handleResetFromBuiltin = async (builtinId: string): Promise<void> => {
        if (! fields.data) return;
        const ok = await confirm({
            title: __('Restaurar desde plantilla'),
            description: __('Reemplazará todos los cambios actuales con la plantilla seleccionada.'),
            destructive: true,
            confirmLabel: __('Restaurar'),
        });
        if (! ok) return;
        setConfig(customConfigFromBuiltin(builtinId, fields.data));
        toast.info(__('Restaurada — recordá guardar para aplicar.'));
    };

    if (list.isLoading || fields.isLoading || ! initialized) {
        return (
            <div className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-py-12 imcrm-text-sm imcrm-text-muted-foreground">
                <Loader2 className="imcrm-h-4 imcrm-w-4 imcrm-animate-spin" />
                {__('Cargando editor…')}
            </div>
        );
    }

    if (! list.data || ! fields.data) {
        return (
            <div className="imcrm-flex imcrm-flex-col imcrm-items-start imcrm-gap-3">
                <Button asChild variant="ghost" size="sm" className="imcrm-gap-2">
                    <Link to="/lists">
                        <ArrowLeft className="imcrm-h-4 imcrm-w-4" />
                        {__('Listas')}
                    </Link>
                </Button>
                <p className="imcrm-text-sm imcrm-text-destructive">{__('Lista no encontrada.')}</p>
            </div>
        );
    }

    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-4">
            <header className="imcrm-flex imcrm-items-center imcrm-justify-between imcrm-gap-4">
                <div className="imcrm-flex imcrm-flex-col imcrm-gap-1">
                    <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="imcrm-gap-2 imcrm-self-start imcrm-text-muted-foreground"
                    >
                        <Link to={`/lists/${list.data.slug}/edit`}>
                            <ArrowLeft className="imcrm-h-4 imcrm-w-4" />
                            {list.data.name}
                        </Link>
                    </Button>
                    <h1 className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-text-xl imcrm-font-semibold imcrm-tracking-tight">
                        <SlidersHorizontal className="imcrm-h-5 imcrm-w-5 imcrm-text-primary" />
                        {__('Editor de plantilla CRM')}
                    </h1>
                </div>
                <div className="imcrm-flex imcrm-gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="imcrm-gap-2"
                        onClick={() => setShowPreview((v) => ! v)}
                    >
                        <Eye className="imcrm-h-3.5 imcrm-w-3.5" />
                        {showPreview ? __('Ocultar preview') : __('Mostrar preview')}
                    </Button>
                    <ResetMenu onSelect={(id) => void handleResetFromBuiltin(id)} />
                    <Button
                        size="sm"
                        className="imcrm-gap-2"
                        onClick={() => void handleSave()}
                        disabled={update.isPending}
                    >
                        {update.isPending ? (
                            <Loader2 className="imcrm-h-3.5 imcrm-w-3.5 imcrm-animate-spin" />
                        ) : (
                            <Save className="imcrm-h-3.5 imcrm-w-3.5" />
                        )}
                        {__('Guardar plantilla')}
                    </Button>
                </div>
            </header>

            <div
                className={cn(
                    'imcrm-grid imcrm-gap-4',
                    showPreview ? 'lg:imcrm-grid-cols-[480px_minmax(0,1fr)]' : 'lg:imcrm-grid-cols-1',
                )}
            >
                <SlotsPanel
                    fields={fields.data}
                    config={config}
                    onChange={setConfig}
                />
                {showPreview && (
                    <div className="imcrm-rounded-xl imcrm-border imcrm-border-dashed imcrm-border-border imcrm-bg-muted/20 imcrm-p-4">
                        <p className="imcrm-mb-3 imcrm-text-xs imcrm-font-medium imcrm-uppercase imcrm-tracking-wide imcrm-text-muted-foreground">
                            {__('Preview en vivo')}
                            {sampleRecord === null && ` · ${__('Sin registros para mostrar — los slots aparecen vacíos')}`}
                        </p>
                        {layout && (
                            <TemplatePreview
                                listId={list.data.id}
                                fields={fields.data}
                                layout={layout}
                                sampleRecord={sampleRecord}
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function ResetMenu({ onSelect }: { onSelect: (builtinId: string) => void }): JSX.Element {
    const [open, setOpen] = useState(false);
    return (
        <div className="imcrm-relative">
            <Button
                variant="outline"
                size="sm"
                className="imcrm-gap-2"
                onClick={() => setOpen((v) => ! v)}
            >
                <RotateCcw className="imcrm-h-3.5 imcrm-w-3.5" />
                {__('Restaurar desde…')}
            </Button>
            {open && (
                <ul className="imcrm-absolute imcrm-right-0 imcrm-top-full imcrm-z-10 imcrm-mt-1 imcrm-w-56 imcrm-rounded-lg imcrm-border imcrm-border-border imcrm-bg-card imcrm-p-1 imcrm-shadow-lg">
                    {CRM_TEMPLATES.map((t) => (
                        <li key={t.id}>
                            <button
                                type="button"
                                onClick={() => {
                                    setOpen(false);
                                    onSelect(t.id);
                                }}
                                className="imcrm-flex imcrm-w-full imcrm-flex-col imcrm-items-start imcrm-rounded imcrm-px-2 imcrm-py-1.5 imcrm-text-left imcrm-text-sm hover:imcrm-bg-accent/50"
                            >
                                <span className="imcrm-font-medium">{t.name}</span>
                                <span className="imcrm-text-[11px] imcrm-text-muted-foreground">{t.description}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
