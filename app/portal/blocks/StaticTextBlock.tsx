interface Props {
    config: { html?: string; title?: string; variant?: 'card' | 'plain' };
}

/**
 * Bloque `static_text`. Renderiza HTML estático configurado por el
 * admin. Soporta variante `card` (default, con border + bg) o `plain`
 * (sin marco, fluye con el contexto).
 *
 * El HTML viene server-side y el admin es quien lo configuró —
 * trusted. Si el modelo cambia para permitir input del cliente, hay
 * que pasar por `dompurify` antes.
 */
export function StaticTextBlock({ config }: Props): JSX.Element {
    const variant = config.variant ?? 'card';
    const variantClass =
        variant === 'plain'
            ? 'imcrm-portal-block--plain'
            : 'imcrm-portal-block--card';
    return (
        <section
            className={`imcrm-portal-block imcrm-portal-block--static-text ${variantClass}`}
        >
            {config.title !== undefined && config.title !== '' ? (
                <h2 className="imcrm-portal-block__title">{config.title}</h2>
            ) : null}
            {config.html !== undefined && config.html !== '' ? (
                <div
                    className="imcrm-portal-block__content"
                    dangerouslySetInnerHTML={{ __html: config.html }}
                />
            ) : null}
        </section>
    );
}
