interface Props {
    config: { html?: string; title?: string };
}

/**
 * Bloque `static_text` (Fase 9 — 3.D). Renderiza HTML estático
 * configurado por el admin desde el template editor.
 *
 * El HTML viene server-side y el admin es quien lo configuró —
 * confiamos en su input. Si el modelo cambia en el futuro para
 * permitir input del cliente, hay que pasar por `dompurify` o
 * similar.
 */
export function StaticTextBlock({ config }: Props): JSX.Element {
    return (
        <section className="imcrm-portal-block imcrm-portal-block--static-text">
            {config.title !== undefined && config.title !== '' ? (
                <h2 className="imcrm-portal-block__title">{config.title}</h2>
            ) : null}
            {config.html !== undefined && config.html !== '' ? (
                <div
                    className="imcrm-portal-block__content"
                    // El HTML lo escribió el admin del CRM via template editor.
                    // Trusted source — mismo modelo que el `static_text` del
                    // panel CRM (ver `app/admin/records/crm/blocks/`).
                    dangerouslySetInnerHTML={{ __html: config.html }}
                />
            ) : null}
        </section>
    );
}
