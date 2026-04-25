<?php
declare(strict_types=1);

namespace ImaginaCRM\Activation;

use ImaginaCRM\Plugin;

/**
 * Activación del plugin.
 *
 * En Fase 0 sólo deja registrados los flags de versión. Las migraciones de
 * tablas (lists, fields, saved_views, comments, activity, relations,
 * slug_history) se añadirán en la Fase 1 vía `SchemaManager` + `Upgrader`.
 */
final class Installer
{
    public const OPTION_DB_VERSION = 'imcrm_db_version';
    public const OPTION_INSTALLED  = 'imcrm_installed_at';

    public static function activate(): void
    {
        if (version_compare(PHP_VERSION, IMAGINA_CRM_MIN_PHP, '<')) {
            deactivate_plugins(IMAGINA_CRM_BASENAME);
            wp_die(
                esc_html(
                    sprintf(
                        /* translators: 1: required PHP version, 2: current PHP version */
                        __('Imagina CRM requires PHP %1$s or higher. You are running PHP %2$s.', 'imagina-crm'),
                        IMAGINA_CRM_MIN_PHP,
                        PHP_VERSION
                    )
                ),
                esc_html__('Plugin activation error', 'imagina-crm'),
                ['back_link' => true]
            );
        }

        if (get_option(self::OPTION_INSTALLED) === false) {
            update_option(self::OPTION_INSTALLED, current_time('mysql', true), false);
        }

        update_option(self::OPTION_DB_VERSION, Plugin::DB_VERSION, false);

        if (! get_role('administrator') instanceof \WP_Role) {
            return;
        }

        flush_rewrite_rules();
    }
}
