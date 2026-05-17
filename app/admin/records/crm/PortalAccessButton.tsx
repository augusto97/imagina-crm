import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Check, Loader2, UserPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useFields } from '@/hooks/useFields';
import { api, ApiError } from '@/lib/api';
import { __ } from '@/lib/i18n';
import type { ListSummary } from '@/types/list';
import type { RecordEntity } from '@/types/record';

interface Props {
    list: ListSummary;
    record: RecordEntity;
}

/**
 * Botón "Crear acceso al portal" (Fase 9 — UI follow-up).
 *
 * Solo se renderiza si la lista está marcada como portal-list
 * (`settings.portal.enabled = true` con `owner_field_id` configurado).
 *
 * Lee el record actual: si el owner_field ya tiene un valor (cliente
 * con cuenta), muestra estado "✓ Acceso creado" deshabilitado. Si no,
 * un botón que llama a `POST /portal/lists/{slug}/records/{id}/access`.
 *
 * Tres estados resultantes:
 *  - 201 Created + `created: true`  → "Cuenta nueva creada".
 *  - 201 Created + `created: false` → "Cuenta existente vinculada".
 *  - Error → mensaje específico.
 *
 * Después del éxito, el componente queda en estado "acceso creado"
 * hasta que el usuario refresque (no invalida el record cache —
 * el record refleja el cambio sólo al recargar).
 */
export function PortalAccessButton({ list, record }: Props): JSX.Element | null {
    const portalCfg = useMemo(() => readPortal(list.settings), [list.settings]);
    const fields = useFields(list.id);

    // Resolvemos owner_field_id → slug usando los fields cargados.
    // Si fields aún no cargó, el botón espera (return null abajo).
    const ownerFieldSlug = useMemo(() => {
        if (portalCfg.ownerFieldId === null || fields.data === undefined) return null;
        const f = fields.data.find((x) => x.id === portalCfg.ownerFieldId);
        return f?.slug ?? null;
    }, [portalCfg.ownerFieldId, fields.data]);

    const [optimisticDone, setOptimisticDone] = useState(false);
    const [feedback, setFeedback] = useState<string | null>(null);

    const mutation = useMutation({
        mutationFn: async (): Promise<{ user_id: number; created: boolean; email: string }> => {
            const res = await api.post<{ user_id: number; created: boolean; email: string }>(
                `/portal/lists/${encodeURIComponent(list.slug)}/records/${record.id}/access`,
                { send_notification: true },
            );
            return res.data;
        },
        onSuccess: (data) => {
            setOptimisticDone(true);
            setFeedback(
                data.created
                    ? __('Cuenta creada. Email de bienvenida enviado.')
                    : __('Cuenta existente vinculada al registro.'),
            );
        },
        onError: (err: unknown) => {
            if (err instanceof ApiError || err instanceof Error) {
                setFeedback(err.message);
            } else {
                setFeedback(__('No se pudo crear el acceso.'));
            }
        },
    });

    // Out: no es lista de portal → no renderizamos nada.
    if (!portalCfg.enabled) {
        return null;
    }
    // Esperamos a que fields cargue para poder evaluar el estado
    // (hasAccess depende del valor del owner_field en el record).
    if (ownerFieldSlug === null) {
        return null;
    }

    // ¿Ya tiene user asociado? Lo sabemos por el valor del owner_field
    // en el record actual. El owner_field es tipo `user`, así que el
    // valor es un user_id numérico (o null/undefined si no asignado).
    const ownerValue = record.fields[ownerFieldSlug];
    const hasAccess = typeof ownerValue === 'number' && ownerValue > 0;
    const showSuccess = optimisticDone;

    return (
        <div className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-rounded-md imcrm-border imcrm-border-dashed imcrm-border-border imcrm-bg-muted/30 imcrm-px-3 imcrm-py-2 imcrm-text-sm">
            {hasAccess || showSuccess ? (
                <>
                    <Check className="imcrm-h-4 imcrm-w-4 imcrm-text-green-600" aria-hidden />
                    <span className="imcrm-font-medium">
                        {hasAccess ? __('Acceso al portal activo') : __('Acceso creado')}
                    </span>
                    {feedback !== null && (
                        <span className="imcrm-text-xs imcrm-text-muted-foreground">— {feedback}</span>
                    )}
                </>
            ) : (
                <>
                    <Button
                        size="sm"
                        variant="outline"
                        className="imcrm-gap-2"
                        onClick={() => mutation.mutate()}
                        disabled={mutation.isPending}
                    >
                        {mutation.isPending ? (
                            <Loader2 className="imcrm-h-3.5 imcrm-w-3.5 imcrm-animate-spin" />
                        ) : (
                            <UserPlus className="imcrm-h-3.5 imcrm-w-3.5" />
                        )}
                        {mutation.isPending ? __('Creando…') : __('Crear acceso al portal')}
                    </Button>
                    {feedback !== null && (
                        <span className="imcrm-text-xs imcrm-text-destructive">{feedback}</span>
                    )}
                </>
            )}
        </div>
    );
}

interface PortalSettingsView {
    enabled: boolean;
    ownerFieldId: number | null;
}

/**
 * Lee `settings.portal` con shape esperado:
 *   { enabled: bool, owner_field_id: int }
 *
 * Devuelve `enabled=false` si el shape no es válido (defensa frente
 * a settings con `enabled=true` pero `owner_field_id` faltante).
 */
function readPortal(settings: Record<string, unknown>): PortalSettingsView {
    const raw = settings.portal;
    if (raw === null || raw === undefined || typeof raw !== 'object') {
        return { enabled: false, ownerFieldId: null };
    }
    const p = raw as Record<string, unknown>;
    if (p.enabled !== true || typeof p.owner_field_id !== 'number' || p.owner_field_id <= 0) {
        return { enabled: false, ownerFieldId: null };
    }
    return { enabled: true, ownerFieldId: p.owner_field_id };
}
