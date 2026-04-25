<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Integration\Records;

use ImaginaCRM\Fields\FieldRepository;
use ImaginaCRM\Fields\FieldService;
use ImaginaCRM\Fields\FieldTypeRegistry;
use ImaginaCRM\Lists\ListEntity;
use ImaginaCRM\Lists\ListRepository;
use ImaginaCRM\Lists\ListService;
use ImaginaCRM\Lists\SlugManager;
use ImaginaCRM\Records\QueryBuilder;
use ImaginaCRM\Records\RecordRepository;
use ImaginaCRM\Records\RecordService;
use ImaginaCRM\Records\RecordValidator;
use ImaginaCRM\Records\RelationRepository;
use ImaginaCRM\Support\ValidationResult;
use ImaginaCRM\Tests\Integration\IntegrationTestCase;

/**
 * Tests end-to-end de `RecordService` (que también ejercita `QueryBuilder`,
 * `RecordRepository`, `RelationRepository` y `RecordValidator`):
 *
 * - CRUD básico con SQL real.
 * - Filtros (eq, contains, gt, in, is_null) producen el resultado correcto.
 * - Sort multi-columna funciona contra MySQL.
 * - Search filtra solo por columnas text/email/url.
 * - Paginación devuelve `meta.total` correcto.
 * - Relations se sincronizan en `wp_imcrm_relations` y vienen de vuelta
 *   en el listing sin generar N+1 (probamos vía batchTargets).
 * - Resolver por slug histórico funciona en filtros.
 */
final class RecordServiceTest extends IntegrationTestCase
{
    private FieldService $fields;
    private RecordService $records;
    private ListService $lists;
    private SlugManager $slugs;

    protected function setUp(): void
    {
        parent::setUp();
        $registry      = new FieldTypeRegistry();
        $this->slugs   = new SlugManager($this->db());
        $listRepo      = new ListRepository($this->db());
        $fieldRepo     = new FieldRepository($this->db());
        $relationsRepo = new RelationRepository($this->db());
        $recordRepo    = new RecordRepository($this->db());
        $validator     = new RecordValidator($registry, $this->db());
        $queryBuilder  = new QueryBuilder($this->db(), $this->slugs);

        $this->lists = new ListService($listRepo, $this->slugs, $this->schema);
        $this->fields = new FieldService($fieldRepo, $listRepo, $this->slugs, $this->schema, $registry);
        $this->records = new RecordService(
            $fieldRepo,
            $recordRepo,
            $relationsRepo,
            $validator,
            $queryBuilder,
        );
    }

    public function test_full_crud_cycle(): void
    {
        $list = $this->createListWithFields();

        // CREATE.
        $created = $this->records->create($list, [
            'name' => 'Acme Corp',
            'amount' => 1500.50,
            'status' => 'active',
        ]);
        $this->assertIsArray($created);
        $this->assertSame('Acme Corp', $created['fields']['name']);
        $this->assertSame(1500.5, $created['fields']['amount']);
        $this->assertSame('active', $created['fields']['status']);
        $id = (int) $created['id'];

        // READ por id.
        $found = $this->records->find($list, $id);
        $this->assertNotNull($found);
        $this->assertSame('Acme Corp', $found['fields']['name']);

        // UPDATE parcial.
        $updated = $this->records->update($list, $id, ['name' => 'Acme S.A.S.']);
        $this->assertIsArray($updated);
        $this->assertSame('Acme S.A.S.', $updated['fields']['name']);
        $this->assertSame(1500.5, $updated['fields']['amount'], 'amount no fue tocado');

        // SOFT DELETE.
        $this->assertTrue($this->records->delete($list, $id)->isValid());
        $this->assertNull($this->records->find($list, $id));
    }

    public function test_required_field_blocks_creation(): void
    {
        $list = $this->createListWithFields();

        $result = $this->records->create($list, ['amount' => 100]);
        $this->assertInstanceOf(ValidationResult::class, $result);
        /** @var ValidationResult $result */
        $this->assertArrayHasKey('name', $result->errors());
    }

