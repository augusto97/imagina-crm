<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Integration;

use ImaginaCRM\Lists\SchemaManager;
use ImaginaCRM\Support\Database;
use PHPUnit\Framework\TestCase;

/**
 * Base para tests de integración con MySQL real.
 *
 * - Salta el test si no hay conexión disponible (entorno sin BD).
 * - Usa un prefijo `imcrm_int_` único por suite para no colisionar con
 *   datos reales y poder limpiar agresivamente en tearDown.
 * - Antes de cada test instala las 7 tablas del sistema; al terminar
 *   las elimina junto con cualquier `wp_imcrm_data_*` creada por la
 *   prueba.
 *
 * Helpers:
 * - `db()`: instancia de `ImaginaCRM\Support\Database` lista para usar.
 * - `schemaManager()`: SchemaManager configurado.
 */
abstract class IntegrationTestCase extends TestCase
{
    protected const TEST_PREFIX = 'imcrm_int_';

    protected \wpdb $wpdb;
    protected Database $database;
    protected SchemaManager $schema;

    protected function setUp(): void
    {
        parent::setUp();

        if (! ($GLOBALS['imcrm_test_db_available'] ?? false)) {
            $this->markTestSkipped(
                'Integration DB not available: ' . ($GLOBALS['imcrm_test_db_error'] ?? 'unknown'),
            );
        }

        /** @var \wpdb $wpdb */
        $wpdb        = $GLOBALS['wpdb'];
        $wpdb->prefix = self::TEST_PREFIX;
        $this->wpdb   = $wpdb;
        $this->database = new Database($wpdb);
        $this->schema   = new SchemaManager($this->database);

        $this->cleanAllImcrmTables();
        $this->schema->installSystemTables();
    }

    protected function tearDown(): void
    {
        if (isset($this->wpdb)) {
            $this->cleanAllImcrmTables();
        }
        parent::tearDown();
    }

    protected function db(): Database
    {
        return $this->database;
    }

    /**
     * Tablas dinámicas presentes (no destructivo). Útil para asserts.
     *
     * @return array<int, string>
     */
    protected function dataTables(): array
    {
        $rows = $this->wpdb->get_col('SHOW TABLES');
        if (! is_array($rows)) {
            return [];
        }
        $needle = self::TEST_PREFIX . 'imcrm_data_';
        return array_values(array_filter(
            array_map('strval', $rows),
            static fn (string $t): bool => str_starts_with($t, $needle),
        ));
    }

    /**
     * @return array<int, array<string, string>>
     */
    protected function describeTable(string $tableName): array
    {
        $rows = $this->wpdb->get_results(
            'SHOW COLUMNS FROM `' . esc_sql($tableName) . '`',
            ARRAY_A,
        );
        if (! is_array($rows)) {
            return [];
        }
        $out = [];
        foreach ($rows as $row) {
            $out[] = array_map('strval', $row);
        }
        return $out;
    }

    /**
     * Pequeño helper para correr una query sin pensar en `prepare`.
     */
    protected function exec(string $sql): void
    {
        $this->wpdb->query($sql);
    }

    private function cleanAllImcrmTables(): void
    {
        $rows = $this->wpdb->get_col('SHOW TABLES');
        if (! is_array($rows)) {
            return;
        }
        $this->exec('SET FOREIGN_KEY_CHECKS=0');
        foreach ($rows as $name) {
            $name = (string) $name;
            if (! str_starts_with($name, self::TEST_PREFIX)) {
                continue;
            }
            $this->exec('DROP TABLE IF EXISTS `' . esc_sql($name) . '`');
        }
        $this->exec('SET FOREIGN_KEY_CHECKS=1');
    }
}
