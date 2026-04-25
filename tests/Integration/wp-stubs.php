<?php
declare(strict_types=1);

/**
 * Stubs WordPress mínimos para tests de integración.
 *
 * El objetivo es ejercitar la capa de persistencia (SchemaManager,
 * SlugManager, Services, QueryBuilder) contra una BD MySQL real, sin
 * depender del WP test suite oficial. Implementa una clase `wpdb`
 * compatible con la superficie usada por el plugin.
 *
 * Este bootstrap NO es un sustituto del runtime WP — no carga rewrite
 * rules, hooks, REST, etc. Solo apunta a validar que el SQL del plugin
 * funciona con un MySQL/MariaDB real.
 */

if (! defined('ABSPATH')) {
    define('ABSPATH', sys_get_temp_dir() . '/imcrm-int-abspath/');
}
if (! defined('IMAGINA_CRM_VERSION')) {
    define('IMAGINA_CRM_VERSION', '0.0.0-int');
}
if (! defined('IMAGINA_CRM_FILE')) {
    define('IMAGINA_CRM_FILE', __FILE__);
}
if (! defined('IMAGINA_CRM_DIR')) {
    define('IMAGINA_CRM_DIR', dirname(__DIR__, 2) . '/');
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
if (! defined('ARRAY_A')) {
    define('ARRAY_A', 'ARRAY_A');
}
if (! defined('OBJECT')) {
    define('OBJECT', 'OBJECT');
}

if (! class_exists('wpdb')) {
    /**
     * `wpdb`-compatible mínimo basado en mysqli.
     *
     * Cubre la superficie usada por el plugin (consultar `Database`,
     * Repositorios, SchemaManager, SlugManager, RecordRepository). NO replica
     * la complejidad real de `wp-includes/class-wpdb.php` (multisite, charset
     * negotiation, query reconnect, etc.).
     *
     * Las dos sutilezas críticas que sí cubrimos:
     *
     * 1. `prepare()` reemplaza placeholders %d/%f/%s/%F con valores
     *    escapados (entero, float canonical, string entrecomillado).
     * 2. `insert/update/delete` aceptan los formatos pedidos por WP y
     *    construyen SQL preparado correctamente.
     */
    // phpcs:disable WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase
    class wpdb // phpcs:ignore
    {
        public string $prefix = 'wptest_';
        public int $insert_id = 0;
        public int $rows_affected = 0;
        public string $last_error = '';

        private \mysqli $link;

        public function __construct(string $user, string $password, string $database, string $host, ?string $socket = null)
        {
            $port = 3306;
            $hostname = $host;
            if (str_contains($host, ':')) {
                [$hostname, $portStr] = explode(':', $host, 2);
                $port = (int) $portStr;
            }

            \mysqli_report(MYSQLI_REPORT_OFF);
            $this->link = mysqli_init() ?: throw new \RuntimeException('mysqli_init failed');
            $ok = $socket !== null
                ? @$this->link->real_connect(null, $user, $password, $database, 0, $socket)
                : @$this->link->real_connect($hostname, $user, $password, $database, $port);
            if (! $ok) {
                throw new \RuntimeException('mysqli connect failed: ' . mysqli_connect_error());
            }
            $this->link->set_charset('utf8mb4');
        }

        public function get_charset_collate(): string
        {
            return 'DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
        }

        public function esc_like(string $text): string
        {
            return addcslashes($text, '_%\\');
        }

        public function _real_escape(string $value): string
        {
            return $this->link->real_escape_string($value);
        }

        public function _escape(mixed $value): string
        {
            if (is_array($value) || is_object($value)) {
                return $this->_real_escape((string) wp_json_encode($value));
            }
            if ($value === null) {
                return '';
            }
            return $this->_real_escape((string) $value);
        }

        /**
         * Implementación simplificada de `wpdb::prepare` con paridad
         * comportamental para los placeholders que el plugin usa: %d, %f,
         * %F, %s. Acepta `prepare($sql, ...$args)` y `prepare($sql, $args)`.
         */
        public function prepare(string $query, mixed ...$args): string
        {
            if (count($args) === 1 && is_array($args[0])) {
                $args = $args[0];
            }

            $i = 0;
            return preg_replace_callback(
                '/%[dfsF]/',
                function (array $m) use (&$args, &$i): string {
                    $val = $args[$i] ?? null;
                    ++$i;
                    if ($val === null) {
                        return 'NULL';
                    }
                    return match ($m[0]) {
                        '%d' => (string) (int) $val,
                        '%f', '%F' => (string) (float) $val,
                        default => "'" . $this->_real_escape((string) $val) . "'",
                    };
                },
                $query,
            ) ?? $query;
        }

        public function query(string $sql): int|bool
        {
            $result = $this->link->query($sql);
            $this->last_error = $this->link->error;

            if ($result === false) {
                return false;
            }

            if ($result instanceof \mysqli_result) {
                $result->free();
                $this->rows_affected = $this->link->affected_rows;
                return $this->link->affected_rows;
            }

            $this->rows_affected = $this->link->affected_rows;
            $this->insert_id = (int) $this->link->insert_id;
            return $this->link->affected_rows >= 0 ? $this->link->affected_rows : 0;
        }

        /**
         * @return array<int, array<string, mixed>>|array<int, object>|null
         */
        public function get_results(string $sql, string $output = OBJECT): ?array
        {
            $result = $this->link->query($sql);
            $this->last_error = $this->link->error;
            if ($result === false) {
                return null;
            }
            if (! $result instanceof \mysqli_result) {
                return [];
            }
            $rows = [];
            while ($row = $result->fetch_assoc()) {
                $rows[] = $output === ARRAY_A ? $row : (object) $row;
            }
            $result->free();
            return $rows;
        }

        /**
         * @return array<string, mixed>|object|null
         */
        public function get_row(string $sql, string $output = OBJECT): mixed
        {
            $rows = $this->get_results($sql, $output);
            return is_array($rows) && isset($rows[0]) ? $rows[0] : null;
        }

        public function get_var(string $sql): mixed
        {
            $row = $this->get_row($sql, ARRAY_A);
            if (! is_array($row)) {
                return null;
            }
            return reset($row);
        }

        /**
         * @return array<int, mixed>|null
         */
        public function get_col(string $sql): ?array
        {
            $rows = $this->get_results($sql, ARRAY_A);
            if ($rows === null) {
                return null;
            }
            $col = [];
            foreach ($rows as $row) {
                $col[] = reset($row);
            }
            return $col;
        }

        /**
         * @param array<string, mixed> $data
         * @param array<int, string>|null $format
         */
        public function insert(string $table, array $data, ?array $format = null): int|false
        {
            return $this->insertOrReplace('INSERT', $table, $data, $format);
        }

        /**
         * @param array<string, mixed> $data
         * @param array<string, mixed> $where
         * @param array<int, string>|null $format
         * @param array<int, string>|null $whereFormat
         */
        public function update(
            string $table,
            array $data,
            array $where,
            ?array $format = null,
            ?array $whereFormat = null,
        ): int|false {
            $sets = $this->buildAssignments($data, $format);
            $cond = $this->buildAssignments($where, $whereFormat, ' AND ');

            $sql = "UPDATE `" . $this->_real_escape($table) . "` SET {$sets} WHERE {$cond}";
            $result = $this->query($sql);
            return $result === false ? false : (int) $result;
        }

        /**
         * @param array<string, mixed> $where
         * @param array<int, string>|null $whereFormat
         */
        public function delete(string $table, array $where, ?array $whereFormat = null): int|false
        {
            $cond = $this->buildAssignments($where, $whereFormat, ' AND ');
            $sql = "DELETE FROM `" . $this->_real_escape($table) . "` WHERE {$cond}";
            $result = $this->query($sql);
            return $result === false ? false : (int) $result;
        }

        public function close(): void
        {
            @$this->link->close();
        }

        public function rawLink(): \mysqli
        {
            return $this->link;
        }

        /**
         * @param array<string, mixed> $data
         * @param array<int, string>|null $format
         */
        private function insertOrReplace(string $kind, string $table, array $data, ?array $format): int|false
        {
            $columns = [];
            $values  = [];
            $i = 0;
            foreach ($data as $col => $value) {
                $columns[] = '`' . $this->_real_escape($col) . '`';
                $fmt = $format[$i] ?? '%s';
                if ($value === null) {
                    $values[] = 'NULL';
                } else {
                    $values[] = match ($fmt) {
                        '%d' => (string) (int) $value,
                        '%f', '%F' => (string) (float) $value,
                        default => "'" . $this->_real_escape((string) $value) . "'",
                    };
                }
                ++$i;
            }
            $sql = "{$kind} INTO `" . $this->_real_escape($table) . '` ('
                . implode(', ', $columns) . ') VALUES (' . implode(', ', $values) . ')';
            $result = $this->query($sql);
            return $result === false ? false : (int) $result;
        }

        /**
         * @param array<string, mixed> $data
         * @param array<int, string>|null $format
         */
        private function buildAssignments(array $data, ?array $format, string $glue = ', '): string
        {
            $parts = [];
            $i = 0;
            foreach ($data as $col => $value) {
                $colSql = '`' . $this->_real_escape($col) . '`';
                $fmt    = $format[$i] ?? '%s';
                if ($value === null) {
                    $parts[] = "{$colSql} IS NULL";
                } else {
                    $literal = match ($fmt) {
                        '%d' => (string) (int) $value,
                        '%f', '%F' => (string) (float) $value,
                        default => "'" . $this->_real_escape((string) $value) . "'",
                    };
                    $parts[] = "{$colSql} = {$literal}";
                }
                ++$i;
            }
            return implode($glue, $parts);
        }
    }
    // phpcs:enable
}

if (! function_exists('__')) {
    function __(string $text, string $domain = 'default'): string
    {
        unset($domain);
        return $text;
    }
}
if (! function_exists('esc_html__')) {
    function esc_html__(string $text, string $domain = 'default'): string
    {
        unset($domain);
        return $text;
    }
}
if (! function_exists('esc_html')) {
    function esc_html(string $text): string
    {
        return htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
    }
}
if (! function_exists('esc_attr')) {
    function esc_attr(string $text): string
    {
        return htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
    }
}
if (! function_exists('esc_url_raw')) {
    function esc_url_raw(string $url): string
    {
        return filter_var($url, FILTER_VALIDATE_URL) === false ? '' : $url;
    }
}
if (! function_exists('esc_sql')) {
    function esc_sql(string $value): string
    {
        global $wpdb;
        return $wpdb instanceof \wpdb ? $wpdb->_real_escape($value) : addslashes($value);
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
        return $GLOBALS['imcrm_test_user_id'] ?? 1;
    }
}
if (! function_exists('wp_json_encode')) {
    function wp_json_encode(mixed $data): string
    {
        return json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}';
    }
}
if (! function_exists('is_email')) {
    function is_email(string $email): bool
    {
        return (bool) filter_var($email, FILTER_VALIDATE_EMAIL);
    }
}
if (! function_exists('sanitize_email')) {
    function sanitize_email(string $email): string
    {
        $email = trim($email);
        return filter_var($email, FILTER_VALIDATE_EMAIL) === false ? '' : $email;
    }
}
if (! function_exists('get_userdata')) {
    function get_userdata(int $id): mixed
    {
        // En tests asumimos que cualquier ID > 0 es válido a menos que el
        // test específico lo configure de otra forma.
        return $id > 0 ? (object) ['ID' => $id] : false;
    }
}
if (! function_exists('get_post')) {
    function get_post(int $id): mixed
    {
        return $id > 0 ? (object) ['ID' => $id, 'post_type' => 'attachment'] : null;
    }
}
if (! function_exists('remove_accents')) {
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
if (! function_exists('add_action')) {
    function add_action(string $hook, callable $cb, int $priority = 10, int $accepted = 1): bool
    {
        unset($hook, $cb, $priority, $accepted);
        return true;
    }
}
if (! function_exists('add_filter')) {
    function add_filter(string $hook, callable $cb, int $priority = 10, int $accepted = 1): bool
    {
        unset($hook, $cb, $priority, $accepted);
        return true;
    }
}

if (! function_exists('dbDelta')) {
    /**
     * Implementación pragmática para tests: convierte cada `CREATE TABLE`
     * en `CREATE TABLE IF NOT EXISTS` y la ejecuta. NO hace diffing de
     * columnas como el `dbDelta` real — los tests de migración explícita
     * no son objetivo en este suite (las tablas dinámicas se ejercitan
     * vía `addColumn`/`alterColumn`/`dropColumn`).
     *
     * @param string|array<int, string> $queries
     */
    function dbDelta(string|array $queries): void
    {
        global $wpdb;
        if (! $wpdb instanceof \wpdb) {
            return;
        }
        $list = is_array($queries) ? $queries : [$queries];
        foreach ($list as $sql) {
            $sql = trim($sql);
            $sql = preg_replace('/^CREATE TABLE\s+/i', 'CREATE TABLE IF NOT EXISTS ', $sql);
            if ($sql !== null && $sql !== '') {
                $wpdb->query($sql);
            }
        }
    }
}
