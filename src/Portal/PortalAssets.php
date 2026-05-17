<?php
declare(strict_types=1);

namespace ImaginaCRM\Portal;

use ImaginaCRM\Plugin;

/**
 * Enqueue lazy del CSS del portal (Fase 9 — 3.B).
 *
 * Mismo patrón que `PublicAssets` de Fase 8: solo carga el CSS en
 * páginas que contienen el shortcode `[imcrm-client-portal]`. Impacto
 * cero en TTFB para páginas sin el shortcode.
 *
 * El JS llega en 3.F (bundle `app/portal.tsx`) — esta clase ya tiene
 * el slot listo.
 */
final class PortalAssets
{
    public const HANDLE_CSS = 'imagina-crm-portal';

    public function register(): void
    {
        add_action('wp_enqueue_scripts', [$this, 'maybeEnqueue']);
    }

    public function maybeEnqueue(): void
    {
        if (! $this->currentPageNeedsAssets()) {
            return;
        }
        wp_enqueue_style(
            self::HANDLE_CSS,
            IMAGINA_CRM_URL . 'assets/portal.css',
            [],
            Plugin::VERSION,
        );

        // Slot para el bundle JS de 3.F:
        //
        //   wp_enqueue_script(
        //       'imagina-crm-portal',
        //       IMAGINA_CRM_URL . 'dist/portal.js',
        //       [],
        //       Plugin::VERSION,
        //       true,
        //   );
    }

    private function currentPageNeedsAssets(): bool
    {
        if (! function_exists('get_post')) {
            return false;
        }
        $post = get_post();
        if ($post === null) {
            return false;
        }
        $content = (string) $post->post_content;
        if ($content === '') {
            return false;
        }
        return function_exists('has_shortcode') && has_shortcode($content, PortalShortcode::TAG);
    }
}
