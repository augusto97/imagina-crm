<?php
declare(strict_types=1);

namespace ImaginaCRM\Admin;

use ImaginaCRM\Plugin;

/**
 * Registra la entrada del plugin en el menú de WordPress y monta el shell
 * React (un único `<div id="imcrm-root">`). Toda la navegación interna ocurre
 * en el frontend con React Router (HashRouter), por eso aquí no hay subpáginas.
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
            [$this, 'renderShell'],
            'dashicons-rest-api',
            58
        );
    }

    public function renderShell(): void
    {
        if (! current_user_can(Plugin::ADMIN_CAPABILITY)) {
            wp_die(esc_html__('No tienes permiso para acceder a Imagina CRM.', 'imagina-crm'));
        }

        printf(
            '<div id="imcrm-root" class="imcrm-app-root" data-imcrm-theme="light" data-imcrm-version="%s"></div>',
            esc_attr(Plugin::VERSION)
        );

        printf(
            '<noscript><div class="notice notice-warning"><p>%s</p></div></noscript>',
            esc_html__('Imagina CRM requiere JavaScript para funcionar.', 'imagina-crm')
        );
    }
}
