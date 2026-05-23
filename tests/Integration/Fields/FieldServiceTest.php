<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Integration\Fields;

use ImaginaCRM\Fields\FieldEntity;
use ImaginaCRM\Fields\FieldRepository;
use ImaginaCRM\Fields\FieldService;
use ImaginaCRM\Fields\FieldTypeRegistry;
use ImaginaCRM\Lists\ListRepository;
use ImaginaCRM\Lists\ListService;
use ImaginaCRM\Lists\SlugManager;
use ImaginaCRM\Support\ValidationResult;
use ImaginaCRM\Tests\Integration\IntegrationTestCase;

/**
 * Tests end-to-end de `FieldService`:
 *
 * - Crear un campo añade una columna real a la tabla dinámica.
 * - Cambiar `config` muta el SQL de la columna (MODIFY COLUMN).
 * - Toggle `is_unique` añade/quita el UNIQUE INDEX correspondiente.
 * - Rename de slug NO altera `column_name`.
 * - Delete con purge dropea la columna; sin purge la conserva.
 * - Tipos con `hasColumn() = false` (relation) NO crean columna.
 */
final class FieldServiceTest extends IntegrationTestCase
{
    private FieldService $service;
    private ListService $lists;

    protected function setUp(): void
    {
        parent::setUp();
        $slugs    = new SlugManager($this->db());
        $registry = new FieldTypeRegistry();
        $this->lists = new ListService(
            new ListRepository($this->db()),
            $slugs,
            $this->schema,
        );
        $this->service = new FieldService(
            new FieldRepository($this->db()),
            new ListRepository($this->db()),
            $slugs,
            $this->schema,
            $registry,
            new \ImaginaCRM\Records\RecordRepository($this->db()),
        );
    }

    public function test_create_field_adds_real_column(): void
    {
        $list = $this->lists->create(['name' => 'Clientes']);
        $this->assertIsObject($list);

        $field = $this->service->create($list->id, [
            'label' => 'Nombre',
            'type'  => 'text',
            'config' => ['max_length' => 120],
        ]);
        $this->assertInstanceOf(FieldEntity::class, $field);
        /** @var FieldEntity $field */

        $tableName = self::TEST_PREFIX . 'imcrm_data_' . $list->tableSuffix;
        $columns = $this->describeTable($tableName);
        $byName = [];
        foreach ($columns as $col) {
            $byName[$col['Field']] = $col;
        }
        $this->assertArrayHasKey($field->columnName, $byName);
        $this->assertSame('varchar(120)', strtolower($byName[$field->columnName]['Type']));
    }

    public function test_changing_config_alters_column(): void
    {
        $list = $this->lists->create(['name' => 'Clientes']);
        $this->assertIsObject($list);
        $field = $this->service->create($list->id, [
            'label' => 'Nombre',
            'type'  => 'text',
            'config' => ['max_length' => 50],
        ]);
        $this->assertInstanceOf(FieldEntity::class, $field);
        /** @var FieldEntity $field */

        $updated = $this->service->update($list->id, $field->id, [
            'config' => ['max_length' => 200],
        ]);
        $this->assertInstanceOf(FieldEntity::class, $updated);

        $columns = $this->describeTable(self::TEST_PREFIX . 'imcrm_data_' . $list->tableSuffix);
        $type = '';
        foreach ($columns as $col) {
            if (($col['Field'] ?? null) === $field->columnName) {
                $type = strtolower($col['Type']);
                break;
            }
        }
        $this->assertSame('varchar(200)', $type);
    }

    public function test_toggle_unique_adds_and_removes_index(): void
    {
        $list = $this->lists->create(['name' => 'Clientes']);
        $this->assertIsObject($list);
        $field = $this->service->create($list->id, [
            'label' => 'Email',
            'type'  => 'email',
        ]);
        $this->assertInstanceOf(FieldEntity::class, $field);
        /** @var FieldEntity $field */

        // Activar UNIQUE.
        $r = $this->service->update($list->id, $field->id, ['is_unique' => true]);
        $this->assertInstanceOf(FieldEntity::class, $r);

        $tableName = self::TEST_PREFIX . 'imcrm_data_' . $list->tableSuffix;
        $now = current_time('mysql', true);
        $insert = function (string $email) use ($tableName, $now): int|false {
            return $this->wpdb->insert(
                $tableName,
                ['email' => $email, 'created_by' => 1, 'created_at' => $now, 'updated_at' => $now],
                ['%s', '%d', '%s', '%s'],
            );
        };

        $this->assertSame(1, $insert('a@example.com'));
        $this->assertFalse($insert('a@example.com'));

        // Quitar UNIQUE → deja pasar el duplicado.
        $r = $this->service->update($list->id, $field->id, ['is_unique' => false]);
        $this->assertInstanceOf(FieldEntity::class, $r);

        $this->assertSame(1, $insert('a@example.com'));
    }

