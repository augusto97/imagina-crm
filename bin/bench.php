<?php
declare(strict_types=1);

/**
 * Benchmark de RecordService + QueryBuilder contra los contratos de
 * rendimiento de CLAUDE.md §11.
 *
 * Uso:
 *   php bin/bench.php [--records=5000] [--runs=100] [--page-size=50]
 *
 * Variables de entorno (mismas que los tests de integración):
 *   IMCRM_TEST_DB_HOST=127.0.0.1
 *   IMCRM_TEST_DB_PORT=3306
 *   IMCRM_TEST_DB_NAME=imcrm_tests
 *   IMCRM_TEST_DB_USER=imcrm
 *   IMCRM_TEST_DB_PASS=imcrm
 *   IMCRM_TEST_DB_SOCKET=/tmp/mysql.sock   (opcional)
 *
 * Imprime una tabla markdown con min / p50 / p95 / p99 / max para cada
 * escenario y devuelve exit-code 1 si algún contrato se incumple.
 *
 * Contratos verificados:
 *   - 5k rows  + 2 filters page 1: p95 ≤ 80 ms
 *   - 50k rows + 2 filters page 1: p95 ≤ 200 ms
 */

require_once __DIR__ . '/../tests/Integration/wp-stubs.php';
require_once __DIR__ . '/../vendor/autoload.php';

use ImaginaCRM\Fields\FieldRepository;
use ImaginaCRM\Fields\FieldService;
use ImaginaCRM\Fields\FieldTypeRegistry;
use ImaginaCRM\Lists\ListEntity;
use ImaginaCRM\Lists\ListRepository;
use ImaginaCRM\Lists\ListService;
use ImaginaCRM\Lists\SchemaManager;
use ImaginaCRM\Lists\SlugManager;
use ImaginaCRM\Records\QueryBuilder;
use ImaginaCRM\Records\RecordRepository;
use ImaginaCRM\Records\RecordService;
use ImaginaCRM\Records\RecordValidator;
use ImaginaCRM\Records\RelationRepository;
use ImaginaCRM\Support\Database;

$opts = getopt('', ['records:', 'runs:', 'page-size:']);
$recordsCount = isset($opts['records']) ? (int) $opts['records'] : 5000;
$runs         = isset($opts['runs']) ? (int) $opts['runs'] : 100;
$pageSize     = isset($opts['page-size']) ? (int) $opts['page-size'] : 50;

$dbHost   = getenv('IMCRM_TEST_DB_HOST') ?: '127.0.0.1';
$dbPort   = getenv('IMCRM_TEST_DB_PORT') ?: '3306';
$dbName   = getenv('IMCRM_TEST_DB_NAME') ?: 'imcrm_tests';
$dbUser   = getenv('IMCRM_TEST_DB_USER') ?: 'imcrm';
$dbPass   = getenv('IMCRM_TEST_DB_PASS') ?: 'imcrm';
$dbSocket = getenv('IMCRM_TEST_DB_SOCKET') ?: null;

try {
    $GLOBALS['wpdb'] = new \wpdb($dbUser, $dbPass, $dbName, $dbHost . ':' . $dbPort, $dbSocket ?: null);
} catch (\Throwable $e) {
    fwrite(STDERR, "ERROR: no se pudo conectar a MySQL: {$e->getMessage()}\n");
    exit(2);
}
$GLOBALS['wpdb']->prefix = 'imcrm_bench_';

$wpdb     = $GLOBALS['wpdb'];
$db       = new Database($wpdb);
$schema   = new SchemaManager($db);
$slugs    = new SlugManager($db);
$registry = new FieldTypeRegistry();

$listRepo     = new ListRepository($db);
$fieldRepo    = new FieldRepository($db);
$lists        = new ListService($listRepo, $slugs, $schema);
$fields       = new FieldService($fieldRepo, $listRepo, $slugs, $schema, $registry);
$recordSvc    = new RecordService(
    $fieldRepo,
    new RecordRepository($db),
    new RelationRepository($db),
    new RecordValidator($registry, $db),
    new QueryBuilder($db, $slugs),
);

