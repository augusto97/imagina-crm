<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Integration\Lists;

use ImaginaCRM\Lists\ListEntity;
use ImaginaCRM\Lists\ListRepository;
use ImaginaCRM\Lists\ListService;
use ImaginaCRM\Lists\SlugManager;
use ImaginaCRM\Support\ValidationResult;
use ImaginaCRM\Tests\Integration\IntegrationTestCase;

/**
 * Tests end-to-end de `ListService` contra MySQL real:
 *
 * - Crear una lista materializa la tabla dinámica con columnas base.
 * - Crear con slug duplicado falla via UNIQUE INDEX (si bien la app
 *   también valida).
 * - Renombrar slug NO toca la tabla dinámica (`table_suffix` es inmutable).
 * - `findByIdOrSlug` resuelve por ID, slug actual y slug histórico.
 * - Soft-delete preserva la tabla dinámica; purge la elimina.
 */
final class ListServiceTest extends IntegrationTestCase
{
    private ListService $service;
    private SlugManager $slugs;

    protected function setUp(): void
    {
        parent::setUp();
        $this->slugs = new SlugManager($this->db());
        $this->service = new ListService(
            new ListRepository($this->db()),
            $this->slugs,
            $this->schema,
        );
    }

    public function test_create_materializes_dynamic_table(): void
    {
        $result = $this->service->create([
            'name' => 'Clientes',
            'description' => 'Mi base de clientes',
        ]);
        $this->assertInstanceOf(ListEntity::class, $result);
        /** @var ListEntity $result */

        $this->assertSame('clientes', $result->slug);
        $this->assertNotEmpty($result->tableSuffix);

        $expectedTable = self::TEST_PREFIX . 'imcrm_data_' . $result->tableSuffix;
        $this->assertContains($expectedTable, $this->dataTables());

        $columns = array_column($this->describeTable($expectedTable), 'Field');
        $this->assertSame(['id', 'created_by', 'created_at', 'updated_at', 'deleted_at'], $columns);
    }

    public function test_create_with_duplicate_slug_fails_validation(): void
    {
        $a = $this->service->create(['name' => 'Clientes']);
        $this->assertInstanceOf(ListEntity::class, $a);

        $b = $this->service->create(['name' => 'Otra cosa', 'slug' => 'clientes']);
        $this->assertInstanceOf(ValidationResult::class, $b);
        /** @var ValidationResult $b */
        $this->assertFalse($b->isValid());
        $this->assertArrayHasKey('slug', $b->errors());
    }

    public function test_create_collision_in_table_suffix_appends_number(): void
    {
        // Primera lista: slug=clientes → table_suffix=clientes.
        $a = $this->service->create(['name' => 'Clientes']);
        $this->assertInstanceOf(ListEntity::class, $a);
        /** @var ListEntity $a */
        $this->assertSame('clientes', $a->tableSuffix);

        // Soft-delete la primera para que el slug se libere a nivel UNIQUE.
        // Pero el `table_suffix` permanece (UNIQUE) para no destruir la tabla
        // dinámica. La nueva debe sufijar.
        $this->service->delete($a->id);

        $b = $this->service->create(['name' => 'Clientes']);
        $this->assertInstanceOf(ListEntity::class, $b);
        /** @var ListEntity $b */
        $this->assertSame('clientes', $b->slug);
        $this->assertSame('clientes_2', $b->tableSuffix);

        $this->assertContains(
            self::TEST_PREFIX . 'imcrm_data_clientes_2',
            $this->dataTables(),
        );
    }

    public function test_rename_slug_does_not_touch_data_table(): void
    {
        $list = $this->service->create(['name' => 'Clientes']);
        $this->assertInstanceOf(ListEntity::class, $list);
        /** @var ListEntity $list */

        $tableBefore = self::TEST_PREFIX . 'imcrm_data_' . $list->tableSuffix;
        $this->assertContains($tableBefore, $this->dataTables());

        $r = $this->service->renameSlug($list->id, 'clientes_anuales');
        $this->assertTrue($r->success);

        // La tabla dinámica sigue ahí con el mismo nombre.
        $this->assertContains($tableBefore, $this->dataTables());

        // El registro persistido refleja el slug nuevo y mantiene table_suffix.
        $reloaded = $this->service->findByIdOrSlug((string) $list->id);
        $this->assertNotNull($reloaded);
        $this->assertSame('clientes_anuales', $reloaded->slug);
        $this->assertSame($list->tableSuffix, $reloaded->tableSuffix);
    }

    public function test_findByIdOrSlug_resolves_old_slug_via_history(): void
    {
        $list = $this->service->create(['name' => 'Clientes', 'slug' => 'clientes']);
        $this->assertInstanceOf(ListEntity::class, $list);
        /** @var ListEntity $list */

        $this->service->renameSlug($list->id, 'clientes_2026');

        // Por ID.
        $byId = $this->service->findByIdOrSlug((string) $list->id);
        $this->assertNotNull($byId);

        // Por slug actual.
        $byCurrent = $this->service->findByIdOrSlug('clientes_2026');
        $this->assertNotNull($byCurrent);
        $this->assertSame($list->id, $byCurrent->id);

        // Por slug viejo (debe seguir el historial).
        $byOld = $this->service->findByIdOrSlug('clientes');
        $this->assertNotNull($byOld);
        $this->assertSame($list->id, $byOld->id);

        // Slug inexistente.
        $this->assertNull($this->service->findByIdOrSlug('no_existe'));
    }

    public function test_soft_delete_preserves_data_table(): void
    {
        $list = $this->service->create(['name' => 'Clientes']);
        $this->assertInstanceOf(ListEntity::class, $list);
        /** @var ListEntity $list */

        $tableName = self::TEST_PREFIX . 'imcrm_data_' . $list->tableSuffix;
        $this->assertContains($tableName, $this->dataTables());

        $result = $this->service->delete($list->id);
        $this->assertTrue($result->isValid());

        // La fila está marcada como borrada pero la tabla dinámica sigue
        // intacta (ADR-007).
        $this->assertContains($tableName, $this->dataTables());
        $this->assertNull($this->service->findByIdOrSlug((string) $list->id));
    }

    public function test_purge_drops_dynamic_table(): void
    {
        $list = $this->service->create(['name' => 'Clientes']);
        $this->assertInstanceOf(ListEntity::class, $list);
        /** @var ListEntity $list */

        $tableName = self::TEST_PREFIX . 'imcrm_data_' . $list->tableSuffix;
        $this->assertContains($tableName, $this->dataTables());

        $result = $this->service->delete($list->id, purge: true);
        $this->assertTrue($result->isValid());

        $this->assertNotContains($tableName, $this->dataTables());
    }
}
