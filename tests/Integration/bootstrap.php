<?php
declare(strict_types=1);

/**
 * Bootstrap del suite de integración.
 *
 * Variables de entorno:
 * - IMCRM_TEST_DB_HOST    (default: 127.0.0.1)
 * - IMCRM_TEST_DB_PORT    (default: 3306)
 * - IMCRM_TEST_DB_NAME    (default: imcrm_tests)
 * - IMCRM_TEST_DB_USER    (default: imcrm)
 * - IMCRM_TEST_DB_PASS    (default: imcrm)
 * - IMCRM_TEST_DB_SOCKET  (opcional, si está set se usa en vez de host:port)
 *
 * Si la conexión no se puede establecer, los tests del suite Integration
 * se omiten con un `markTestSkipped` desde IntegrationTestCase.
 */

require_once __DIR__ . '/wp-stubs.php';
require_once dirname(__DIR__, 2) . '/vendor/autoload.php';

$dbHost   = getenv('IMCRM_TEST_DB_HOST') ?: '127.0.0.1';
$dbPort   = getenv('IMCRM_TEST_DB_PORT') ?: '3306';
$dbName   = getenv('IMCRM_TEST_DB_NAME') ?: 'imcrm_tests';
$dbUser   = getenv('IMCRM_TEST_DB_USER') ?: 'imcrm';
$dbPass   = getenv('IMCRM_TEST_DB_PASS') ?: 'imcrm';
$dbSocket = getenv('IMCRM_TEST_DB_SOCKET') ?: null;

try {
    $GLOBALS['wpdb'] = new \wpdb(
        $dbUser,
        $dbPass,
        $dbName,
        $dbHost . ':' . $dbPort,
        $dbSocket ?: null,
    );
    $GLOBALS['imcrm_test_db_available'] = true;
} catch (\Throwable $e) {
    $GLOBALS['imcrm_test_db_available'] = false;
    $GLOBALS['imcrm_test_db_error']    = $e->getMessage();
}
