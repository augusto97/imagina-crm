<?php
/**
 * Imagina CRM uninstall handler.
 *
 * Por defecto NO se eliminan datos del usuario al desinstalar (ADR-007 — los
 * datos del cliente nunca se bloquean ni se borran por licencia/desinstalación).
 * Si el usuario activa explícitamente la opción `imcrm_purge_on_uninstall`,
 * se eliminan tablas del sistema, dinámicas y opciones del plugin.
 *
 * @package ImaginaCRM
 */

declare(strict_types=1);

if (! defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

$purge = (bool) get_option('imcrm_purge_on_uninstall', false);

if (! $purge) {
    return;
}

// Roles y capabilities del plugin (Fase 7). Se remueven incluso en uninstall
// porque son metadata WP, no datos del usuario — y dejarlos atrás contamina
// la instalación si el plugin se vuelve a instalar más adelante.
$autoload_path = __DIR__ . '/vendor/autoload.php';
if (is_readable($autoload_path)) {
    require_once $autoload_path;
    if (class_exists(\ImaginaCRM\Permissions\RoleInstaller::class)) {
        (new \ImaginaCRM\Permissions\RoleInstaller())->uninstall();
    }
}

global $wpdb;

$prefix = $wpdb->prefix . 'imcrm_';

$dynamic_tables = $wpdb->get_col(
    $wpdb->prepare(
        'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = %s AND TABLE_NAME LIKE %s',
        DB_NAME,
        $wpdb->esc_like($prefix . 'data_') . '%'
    )
);

foreach ((array) $dynamic_tables as $table) {
    $wpdb->query('DROP TABLE IF EXISTS `' . esc_sql($table) . '`');
}

$system_tables = [
    'automation_runs',
    'automations',
    'dashboards',
    'slug_history',
    'relations',
    'activity',
    'comments',
    'saved_views',
    'fields',
    'lists',
];

foreach ($system_tables as $table) {
    $wpdb->query('DROP TABLE IF EXISTS `' . esc_sql($prefix . $table) . '`');
}

delete_option('imcrm_db_version');
delete_option('imcrm_settings');
delete_option('imcrm_purge_on_uninstall');
delete_option('imcrm_license');
