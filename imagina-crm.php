<?php
/**
 * Plugin Name:       Imagina CRM
 * Plugin URI:        https://imaginawp.com/imagina-crm
 * Description:       Plataforma de gestión de listas, registros y automatizaciones tipo ClickUp/Airtable nativa en WordPress.
 * Version:           0.30.8
 * Requires at least: 6.4
 * Requires PHP:      8.2
 * Author:            IMAGINA LA WEB S.A.S.
 * Author URI:        https://imaginawp.com
 * License:           GPL v2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       imagina-crm
 * Domain Path:       /languages
 *
 * @package ImaginaCRM
 */

declare(strict_types=1);

if (! defined('ABSPATH')) {
    exit;
}

if (defined('IMAGINA_CRM_VERSION')) {
    return;
}

define('IMAGINA_CRM_VERSION', '0.30.8');
define('IMAGINA_CRM_FILE', __FILE__);
define('IMAGINA_CRM_DIR', plugin_dir_path(__FILE__));
define('IMAGINA_CRM_URL', plugin_dir_url(__FILE__));
define('IMAGINA_CRM_BASENAME', plugin_basename(__FILE__));
define('IMAGINA_CRM_TEXT_DOMAIN', 'imagina-crm');
// Bump this whenever SchemaManager::installSystemTables changes (nuevas
// tablas o nuevos índices). El runtime upgrade en Plugin::register()
// compara contra `imcrm_db_version` en wp_options y re-ejecuta dbDelta
// si difieren — así los updates desde el WP admin (sin desactivar/
// reactivar) reciben el nuevo schema automáticamente.
//
// Historial:
//  '1' — schema inicial (Fase 1).
//  '2' — añade tablas automations + automation_runs (Fase 2),
//        dashboards (Fase 5).
//  '3' — añade tabla saved_filters (Fase polish: filtros ClickUp-style
//        con AND/OR + nested + saved sets — 0.17.0).
//  '4' — añade tabla recurrences (recurrencia ClickUp-style en campos
//        date/datetime — 0.21.0).
//  '5' — añade columna `is_indexed` a wp_imcrm_fields (toggle opt-in
//        de índice MySQL no-unique sobre la columna del field — 0.29.0).
//  '6' — añade tablas search_tokens + search_documents (Tier 3:
//        motor de búsqueda propio con índice invertido + BM25 — 0.30.0).
define('IMAGINA_CRM_DB_VERSION', '6');
define('IMAGINA_CRM_MIN_PHP', '8.2');
define('IMAGINA_CRM_MIN_WP', '6.4');

if (version_compare(PHP_VERSION, IMAGINA_CRM_MIN_PHP, '<')) {
    add_action('admin_notices', static function (): void {
        echo '<div class="notice notice-error"><p>';
        echo esc_html(
            sprintf(
                /* translators: 1: required PHP version, 2: current PHP version */
                __('Imagina CRM requires PHP %1$s or higher. You are running PHP %2$s.', 'imagina-crm'),
                IMAGINA_CRM_MIN_PHP,
                PHP_VERSION
            )
        );
        echo '</p></div>';
    });
    return;
}

$imagina_crm_autoload = IMAGINA_CRM_DIR . 'vendor/autoload.php';

if (! is_readable($imagina_crm_autoload)) {
    add_action('admin_notices', static function (): void {
        echo '<div class="notice notice-error"><p>';
        echo esc_html__(
            'Imagina CRM no encontró el autoload de Composer. Ejecuta "composer install" en el directorio del plugin.',
            'imagina-crm'
        );
        echo '</p></div>';
    });
    return;
}

require_once $imagina_crm_autoload;

// Salvaguarda: el bundle de Vite (`dist/manifest.json`) tiene que existir
// para que el admin React cargue. Si el plugin se instaló desde el código
// fuente sin ejecutar `npm run build`, avisamos antes de que el usuario
// vea una pantalla en blanco. (Las descargas de la rama `release` ya lo
// incluyen, así que esto solo dispara para developers.)
if (is_admin() && ! is_readable(IMAGINA_CRM_DIR . 'dist/manifest.json')) {
    add_action('admin_notices', static function (): void {
        echo '<div class="notice notice-warning"><p>';
        echo esc_html__(
            'Imagina CRM: el bundle JS no está compilado. Ejecuta "npm ci && npm run build" en el directorio del plugin, o descarga el ZIP pre-compilado desde la rama "release" del repositorio.',
            'imagina-crm'
        );
        echo '</p></div>';
    });
}

// Action Scheduler: librería de WooCommerce reutilizada para colas y cron
// del plugin. Su entry point debe cargarse antes de `plugins_loaded` para
// que `as_enqueue_async_action()` y compañía estén disponibles globalmente.
$imagina_crm_action_scheduler = IMAGINA_CRM_DIR . 'vendor/woocommerce/action-scheduler/action-scheduler.php';
if (is_readable($imagina_crm_action_scheduler)) {
    require_once $imagina_crm_action_scheduler;
}

register_activation_hook(__FILE__, [\ImaginaCRM\Activation\Installer::class, 'activate']);
register_deactivation_hook(__FILE__, [\ImaginaCRM\Activation\Deactivator::class, 'deactivate']);

add_action('plugins_loaded', static function (): void {
    \ImaginaCRM\Plugin::boot();
}, 5);
