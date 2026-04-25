<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Integration\Dashboards;

use ImaginaCRM\Dashboards\DashboardEntity;
use ImaginaCRM\Dashboards\DashboardRepository;
use ImaginaCRM\Dashboards\DashboardService;
use ImaginaCRM\Dashboards\WidgetEvaluator;
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
 * E2E del WidgetEvaluator contra MySQL real:
 * - kpi.count cuenta records vivos.
 * - kpi.sum / kpi.avg agregan correctamente sobre un campo numérico
 *   (incluyendo el caso "tabla vacía" → 0).
 * - chart_bar agrupa por las options del select y mapea labels.
 * - chart_line agrega por mes (YYYY-MM) sobre un campo datetime.
 */
final class WidgetEvaluatorTest extends IntegrationTestCase
{
    private DashboardService $dashboards;
    private FieldService $fields;
    private ListService $lists;
    private RecordService $records;
    private WidgetEvaluator $evaluator;

    protected function setUp(): void
    {
        parent::setUp();
        $registry      = new FieldTypeRegistry();
        $slugs         = new SlugManager($this->db());
        $listRepo      = new ListRepository($this->db());
        $fieldRepo     = new FieldRepository($this->db());
        $relationsRepo = new RelationRepository($this->db());
        $recordRepo    = new RecordRepository($this->db());
        $validator     = new RecordValidator($registry, $this->db());
        $queryBuilder  = new QueryBuilder($this->db(), $slugs);
        $dashboardRepo = new DashboardRepository($this->db());

        $this->lists      = new ListService($listRepo, $slugs, $this->schema);
        $this->fields     = new FieldService($fieldRepo, $listRepo, $slugs, $this->schema, $registry);
        $this->records    = new RecordService($fieldRepo, $recordRepo, $relationsRepo, $validator, $queryBuilder);
        $this->dashboards = new DashboardService($dashboardRepo, $listRepo, $fieldRepo);
        $this->evaluator  = new WidgetEvaluator($this->db(), $listRepo, $fieldRepo);
    }

    public function test_kpi_count_returns_active_records_count(): void
    {
        [$list, $numField] = $this->seedRecords();

        $dashboard = $this->makeDashboard($list, [
            ['type' => 'kpi', 'list_id' => $list->id, 'config' => ['metric' => 'count'], 'id' => 'k_count'],
        ]);

        $result = $this->evaluator->evaluate($dashboard, 'k_count');
        $this->assertIsArray($result);
        $this->assertSame(3, $result['value']);
        $this->assertSame('count', $result['metric']);
    }

    public function test_kpi_sum_aggregates_numeric_field(): void
    {
        [$list, $numField] = $this->seedRecords();

        $dashboard = $this->makeDashboard($list, [
            [
                'type'    => 'kpi',
                'list_id' => $list->id,
                'config'  => ['metric' => 'sum', 'metric_field_id' => $numField->id],
                'id'      => 'k_sum',
            ],
        ]);

        $result = $this->evaluator->evaluate($dashboard, 'k_sum');
        $this->assertIsArray($result);
        // 100 + 200 + 50 = 350.
        $this->assertEqualsWithDelta(350.0, (float) $result['value'], 0.001);
    }

    public function test_kpi_avg_handles_empty_table_as_zero(): void
    {
        $list = $this->lists->create(['name' => 'Empty']);
        $this->assertIsObject($list);
        /** @var ListEntity $list */
        $numField = $this->fields->create($list->id, [
            'label' => 'Monto', 'slug' => 'amount', 'type' => 'number',
        ]);
        $this->assertNotInstanceOf(ValidationResult::class, $numField);

        $dashboard = $this->makeDashboard($list, [
            [
                'type'    => 'kpi',
                'list_id' => $list->id,
                'config'  => ['metric' => 'avg', 'metric_field_id' => $numField->id],
                'id'      => 'k_avg',
            ],
        ]);

        $result = $this->evaluator->evaluate($dashboard, 'k_avg');
        $this->assertIsArray($result);
        $this->assertSame(0.0, (float) $result['value']);
    }

