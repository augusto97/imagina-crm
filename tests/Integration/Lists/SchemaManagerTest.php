<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Integration\Lists;

use ImaginaCRM\Tests\Integration\IntegrationTestCase;

/**
 * Verifica que `SchemaManager` ejecuta DDL real correctamente:
 *
 * - Las 7 tablas del sistema existen tras `installSystemTables()`.
 * - `createDataTable` crea la tabla con las columnas base.
 * - `addColumn`/`alterColumn`/`dropColumn` mutan el schema sin afectar
 *   datos existentes en otras columnas.
 * - `addUniqueIndex` impide duplicados a nivel BD.
 */
final class SchemaManagerTest extends IntegrationTestCase
{
    public function test_install_system_tables_creates_seven_tables(): void
    {
        $expected = ['lists', 'fields', 'saved_views', 'comments', 'activity', 'relations', 'slug_history'];
        foreach ($expected as $name) {
            $tableName = self::TEST_PREFIX . 'imcrm_' . $name;
            $row = $this->wpdb->get_var("SHOW TABLES LIKE '" . esc_sql($tableName) . "'");
            $this->assertSame($tableName, $row, "Expected system table {$tableName} to exist.");
        }
    }

    public function test_create_data_table_has_base_columns(): void
    {
        $this->schema->createDataTable('clientes');

        $columns = array_column($this->describeTable(self::TEST_PREFIX . 'imcrm_data_clientes'), 'Field');
        $this->assertSame(['id', 'created_by', 'created_at', 'updated_at', 'deleted_at'], $columns);

        $this->assertTrue($this->schema->dataTableExists('clientes'));
        $this->assertContains(self::TEST_PREFIX . 'imcrm_data_clientes', $this->dataTables());
    }

    public function test_create_data_table_is_idempotent(): void
    {
        $this->schema->createDataTable('proyectos');
        $this->schema->createDataTable('proyectos'); // No debe lanzar.

        $this->assertCount(1, $this->dataTables());
    }

    public function test_add_column_creates_a_real_column(): void
    {
        $this->schema->createDataTable('clientes');
        $this->schema->addColumn('clientes', 'col_name', 'VARCHAR(120) NULL');

        $columns = array_column($this->describeTable(self::TEST_PREFIX . 'imcrm_data_clientes'), 'Field');
        $this->assertContains('col_name', $columns);
        $this->assertTrue($this->schema->columnExists('clientes', 'col_name'));
    }

    public function test_alter_column_changes_type_without_dropping_data(): void
    {
        $this->schema->createDataTable('clientes');
        $this->schema->addColumn('clientes', 'col_name', 'VARCHAR(50) NULL');

        $now = current_time('mysql', true);
        $this->wpdb->insert(
            self::TEST_PREFIX . 'imcrm_data_clientes',
            ['col_name' => 'Hola', 'created_by' => 1, 'created_at' => $now, 'updated_at' => $now],
            ['%s', '%d', '%s', '%s'],
        );

        $this->schema->alterColumn('clientes', 'col_name', 'VARCHAR(255) NULL');

        $stored = $this->wpdb->get_var(
            'SELECT col_name FROM `' . self::TEST_PREFIX . 'imcrm_data_clientes` LIMIT 1',
        );
        $this->assertSame('Hola', $stored);

        $describe = $this->describeTable(self::TEST_PREFIX . 'imcrm_data_clientes');
        $type = '';
        foreach ($describe as $col) {
            if (($col['Field'] ?? null) === 'col_name') {
                $type = strtolower($col['Type'] ?? '');
                break;
            }
        }
        $this->assertSame('varchar(255)', $type);
    }

    public function test_drop_column_removes_it(): void
    {
        $this->schema->createDataTable('clientes');
        $this->schema->addColumn('clientes', 'col_temp', 'VARCHAR(64) NULL');
        $this->assertTrue($this->schema->columnExists('clientes', 'col_temp'));

        $this->schema->dropColumn('clientes', 'col_temp');
        $this->assertFalse($this->schema->columnExists('clientes', 'col_temp'));
    }

    public function test_unique_index_rejects_duplicates(): void
    {
        $this->schema->createDataTable('clientes');
        $this->schema->addColumn('clientes', 'col_email', 'VARCHAR(191) NULL');
        $this->schema->addUniqueIndex('clientes', 'col_email');

        $now = current_time('mysql', true);
        $insert = function (string $email) use ($now): int|false {
            return $this->wpdb->insert(
                self::TEST_PREFIX . 'imcrm_data_clientes',
                ['col_email' => $email, 'created_by' => 1, 'created_at' => $now, 'updated_at' => $now],
                ['%s', '%d', '%s', '%s'],
            );
        };

        $this->assertSame(1, $insert('a@example.com'));
        $second = $insert('a@example.com');
        $this->assertFalse($second, 'Duplicate insert should be rejected by UNIQUE INDEX.');

        // Tras quitar el índice, el duplicado pasa.
        $this->schema->dropUniqueIndex('clientes', 'col_email');
        $this->assertSame(1, $insert('a@example.com'));
    }

    public function test_drop_data_table_removes_it(): void
    {
        $this->schema->createDataTable('clientes');
        $this->assertTrue($this->schema->dataTableExists('clientes'));

        $this->schema->dropDataTable('clientes');
        $this->assertFalse($this->schema->dataTableExists('clientes'));
    }

    public function test_quote_ident_rejects_malicious_identifiers(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        // `addColumn` valida el column_name contra el regex (red de seguridad
        // ante un caller bug). Sin esta defensa el plugin sería SQL-injectable.
        $this->schema->addColumn('clientes', 'evil; DROP TABLE x', 'VARCHAR(10) NULL');
    }
}
