import { useEffect, useMemo, useState } from 'react';
import { Download, FileText } from 'lucide-react';

import type { PortalRecord } from '../types';

interface Props {
    config: {
        title?: string;
        /** Slug del field tipo `file` cuyo valor es un attachment ID (o array). */
        field_slug?: string;
    };
    record: PortalRecord;
}

interface ResolvedAttachment {
    id: number;
    title: string;
    url: string;
}

/**
 * Bloque `download_files` (Fase 9 — pulidos). Lista archivos
 * adjuntos al record del cliente.
 *
 * Implementación 100% client-side — usa el endpoint nativo de WP
 * `/wp-json/wp/v2/media/<id>` que es público para attachments. No
 * requiere agregar superficie REST al plugin.
 *
 * Edge cases:
 *  - Field tipo `file` con valor null/0 → "sin archivo".
 *  - Si el field permite múltiples archivos (array de IDs) → lista
 *    cada uno.
 *  - Si el media endpoint devuelve 404 (attachment borrado) → se
 *    omite del listado (no se muestra entry rota).
 */
export function DownloadFilesBlock({ config, record }: Props): JSX.Element {
    const fieldSlug = config.field_slug ?? '';
    const value = record.fields[fieldSlug];
    const attachmentIds = useMemo(() => normalizeAttachmentIds(value), [value]);

    const [items, setItems] = useState<ResolvedAttachment[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (fieldSlug === '') {
            setError('Bloque no configurado: falta field_slug.');
            return;
        }
        if (attachmentIds.length === 0) {
            setItems([]);
            return;
        }

        const ac = new AbortController();
        // El endpoint nativo de WP acepta múltiples IDs como
        // `?include=1,2,3`. Eso ahorra round-trips.
        const url = `/wp-json/wp/v2/media?include=${attachmentIds.join(',')}&per_page=${attachmentIds.length}`;
        fetch(url, { signal: ac.signal, credentials: 'same-origin' })
            .then(async (res) => {
                if (!res.ok) throw new Error(`http-${res.status}`);
                const body = (await res.json()) as Array<{
                    id: number;
                    title: { rendered: string };
                    source_url: string;
                }>;
                setItems(
                    body.map((m) => ({
                        id: m.id,
                        title: stripHtml(m.title.rendered) || `Archivo #${m.id}`,
                        url: m.source_url,
                    })),
                );
            })
            .catch((err: unknown) => {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                setError('No se pudieron cargar los archivos.');
            });
        return () => ac.abort();
    }, [attachmentIds, fieldSlug]);

    return (
        <section className="imcrm-portal-block imcrm-portal-block--downloads">
            <h2 className="imcrm-portal-block__title">{config.title ?? 'Archivos'}</h2>
            {error !== null ? (
                <p className="imcrm-portal-block__error" role="alert">
                    {error}
                </p>
            ) : items === null ? (
                <p className="imcrm-portal-block__loading">Cargando…</p>
            ) : items.length === 0 ? (
                <p className="imcrm-portal-block__empty">Sin archivos disponibles.</p>
            ) : (
                <ul className="imcrm-portal-downloads">
                    {items.map((att) => (
                        <li key={att.id} className="imcrm-portal-downloads__item">
                            <FileText className="imcrm-portal-downloads__icon" aria-hidden />
                            <a
                                href={att.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="imcrm-portal-downloads__link"
                                download
                            >
                                {att.title}
                            </a>
                            <Download className="imcrm-portal-downloads__action" aria-hidden />
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

/**
 * Normaliza el valor del field a array de attachment IDs.
 * El field tipo `file` puede guardar:
 *  - un único int (single file).
 *  - array de ints (multiple files — config.multiple = true).
 *  - null / 0 / '' → sin archivos.
 */
function normalizeAttachmentIds(value: unknown): number[] {
    if (value === null || value === undefined || value === '' || value === 0) return [];
    if (typeof value === 'number') return value > 0 ? [value] : [];
    if (typeof value === 'string') {
        const n = parseInt(value, 10);
        return n > 0 ? [n] : [];
    }
    if (Array.isArray(value)) {
        const out: number[] = [];
        for (const v of value) {
            if (typeof v === 'number' && v > 0) out.push(v);
            else if (typeof v === 'string') {
                const n = parseInt(v, 10);
                if (n > 0) out.push(n);
            }
        }
        return out;
    }
    return [];
}

function stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, '').trim();
}
