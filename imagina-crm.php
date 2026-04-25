<?php
/**
 * Plugin Name:       Imagina CRM
 * Plugin URI:        https://imaginawp.com/imagina-crm
 * Description:       Plataforma de gestión de listas, registros y automatizaciones tipo ClickUp/Airtable nativa en WordPress.
 * Version:           0.1.0
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

define('IMAGINA_CRM_VERSION', '0.1.0');
define('IMAGINA_CRM_FILE', __FILE__);
define('IMAGINA_CRM_DIR', plugin_dir_path(__FILE__));
define('IMAGINA_CRM_URL', plugin_dir_url(__FILE__));
define('IMAGINA_CRM_BASENAME', plugin_basename(__FILE__));
define('IMAGINA_CRM_TEXT_DOMAIN', 'imagina-crm');
define('IMAGINA_CRM_DB_VERSION', '1');
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

register_activation_hook(__FILE__, [\ImaginaCRM\Activation\Installer::class, 'activate']);
register_deactivation_hook(__FILE__, [\ImaginaCRM\Activation\Deactivator::class, 'deactivate']);

add_action('plugins_loaded', static function (): void {
    \ImaginaCRM\Plugin::boot();
}, 5);
