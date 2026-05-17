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

/**
 * Stub controlable de `wp_mail()`. Los tests ajustan el comportamiento
 * vía:
 *  - `$GLOBALS['imcrm_test_mail_calls']`: array donde cada llamada deja
 *    su payload (`to`, `subject`, `message`, `headers`).
 *  - `$GLOBALS['imcrm_test_mail_should_succeed']`: bool, por defecto true.
 */
$GLOBALS['imcrm_test_mail_calls'] = [];
$GLOBALS['imcrm_test_mail_should_succeed'] = true;

if (! function_exists('wp_mail')) {
    /**
     * @param string|array<int, string>            $to
     * @param array<int, string>|string            $headers
     */
    function wp_mail(string|array $to, string $subject, string $message, array|string $headers = []): bool
    {
        $GLOBALS['imcrm_test_mail_calls'][] = [
            'to'      => $to,
            'subject' => $subject,
            'message' => $message,
            'headers' => $headers,
        ];
        return (bool) ($GLOBALS['imcrm_test_mail_should_succeed'] ?? true);
    }
}

if (! function_exists('is_email')) {
    function is_email(string $email): bool
    {
        return (bool) filter_var($email, FILTER_VALIDATE_EMAIL);
    }
}

/**
 * Stubs de Action Scheduler. Cada llamada deja un registro en
 * `$GLOBALS['imcrm_test_as_calls']` para inspección.
 */
$GLOBALS['imcrm_test_as_calls'] = [];

if (! function_exists('as_enqueue_async_action')) {
    /**
     * @param array<int, mixed> $args
     */
    function as_enqueue_async_action(string $hook, array $args = [], string $group = ''): int
    {
        $GLOBALS['imcrm_test_as_calls'][] = [
            'kind' => 'async',
            'hook' => $hook,
            'args' => $args,
            'group' => $group,
            'when' => null,
        ];
        return count($GLOBALS['imcrm_test_as_calls']);
    }
}

if (! function_exists('as_schedule_single_action')) {
    /**
     * @param array<int, mixed> $args
     */
    function as_schedule_single_action(int $when, string $hook, array $args = [], string $group = ''): int
    {
        $GLOBALS['imcrm_test_as_calls'][] = [
            'kind' => 'single',
            'hook' => $hook,
            'args' => $args,
            'group' => $group,
            'when' => $when,
        ];
        return count($GLOBALS['imcrm_test_as_calls']);
    }
}

if (! function_exists('home_url')) {
    function home_url(string $path = ''): string
    {
        return 'https://example.test' . $path;
    }
}

if (! function_exists('admin_url')) {
    function admin_url(string $path = ''): string
    {
        return 'https://example.test/wp-admin/' . ltrim($path, '/');
    }
}

/**
 * Stub controlable de get_user_by. Los tests llenan
 * `$GLOBALS['imcrm_test_users']` con `[$key => stdClass]` donde `$key`
 * es el `id`/`login` que se va a buscar (prefijo "id:" / "login:").
 */
$GLOBALS['imcrm_test_users'] = [];

