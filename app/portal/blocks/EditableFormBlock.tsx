import { useState } from 'react';

import type { PortalBootData, PortalRecord } from '../types';

interface Props {
    config: {
        editable_field_slugs?: string[];
        title?: string;
        submit_label?: string;
    };
    record: PortalRecord;
    boot: PortalBootData;
}

/**
 * Bloque `editable_form` (Fase 9 — 3.E). Form para que el cliente
 * actualice un subset whitelisteado de sus propios campos.
 *
 * La whitelist se respeta TAMBIÉN server-side via
 * `PortalController::updateMe` — el backend rechaza con 403 cualquier
 * slug fuera de la lista declarada en el template. Acá la usamos solo
 * para renderizar los inputs correctos.
 *
 * Limitaciones de 3.E:
 *  - Tipos de input son todos `text` por ahora (no tenemos el `type`
 *    de cada field en el shape del template). Mejora: incluir
 *    `editable_field_types` en la config del bloque.
 *  - Sin validación client-side por tipo. El backend hace la
 *    validación real vía `RecordValidator`.
 */
export function EditableFormBlock({ config, record, boot }: Props): JSX.Element {
    const slugs = config.editable_field_slugs ?? [];
    const [values, setValues] = useState<Record<string, string>>(() => {
        const out: Record<string, string> = {};
        for (const slug of slugs) {
            const v = record.fields[slug];
            out[slug] = v === null || v === undefined ? '' : String(v);
        }
        return out;
    });
    const [submitting, setSubmitting] = useState(false);
    const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        setSubmitting(true);
        setFeedback(null);

        // Solo enviamos los slugs declarados — defensa adicional
        // contra inputs que se hayan colado en `values`.
        const payload: Record<string, string> = {};
        for (const slug of slugs) {
            const v = values[slug];
            if (v !== undefined) {
                payload[slug] = v;
            }
        }

        try {
            const url = `${boot.rest_root.replace(/\/$/, '')}/portal/me`;
            const res = await fetch(url, {
                method: 'PATCH',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': boot.rest_nonce,
                    Accept: 'application/json',
                },
                body: JSON.stringify({ fields: payload }),
            });
            if (!res.ok) {
                if (res.status === 403) {
                    setFeedback({ kind: 'error', msg: 'No tienes permiso para editar uno o más campos.' });
                } else if (res.status === 422) {
                    const body = await res.json().catch(() => null);
                    const firstErr = (body as { message?: string } | null)?.message;
                    setFeedback({
                        kind: 'error',
                        msg: firstErr ?? 'Algunos valores no son válidos.',
                    });
                } else {
                    setFeedback({ kind: 'error', msg: 'No se pudo guardar. Reintenta en unos segundos.' });
                }
                setSubmitting(false);
                return;
            }
            setFeedback({ kind: 'success', msg: 'Cambios guardados.' });
        } catch (err) {
            setFeedback({ kind: 'error', msg: 'Error de conexión. Reintenta.' });
            // eslint-disable-next-line no-console
            console.warn('[imagina-crm portal] update failed', err);
        } finally {
            setSubmitting(false);
        }
    };

    if (slugs.length === 0) {
        return (
            <section className="imcrm-portal-block imcrm-portal-block--editable-form">
                <h2 className="imcrm-portal-block__title">{config.title ?? 'Editar mis datos'}</h2>
                <p className="imcrm-portal-block__empty">
                    Este bloque no tiene campos editables configurados.
                </p>
            </section>
        );
    }

    return (
        <section className="imcrm-portal-block imcrm-portal-block--editable-form">
            <h2 className="imcrm-portal-block__title">{config.title ?? 'Editar mis datos'}</h2>
            <form className="imcrm-portal-form" onSubmit={handleSubmit}>
                {slugs.map((slug) => (
                    <div key={slug} className="imcrm-portal-form__field">
                        <label htmlFor={`imcrm-portal-${slug}`} className="imcrm-portal-form__label">
                            {slug}
                        </label>
                        <input
                            id={`imcrm-portal-${slug}`}
                            type="text"
                            className="imcrm-portal-form__input"
                            value={values[slug] ?? ''}
                            onChange={(e) => setValues((v) => ({ ...v, [slug]: e.target.value }))}
                            disabled={submitting}
                        />
                    </div>
                ))}
                {feedback !== null ? (
                    <p
                        className={`imcrm-portal-form__feedback imcrm-portal-form__feedback--${feedback.kind}`}
                        role={feedback.kind === 'error' ? 'alert' : 'status'}
                    >
                        {feedback.msg}
                    </p>
                ) : null}
                <button
                    type="submit"
                    disabled={submitting}
                    className="imcrm-portal-card__btn imcrm-portal-form__submit"
                >
                    {submitting ? 'Guardando…' : config.submit_label ?? 'Guardar'}
                </button>
            </form>
        </section>
    );
}
