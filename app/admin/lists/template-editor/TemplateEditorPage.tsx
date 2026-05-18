import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, RotateCcw, Save, SlidersHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/toast';
import { useFields } from '@/hooks/useFields';
import { useList, useUpdateList } from '@/hooks/useLists';
import { useRecords } from '@/hooks/useRecords';
import { ApiError } from '@/lib/api';
import {
    CRM_TEMPLATES,
    CUSTOM_TEMPLATE_ID,
    customConfigV2FromBuiltin,
    emptyCustomConfigV2,
    ensureV2,
    type CustomTemplateConfigV2,
} from '@/lib/crmTemplates';
import { __ } from '@/lib/i18n';
import type { RecordEntity } from '@/types/record';

import { GridEditor } from './GridEditor';
import { HeaderEditor } from './HeaderEditor';

/**
 * Editor visual de la plantilla CRM custom de una lista (0.35.0+).
 *
 * Se redibuja cada vez que el config cambia. Layout:
 *   - Top: header bar con Save / Restaurar.
 *   - HeaderEditor (colapsable) — slots fijos arriba del panel.
 *   - GridEditor — canvas drag-resize-able con bloques V2.
 *
 * Persiste en `list.settings.crm_template_custom` como
 * `CustomTemplateConfigV2`. Auto-migra V1 → V2 al cargar.
 */
export function TemplateEditorPage(): JSX.Element {
    const { listSlug } = useParams<{ listSlug: string }>();
    const list = useList(listSlug);
    const fields = useFields(list.data?.id);
    const update = useUpdateList(list.data?.id ?? listSlug ?? '');
    const toast = useToast();
    const confirm = useConfirm();

    const [config, setConfig] = useState<CustomTemplateConfigV2>(emptyCustomConfigV2());
    const [initialized, setInitialized] = useState(false);

    // Sample record para el preview en el canvas.
    const sample = useRecords(list.data?.id, { per_page: 1, page: 1 });
    const sampleRecord: RecordEntity | null = sample.data?.data[0] ?? null;

    useEffect(() => {
        if (! list.data || ! fields.data || initialized) return;
        const settings = list.data.settings as {
            crm_template_id?: string;
            crm_template_custom?: unknown;
        };
        // 0.35.2 fix: priorizamos `crm_template_custom` SIEMPRE que
        // exista, sin importar qué plantilla esté activa. El custom
        // es trabajo del user — switchear a una built-in y volver
        // NO debería borrarlo. Antes el chequeo era
        // `&& crm_template_id === 'custom'` y al volver del switch
        // veías un fresh built-in en lugar de tu config personal.
        if (settings.crm_template_custom) {
            setConfig(ensureV2(settings.crm_template_custom));
        } else {
            setConfig(customConfigV2FromBuiltin(settings.crm_template_id ?? 'auto', fields.data));
        }
        setInitialized(true);
    }, [list.data, fields.data, initialized]);

    const mockSample = useMemo<RecordEntity>(
        () => sampleRecord ?? buildMockRecord(fields.data ?? []),
        [sampleRecord, fields.data],
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
        setConfig(customConfigV2FromBuiltin(builtinId, fields.data));
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
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="imcrm-gap-2">
                                <RotateCcw className="imcrm-h-3.5 imcrm-w-3.5" />
                                {__('Restaurar desde…')}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="imcrm-min-w-[260px]">
                            {CRM_TEMPLATES.map((t) => (
                                <DropdownMenuItem
                                    key={t.id}
                                    onSelect={() => void handleResetFromBuiltin(t.id)}
                                >
                                    <span className="imcrm-flex imcrm-flex-col imcrm-items-start">
                                        <span className="imcrm-font-medium">{t.name}</span>
                                        <span className="imcrm-text-[11px] imcrm-text-muted-foreground">
                                            {t.description}
                                        </span>
                                    </span>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
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

            <HeaderEditor fields={fields.data} config={config} onChange={setConfig} />

            <GridEditor
                listId={list.data.id}
                fields={fields.data}
                config={config}
                onChange={setConfig}
                sampleRecord={mockSample}
            />
        </div>
    );
}

function buildMockRecord(fields: import('@/types/field').FieldEntity[]): RecordEntity {
    const sampleByType: Record<string, unknown> = {
        text: 'Ejemplo',
        long_text: 'Texto largo de muestra para previsualizar el campo.',
        email: 'cliente@ejemplo.com',
        url: 'https://ejemplo.com',
        number: 42,
        currency: 1500,
        date: new Date().toISOString().slice(0, 10),
        datetime: new Date().toISOString().slice(0, 19),
        checkbox: true,
        select: '',
        multi_select: [],
        user: 0,
        file: 0,
    };

    const fieldsBlob: Record<string, unknown> = {};
    for (const f of fields) {
        if (f.type === 'relation') continue;
        if (f.type === 'select') {
            const opts = (f.config as { options?: Array<{ value: string }> }).options;
            fieldsBlob[f.slug] = Array.isArray(opts) && opts[0] ? opts[0].value : '';
        } else if (f.type === 'multi_select') {
            const opts = (f.config as { options?: Array<{ value: string }> }).options;
            fieldsBlob[f.slug] = Array.isArray(opts) && opts[0] ? [opts[0].value] : [];
        } else {
            fieldsBlob[f.slug] = sampleByType[f.type] ?? '';
        }
    }

    return {
        id: 0,
        fields: fieldsBlob,
        relations: {},
        created_by: 0,
        created_at: new Date().toISOString().replace('Z', '').replace('T', ' '),
        updated_at: new Date().toISOString().replace('Z', '').replace('T', ' '),
    };
}