    public function test_chart_bar_groups_by_select_with_option_labels(): void
    {
        [$list, , $statusField] = $this->seedRecords();

        $dashboard = $this->makeDashboard($list, [
            [
                'type'    => 'chart_bar',
                'list_id' => $list->id,
                'config'  => ['group_by_field_id' => $statusField->id],
                'id'      => 'cb',
            ],
        ]);

        $result = $this->evaluator->evaluate($dashboard, 'cb');
        $this->assertIsArray($result);
        $data = $result['data'];
        $this->assertIsArray($data);

        // Mapea: 2 leads (label "Lead"), 1 won (label "Ganada").
        $byLabel = [];
        foreach ($data as $row) {
            $byLabel[$row['label']] = $row['value'];
        }
        $this->assertSame(2, $byLabel['Lead']);
        $this->assertSame(1, $byLabel['Ganada']);
    }

    public function test_chart_line_groups_by_month(): void
    {
        $list = $this->lists->create(['name' => 'Tickets']);
        $this->assertIsObject($list);
        /** @var ListEntity $list */

        $nameField = $this->fields->create($list->id, [
            'label' => 'Nombre', 'slug' => 'name', 'type' => 'text', 'is_required' => true,
        ]);
        $this->assertNotInstanceOf(ValidationResult::class, $nameField);

        $dateField = $this->fields->create($list->id, [
            'label' => 'Vencimiento', 'slug' => 'due_at', 'type' => 'datetime',
        ]);
        $this->assertNotInstanceOf(ValidationResult::class, $dateField);

        // 2 en 2026-04, 1 en 2026-05.
        $this->records->create($list, ['name' => 'A', 'due_at' => '2026-04-10 09:00:00']);
        $this->records->create($list, ['name' => 'B', 'due_at' => '2026-04-22 12:00:00']);
        $this->records->create($list, ['name' => 'C', 'due_at' => '2026-05-03 15:00:00']);

        $dashboard = $this->makeDashboard($list, [
            [
                'type'    => 'chart_line',
                'list_id' => $list->id,
                'config'  => ['date_field_id' => $dateField->id],
                'id'      => 'cl',
            ],
        ]);

        $result = $this->evaluator->evaluate($dashboard, 'cl');
        $this->assertIsArray($result);
        $data = $result['data'];

        $byMonth = [];
        foreach ($data as $row) {
            $byMonth[$row['label']] = $row['value'];
        }
        $this->assertSame(2, $byMonth['2026-04']);
        $this->assertSame(1, $byMonth['2026-05']);
    }

    public function test_unknown_widget_id_returns_validation_error(): void
    {
        [$list] = $this->seedRecords();
        $dashboard = $this->makeDashboard($list, [
            ['type' => 'kpi', 'list_id' => $list->id, 'config' => ['metric' => 'count'], 'id' => 'real'],
        ]);

        $result = $this->evaluator->evaluate($dashboard, 'ghost');
        $this->assertInstanceOf(ValidationResult::class, $result);
    }

    /**
     * @return array{0: ListEntity, 1: object, 2: object}
     */
    private function seedRecords(): array
    {
        $list = $this->lists->create(['name' => 'Empresas']);
        $this->assertIsObject($list);
        /** @var ListEntity $list */

        $name = $this->fields->create($list->id, [
            'label' => 'Nombre', 'slug' => 'name', 'type' => 'text', 'is_required' => true,
        ]);
        $this->assertNotInstanceOf(ValidationResult::class, $name);

        $amount = $this->fields->create($list->id, [
            'label' => 'Monto', 'slug' => 'amount', 'type' => 'number',
        ]);
        $this->assertNotInstanceOf(ValidationResult::class, $amount);

        $status = $this->fields->create($list->id, [
            'label'  => 'Estado',
            'slug'   => 'status',
            'type'   => 'select',
            'config' => ['options' => [
                ['value' => 'lead', 'label' => 'Lead'],
                ['value' => 'won',  'label' => 'Ganada'],
            ]],
        ]);
        $this->assertNotInstanceOf(ValidationResult::class, $status);

        $this->records->create($list, ['name' => 'A', 'amount' => 100, 'status' => 'lead']);
        $this->records->create($list, ['name' => 'B', 'amount' => 200, 'status' => 'lead']);
        $this->records->create($list, ['name' => 'C', 'amount' => 50,  'status' => 'won']);

        return [$list, $amount, $status];
    }

    /**
     * @param array<int, array<string, mixed>> $widgets
     */
    private function makeDashboard(ListEntity $list, array $widgets): DashboardEntity
    {
        $created = $this->dashboards->create([
            'name'    => 'Test',
            'widgets' => $widgets,
        ], userId: 1);
        $this->assertNotInstanceOf(ValidationResult::class, $created);
        return $created;
    }
}
