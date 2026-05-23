<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\Stubs;

/**
 * Doble de prueba mínimo para `wpdb`.
 *
 * Solo cubre la superficie que usa el `Database` wrapper en los tests
 * unitarios actuales (prefix + charset). Los tests que ejercen queries
 * reales viven en el suite de integración (que sí arranca un wpdb real).
 */
// phpcs:disable WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase
class FakeWpdb extends \wpdb
{
    /** @var array<int, array{sql:string, args:array<int, mixed>}> Historial de prepare(). */
    public array $preparedCalls = [];

    public function __construct()
    {
        // No llamamos al constructor real de wpdb (no existe en este stub).
    }

    public function get_charset_collate(): string
    {
        return 'DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    }

    public function esc_like(string $text): string
    {
        return addcslashes($text, '_%\\');
    }

    /**
     * @param array<int, mixed>|mixed ...$args
     */
    public function prepare(string $query, ...$args): string
    {
        // Si el primer arg es array, lo desempacamos (firma WP estándar).
        if (count($args) === 1 && is_array($args[0])) {
            $args = $args[0];
        }
        $this->preparedCalls[] = ['sql' => $query, 'args' => $args];
        // Sustituimos placeholders de forma simplificada para inspección.
        $i = 0;
        return preg_replace_callback(
            '/%[dfsF]/',
            static function (array $m) use (&$args, &$i): string {
                $val = $args[$i] ?? null;
                ++$i;
                if ($val === null) {
                    return 'NULL';
                }
                if ($m[0] === '%d') {
                    return (string) (int) $val;
                }
                if ($m[0] === '%f' || $m[0] === '%F') {
                    return (string) (float) $val;
                }
                return "'" . addslashes((string) $val) . "'";
            },
            $query
        ) ?? $query;
    }
}
// phpcs:enable
