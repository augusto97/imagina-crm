<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\Automations;

use ImaginaCRM\Automations\ActionRegistry;
use ImaginaCRM\Automations\ActionResult;
use ImaginaCRM\Automations\AutomationEngine;
use ImaginaCRM\Automations\AutomationEntity;
use ImaginaCRM\Automations\AutomationRunRepository;
use ImaginaCRM\Automations\TriggerContext;
use ImaginaCRM\Automations\TriggerRegistry;
use ImaginaCRM\Lists\ListEntity;
use PHPUnit\Framework\TestCase;

/**
 * Cubre las dos rutas async del engine:
 *
 * - `enqueue(ctx)` persiste run pending + llama Action Scheduler.
 * - `runById(runId)` ejecuta acciones, persiste log y, en fallo, re-encola
 *   con backoff hasta MAX_RETRIES.
 *
 * Reusa los doubles de `AutomationEngineTest.php`
 * (InMemoryAutomationRepository / InMemoryAutomationRunRepository) y
 * los stubs `as_enqueue_async_action` / `as_schedule_single_action` del
 * bootstrap unitario.
 */
final class AsyncEngineTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        AutomationEngine::resetDepth();
        $GLOBALS['imcrm_test_as_calls'] = [];
    }

    public function test_enqueue_persists_pending_run_and_calls_action_scheduler(): void
    {
        $list      = $this->stubList();
        $automation = $this->makeAutomation(1, $list->id, 'record_created', [
            ['type' => 'noop_ok', 'config' => []],
        ]);

        $automationsRepo = new InMemoryAutomationRepository([$automation]);
        $runsRepo        = new InMemoryAutomationRunRepository();
        $actions         = new ActionRegistry();
        $actions->register(new StubAction('noop_ok', ActionResult::success('noop_ok')));

        $engine = new AutomationEngine($automationsRepo, $runsRepo, new TriggerRegistry(), $actions);

        $runId = $engine->enqueue(new TriggerContext(
            event: 'imagina_crm/record_created',
            list: $list,
            record: ['id' => 1, 'fields' => []],
        ));

        $this->assertNotNull($runId);
        $this->assertCount(1, $runsRepo->records);
        $this->assertSame('pending', $runsRepo->records[0]['status']);

        $this->assertCount(1, $GLOBALS['imcrm_test_as_calls']);
        $call = $GLOBALS['imcrm_test_as_calls'][0];
        $this->assertSame(AutomationEngine::HOOK_RUN_AUTOMATION, $call['hook']);
        $this->assertSame('async', $call['kind']);
        $this->assertSame([$runId], $call['args']);
    }

    public function test_run_by_id_executes_actions_and_persists_success(): void
    {
        $list = $this->stubList();
        $automation = $this->makeAutomation(2, $list->id, 'record_created', [
            ['type' => 'noop_ok', 'config' => []],
        ]);

        $automationsRepo = new InMemoryAutomationRepository([$automation]);
        $runsRepo        = new InMemoryAutomationRunRepository();
        $actions         = new ActionRegistry();
        $actions->register(new StubAction('noop_ok', ActionResult::success('noop_ok')));

        $engine = new AutomationEngine($automationsRepo, $runsRepo, new TriggerRegistry(), $actions);

        $runId = $engine->enqueue(new TriggerContext(
            event: 'imagina_crm/record_created',
            list: $list,
            record: ['id' => 1, 'fields' => []],
        ));
        $this->assertNotNull($runId);

        // En la ruta async, AS llamaría runById en otra request. Lo
        // simulamos invocándolo directamente.
        $engine->runById($runId);

        $this->assertSame('success', $runsRepo->records[0]['status']);
        $this->assertCount(1, $runsRepo->records[0]['actions_log']);
    }

    public function test_run_by_id_reenqueues_on_failure_with_backoff(): void
    {
        $list = $this->stubList();
        $automation = $this->makeAutomation(3, $list->id, 'record_created', [
            ['type' => 'noop_fail', 'config' => []],
        ]);

        $automationsRepo = new InMemoryAutomationRepository([$automation]);
        $runsRepo        = new InMemoryAutomationRunRepository();
        $actions         = new ActionRegistry();
        $actions->register(new StubAction('noop_fail', ActionResult::failed('noop_fail', 'boom')));

        $engine = new AutomationEngine($automationsRepo, $runsRepo, new TriggerRegistry(), $actions);

        $runId = $engine->enqueue(new TriggerContext(
            event: 'imagina_crm/record_created',
            list: $list,
            record: ['id' => 1, 'fields' => []],
        ));
        $this->assertNotNull($runId);

        // Limpiamos la primera llamada (la del enqueue) para enfocarnos
        // en el reschedule del retry.
        $GLOBALS['imcrm_test_as_calls'] = [];

        $engine->runById($runId);

        // Run quedó failed pero con retries=1.
        $this->assertSame('failed', $runsRepo->records[0]['status']);
        $this->assertSame(1, $runsRepo->records[0]['retries']);

        // Y se programó un retry single con delay > 0.
        $this->assertCount(1, $GLOBALS['imcrm_test_as_calls']);
        $reschedule = $GLOBALS['imcrm_test_as_calls'][0];
        $this->assertSame('single', $reschedule['kind']);
        $this->assertSame([$runId], $reschedule['args']);
        $this->assertGreaterThan(time(), $reschedule['when']);
    }

    public function test_run_by_id_stops_reenqueueing_after_max_retries(): void
    {
        $list = $this->stubList();
        $automation = $this->makeAutomation(4, $list->id, 'record_created', [
            ['type' => 'noop_fail', 'config' => []],
        ]);

        $automationsRepo = new InMemoryAutomationRepository([$automation]);
        $runsRepo        = new InMemoryAutomationRunRepository();
        $actions         = new ActionRegistry();
        $actions->register(new StubAction('noop_fail', ActionResult::failed('noop_fail', 'boom')));

        $engine = new AutomationEngine($automationsRepo, $runsRepo, new TriggerRegistry(), $actions);
        $runId = $engine->enqueue(new TriggerContext(
            event: 'imagina_crm/record_created',
            list: $list,
            record: ['id' => 1, 'fields' => []],
        ));
        $this->assertNotNull($runId);

        // Simulamos 3 reintentos consecutivos. Tras el último, no debería
        // re-encolar.
        for ($i = 0; $i < AutomationEngine::MAX_RETRIES; $i++) {
            $engine->runById($runId);
        }

        $GLOBALS['imcrm_test_as_calls'] = [];
        $engine->runById($runId);
        $this->assertSame([], $GLOBALS['imcrm_test_as_calls'], 'No debe re-encolar tras MAX_RETRIES');
    }

    public function test_enqueue_returns_null_when_no_match(): void
    {
        $list            = $this->stubList();
        $automationsRepo = new InMemoryAutomationRepository([]);
        $runsRepo        = new InMemoryAutomationRunRepository();
        $engine          = new AutomationEngine($automationsRepo, $runsRepo, new TriggerRegistry(), new ActionRegistry());

        $runId = $engine->enqueue(new TriggerContext(
            event: 'imagina_crm/record_created',
            list: $list,
            record: ['id' => 1, 'fields' => []],
        ));

        $this->assertNull($runId);
        $this->assertSame([], $GLOBALS['imcrm_test_as_calls']);
    }

    /**
     * @param array<int, array{type: string, config: array<string, mixed>}> $actions
     */
    private function makeAutomation(int $id, int $listId, string $triggerType, array $actions): AutomationEntity
    {
        return new AutomationEntity(
            id: $id,
            listId: $listId,
            name: 'auto-' . $id,
            description: null,
            triggerType: $triggerType,
            triggerConfig: [],
            actions: $actions,
            isActive: true,
            createdBy: 1,
            createdAt: '2026-04-25 10:00:00',
            updatedAt: '2026-04-25 10:00:00',
            deletedAt: null,
        );
    }

    private function stubList(): ListEntity
    {
        return new ListEntity(
            id: 1,
            slug: 'leads',
            tableSuffix: 'leads',
            name: 'Leads',
            description: null,
            icon: null,
            color: null,
            settings: [],
            position: 0,
            createdBy: 1,
            createdAt: '2026-04-25 10:00:00',
            updatedAt: '2026-04-25 10:00:00',
            deletedAt: null,
        );
    }
}
