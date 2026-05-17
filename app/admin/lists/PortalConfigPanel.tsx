import { useEffect, useMemo, useState } from 'react';
import { Copy, UserRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useFields } from '@/hooks/useFields';
import { useUpdateList } from '@/hooks/useLists';
import { ApiError } from '@/lib/api';
import { __ } from '@/lib/i18n';
import type { ListSummary } from '@/types/list';
import { PORTAL_BLOCK_TYPES, PORTAL_DEFAULTS, type PortalSettings, type PortalTemplate } from '@/types/portal';

interface Props {
    list: ListSummary;
}

/**
 * Tab "Configuración del portal" del List Builder (Fase 9 — UI admin).
 *
 * Permite al admin configurar:
 *  1. `settings.portal` — habilita la lista como lista-de-portal,
 *     elige el campo de owner (tipo user) que liga records a wp_users.
 *  2. `settings.portal_template` — define qué bloques aparecen en
 *     el portal del cliente.
 *
 * Editor del template: textarea JSON con validación. Un editor visual
 * drag-and-drop es trabajo significativo para una iteración futura —
 * por ahora el admin escribe (o copia/pega) la config del template.
 * Hay un botón "Insertar ejemplo" para cada tipo de bloque que ayuda
 * sin tener que memorizar el shape.
 */
