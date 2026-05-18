import type { PortalRecord } from '../types';

interface Props {
    config: { visible_field_slugs?: string[]; title?: string };
    record: PortalRecord;
}

/**
 * Bloque `client_data` (Fase 9 — 3.D). Muestra los campos del record
 * cliente como una "ficha de datos" simple (label + valor).
 *
 * Para 3.D mostramos solo el valor crudo. Tipos especiales
 * (multi_select, checkbox, etc.) se formatean básicamente —
 * formatters elaborados llegan con el bloque más rico de 3.E o
 * cuando el shape `client_data.config` se extienda con `field_types`.
 */
export function ClientDataBlock({ config, record }: Props): JSX.Element {
    const slugs = config.visible_field_slugs ?? [];
    const fields = record.fields;

    return (
        <section className="imcrm-portal-block imcrm-portal-block--client-data">
            <h2 className="imcrm-portal-block__title">{config.title ?? 'Mis datos'}</h2>
            <dl className="imcrm-portal-data-list">
                {slugs.map((slug) => {
                    const value = fields[slug];
                    return (
                        <div key={slug} className="imcrm-portal-data-list__item">
                            <dt className="imcrm-portal-data-list__label">{slug}</dt>
                            <dd className="imcrm-portal-data-list__value">
                                {renderValue(value)}
                            </dd>
                        </div>
                    );
                })}
                {slugs.length === 0 ? (
                    <p className="imcrm-portal-block__empty">
                        Este bloque no tiene campos configurados.
                    </p>
                ) : null}
            </dl>
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
