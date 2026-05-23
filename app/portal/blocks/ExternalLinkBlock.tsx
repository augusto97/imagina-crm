interface Props {
    config: {
        title?: string;
        description?: string;
        href?: string;
        label?: string;
        new_window?: boolean;
    };
}

/**
 * Bloque `external_link` (Fase 9 — 3.E). Renderiza un CTA con link a
 * recurso externo. Útil para acciones como "Pagar factura",
 * "Descargar PDF", "Agendar reunión", etc.
 *
 * El admin configura el HREF — sin sustitución de merge tags por ahora
 * (queda para iteración futura si el usuario lo pide; con merge tags
 * tipo {{record.field}} se vuelve un mini-template engine).
 */
export function ExternalLinkBlock({ config }: Props): JSX.Element | null {
    const href = config.href?.trim() ?? '';
    if (href === '') return null;

    return (
        <section className="imcrm-portal-block imcrm-portal-block--external-link">
            {config.title !== undefined && config.title !== '' ? (
                <h2 className="imcrm-portal-block__title">{config.title}</h2>
            ) : null}
            {config.description !== undefined && config.description !== '' ? (
                <p className="imcrm-portal-block__content">{config.description}</p>
            ) : null}
            <a
                href={href}
                target={config.new_window !== false ? '_blank' : undefined}
                rel={config.new_window !== false ? 'noopener noreferrer' : undefined}
                className="imcrm-portal-card__btn imcrm-portal-external-link__btn"
            >
                {config.label ?? 'Abrir'}
            </a>
        </section>
    );
}
