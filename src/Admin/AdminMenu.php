<?php
declare(strict_types=1);

namespace ImaginaCRM\Admin;

use ImaginaCRM\Plugin;
use ImaginaCRM\Standalone\StandalonePage;

/**
 * Registra la entrada del plugin en el menú de wp-admin.
 *
 * Desde 0.13.0 el SPA vive en una página standalone fuera de wp-admin
 * (`/imagina-crm/`). El menú lateral de WP es solo un launcher: el
 * `menu_slug` que pasamos a `add_menu_page` es la URL standalone
 * directamente — WP detecta el `://` y la usa como `href` sin
 * intermediar por `admin.php?page=...`. Cero round-trips, cero
 * pantalla en blanco con "click aquí".
 *
 * Para bookmarks viejos a `admin.php?page=imagina-crm` mantenemos
 * un redirect defensivo en `admin_init` (corre antes de cualquier
 * output, así `wp_safe_redirect` siempre funciona).
 */
final class AdminMenu
{
    public function register(): void
    {
        add_action('admin_menu', [$this, 'registerMenu']);
        add_action('admin_init', [$this, 'maybeRedirectLegacy']);
    }

    public function registerMenu(): void
    {
        // `menu_slug` con `://` → WP lo trata como link externo y no
        // intenta resolverlo via admin.php?page=<slug>. El callback
        // queda como no-op (nunca se ejecuta, pero `add_menu_page`
        // requiere un callable válido).
        add_menu_page(
            __('Imagina CRM', 'imagina-crm'),
            __('Imagina CRM', 'imagina-crm'),
            Plugin::ADMIN_CAPABILITY,
            StandalonePage::url(),
            '__return_null',
            'dashicons-rest-api',
            58,
        );
    }

    /**
     * Backwards compat para URLs viejas (`/wp-admin/admin.php?page=imagina-crm`).
     * `admin_init` corre antes de cualquier output del admin → el
     * redirect siempre puede setear headers.
     */
    public function maybeRedirectLegacy(): void
    {
        if (! is_admin() || ! current_user_can(Plugin::ADMIN_CAPABILITY)) {
            return;
        }
        $page = isset($_GET['page']) && is_string($_GET['page']) ? sanitize_key(wp_unslash($_GET['page'])) : '';
        if ($page !== Plugin::ADMIN_PAGE) {
            return;
        }
        wp_safe_redirect(StandalonePage::url());
        exit;
    }
}
