<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Integration\Dashboards;

use ImaginaCRM\Dashboards\DashboardRepository;
use ImaginaCRM\Dashboards\DashboardService;
use ImaginaCRM\Fields\FieldRepository;
use ImaginaCRM\Fields\FieldService;
use ImaginaCRM\Fields\FieldTypeRegistry;
use ImaginaCRM\Lists\ListEntity;
use ImaginaCRM\Lists\ListRepository;
use ImaginaCRM\Lists\ListService;
use ImaginaCRM\Lists\SlugManager;
use ImaginaCRM\Support\ValidationResult;
use ImaginaCRM\Tests\Integration\IntegrationTestCase;

/**
 * E2E del DashboardService contra MySQL real:
 * - CRUD básico.
 * - Validación: nombre vacío, widget de lista inexistente, widget kpi
 *   sin métrica, sum/avg sin metric_field_id válido, chart_bar sin
 *   campo select, chart_line sin campo date.
 * - Permisos: usuario distinto que no es admin no puede editar/borrar.
 * - visibleFor: ve los compartidos (user_id NULL) + los suyos, no los
 *   de otros.
 */
final class DashboardServiceTest extends IntegrationTestCase
{
    private DashboardService $dashboards;
    private FieldService $fields;
    private ListService $lists;
    private DashboardRepository $repo;

    protected function setUp(): void
    {
        parent::setUp();
        $registry  = new FieldTypeRegistry();
        $slugs     = new SlugManager($this->db());
        $listRepo   = new ListRepository($this->db());
        $fieldRepo  = new FieldRepository($this->db());
        $recordRepo = new \ImaginaCRM\Records\RecordRepository($this->db());
        $this->repo = new DashboardRepository($this->db());

        $this->lists      = new ListService($listRepo, $slugs, $this->schema);
        $this->fields     = new FieldService($fieldRepo, $listRepo, $slugs, $this->schema, $registry, $recordRepo);
        $this->dashboards = new DashboardService($this->repo, $listRepo, $fieldRepo);
    }

    public function test_create_with_valid_kpi_widget(): void
    {
        [$list, $numField] = $this->seedList();

        $result = $this->dashboards->create([
            'name'    => 'Sales',
            'widgets' => [
                ['type' => 'kpi', 'list_id' => $list->id, 'title' => 'Total leads', 'config' => ['metric' => 'count']],
                ['type' => 'kpi', 'list_id' => $list->id, 'title' => 'Sum amount', 'config' => ['metric' => 'sum', 'metric_field_id' => $numField->id]],
            ],
        ], userId: 1);

        $this->assertNotInstanceOf(ValidationResult::class, $result);
        $this->assertCount(2, $result->widgets);
        $this->assertSame(1, $result->userId);
    }

    public function test_create_shared_dashboard_has_null_user_id(): void
    {
        [$list] = $this->seedList();
        $result = $this->dashboards->create([
            'name'      => 'Compartido',
            'is_shared' => true,
            'widgets'   => [['type' => 'kpi', 'list_id' => $list->id, 'config' => ['metric' => 'count']]],
        ], userId: 7);

        $this->assertNotInstanceOf(ValidationResult::class, $result);
        $this->assertNull($result->userId);
    }

    public function test_empty_name_fails(): void
    {
        $r = $this->dashboards->create(['name' => '   ', 'widgets' => []], userId: 1);
        $this->assertInstanceOf(ValidationResult::class, $r);
        /** @var ValidationResult $r */
        $this->assertArrayHasKey('name', $r->errors());
    }

    public function test_widget_with_unknown_list_fails(): void
    {
        $r = $this->dashboards->create([
            'name'    => 'X',
            'widgets' => [['type' => 'kpi', 'list_id' => 99999, 'config' => ['metric' => 'count']]],
        ], userId: 1);
        $this->assertInstanceOf(ValidationResult::class, $r);
        $this->assertArrayHasKey('widgets', $r->errors());
    }

    public function test_kpi_sum_without_numeric_field_fails(): void
    {
        [$list] = $this->seedList();

        $r = $this->dashboards->create([
            'name'    => 'X',
            'widgets' => [['type' => 'kpi', 'list_id' => $list->id, 'config' => ['metric' => 'sum']]],
        ], userId: 1);
        $this->assertInstanceOf(ValidationResult::class, $r);
    }