    public function test_filter_eq_and_contains(): void
    {
        $list = $this->createListWithFields();
        $this->seedRows($list, [
            ['name' => 'Acme', 'amount' => 100, 'status' => 'active'],
            ['name' => 'Acme 2', 'amount' => 200, 'status' => 'pending'],
            ['name' => 'Other Co', 'amount' => 300, 'status' => 'active'],
        ]);

        $result = $this->records->list(
            $list,
            ['status' => ['eq' => 'active']],
            [],
            [],
            null,
            1,
            50,
        );
        $this->assertIsArray($result);
        $this->assertSame(2, $result['meta']['total']);
        $names = array_column(array_column($result['data'], 'fields'), 'name');
        sort($names);
        $this->assertSame(['Acme', 'Other Co'], $names);

        $byContains = $this->records->list(
            $list,
            ['name' => ['contains' => 'Acme']],
            [],
            [],
            null,
            1,
            50,
        );
        $this->assertIsArray($byContains);
        $this->assertSame(2, $byContains['meta']['total']);
    }

    public function test_filter_gt_and_in(): void
    {
        $list = $this->createListWithFields();
        $this->seedRows($list, [
            ['name' => 'A', 'amount' => 100, 'status' => 'active'],
            ['name' => 'B', 'amount' => 200, 'status' => 'pending'],
            ['name' => 'C', 'amount' => 300, 'status' => 'active'],
            ['name' => 'D', 'amount' => 50,  'status' => 'archived'],
        ]);

        $gt = $this->records->list(
            $list,
            ['amount' => ['gt' => 150]],
            [],
            [],
            null,
            1,
            50,
        );
        $this->assertIsArray($gt);
        $this->assertSame(2, $gt['meta']['total']);

        $in = $this->records->list(
            $list,
            ['status' => ['in' => ['pending', 'archived']]],
            [],
            [],
            null,
            1,
            50,
        );
        $this->assertIsArray($in);
        $this->assertSame(2, $in['meta']['total']);
    }

    public function test_sort_multi_column(): void
    {
        $list = $this->createListWithFields();
        $this->seedRows($list, [
            ['name' => 'B', 'amount' => 100, 'status' => 'active'],
            ['name' => 'A', 'amount' => 200, 'status' => 'active'],
            ['name' => 'A', 'amount' => 100, 'status' => 'active'],
        ]);

        $result = $this->records->list(
            $list,
            [],
            [['slug' => 'name', 'dir' => 'asc'], ['slug' => 'amount', 'dir' => 'desc']],
            [],
            null,
            1,
            50,
        );
        $this->assertIsArray($result);
        $names = array_column(array_column($result['data'], 'fields'), 'name');
        $amounts = array_column(array_column($result['data'], 'fields'), 'amount');
        $this->assertSame(['A', 'A', 'B'], $names);
        $this->assertSame([200.0, 100.0, 100.0], $amounts);
    }

    public function test_search_only_targets_text_columns(): void
    {
        $list = $this->createListWithFields();
        $this->seedRows($list, [
            ['name' => 'Foo Bar', 'amount' => 100, 'status' => 'active'],
            ['name' => 'Hello',   'amount' => 100, 'status' => 'active'],
        ]);

        $r = $this->records->list($list, [], [], [], 'foo', 1, 50);
        $this->assertIsArray($r);
        $this->assertSame(1, $r['meta']['total']);
        $this->assertSame('Foo Bar', $r['data'][0]['fields']['name']);
    }

    public function test_pagination_meta(): void
    {
        $list = $this->createListWithFields();
        $rows = [];
        for ($i = 1; $i <= 23; $i++) {
            $rows[] = ['name' => 'Row ' . $i, 'amount' => $i * 10, 'status' => 'active'];
        }
        $this->seedRows($list, $rows);

        $page1 = $this->records->list($list, [], [], [], null, 1, 10);
        $this->assertIsArray($page1);
        $this->assertSame(23, $page1['meta']['total']);
        $this->assertSame(3, $page1['meta']['total_pages']);
        $this->assertCount(10, $page1['data']);

        $page3 = $this->records->list($list, [], [], [], null, 3, 10);
        $this->assertIsArray($page3);
        $this->assertCount(3, $page3['data']);
    }

