<?php
declare(strict_types=1);

/**
 * Bootstrap exclusivo de PHPStan: declara las constantes que se definen en
 * runtime al cargar `imagina-crm.php`, para que el análisis estático las
 * reconozca sin tener que ejecutar el archivo de bootstrap real.
 */

if (! defined('IMAGINA_CRM_VERSION')) {
    define('IMAGINA_CRM_VERSION', '0.0.0');
}
if (! defined('IMAGINA_CRM_FILE')) {
    define('IMAGINA_CRM_FILE', __FILE__);
}
if (! defined('IMAGINA_CRM_DIR')) {
    define('IMAGINA_CRM_DIR', __DIR__ . '/');
}
if (! defined('IMAGINA_CRM_URL')) {
    define('IMAGINA_CRM_URL', '');
}
if (! defined('IMAGINA_CRM_BASENAME')) {
    define('IMAGINA_CRM_BASENAME', 'imagina-crm/imagina-crm.php');
}
if (! defined('IMAGINA_CRM_TEXT_DOMAIN')) {
    define('IMAGINA_CRM_TEXT_DOMAIN', 'imagina-crm');
}
if (! defined('IMAGINA_CRM_DB_VERSION')) {
    define('IMAGINA_CRM_DB_VERSION', '1');
}
if (! defined('IMAGINA_CRM_MIN_PHP')) {
    define('IMAGINA_CRM_MIN_PHP', '8.2');
}
if (! defined('IMAGINA_CRM_MIN_WP')) {
    define('IMAGINA_CRM_MIN_WP', '6.4');
}