export function PortalConfigPanel({ list }: Props): JSX.Element {
    const update = useUpdateList(list.id);
    const fields = useFields(list.id);

    const initialPortal = useMemo<PortalSettings>(() => readPortal(list.settings), [list.settings]);
    const initialTemplate = useMemo<PortalTemplate>(() => readTemplate(list.settings), [list.settings]);

    const [portal, setPortal] = useState<PortalSettings>(initialPortal);
    const [templateJson, setTemplateJson] = useState<string>(
        JSON.stringify(initialTemplate, null, 2),
    );
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [copyHint, setCopyHint] = useState<string | null>(null);

    useEffect(() => {
        setPortal(initialPortal);
        setTemplateJson(JSON.stringify(initialTemplate, null, 2));
    }, [initialPortal, initialTemplate]);

    const userFields = useMemo(() => (fields.data ?? []).filter((f) => f.type === 'user'), [fields.data]);

    const insertBlockExample = (type: string): void => {
        let current: PortalTemplate;
        try {
            current = JSON.parse(templateJson) as PortalTemplate;
            if (!Array.isArray(current.blocks)) current = { blocks: [] };
        } catch {
            current = { blocks: [] };
        }
        current.blocks.push({ type: type as PortalTemplate['blocks'][number]['type'], config: exampleConfigFor(type) });
        setTemplateJson(JSON.stringify(current, null, 2));
        setJsonError(null);
    };

    const handleSave = async (): Promise<void> => {
        setSubmitError(null);
        setJsonError(null);

        let parsedTemplate: PortalTemplate;
        try {
            parsedTemplate = JSON.parse(templateJson) as PortalTemplate;
            if (typeof parsedTemplate !== 'object' || parsedTemplate === null) {
                throw new Error('No es un objeto');
            }
            if (!Array.isArray(parsedTemplate.blocks)) {
                throw new Error('Debe tener una propiedad `blocks: []`');
            }
        } catch (err) {
            setJsonError(
                err instanceof Error
                    ? `JSON inválido: ${err.message}`
                    : 'JSON inválido',
            );
            return;
        }

        // Validación coherencia: si owner_field_id está seteado, debe
        // existir Y ser tipo `user`. El backend igual valida, pero
        // alertar acá ahorra un round-trip.
        if (portal.owner_field_id !== null) {
            const f = userFields.find((x) => x.id === portal.owner_field_id);
            if (f === undefined) {
                setSubmitError(__('El campo de owner seleccionado no existe o no es de tipo Usuario.'));
                return;
            }
        }

        if (portal.enabled && portal.owner_field_id === null) {
            setSubmitError(__('Para habilitar el portal debes elegir un campo de tipo Usuario como owner.'));
            return;
        }

        try {
            const nextSettings = mergeIntoSettings(list.settings, portal, parsedTemplate);
            await update.mutateAsync({ settings: nextSettings });
        } catch (err) {
            setSubmitError(
                err instanceof ApiError || err instanceof Error ? err.message : __('Error desconocido'),
            );
        }
    };

    const handleCopyShortcode = async (): Promise<void> => {
        try {
            await navigator.clipboard.writeText('[imcrm-client-portal]');
            setCopyHint(__('Copiado al portapapeles.'));
            window.setTimeout(() => setCopyHint(null), 2000);
        } catch {
            setCopyHint(__('No se pudo copiar — selecciónalo manualmente.'));
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="imcrm-flex imcrm-items-start imcrm-gap-3">
                    <UserRound className="imcrm-mt-0.5 imcrm-h-5 imcrm-w-5 imcrm-text-muted-foreground" />
                    <div>
                        <CardTitle>{__('Portal del cliente')}</CardTitle>
                        <CardDescription>
                            {__(
                                'Marca esta lista como "lista de portal" para que sus registros se conviertan en cuentas accesibles desde el frontend. Cada record corresponde a un cliente.',
                            )}
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="imcrm-flex imcrm-flex-col imcrm-gap-4">
                <label className="imcrm-inline-flex imcrm-items-center imcrm-gap-2 imcrm-text-sm imcrm-font-medium">
                    <input
                        type="checkbox"
                        checked={portal.enabled}
                        onChange={(e) => setPortal((p) => ({ ...p, enabled: e.target.checked }))}
                        className="imcrm-h-4 imcrm-w-4 imcrm-rounded imcrm-border-input"
                    />
                    {__('Habilitar como lista de portal')}
                </label>

                {portal.enabled && (
                    <>
                        <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                            <Label htmlFor="portal-owner-field">{__('Campo de owner (tipo Usuario)')}</Label>
                            <select
                                id="portal-owner-field"
                                className="imcrm-h-9 imcrm-w-full imcrm-max-w-md imcrm-rounded-md imcrm-border imcrm-border-input imcrm-bg-background imcrm-px-3 imcrm-text-sm"
                                value={portal.owner_field_id ?? ''}
                                onChange={(e) =>
                                    setPortal((p) => ({
                                        ...p,
                                        owner_field_id: e.target.value === '' ? null : parseInt(e.target.value, 10),
                                    }))
                                }
                            >
                                <option value="">{__('— Elegir campo —')}</option>
                                {userFields.map((f) => (
                                    <option key={f.id} value={f.id}>
                                        {f.label} ({f.slug})
                                    </option>
                                ))}
                            </select>
                            <p className="imcrm-text-xs imcrm-text-muted-foreground">
                                {__(
                                    'Este campo conecta cada record de cliente con su cuenta WP. Si no hay campos de tipo Usuario, agrega uno primero.',
                                )}
                            </p>
                        </div>

                        <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                            <div className="imcrm-flex imcrm-items-center imcrm-justify-between imcrm-gap-3">
                                <Label htmlFor="portal-template-json">{__('Template del portal (JSON)')}</Label>
                                <div className="imcrm-flex imcrm-gap-2">
                                    {PORTAL_BLOCK_TYPES.map((bt) => (
                                        <button
                                            key={bt.value}
                                            type="button"
                                            onClick={() => insertBlockExample(bt.value)}
                                            className="imcrm-rounded imcrm-border imcrm-border-input imcrm-bg-background imcrm-px-2 imcrm-py-1 imcrm-text-xs hover:imcrm-bg-muted"
                                            title={__('Insertar ejemplo de bloque')}
                                        >
                                            + {bt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <Textarea
                                id="portal-template-json"
                                value={templateJson}
                                onChange={(e) => {
                                    setTemplateJson(e.target.value);
                                    setJsonError(null);
                                }}
                                rows={14}
                                className="imcrm-font-mono imcrm-text-xs"
                            />
                            {jsonError !== null && (
                                <p className="imcrm-text-xs imcrm-text-destructive">{jsonError}</p>
                            )}
                            <p className="imcrm-text-xs imcrm-text-muted-foreground">
                                {__(
                                    'Si dejas blocks: [], el portal renderiza un template default con los datos del cliente. Para empezar, click en los botones de arriba para insertar ejemplos.',
                                )}
                            </p>
                        </div>

                        <div className="imcrm-rounded-md imcrm-border imcrm-border-border imcrm-bg-muted/30 imcrm-px-3 imcrm-py-3">
                            <div className="imcrm-flex imcrm-items-center imcrm-justify-between imcrm-gap-2">
                                <code className="imcrm-truncate imcrm-font-mono imcrm-text-xs">
                                    [imcrm-client-portal]
                                </code>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => void handleCopyShortcode()}
                                    className="imcrm-gap-1.5"
                                >
                                    <Copy className="imcrm-h-3.5 imcrm-w-3.5" />
                                    {__('Copiar')}
                                </Button>
                            </div>
                            <p className="imcrm-mt-1.5 imcrm-text-xs imcrm-text-muted-foreground">
                                {__('Pega este shortcode en cualquier página WP para mostrar el portal a los clientes logueados.')}
                            </p>
                            {copyHint !== null && (
                                <p className="imcrm-mt-1 imcrm-text-xs imcrm-text-primary">{copyHint}</p>
                            )}
                        </div>
                    </>
                )}

                {!portal.enabled && (
                    <p className="imcrm-rounded-md imcrm-border imcrm-border-dashed imcrm-border-border imcrm-bg-muted/30 imcrm-px-3 imcrm-py-3 imcrm-text-xs imcrm-text-muted-foreground">
                        {__(
                            'Esta lista no está marcada como portal. Los endpoints /portal/* devuelven 404 cuando se pide referencia a esta lista.',
                        )}
                    </p>
                )}

                {submitError !== null && (
                    <div className="imcrm-rounded-md imcrm-border imcrm-border-destructive/40 imcrm-bg-destructive/10 imcrm-p-3 imcrm-text-sm imcrm-text-destructive">
                        {submitError}
                    </div>
                )}

                <div className="imcrm-flex imcrm-justify-end">
                    <Button onClick={handleSave} disabled={update.isPending}>
                        {update.isPending ? __('Guardando…') : __('Guardar configuración del portal')}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

// ───────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────

function readPortal(settings: Record<string, unknown>): PortalSettings {
    const raw = settings.portal;
    if (raw === null || raw === undefined || typeof raw !== 'object') {
        return { ...PORTAL_DEFAULTS };
    }
    const p = raw as Record<string, unknown>;
    return {
        enabled: Boolean(p.enabled),
        owner_field_id:
            typeof p.owner_field_id === 'number' && p.owner_field_id > 0 ? p.owner_field_id : null,
        default_template_id:
            typeof p.default_template_id === 'number' && p.default_template_id > 0
                ? p.default_template_id
                : null,
    };
}

function readTemplate(settings: Record<string, unknown>): PortalTemplate {
    const raw = settings.portal_template;
    if (raw === null || raw === undefined || typeof raw !== 'object') {
        return { blocks: [] };
    }
    const t = raw as Record<string, unknown>;
    if (!Array.isArray(t.blocks)) return { blocks: [] };
    return { blocks: t.blocks as PortalTemplate['blocks'] };
}

function mergeIntoSettings(
    current: Record<string, unknown>,
    portal: PortalSettings,
    template: PortalTemplate,
): Record<string, unknown> {
    return {
        ...current,
        portal,
        portal_template: template,
    };
}

function exampleConfigFor(type: string): Record<string, unknown> {
    switch (type) {
        case 'static_text':
            return { html: '<p>Bienvenido a tu portal.</p>', title: 'Bienvenida' };
        case 'client_data':
            return { visible_field_slugs: ['nombre', 'email'], title: 'Mis datos' };
        case 'editable_form':
            return {
                editable_field_slugs: ['telefono', 'direccion'],
                title: 'Actualizar mis datos',
                submit_label: 'Guardar',
            };
        case 'related_records_table':
            return {
                list_slug: 'facturas',
                visible_field_slugs: ['fecha', 'monto', 'estado'],
                title: 'Mis facturas',
                per_page: 10,
            };
        case 'kpi_widget':
            return {
                list_slug: 'facturas',
                field_id: 0,
                metric: 'count',
                title: 'Total de facturas',
            };
        case 'external_link':
            return {
                href: 'https://example.com',
                label: 'Visitar',
                title: 'Acción externa',
                new_window: true,
            };
        default:
            return {};
    }
}