echo "→ Reset de tablas con prefijo {$wpdb->prefix}…\n";
cleanupBenchTables($wpdb);
$schema->installSystemTables();

echo "→ Creando lista 'companies' con 5 campos…\n";
$list = $lists->create(['name' => 'Companies', 'slug' => 'companies']);
if (! $list instanceof ListEntity) {
    fwrite(STDERR, "ERROR: no se pudo crear la lista de prueba.\n");
    exit(2);
}
$fields->create($list->id, ['label' => 'Name', 'slug' => 'name', 'type' => 'text', 'is_required' => true]);
$fields->create($list->id, ['label' => 'Status', 'slug' => 'status', 'type' => 'select', 'config' => ['options' => [
    ['value' => 'active', 'label' => 'Active'],
    ['value' => 'pending', 'label' => 'Pending'],
    ['value' => 'archived', 'label' => 'Archived'],
]]]);
$fields->create($list->id, ['label' => 'Amount', 'slug' => 'amount', 'type' => 'number', 'config' => ['precision' => 2]]);
$fields->create($list->id, ['label' => 'Email', 'slug' => 'email', 'type' => 'email']);
$fields->create($list->id, ['label' => 'Created date', 'slug' => 'opened_at', 'type' => 'date']);

echo "→ Sembrando {$recordsCount} registros…\n";
$start = microtime(true);
seedRecords($wpdb, $list->tableSuffix, $recordsCount);
$seedMs = (int) round((microtime(true) - $start) * 1000);
echo "  {$recordsCount} registros en {$seedMs}ms.\n";

$scenarios = [
    'list page 1 (no filters)' => [
        'filters' => [],
        'sort'    => [],
        'search'  => null,
    ],
    'list page 1 + 2 filters (status=active AND amount>500)' => [
        'filters' => [
            'status' => ['eq' => 'active'],
            'amount' => ['gt' => 500],
        ],
        'sort'    => [],
        'search'  => null,
    ],
    'list page 1 + sort by opened_at desc + 1 filter' => [
        'filters' => ['status' => ['eq' => 'active']],
        'sort'    => [['slug' => 'opened_at', 'dir' => 'desc']],
        'search'  => null,
    ],
    'list page 1 + search "acme"' => [
        'filters' => [],
        'sort'    => [],
        'search'  => 'acme',
    ],
    'list page 50 + 2 filters (deep page)' => [
        'filters' => [
            'status' => ['eq' => 'active'],
            'amount' => ['gt' => 500],
        ],
        'sort'    => [],
        'search'  => null,
        'page'    => 50,
    ],
];

$contractMs = $recordsCount >= 50000 ? 200 : ($recordsCount >= 5000 ? 80 : null);
$results    = [];

foreach ($scenarios as $name => $params) {
    $samples = [];
    $page    = $params['page'] ?? 1;
    // Warmup: 3 calls para llenar buffer pool / parsers.
    for ($i = 0; $i < 3; $i++) {
        $recordSvc->list($list, $params['filters'], $params['sort'], [], $params['search'], $page, $pageSize);
    }
    for ($i = 0; $i < $runs; $i++) {
        $t0 = microtime(true);
        $recordSvc->list($list, $params['filters'], $params['sort'], [], $params['search'], $page, $pageSize);
        $samples[] = (microtime(true) - $t0) * 1000;
    }
    sort($samples, SORT_NUMERIC);
    $results[$name] = [
        'min' => $samples[0],
        'p50' => percentile($samples, 50),
        'p95' => percentile($samples, 95),
        'p99' => percentile($samples, 99),
        'max' => $samples[count($samples) - 1],
        'n'   => count($samples),
    ];
}

echo "\n";
echo str_repeat('=', 78) . "\n";
echo " BENCHMARK: {$recordsCount} records, page_size={$pageSize}, {$runs} runs c/u\n";
echo str_repeat('=', 78) . "\n";
printf("| %-58s | %6s | %6s | %6s | %6s |\n", 'Scenario', 'min', 'p50', 'p95', 'p99');
echo "|" . str_repeat('-', 60) . "|" . str_repeat('-', 8) . "|" . str_repeat('-', 8) . "|" . str_repeat('-', 8) . "|" . str_repeat('-', 8) . "|\n";
foreach ($results as $name => $r) {
    printf(
        "| %-58s | %5.1fms | %5.1fms | %5.1fms | %5.1fms |\n",
        substr($name, 0, 58),
        $r['min'],
        $r['p50'],
        $r['p95'],
        $r['p99'],
    );
}
echo "\n";

