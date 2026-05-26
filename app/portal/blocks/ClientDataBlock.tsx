import type { PortalRecord } from '../types';

interface Props {
    config: {
        visible_field_slugs?: string[];
        title?: string;
        variant?: 'definition_list' | 'cards';
    };
    record: PortalRecord;
}

/**
 * Bloque `client_data`. Muestra los campos del record cliente.
 *
 * Variantes:
 *  - `definition_list` (default) — `<dl>` denso label izq / valor der.
 *  - `cards` — grid 2-col, cada campo en su card propia.
 */
export function ClientDataBlock({ config, record }: Props): JSX.Element {
    const slugs = config.visible_field_slugs ?? [];
    const fields = record.fields;
    const variant = config.variant ?? 'definition_list';

    return (
        <section className="imcrm-portal-block imcrm-portal-block--client-data">
            <h2 className="imcrm-portal-block__title">{config.title ?? 'Mis datos'}</h2>
            {slugs.length === 0 ? (
                <p className="imcrm-portal-block__empty">
                    Este bloque no tiene campos configurados.
                </p>
            ) : variant === 'cards' ? (
                <div className="imcrm-portal-data-cards">
                    {slugs.map((slug) => (
                        <div key={slug} className="imcrm-portal-data-cards__item">
                            <p className="imcrm-portal-data-cards__label">{slug}</p>
                            <div className="imcrm-portal-data-cards__value">
                                {renderValue(fields[slug])}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <dl className="imcrm-portal-data-list">
                    {slugs.map((slug) => (
                        <div key={slug} className="imcrm-portal-data-list__item">
                            <dt className="imcrm-portal-data-list__label">{slug}</dt>
                            <dd className="imcrm-portal-data-list__value">
                                {renderValue(fields[slug])}
                            </dd>
                        </div>
                    ))}
                </dl>
            )}
        </section>
    );
}

function renderValue(value: unknown): JSX.Element | string {
    if (value === null || value === undefined || value === '') {
        return <span className="imcrm-portal-data-list__empty">—</span>;
    }
    if (Array.isArray(value)) {
        return (
            <>
                {value.map((v, i) => (
                    <span key={i} className="imcrm-portal-pill">
                        {String(v)}
                    </span>
                ))}
            </>
        );
    }
    if (value === true || value === 1 || value === '1') return '✓';
    if (value === false || value === 0 || value === '0') return '✗';
    return String(value);
}
