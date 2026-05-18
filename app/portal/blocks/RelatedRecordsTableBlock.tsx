import { useEffect, useState } from 'react';

import { fetchRelatedRecords } from '../api';
import type { PortalBootData, PortalRecord } from '../types';

interface Props {
    config: {
        list_slug?: string;
        visible_field_slugs?: string[];
        title?: string;
        per_page?: number;
    };
    boot: PortalBootData;
}

/**
 * Bloque `related_records_table` (Fase 9 — 3.D). Renderiza records
 * de una lista relacionada al cliente. El backend (PortalController +
 * PortalScopeService) garantiza que SOLO devuelve records del cliente
 * actual — confiamos en eso.
 *
 * Fetch on-mount, sin paginación interactiva todavía (llega cuando
 * el bloque tenga UI más rica en 3.E). Para 3.D: primera página y
 * footer con conteo.
 */
export function RelatedRecordsTableBlock({ config, boot }: Props): JSX.Element {
    const listSlug = config.list_slug ?? '';
    const perPage = config.per_page ?? 10;
    const columns = config.visible_field_slugs ?? [];

    const [records, setRecords] = useState<PortalRecord[] | null>(null);
    const [total, setTotal] = useState(0);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (listSlug === '') {
            setError('Bloque no configurado: falta list_slug.');
            return;
        }
        const ac = new AbortController();
        fetchRelatedRecords(boot, listSlug, { page: 1, per_page: perPage }, ac.signal)
            .then((res) => {
                setRecords(res.data);
                setTotal(res.meta.total);
            })
            .catch((err: unknown) => {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                setError('No se pudieron cargar los registros.');
            });
        return () => ac.abort();
    }, [boot, listSlug, perPage]);

    return (
        <section className="imcrm-portal-block imcrm-portal-block--related">
            <h2 className="imcrm-portal-block__title">{config.title ?? listSlug}</h2>

            {error !== null ? (
                <p className="imcrm-portal-block__error" role="alert">
                    {error}
                </p>
            ) : records === null ? (
                <p className="imcrm-portal-block__loading">Cargando…</p>
            ) : records.length === 0 ? (
                <p className="imcrm-portal-block__empty">No hay registros para mostrar.</p>
            ) : (
                <>
                    <table className="imcrm-portal-related-table">
                        <thead>
                            <tr>
                                {columns.map((slug) => (
                                    <th key={slug}>{slug}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {records.map((rec) => (
                                <tr key={rec.id}>
                                    {columns.map((slug) => (
                                        <td key={slug}>{renderCell(rec.fields[slug])}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {total > records.length ? (
                        <p className="imcrm-portal-related-table__footer">
                            Mostrando {records.length} de {total} registros.
                        </p>
                    ) : null}
                </>
            )}
        </section>
    );
}

function renderCell(value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    if (value === true || value === 1 || value === '1') return '✓';
    if (value === false || value === 0 || value === '0') return '✗';
    if (Array.isArray(value)) return value.map(String).join(', ');
    return String(value);
}
