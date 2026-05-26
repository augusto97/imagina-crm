import { useEffect, useState } from 'react';

import { fetchMe } from './api';
import { ActivityTimelineBlock } from './blocks/ActivityTimelineBlock';
import { ClientDataBlock } from './blocks/ClientDataBlock';
import { CommentsThreadBlock } from './blocks/CommentsThreadBlock';
import { ContactCardBlock } from './blocks/ContactCardBlock';
import { DividerBlock } from './blocks/DividerBlock';
import { DownloadFilesBlock } from './blocks/DownloadFilesBlock';
import { EditableFormBlock } from './blocks/EditableFormBlock';
import { ExternalLinkBlock } from './blocks/ExternalLinkBlock';
import { FaqBlock } from './blocks/FaqBlock';
import { HeadingBlock } from './blocks/HeadingBlock';
import { HeroBlock } from './blocks/HeroBlock';
import { KpiWidgetBlock } from './blocks/KpiWidgetBlock';
import { NoticeBlock } from './blocks/NoticeBlock';
import { QuickActionsBlock } from './blocks/QuickActionsBlock';
import { RelatedRecordsTableBlock } from './blocks/RelatedRecordsTableBlock';
import { StaticTextBlock } from './blocks/StaticTextBlock';
import { StatsGridBlock } from './blocks/StatsGridBlock';
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

    // Layout grid 12-col cuando los bloques tienen posiciones (Fase 9
     // grid editor). Si están ausentes (templates pre-grid o sin
     // configurar), caemos a layout vertical clásico — backward-compat
     // total con instalaciones existentes.
    const hasGridLayout = data.template.blocks.some(
        (b) => typeof b.x === 'number' && typeof b.y === 'number' && typeof b.w === 'number' && typeof b.h === 'number',
    );

    return (
        <div
            className={hasGridLayout ? 'imcrm-portal-grid' : undefined}
            style={hasGridLayout ? { '--imcrm-portal-grid-cols': 12 } as React.CSSProperties : undefined}
        >
            {data.template.blocks.map((block, idx) => {
                const rendered = renderBlock(block, idx, data, boot);
                if (rendered === null) return null;
                if (hasGridLayout) {
                    return (
                        <div
                            key={idx}
                            className="imcrm-portal-grid__cell"
                            style={{
                                gridColumn: `${(block.x ?? 0) + 1} / span ${block.w ?? 12}`,
                                gridRow: `${(block.y ?? 0) + 1} / span ${block.h ?? 4}`,
                            }}
                        >
                            {rendered}
                        </div>
                    );
                }
                return rendered;
            })}
        </div>
    );
}

function renderBlock(
    block: PortalMeResponse['data']['template']['blocks'][number],
    idx: number,
    data: PortalMeResponse['data'],
    boot: PortalBootData,
): JSX.Element | null {
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
        case 'comments_thread':
            return <CommentsThreadBlock key={idx} config={block.config} boot={boot} />;
        case 'heading':
            return <HeadingBlock key={idx} config={block.config} />;
        case 'hero':
            return <HeroBlock key={idx} config={block.config} record={data.record} />;
        case 'stats_grid':
            return <StatsGridBlock key={idx} config={block.config} boot={boot} />;
        case 'quick_actions':
            return <QuickActionsBlock key={idx} config={block.config} />;
        case 'notice':
            return <NoticeBlock key={idx} config={block.config} />;
        case 'divider':
            return <DividerBlock key={idx} config={block.config} />;
        case 'faq':
            return <FaqBlock key={idx} config={block.config} />;
        case 'contact_card':
            return <ContactCardBlock key={idx} config={block.config} />;
        default:
            return null;
    }
}
