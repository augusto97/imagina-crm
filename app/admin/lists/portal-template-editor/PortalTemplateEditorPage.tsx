import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useList, useUpdateList } from '@/hooks/useLists';
import { ApiError } from '@/lib/api';
import { __ } from '@/lib/i18n';
import type { PortalTemplate } from '@/types/portal';

import { PortalGridEditor } from './PortalGridEditor';

const EMPTY_TEMPLATE: PortalTemplate = { blocks: [] };

/**
 * Página standalone del editor de plantilla del portal — replica el
 * patrón de `TemplateEditorPage` del CRM panel: ruta dedicada,
 * carga la lista por slug, header con "Volver" + "Guardar", y body
 * con el editor visual a pantalla completa.
 *
 * Reemplaza el editor embebido en `PortalConfigPanel` — desde allí
 * ahora solo se accede vía botón "Abrir editor visual".
 */
export function PortalTemplateEditorPage(): JSX.Element {
    const { listSlug } = useParams<{ listSlug: string }>();
    const list = useList(listSlug);
    const update = useUpdateList(list.data?.id ?? listSlug ?? '');
    const toast = useToast();

    const [template, setTemplate] = useState<PortalTemplate>(EMPTY_TEMPLATE);
    const [initialized, setInitialized] = useState(false);
    const [advancedMode, setAdvancedMode] = useState(false);
    const [dirty, setDirty] = useState(false);

    // Init: lee `portal_template` del settings (o vacío si no hay).
    useEffect(() => {
        if (! list.data || initialized) return;
        const settings = list.data.settings as { portal_template?: unknown };
        const raw = settings.portal_template;
        if (raw && typeof raw === 'object' && raw !== null && Array.isArray((raw as { blocks?: unknown }).blocks)) {
            setTemplate(raw as PortalTemplate);
        } else {
            setTemplate(EMPTY_TEMPLATE);
        }
        setInitialized(true);
    }, [list.data, initialized]);

    const handleChange = (next: PortalTemplate): void => {
        setTemplate(next);
        setDirty(true);
    };

    const handleSave = async (): Promise<void> => {
        if (! list.data) return;
        const settings = {
            ...(list.data.settings as Record<string, unknown>),
            portal_template: template,
        };
        try {
            await update.mutateAsync({ settings });
            toast.success(__('Plantilla del portal guardada'));
            setDirty(false);
        } catch (err) {
            const msg = err instanceof ApiError ? err.message : __('No se pudo guardar.');
            toast.error(__('Error al guardar'), msg);
        }
    };

    // Aviso al user si intenta navegar con cambios sin guardar.
    useEffect(() => {
        if (! dirty) return;
        const handler = (e: BeforeUnloadEvent): void => {
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [dirty]);

    if (list.isLoading) {
        return (
            <div className="imcrm-flex imcrm-items-center imcrm-justify-center imcrm-py-12">
                <p className="imcrm-text-sm imcrm-text-muted-foreground">{__('Cargando…')}</p>
            </div>
        );
    }
    if (! list.data) {
        return (
            <div className="imcrm-flex imcrm-flex-col imcrm-items-center imcrm-gap-3 imcrm-py-12">
                <p className="imcrm-text-sm imcrm-text-muted-foreground">
                    {__('Lista no encontrada.')}
                </p>
                <Button asChild variant="outline" size="sm">
                    <Link to="/lists">{__('Volver a listas')}</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="imcrm-flex imcrm-h-[calc(100vh-8rem)] imcrm-min-h-[640px] imcrm-flex-col imcrm-gap-3">
            {/* Header de la página ─────────────────────────────────── */}
            <header className="imcrm-flex imcrm-flex-wrap imcrm-items-center imcrm-justify-between imcrm-gap-3">
                <div className="imcrm-flex imcrm-min-w-0 imcrm-items-center imcrm-gap-2">
                    <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="imcrm-gap-1.5 imcrm-text-muted-foreground"
                    >
                        <Link to={`/lists/${list.data.slug}/settings`}>
                            <ArrowLeft className="imcrm-h-3.5 imcrm-w-3.5" />
                            {list.data.name}
                        </Link>
                    </Button>
                    <span className="imcrm-text-muted-foreground/40">·</span>
                    <h1 className="imcrm-text-base imcrm-font-semibold imcrm-tracking-tight">
                        {__('Editor de portal del cliente')}
                    </h1>
                </div>
                <div className="imcrm-flex imcrm-items-center imcrm-gap-2">
                    {dirty && (
                        <span className="imcrm-text-xs imcrm-text-warning">
                            {__('Cambios sin guardar')}
                        </span>
                    )}
                    <Button
                        type="button"
                        size="sm"
                        className="imcrm-gap-1.5"
                        disabled={! dirty || update.isPending}
                        onClick={() => void handleSave()}
                    >
                        <Save className="imcrm-h-3.5 imcrm-w-3.5" />
                        {update.isPending ? __('Guardando…') : __('Guardar plantilla')}
                    </Button>
                </div>
            </header>

            {/* Body: editor visual ────────────────────────────────── */}
            <div className="imcrm-flex-1 imcrm-overflow-y-auto">
                <PortalGridEditor
                    listId={list.data.id}
                    template={template}
                    onChange={handleChange}
                    advancedMode={advancedMode}
                    onAdvancedToggle={setAdvancedMode}
                />
            </div>
        </div>
    );
}