    public function test_unique_rejected_for_unsupported_type(): void
    {
        $list = $this->lists->create(['name' => 'Tareas']);
        $this->assertIsObject($list);

        $r = $this->service->create($list->id, [
            'label' => 'Tags',
            'type'  => 'multi_select',
            'is_unique' => true,
        ]);
        $this->assertInstanceOf(ValidationResult::class, $r);
        /** @var ValidationResult $r */
        $this->assertArrayHasKey('is_unique', $r->errors());
    }

    public function test_rename_field_slug_keeps_column_name(): void
    {
        $list = $this->lists->create(['name' => 'Clientes']);
        $this->assertIsObject($list);
        $field = $this->service->create($list->id, [
            'label' => 'Nombre',
            'type'  => 'text',
            'slug'  => 'nombre',
        ]);
        $this->assertInstanceOf(FieldEntity::class, $field);
        /** @var FieldEntity $field */
        $originalColumn = $field->columnName;

        $r = $this->service->renameSlug($list->id, $field->id, 'nombre_completo');
        $this->assertTrue($r->success);

        $reloaded = $this->service->findByIdOrSlug($list->id, (string) $field->id);
        $this->assertNotNull($reloaded);
        $this->assertSame('nombre_completo', $reloaded->slug);
        $this->assertSame($originalColumn, $reloaded->columnName);

        // findByIdOrSlug debe resolver también el slug viejo.
        $byOld = $this->service->findByIdOrSlug($list->id, 'nombre');
        $this->assertNotNull($byOld);
        $this->assertSame($field->id, $byOld->id);
    }

    public function test_delete_soft_keeps_column_purge_drops_it(): void
    {
        $list = $this->lists->create(['name' => 'Clientes']);
        $this->assertIsObject($list);

        $field = $this->service->create($list->id, [
            'label' => 'Nombre',
            'type'  => 'text',
        ]);
        $this->assertInstanceOf(FieldEntity::class, $field);
        /** @var FieldEntity $field */

        // Soft-delete: la columna física sigue ahí.
        $this->assertTrue($this->service->delete($list->id, $field->id, purge: false)->isValid());
        $this->assertTrue($this->schema->columnExists($list->tableSuffix, $field->columnName));

        // Crear otro campo y purgarlo: la columna desaparece.
        $f2 = $this->service->create($list->id, [
            'label' => 'Notas',
            'type'  => 'long_text',
        ]);
        $this->assertInstanceOf(FieldEntity::class, $f2);
        /** @var FieldEntity $f2 */

        $this->assertTrue($this->schema->columnExists($list->tableSuffix, $f2->columnName));
        $this->assertTrue($this->service->delete($list->id, $f2->id, purge: true)->isValid());
        $this->assertFalse($this->schema->columnExists($list->tableSuffix, $f2->columnName));
    }

    public function test_relation_field_does_not_create_column(): void
    {
        $list = $this->lists->create(['name' => 'Tareas']);
        $other = $this->lists->create(['name' => 'Personas']);
        $this->assertIsObject($list);
        $this->assertIsObject($other);

        $field = $this->service->create($list->id, [
            'label' => 'Asignado a',
            'type'  => 'relation',
            'config' => ['target_list_id' => $other->id],
        ]);
        $this->assertInstanceOf(FieldEntity::class, $field);
        /** @var FieldEntity $field */

        // No hay columna física correspondiente.
        $this->assertFalse(
            $this->schema->columnExists($list->tableSuffix, $field->columnName),
            'relation type must NOT create a column.',
        );
    }
}