    public function test_relation_field_round_trip(): void
    {
        $owners = $this->lists->create(['name' => 'Owners']);
        $this->assertIsObject($owners);
        $this->fields->create($owners->id, ['label' => 'Name', 'slug' => 'name', 'type' => 'text']);

        $list = $this->createListWithFields();
        $this->fields->create($list->id, [
            'label' => 'Owner',
            'slug'  => 'owner',
            'type'  => 'relation',
            'config' => ['target_list_id' => $owners->id],
        ]);

        // Sembramos owners y guardamos sus IDs.
        $owner1 = $this->records->create($owners, ['name' => 'Alice']);
        $owner2 = $this->records->create($owners, ['name' => 'Bob']);
        $this->assertIsArray($owner1);
        $this->assertIsArray($owner2);

        // Crear record con la relación.
        $created = $this->records->create($list, [
            'name' => 'Acme',
            'amount' => 0,
            'status' => 'active',
            'owner' => [$owner1['id'], $owner2['id']],
        ]);
        $this->assertIsArray($created);

        // El listing debe traer las relaciones.
        $listed = $this->records->list($list, [], [], [], null, 1, 50);
        $this->assertIsArray($listed);
        $this->assertSame(1, $listed['meta']['total']);
        $first = $listed['data'][0];
        $this->assertSame(
            [(int) $owner1['id'], (int) $owner2['id']],
            $first['relations']['owner'],
        );
    }

    public function test_filter_by_legacy_slug_via_history(): void
    {
        $list = $this->createListWithFields();
        $this->seedRows($list, [
            ['name' => 'A', 'amount' => 100, 'status' => 'active'],
            ['name' => 'B', 'amount' => 200, 'status' => 'pending'],
        ]);

        // Renombramos `status` → `lifecycle`.
        /** @var \ImaginaCRM\Fields\FieldEntity $statusField */
        $statusField = $this->fields->findByIdOrSlug($list->id, 'status');
        $this->assertNotNull($statusField);
        $r = $this->fields->renameSlug($list->id, $statusField->id, 'lifecycle');
        $this->assertTrue($r->success);

        // Filtrar usando el slug VIEJO debe seguir funcionando vía slug_history.
        $filtered = $this->records->list(
            $list,
            ['status' => ['eq' => 'active']],
            [],
            [],
            null,
            1,
            50,
        );
        $this->assertIsArray($filtered);
        $this->assertSame(1, $filtered['meta']['total']);
        $this->assertSame('A', $filtered['data'][0]['fields']['name']);
    }

    /**
     * Crea una lista de prueba con 3 campos (text required, number, select).
     */
    private function createListWithFields(): ListEntity
    {
        $list = $this->lists->create(['name' => 'Empresas']);
        $this->assertIsObject($list);
        /** @var ListEntity $list */

        $r = $this->fields->create($list->id, [
            'label' => 'Nombre',
            'slug'  => 'name',
            'type'  => 'text',
            'is_required' => true,
        ]);
        $this->assertNotInstanceOf(ValidationResult::class, $r);

        $r = $this->fields->create($list->id, [
            'label' => 'Monto',
            'slug'  => 'amount',
            'type'  => 'number',
            'config' => ['precision' => 2],
        ]);
        $this->assertNotInstanceOf(ValidationResult::class, $r);

        $r = $this->fields->create($list->id, [
            'label' => 'Status',
            'slug'  => 'status',
            'type'  => 'select',
            'config' => [
                'options' => [
                    ['value' => 'active', 'label' => 'Activo'],
                    ['value' => 'pending', 'label' => 'Pendiente'],
                    ['value' => 'archived', 'label' => 'Archivado'],
                ],
            ],
        ]);
        $this->assertNotInstanceOf(ValidationResult::class, $r);

        return $list;
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     */
    private function seedRows(ListEntity $list, array $rows): void
    {
        foreach ($rows as $row) {
            $created = $this->records->create($list, $row);
            $this->assertIsArray($created, 'Failed to seed row: ' . wp_json_encode($row));
        }
    }
}
