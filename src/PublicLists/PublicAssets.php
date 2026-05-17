<?php
declare(strict_types=1);

namespace ImaginaCRM\PublicLists;

use ImaginaCRM\Plugin;

/**
 * Enqueue de assets para el shortcode/bloque `[imcrm-list]` (Fase 8 — 2.B).
 *
 * Estrategia para no penalizar el TTFB del frontend:
 *
 *  1. Registramos el handle SIEMPRE en `wp_enqueue_scripts` (cheap —
 *     solo declara el asset, no lo carga).
 *  2. Usamos `wp_enqueue_*` solo si la página contiene el shortcode o
 *     el bloque. Esto se detecta perezosamente vía `has_shortcode` /
 *     `has_block` en el hook `wp_enqueue_scripts` que corre DESPUÉS de
 *     `the_post` (cuando WordPress ya sabe qué contenido va a renderizar).
 *
 *  3. Para páginas que no consumen el shortcode, el CSS NO se carga →
 *     impacto cero en TTFB.
 *
 * El JS (bundle público) llega en 2.C — esta clase tiene el slot listo
 * para enqueuearlo cuando exista.
 */
final class PublicAssets
{
    public const HANDLE_CSS = 'imagina-crm-public-list';

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
            IMAGINA_CRM_URL . 'assets/public-list.css',
            [],
            Plugin::VERSION,
        );

        // Slot para enqueuear el bundle JS público en 2.C:
        //
        //   wp_enqueue_script(
        //       'imagina-crm-public',
        //       IMAGINA_CRM_URL . 'dist/public.js',
        //       [],
        //       Plugin::VERSION,
        //       true,
        //   );
        //   wp_script_add_data('imagina-crm-public', 'type', 'module');
        //
        // En 2.B servimos solo HTML server-side renderizado por el
        // shortcode — sin JS la tabla es funcional para SEO/first paint.
    }

    /**
     * `true` si la página actual contiene el shortcode `[imcrm-list]` o
     * el bloque Gutenberg `imagina-crm/list` (este último llega en 2.D).
     *
     * Detección defensiva: el hook `wp_enqueue_scripts` corre después de
     * que WordPress preparó el post principal, así que `get_post()`
     * funciona. Si por alguna razón no hay post (request 404, sitemap
     * dinámico, etc.), salimos sin enqueue.
     */
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

        $hasShortcode = function_exists('has_shortcode') && has_shortcode($content, Shortcode::TAG);
        $hasBlock = function_exists('has_block') && has_block('imagina-crm/list', $content);

        // Filtro `imagina_crm/public_list/force_enqueue` para casos
        // edge: temas que renderizan el shortcode desde una llamada a
        // `do_shortcode` dentro de un widget/template hook donde
        // `has_shortcode` sobre `post_content` no lo detecta.
        if (function_exists('apply_filters')) {
            $forced = (bool) apply_filters('imagina_crm/public_list/force_enqueue', false, $post);
            if ($forced) {
                return true;
            }
        }
        return $hasShortcode || $hasBlock;
    }
}