if (! function_exists('get_user_by')) {
    function get_user_by(string $field, mixed $value): mixed
    {
        $key = $field . ':' . (string) $value;
        return $GLOBALS['imcrm_test_users'][$key] ?? false;
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

if (! function_exists('wp_date')) {
    function wp_date(string $format, ?int $timestamp = null): string
    {
        return date($format, $timestamp ?? time());
    }
}

if (! function_exists('get_user_meta')) {
    function get_user_meta(int $userId, string $key = '', bool $single = false): mixed
    {
        unset($userId, $key, $single);
        return ''; // sin metadata en unit tests
    }
}

if (! function_exists('update_user_meta')) {
    function update_user_meta(int $userId, string $key, mixed $value): bool
    {
        unset($userId, $key, $value);
        return true;
    }
}

if (! function_exists('get_userdata')) {
    function get_userdata(int $userId): mixed
    {
        unset($userId);
        return false;
    }
}

/**
 * Stubs de la API de roles de WP. Estado en `$GLOBALS['imcrm_test_roles']`
 * con shape `[$slug => WP_Role]`. Reseteable con
 * `imcrm_test_reset_roles()`.
 *
 * El rol `administrator` se pre-crea vacío para que los tests que
 * comprueban "el admin recibe todas las caps" puedan operar sin setup.
 */
if (! class_exists('WP_Role')) {
    class WP_Role // phpcs:ignore
    {
        public string $name;

        /** @var array<string, bool> */
        public array $capabilities;

        /**
         * @param array<string, bool> $capabilities
         */
        public function __construct(string $name, array $capabilities = [])
        {
            $this->name         = $name;
            $this->capabilities = $capabilities;
        }

        public function add_cap(string $cap, bool $grant = true): void // phpcs:ignore
        {
            $this->capabilities[$cap] = $grant;
        }

        public function remove_cap(string $cap): void // phpcs:ignore
        {
            unset($this->capabilities[$cap]);
        }

        public function has_cap(string $cap): bool // phpcs:ignore
        {
            return ! empty($this->capabilities[$cap]);
        }
    }
}

$GLOBALS['imcrm_test_roles'] = [
    'administrator' => new WP_Role('administrator', []),
];

if (! function_exists('imcrm_test_reset_roles')) {
    function imcrm_test_reset_roles(): void
    {
        $GLOBALS['imcrm_test_roles'] = [
            'administrator' => new WP_Role('administrator', []),
        ];
    }
}

if (! function_exists('get_role')) {
    function get_role(string $slug): ?WP_Role
    {
        return $GLOBALS['imcrm_test_roles'][$slug] ?? null;
    }
}

if (! function_exists('add_role')) {
    /**
     * @param array<string, bool> $capabilities
     */
    function add_role(string $slug, string $displayName, array $capabilities = []): ?WP_Role
    {
        unset($displayName);
        if (isset($GLOBALS['imcrm_test_roles'][$slug])) {
            return null; // mimic WP: ya existe → no-op
        }
        $role = new WP_Role($slug, $capabilities);
        $GLOBALS['imcrm_test_roles'][$slug] = $role;
        return $role;
    }
}

if (! function_exists('remove_role')) {
    function remove_role(string $slug): void
    {
        unset($GLOBALS['imcrm_test_roles'][$slug]);
    }
}

/**
 * Stub minimalista de `WP_User`. Los tests instancian con el constructor
 * (ID + roles). `user_can()` consulta las caps agregadas a los roles que
 * tenga asignados en `$GLOBALS['imcrm_test_roles']`.
 */
if (! class_exists('WP_User')) {
    class WP_User // phpcs:ignore
    {
        public int $ID;

        /** @var list<string> */
        public array $roles;

        /**
         * @param list<string> $roles
         */
        public function __construct(int $id = 0, array $roles = [])
        {
            $this->ID    = $id;
            $this->roles = $roles;
        }
    }
}

if (! function_exists('user_can')) {
    function user_can(WP_User $user, string $cap): bool
    {
        foreach ($user->roles as $role) {
            $r = $GLOBALS['imcrm_test_roles'][$role] ?? null;
            if ($r instanceof WP_Role && $r->has_cap($cap)) {
                return true;
            }
        }
        return false;
    }
}

if (! function_exists('current_user_can')) {
    function current_user_can(string $cap): bool
    {
        // Override directo via callable (útil para tests que no quieren
        // armar un WP_User completo — ej. BlockTest).
        $override = $GLOBALS['imcrm_test_current_user_can'] ?? null;
        if (is_callable($override)) {
            return (bool) $override($cap);
        }
        $user = $GLOBALS['imcrm_test_current_user'] ?? null;
        if ($user instanceof WP_User) {
            return user_can($user, $cap);
        }
        return false;
    }
}

if (! function_exists('rest_authorization_required_code')) {
    function rest_authorization_required_code(): int
    {
        return 401;
    }
}

/**
 * Stubs de funciones de escape/output de WP. Los tests del Shortcode
 * (Fase 8 — 2.B) consumen estos para renderizar HTML sin un WP real.
 * Las versiones reales aplican sanitización más estricta — estos
 * stubs son suficientes para validar shape del output, no seguridad.
 */
if (! function_exists('esc_html')) {
    function esc_html(string $text): string
    {
        return htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}
if (! function_exists('esc_attr')) {
    function esc_attr(string $text): string
    {
        return htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}
if (! function_exists('esc_url')) {
    function esc_url(string $url): string
    {
        return htmlspecialchars($url, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}
if (! function_exists('esc_html__')) {
    function esc_html__(string $text, string $domain = 'default'): string
    {
        unset($domain);
        return esc_html($text);
    }
}
if (! function_exists('esc_attr__')) {
    function esc_attr__(string $text, string $domain = 'default'): string
    {
        unset($domain);
        return esc_attr($text);
    }
}
if (! function_exists('_n')) {
    function _n(string $single, string $plural, int $count, string $domain = 'default'): string
    {
        unset($domain);
        return $count === 1 ? $single : $plural;
    }
}
if (! function_exists('rest_url')) {
    function rest_url(string $path = ''): string
    {
        return 'https://example.test/wp-json/' . ltrim($path, '/');
    }
}

if (! function_exists('wp_kses_post')) {
    function wp_kses_post(string $html): string
    {
        // En unit tests devolvemos tal cual; el filtro real de WP solo
        // aplica al runtime.
        return $html;
    }
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
