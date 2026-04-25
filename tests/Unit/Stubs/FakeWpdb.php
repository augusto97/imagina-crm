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
}
// phpcs:enable