if ($contractMs !== null) {
    $missed = [];
    foreach ($results as $name => $r) {
        if ($r['p95'] > $contractMs) {
            $missed[] = sprintf('%s (p95=%.1fms > %dms)', $name, $r['p95'], $contractMs);
        }
    }
    if ($missed === []) {
        echo "✓ Todos los escenarios cumplen el contrato p95 ≤ {$contractMs}ms.\n";
        exit(0);
    }
    echo "✗ INCUMPLIMIENTOS de contrato (p95 ≤ {$contractMs}ms):\n";
    foreach ($missed as $m) {
        echo "  - {$m}\n";
    }
    exit(1);
}

echo "ℹ Sin contrato definido para {$recordsCount} records.\n";
exit(0);

// -------------------------------------------------------------------------

/**
 * Reset agresivo: dropea cualquier tabla con el prefijo bench.
 */
function cleanupBenchTables(\wpdb $wpdb): void
{
    $rows = $wpdb->get_col('SHOW TABLES');
    if (! is_array($rows)) {
        return;
    }
    $wpdb->query('SET FOREIGN_KEY_CHECKS=0');
    foreach ($rows as $name) {
        $name = (string) $name;
        if (str_starts_with($name, $wpdb->prefix)) {
            $wpdb->query('DROP TABLE IF EXISTS `' . esc_sql($name) . '`');
        }
    }
    $wpdb->query('SET FOREIGN_KEY_CHECKS=1');
}

/**
 * INSERT masivo bypassing el RecordService (queremos seed rápido). Las
 * columnas y tipos coinciden con la lista que creamos arriba.
 */
function seedRecords(\wpdb $wpdb, string $tableSuffix, int $count): void
{
    $table   = $wpdb->prefix . 'imcrm_data_' . $tableSuffix;
    $now     = gmdate('Y-m-d H:i:s');
    $statuses = ['active', 'pending', 'archived'];
    $names    = ['Acme', 'Globex', 'Initech', 'Umbrella', 'Stark', 'Wayne', 'Wonka', 'Tyrell', 'Soylent', 'Hooli'];

    $batchSize = 500;
    $batches   = (int) ceil($count / $batchSize);
    for ($b = 0; $b < $batches; $b++) {
        $values = [];
        $end    = min(($b + 1) * $batchSize, $count);
        for ($i = $b * $batchSize; $i < $end; $i++) {
            $name      = $names[$i % count($names)] . ' ' . ($i + 1);
            $status    = $statuses[$i % 3];
            $amount    = sprintf('%.2f', (mt_rand(1, 100000)) / 100);
            $email     = 'user' . $i . '@example.com';
            $opened    = gmdate('Y-m-d', strtotime("-{$i} days"));
            $values[] = "('"
                . esc_sql($name) . "', '"
                . esc_sql($status) . "', "
                . $amount . ", '"
                . esc_sql($email) . "', '"
                . esc_sql($opened) . "', 1, '"
                . esc_sql($now) . "', '"
                . esc_sql($now) . "')";
        }
        $sql = "INSERT INTO `{$table}` (name, status, amount, email, opened_at, created_by, created_at, updated_at) VALUES "
            . implode(', ', $values);
        $wpdb->query($sql);
    }
}

/**
 * Percentil simple (con interpolación lineal).
 *
 * @param array<int, float> $sorted Asume ya ordenados ascendente.
 */
function percentile(array $sorted, int $p): float
{
    $n = count($sorted);
    if ($n === 0) {
        return 0.0;
    }
    $rank = ($p / 100) * ($n - 1);
    $low  = (int) floor($rank);
    $high = (int) ceil($rank);
    if ($low === $high) {
        return $sorted[$low];
    }
    $w = $rank - $low;
    return $sorted[$low] * (1 - $w) + $sorted[$high] * $w;
}
