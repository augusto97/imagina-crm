<?php
declare(strict_types=1);

/**
 * Bootstrap PHPUnit para tests UNITARIOS.
 *
 * No depende de un WordPress real: stubs mínimos de constantes y de las
 * funciones que tocan los servicios bajo test. Para tests de integración con
 * MySQL/REST se añadirá un bootstrap aparte que arranque el suite oficial de
 * WordPress.
 */

if (! defined('ABSPATH')) {
    define('ABSPATH', sys_get_temp_dir() . '/imcrm-test-abspath/');
}

if (! defined('IMAGINA_CRM_VERSION')) {
    define('IMAGINA_CRM_VERSION', '0.0.0-test');
}
if (! defined('IMAGINA_CRM_FILE')) {
    define('IMAGINA_CRM_FILE', __FILE__);
}
if (! defined('IMAGINA_CRM_DIR')) {
    define('IMAGINA_CRM_DIR', dirname(__DIR__) . '/');
}
if (! defined('IMAGINA_CRM_URL')) {
    define('IMAGINA_CRM_URL', 'http://example.test/wp-content/plugins/imagina-crm/');
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

if (! class_exists('wpdb')) {
    /**
     * Stub vacío para que los typehints `wpdb` resuelvan en tests unitarios.
     * Las dobles concretas extienden esta clase y añaden lo que necesiten.
     */
    class wpdb // phpcs:ignore
    {
        public string $prefix = 'wp_';
        public int $insert_id = 0;
    }
}

if (! function_exists('__')) {
    function __(string $text, string $domain = 'default'): string
    {
        unset($domain);
        return $text;
    }
}

if (! function_exists('esc_sql')) {
    function esc_sql(string $value): string
    {
        return addslashes($value);
    }
}

if (! function_exists('current_time')) {
    function current_time(string $type, int|bool $gmt = 0): string
    {
        unset($type, $gmt);
        return gmdate('Y-m-d H:i:s');
    }
}

if (! function_exists('get_current_user_id')) {
    function get_current_user_id(): int
    {
        return 1;
    }
}

if (! function_exists('wp_json_encode')) {
    function wp_json_encode(mixed $data): string
    {
        return json_encode($data) ?: '{}';
    }
}

/**
 * Stubs de la options API: store en memoria, reseteable entre tests con
 * `imcrm_test_reset_options()`.
 */
$GLOBALS['imcrm_test_options'] = [];

if (! function_exists('get_option')) {
    function get_option(string $name, mixed $default = false): mixed
    {
        return $GLOBALS['imcrm_test_options'][$name] ?? $default;
    }
}
if (! function_exists('update_option')) {
    function update_option(string $name, mixed $value, bool $autoload = true): bool
    {
        unset($autoload);
        $GLOBALS['imcrm_test_options'][$name] = $value;
        return true;
    }
}
if (! function_exists('delete_option')) {
    function delete_option(string $name): bool
    {
        unset($GLOBALS['imcrm_test_options'][$name]);
        return true;
    }
}
if (! function_exists('imcrm_test_reset_options')) {
    function imcrm_test_reset_options(): void
    {
        $GLOBALS['imcrm_test_options'] = [];
    }
}

if (! function_exists('home_url')) {
    function home_url(string $path = ''): string
    {
        return 'https://example.test' . $path;
    }
}

if (! function_exists('do_action')) {
    function do_action(string $hook, mixed ...$args): void
    {
        unset($hook, $args);
    }
}

if (! function_exists('apply_filters')) {
    function apply_filters(string $hook, mixed $value, mixed ...$args): mixed
    {
        unset($hook, $args);
        return $value;
    }
}

if (! defined('DAY_IN_SECONDS')) {
    define('DAY_IN_SECONDS', 86400);
}
if (! defined('HOUR_IN_SECONDS')) {
    define('HOUR_IN_SECONDS', 3600);
}

if (! function_exists('remove_accents')) {
    /**
     * Stub minimalista. La implementación real de WP es mucho más completa,
     * pero este reemplazo cubre los casos comunes de prueba (acentos en
     * vocales y eñe).
     */
    function remove_accents(string $string): string
    {
        $map = [
            'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u',
            'Á' => 'A', 'É' => 'E', 'Í' => 'I', 'Ó' => 'O', 'Ú' => 'U', 'Ü' => 'U',
            'ñ' => 'n', 'Ñ' => 'N',
            'à' => 'a', 'è' => 'e', 'ì' => 'i', 'ò' => 'o', 'ù' => 'u',
            'â' => 'a', 'ê' => 'e', 'î' => 'i', 'ô' => 'o', 'û' => 'u',
        ];
        return strtr($string, $map);
    }
}

require_once dirname(__DIR__) . '/vendor/autoload.php';
