<?php
declare(strict_types=1);

namespace ImaginaCRM\Admin;

use ImaginaCRM\Plugin;
use ImaginaCRM\Standalone\StandalonePage;

/**
 * Registra la entrada del plugin en el menú de wp-admin.
 *
 * Desde 0.13.0 el SPA vive en una página standalone fuera de wp-admin
 * (`/imagina-crm/`) — sin chrome, sin styles bleed, más rápido. El
 * menú de WP lateral sigue existiendo como entry point familiar
 * pero el render callback ya NO monta el SPA inline; redirige al
 * usuario a la URL standalone.
 *
 * Razón: tener un único mental model — todos los clicks del menú
 * llevan al mismo lugar; los bookmarks viejos a admin.php?page=...
 * también, sin sorpresas de estilos rotos por wp-admin chrome.
 */
final class AdminMenu
{
    public function register(): void
    {
        add_action('admin_menu', [$this, 'registerMenu']);
    }

    public function registerMenu(): void
    {
        add_menu_page(
            __('Imagina CRM', 'imagina-crm'),
            __('Imagina CRM', 'imagina-crm'),
            Plugin::ADMIN_CAPABILITY,
            Plugin::ADMIN_PAGE,
            [$this, 'redirectToStandalone'],
            'dashicons-rest-api',
            58,
        );
    }

    /**
     * Render callback de la página de wp-admin. NO renderea el SPA;
     * redirige a la URL standalone. Si por alguna razón el redirect
     * falla (headers ya enviados, etc.) renderea un link manual.
     */
    public function redirectToStandalone(): void
    {
        if (! current_user_can(Plugin::ADMIN_CAPABILITY)) {
            wp_die(esc_html__('No tienes permiso para acceder a Imagina CRM.', 'imagina-crm'));
        }

        $target = StandalonePage::url();

        if (! headers_sent()) {
            wp_safe_redirect($target);
            exit;
        }

        printf(
            '<div class="wrap"><h1>%s</h1><p>%s <a href="%s">%s</a>.</p></div>',
            esc_html__('Imagina CRM', 'imagina-crm'),
            esc_html__('Esta página vive ahora en una URL standalone.', 'imagina-crm'),
            esc_url($target),
            esc_html__('Abrir Imagina CRM', 'imagina-crm'),
        );
    }
}
