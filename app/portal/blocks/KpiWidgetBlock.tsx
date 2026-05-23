import { useEffect, useState } from 'react';

import type { PortalBootData } from '../types';

interface Props {
    config: {
        title?: string;
        list_slug?: string;
        field_id?: number;
        /**
         * Tipo de agregado a mostrar. RecordAggregator emite varios
         * (count, sum, avg, min, max, etc.) — el bloque elige uno.
         */
        metric?: 'count' | 'sum' | 'avg' | 'min' | 'max';
        suffix?: string;
        prefix?: string;
    };
    boot: PortalBootData;
}

/**
 * Bloque `kpi_widget` (Fase 9 — 3.E). Muestra una métrica simple
 * (count/sum/avg/min/max) sobre records relacionados al cliente.
 *
 * Reusa el endpoint `/portal/lists/{slug}/aggregates` que aplica el
 * scope SQL del portal automáticamente — la métrica NUNCA incluye
 * records ajenos.
 */
export function KpiWidgetBlock({ config, boot }: Props): JSX.Element {
    const [value, setValue] = useState<string | number | null | undefined>(undefined);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const listSlug = config.list_slug ?? '';
        const fieldId = config.field_id ?? 0;
        const metric = config.metric ?? 'count';
        if (listSlug === '' || (metric !== 'count' && fieldId <= 0)) {
            setError('Bloque no configurado correctamente.');
            return;
        }

        const ac = new AbortController();
        const url =
            `${boot.rest_root.replace(/\/$/, '')}/portal/lists/${encodeURIComponent(listSlug)}/aggregates` +
            `?fields=${fieldId > 0 ? fieldId : ''}`;

        fetch(url, {
            signal: ac.signal,
            credentials: 'same-origin',
            headers: { Accept: 'application/json', 'X-WP-Nonce': boot.rest_nonce },
        })
            .then(async (res) => {
                if (!res.ok) throw new Error(`http-${res.status}`);
                const body = (await res.json()) as {
                    data: { totals: Record<string, Record<string, unknown>> };
                };
                const totals = body.data.totals;
                // El shape de totals es `{slug: {count, sum, avg, ...}}`.
                // Tomamos el PRIMER slug (solo pedimos uno) y la metric pedida.
                const firstSlug = Object.keys(totals)[0];
                const entry = firstSlug !== undefined ? totals[firstSlug] : null;
                if (entry === null || entry === undefined) {
                    setValue(null);
                    return;
                }
                const raw = entry[metric];
                if (raw === null || raw === undefined) {
                    setValue(null);
                    return;
                }
                setValue(raw as string | number);
            })
            .catch((err: unknown) => {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                setError('No se pudo calcular la métrica.');
            });
        return () => ac.abort();
    }, [boot, config.list_slug, config.field_id, config.metric]);

    return (
        <section className="imcrm-portal-block imcrm-portal-block--kpi">
            {config.title !== undefined && config.title !== '' ? (
                <p className="imcrm-portal-kpi__label">{config.title}</p>
            ) : null}
            {error !== null ? (
                <p className="imcrm-portal-block__error" role="alert">
                    {error}
                </p>
            ) : value === undefined ? (
                <p className="imcrm-portal-block__loading">Cargando…</p>
            ) : (
                <p className="imcrm-portal-kpi__value">
                    {config.prefix ?? ''}
                    {value === null ? '—' : String(value)}
                    {config.suffix ?? ''}
                </p>
            )}
        </section>
    );
}