    public function test_chart_bar_requires_select_field(): void
    {
        [$list, $numField] = $this->seedList();

        // Pasamos el field numérico — debe fallar (no es select).
        $r = $this->dashboards->create([
            'name'    => 'X',
            'widgets' => [['type' => 'chart_bar', 'list_id' => $list->id, 'config' => ['group_by_field_id' => $numField->id]]],
        ], userId: 1);
        $this->assertInstanceOf(ValidationResult::class, $r);
    }

    public function test_chart_line_requires_date_field(): void
    {
        [$list, , $selectField] = $this->seedList();

        $r = $this->dashboards->create([
            'name'    => 'X',
            'widgets' => [['type' => 'chart_line', 'list_id' => $list->id, 'config' => ['date_field_id' => $selectField->id]]],
        ], userId: 1);
        $this->assertInstanceOf(ValidationResult::class, $r);
    }

    public function test_other_user_cannot_edit_private_dashboard(): void
    {
        [$list] = $this->seedList();
        $created = $this->dashboards->create([
            'name'    => 'Privado de 7',
            'widgets' => [['type' => 'kpi', 'list_id' => $list->id, 'config' => ['metric' => 'count']]],
        ], userId: 7);
        $this->assertNotInstanceOf(ValidationResult::class, $created);

        // Usuario 99 no admin → forbidden.
        $r = $this->dashboards->update($created->id, ['name' => 'pwned'], userId: 99, isAdmin: false);
        $this->assertInstanceOf(ValidationResult::class, $r);
        /** @var ValidationResult $r */
        $this->assertArrayHasKey('forbidden', $r->errors());

        // Admin sí.
        $r = $this->dashboards->update($created->id, ['name' => 'moderado'], userId: 99, isAdmin: true);
        $this->assertNotInstanceOf(ValidationResult::class, $r);
        $this->assertSame('moderado', $r->name);
    }

    public function test_visible_for_returns_shared_plus_own(): void
    {
        [$list] = $this->seedList();

        $shared = $this->dashboards->create([
            'name'      => 'Compartido',
            'is_shared' => true,
            'widgets'   => [['type' => 'kpi', 'list_id' => $list->id, 'config' => ['metric' => 'count']]],
        ], userId: 1);
        $this->assertNotInstanceOf(ValidationResult::class, $shared);

        $mine = $this->dashboards->create([
            'name'    => 'Mío',
            'widgets' => [['type' => 'kpi', 'list_id' => $list->id, 'config' => ['metric' => 'count']]],
        ], userId: 7);
        $this->assertNotInstanceOf(ValidationResult::class, $mine);

        $other = $this->dashboards->create([
            'name'    => 'De 99',
            'widgets' => [['type' => 'kpi', 'list_id' => $list->id, 'config' => ['metric' => 'count']]],
        ], userId: 99);
        $this->assertNotInstanceOf(ValidationResult::class, $other);

        $visibleFor7 = $this->dashboards->visibleFor(7);
        $names = array_map(static fn ($d) => $d->name, $visibleFor7);
        $this->assertContains('Compartido', $names);
        $this->assertContains('Mío', $names);
        $this->assertNotContains('De 99', $names);
    }

    public function test_soft_delete_hides_dashboard_from_visible_for(): void
    {
        [$list] = $this->seedList();
        $created = $this->dashboards->create([
            'name'    => 'temporal',
            'widgets' => [['type' => 'kpi', 'list_id' => $list->id, 'config' => ['metric' => 'count']]],
        ], userId: 1);
        $this->assertNotInstanceOf(ValidationResult::class, $created);

        $r = $this->dashboards->delete($created->id, userId: 1, isAdmin: false);
        $this->assertTrue($r->isValid());

        $visible = $this->dashboards->visibleFor(1);
        $names = array_map(static fn ($d) => $d->name, $visible);
        $this->assertNotContains('temporal', $names);
    }

    /**
     * @return array{0: ListEntity, 1: object, 2: object}
     */
    private function seedList(): array
    {
        $list = $this->lists->create(['name' => 'Empresas']);
        $this->assertIsObject($list);
        /** @var ListEntity $list */

        $numField = $this->fields->create($list->id, [
            'label' => 'Monto',
            'slug'  => 'amount',
            'type'  => 'number',
        ]);
        $this->assertNotInstanceOf(ValidationResult::class, $numField);

        $selectField = $this->fields->create($list->id, [
            'label'  => 'Status',
            'slug'   => 'status',
            'type'   => 'select',
            'config' => ['options' => [
                ['value' => 'lead', 'label' => 'Lead'],
                ['value' => 'won',  'label' => 'Won'],
            ]],
        ]);
        $this->assertNotInstanceOf(ValidationResult::class, $selectField);

        return [$list, $numField, $selectField];
    }
}
