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
use ImaginaCRM\Tests\Integration\IntegrationTestCase;
use PHPUnit\Framework\Attributes\Group;

/**
 * Verifica los contratos de rendimiento de CLAUDE.md §11 con datos reales:
 *
 * - 5k filas, paginación 50, 2 filtros: p95 ≤ 80ms
 * - 50k filas, paginación 50, 2 filtros: p95 ≤ 200ms
 *
 * Marcado con `#[Group('performance')]` para que CI pueda omitirlo en
 * runs rápidos (`phpunit --exclude-group performance`). El benchmark
 * completo con todos los escenarios y reporte rico vive en `bin/bench.php`.
 *
 * Sembrar 50k rows tarda ~1s; cada test corre ~80 iteraciones del
 * escenario, así que la duración total del suite performance es ~10–15s
 * en hardware modesto.
 */
#[Group('performance')]
final class RecordsBenchmarkTest extends IntegrationTestCase
{
    private const RUNS_PER_SCENARIO = 60;
    private const PAGE_SIZE         = 50;

    private RecordService $records;
    private ListService $lists;
    private FieldService $fields;

    protected function setUp(): void
    {
        parent::setUp();
        $registry = new FieldTypeRegistry();
        $slugs    = new SlugManager($this->db());
        $listRepo = new ListRepository($this->db());
        $fieldRepo = new FieldRepository($this->db());

        $this->lists = new ListService($listRepo, $slugs, $this->schema);
        $this->fields = new FieldService($fieldRepo, $listRepo, $slugs, $this->schema, $registry, new \ImaginaCRM\Records\RecordRepository($this->db()));
        $this->records = new RecordService(
            $fieldRepo,
            new RecordRepository($this->db()),
            new RelationRepository($this->db()),
            new RecordValidator($registry, $this->db()),
            new QueryBuilder($this->db(), $slugs),
        );
    }

    public function test_5k_records_with_two_filters_under_80ms_p95(): void
    {
        $list = $this->seedList(5000);

        $p95 = $this->measureP95(
            list: $list,
            filters: ['status' => ['eq' => 'active'], 'amount' => ['gt' => 500]],
        );

        $this->assertLessThanOrEqual(
            80.0,
            $p95,
            sprintf('p95 = %.1fms supera el contrato de 80ms (5k rows + 2 filtros).', $p95),
        );
    }

    public function test_50k_records_with_two_filters_under_200ms_p95(): void
    {
        $list = $this->seedList(50000);

        $p95 = $this->measureP95(
            list: $list,
            filters: ['status' => ['eq' => 'active'], 'amount' => ['gt' => 500]],
        );

        $this->assertLessThanOrEqual(
            200.0,
            $p95,
            sprintf('p95 = %.1fms supera el contrato de 200ms (50k rows + 2 filtros).', $p95),
        );
    }

    /**
     * Crea una lista con los 5 campos típicos y siembra `$count` registros
     * vía INSERT masivo (bypass del RecordService para que el seeding sea
     * rápido — el objetivo del test es medir la lectura, no la escritura).
     */
    private function seedList(int $count): ListEntity
    {
        $list = $this->lists->create(['name' => 'Bench ' . $count, 'slug' => 'bench_' . $count]);
        $this->assertInstanceOf(ListEntity::class, $list);
        /** @var ListEntity $list */

        $this->fields->create($list->id, ['label' => 'Name', 'slug' => 'name', 'type' => 'text', 'is_required' => true]);
        $this->fields->create($list->id, ['label' => 'Status', 'slug' => 'status', 'type' => 'select', 'config' => [
            'options' => [
                ['value' => 'active', 'label' => 'Active'],
                ['value' => 'pending', 'label' => 'Pending'],
                ['value' => 'archived', 'label' => 'Archived'],
            ],
        ]]);
        $this->fields->create($list->id, ['label' => 'Amount', 'slug' => 'amount', 'type' => 'number', 'config' => ['precision' => 2]]);
        $this->fields->create($list->id, ['label' => 'Email', 'slug' => 'email', 'type' => 'email']);
        $this->fields->create($list->id, ['label' => 'Opened', 'slug' => 'opened_at', 'type' => 'date']);

        $table   = self::TEST_PREFIX . 'imcrm_data_' . $list->tableSuffix;
        $now     = gmdate('Y-m-d H:i:s');
        $statuses = ['active', 'pending', 'archived'];
        $names    = ['Acme', 'Globex', 'Initech', 'Umbrella', 'Stark', 'Wayne'];

        $batchSize = 500;
        $batches   = (int) ceil($count / $batchSize);
        for ($b = 0; $b < $batches; $b++) {
            $values = [];
            $end    = min(($b + 1) * $batchSize, $count);
            for ($i = $b * $batchSize; $i < $end; $i++) {
                $name   = $names[$i % count($names)] . ' ' . ($i + 1);
                $status = $statuses[$i % 3];
                $amount = sprintf('%.2f', mt_rand(1, 100000) / 100);
                $email  = 'user' . $i . '@example.com';
                $opened = gmdate('Y-m-d', strtotime("-{$i} days"));
                $values[] = "('"
                    . esc_sql($name) . "', '"
                    . esc_sql($status) . "', "
                    . $amount . ", '"
                    . esc_sql($email) . "', '"
                    . esc_sql($opened) . "', 1, '"
                    . esc_sql($now) . "', '"
                    . esc_sql($now) . "')";
            }
            $this->wpdb->query(
                "INSERT INTO `{$table}` (name, status, amount, email, opened_at, created_by, created_at, updated_at) VALUES "
                . implode(', ', $values)
            );
        }

        return $list;
    }

    /**
     * @param array<string, mixed> $filters
     */
    private function measureP95(ListEntity $list, array $filters): float
    {
        // Warmup: 3 calls para llenar buffer pool de InnoDB.
        for ($i = 0; $i < 3; $i++) {
            $this->records->list($list, $filters, [], [], null, 1, self::PAGE_SIZE);
        }

        $samples = [];
        for ($i = 0; $i < self::RUNS_PER_SCENARIO; $i++) {
            $t0 = microtime(true);
            $this->records->list($list, $filters, [], [], null, 1, self::PAGE_SIZE);
            $samples[] = (microtime(true) - $t0) * 1000;
        }
        sort($samples, SORT_NUMERIC);

        $rank = 0.95 * (count($samples) - 1);
        $low  = (int) floor($rank);
        $high = (int) ceil($rank);
        if ($low === $high) {
            return $samples[$low];
        }
        $w = $rank - $low;
        return $samples[$low] * (1 - $w) + $samples[$high] * $w;
    }
}
