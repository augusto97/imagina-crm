import { useEffect, useState } from 'react';

import { fetchMe } from './api';
import { ActivityTimelineBlock } from './blocks/ActivityTimelineBlock';
import { ClientDataBlock } from './blocks/ClientDataBlock';
import { DownloadFilesBlock } from './blocks/DownloadFilesBlock';
import { EditableFormBlock } from './blocks/EditableFormBlock';
import { ExternalLinkBlock } from './blocks/ExternalLinkBlock';
import { KpiWidgetBlock } from './blocks/KpiWidgetBlock';
import { RelatedRecordsTableBlock } from './blocks/RelatedRecordsTableBlock';
import { StaticTextBlock } from './blocks/StaticTextBlock';
import type { PortalBootData, PortalMeResponse } from './types';

interface Props {
    boot: PortalBootData;
}

/**
 * Renderer principal del portal (Fase 9 — 3.D).
 *
 * Pide `/portal/me` on-mount, recibe `template.blocks` + `record` y
 * los itera renderizando el componente apropiado por `block.type`.
 *
 * El primer paint del shortcode ya muestra el saludo del cliente y
 * un placeholder "El portal está cargando…". Cuando el fetch resuelve,
 * reemplazamos por los bloques renderizados.
 *
 * Bloques desconocidos (versionado futuro) se ignoran silenciosamente
 * — mismo patrón que el parser PHP (`PortalTemplate::fromListSettings`).
 */
export function PortalRenderer({ boot }: Props): JSX.Element {
    const [data, setData] = useState<PortalMeResponse['data'] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const ac = new AbortController();
        fetchMe(boot, ac.signal)
            .then((res) => setData(res.data))
            .catch((err: unknown) => {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                if (err instanceof Error) {
                    setError(
                        err.message === 'not-authorized'
                            ? 'No tienes permiso para ver este portal.'
                            : err.message === 'not-found'
                            ? 'No encontramos tu portal.'
                            : 'No se pudo cargar el portal. Reintenta en unos segundos.',
                    );
                }
            });
        return () => ac.abort();
    }, [boot]);

    if (error !== null) {
        return (
            <div className="imcrm-portal-card imcrm-portal-card--error" role="alert">
                <p className="imcrm-portal-card__body">{error}</p>
            </div>
        );
    }

    if (data === null) {
        return <p className="imcrm-portal-block__loading">Cargando tu portal…</p>;
    }

    return (
        <>
            {data.template.blocks.map((block, idx) => {
                switch (block.type) {
                    case 'static_text':
                        return <StaticTextBlock key={idx} config={block.config} />;
                    case 'client_data':
                        return <ClientDataBlock key={idx} config={block.config} record={data.record} />;
                    case 'related_records_table':
                        return <RelatedRecordsTableBlock key={idx} config={block.config} boot={boot} />;
                    case 'editable_form':
                        return (
                            <EditableFormBlock
                                key={idx}
                                config={block.config}
                                record={data.record}
                                boot={boot}
                            />
                        );
                    case 'external_link':
                        return <ExternalLinkBlock key={idx} config={block.config} />;
                    case 'kpi_widget':
                        return <KpiWidgetBlock key={idx} config={block.config} boot={boot} />;
                    case 'activity_timeline':
                        return <ActivityTimelineBlock key={idx} config={block.config} boot={boot} />;
                    case 'download_files':
                        return <DownloadFilesBlock key={idx} config={block.config} record={data.record} />;
                    default:
                        // Bloques desconocidos: ignorar silenciosamente.
                        return null;
                }
            })}
        </>
    );
}
