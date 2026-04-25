<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\Automations;

use ImaginaCRM\Automations\ActionRegistry;
use ImaginaCRM\Automations\ActionResult;
use ImaginaCRM\Automations\AutomationEngine;
use ImaginaCRM\Automations\AutomationEntity;
use ImaginaCRM\Automations\AutomationRepository;
use ImaginaCRM\Automations\AutomationRunRepository;
use ImaginaCRM\Automations\TriggerContext;
use ImaginaCRM\Automations\TriggerRegistry;
use ImaginaCRM\Automations\Triggers\RecordCreatedTrigger;
use ImaginaCRM\Contracts\ActionInterface;
use ImaginaCRM\Lists\ListEntity;
use PHPUnit\Framework\TestCase;

/**
 * Tests del engine en aislamiento usando stubs en memoria de los
 * repositorios. No depende de wpdb. Cubre:
 *
 * - dispatch ejecuta acciones cuando trigger.matches() = true.
 * - run se persiste con status=success cuando todas las acciones suceden.
 * - run se marca failed si al menos una acción falla, pero todas las
 *   acciones igual se intentan.
 * - acciones no registradas se loguean como skipped.
 * - matchea solo automatizaciones activas para la lista + trigger.
 * - protección de loop: la profundidad estática limita disparos
 *   recursivos (UpdateFieldAction → record_updated → dispatch...).
 */
final class AutomationEngineTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        AutomationEngine::resetDepth();
    }

    public function test_dispatch_runs_actions_and_persists_success(): void
    {
        $list      = $this->stubList();
        $automation = $this->makeAutomation(1, $list->id, 'record_created', actions: [
            ['type' => 'noop_ok', 'config' => []],
        ]);

        $automationsRepo = new InMemoryAutomationRepository([$automation]);
        $runsRepo        = new InMemoryAutomationRunRepository();

        $triggers = new TriggerRegistry();
        $actions  = new ActionRegistry();
        $actions->register(new StubAction('noop_ok', ActionResult::success('noop_ok')));

        $engine = new AutomationEngine($automationsRepo, $runsRepo, $triggers, $actions);

        $engine->dispatch(new TriggerContext(
            event: 'imagina_crm/record_created',
            list: $list,
            record: ['id' => 99, 'fields' => ['status' => 'active']],
        ));

        $this->assertCount(1, $runsRepo->records);
        $run = $runsRepo->records[0];
        $this->assertSame('success', $run['status']);
        $this->assertCount(1, $run['actions_log']);
        $this->assertSame('success', $run['actions_log'][0]['status']);
    }

    public function test_run_marked_failed_when_any_action_fails(): void
    {
        $list      = $this->stubList();
        $automation = $this->makeAutomation(2, $list->id, 'record_created', actions: [
            ['type' => 'noop_ok', 'config' => []],
            ['type' => 'noop_fail', 'config' => []],
        ]);

        $automationsRepo = new InMemoryAutomationRepository([$automation]);
        $runsRepo        = new InMemoryAutomationRunRepository();

        $actions = new ActionRegistry();
        $actions->register(new StubAction('noop_ok',   ActionResult::success('noop_ok')));
        $actions->register(new StubAction('noop_fail', ActionResult::failed('noop_fail', 'boom')));

        $engine = new AutomationEngine($automationsRepo, $runsRepo, new TriggerRegistry(), $actions);

        $engine->dispatch(new TriggerContext(
            event: 'imagina_crm/record_created',
            list: $list,
            record: ['id' => 1, 'fields' => []],
        ));

        $run = $runsRepo->records[0];
        $this->assertSame('failed', $run['status']);
        $this->assertCount(2, $run['actions_log'], 'Ambas acciones se ejecutan, aunque una falla.');
        $this->assertSame('success', $run['actions_log'][0]['status']);
        $this->assertSame('failed',  $run['actions_log'][1]['status']);
    }

    public function test_unregistered_action_is_logged_as_skipped(): void
    {
        $list      = $this->stubList();
        $automation = $this->makeAutomation(3, $list->id, 'record_created', actions: [
            ['type' => 'ghost', 'config' => []],
        ]);

        $automationsRepo = new InMemoryAutomationRepository([$automation]);
        $runsRepo        = new InMemoryAutomationRunRepository();
        $engine          = new AutomationEngine($automationsRepo, $runsRepo, new TriggerRegistry(), new ActionRegistry());

        $engine->dispatch(new TriggerContext(
            event: 'imagina_crm/record_created',
            list: $list,
            record: ['id' => 1, 'fields' => []],
        ));

        $run = $runsRepo->records[0];
        $this->assertSame('success', $run['status'], 'skipped no se considera fallo');
        $this->assertSame('skipped', $run['actions_log'][0]['status']);
    }

    public function test_dispatch_ignores_event_with_no_active_automation(): void
    {
        $list = $this->stubList();
        $automationsRepo = new InMemoryAutomationRepository([]);
        $runsRepo        = new InMemoryAutomationRunRepository();
        $engine          = new AutomationEngine($automationsRepo, $runsRepo, new TriggerRegistry(), new ActionRegistry());

        $engine->dispatch(new TriggerContext(
            event: 'imagina_crm/record_created',
            list: $list,
            record: ['id' => 1, 'fields' => []],
        ));

        $this->assertSame([], $runsRepo->records);
    }

    public function test_unknown_event_does_nothing(): void
    {
        $list = $this->stubList();
        $automation = $this->makeAutomation(4, $list->id, 'record_created', actions: [
            ['type' => 'noop_ok', 'config' => []],
        ]);

        $automationsRepo = new InMemoryAutomationRepository([$automation]);
        $runsRepo        = new InMemoryAutomationRunRepository();
        $actions         = new ActionRegistry();
        $actions->register(new StubAction('noop_ok', ActionResult::success('noop_ok')));

        $engine = new AutomationEngine($automationsRepo, $runsRepo, new TriggerRegistry(), $actions);

        $engine->dispatch(new TriggerContext(
            event: 'imagina_crm/some_unknown_event',
            list: $list,
            record: ['id' => 1, 'fields' => []],
        ));

        $this->assertSame([], $runsRepo->records);
    }

    public function test_loop_protection_caps_recursive_depth(): void
    {
        $list   = $this->stubList();

        $automation = $this->makeAutomation(5, $list->id, 'record_created', actions: [
            ['type' => 'recursive', 'config' => []],
        ]);

        $automationsRepo = new InMemoryAutomationRepository([$automation]);
        $runsRepo        = new InMemoryAutomationRunRepository();
        $actions         = new ActionRegistry();

        // Acción que vuelve a llamar a dispatch() recursivamente. Sin
        // protección, esto explotaría en stack overflow.
        $engineHolder = new \stdClass();
        $actions->register(new class($engineHolder, $list) implements ActionInterface {
            public function __construct(private \stdClass $holder, private ListEntity $list) {}
            public function getSlug(): string { return 'recursive'; }
            public function getLabel(): string { return 'Recursive'; }
            public function execute(TriggerContext $context, array $config): ActionResult
            {
                /** @var AutomationEngine $engine */
                $engine = $this->holder->engine;
                $engine->dispatch(new TriggerContext(
                    event: 'imagina_crm/record_created',
                    list: $this->list,
                    record: ['id' => 1, 'fields' => []],
                ));
                return ActionResult::success('recursive');
            }
            public function getConfigSchema(): array { return []; }
        });

        $engine               = new AutomationEngine($automationsRepo, $runsRepo, new TriggerRegistry(), $actions);
        $engineHolder->engine = $engine;

        $engine->dispatch(new TriggerContext(
            event: 'imagina_crm/record_created',
            list: $list,
            record: ['id' => 1, 'fields' => []],
        ));

        // MAX_DEPTH=5 → debe haber exactamente 5 runs persistidos
        // (el dispatch #6 entra al guard y retorna sin tocar runs).
        $this->assertCount(AutomationEngine::MAX_DEPTH, $runsRepo->records);
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

/**
 * Repositorio en memoria que sólo expone `activeForListAndTrigger`,
 * suficiente para los tests del engine. El resto de métodos de
 * `AutomationRepository` no se invocan en estas rutas.
 */
final class InMemoryAutomationRepository extends AutomationRepository
{
    /** @var array<int, AutomationEntity> */
    public array $items;

    /**
     * @param array<int, AutomationEntity> $items
     */
    public function __construct(array $items)
    {
        $this->items = $items;
        // No llamamos al ctor padre — no necesitamos Database aquí.
    }

    public function find(int $id): ?AutomationEntity
    {
        foreach ($this->items as $item) {
            if ($item->id === $id) {
                return $item;
            }
        }
        return null;
    }

    /**
     * @return array<int, AutomationEntity>
     */
    public function allForList(int $listId): array
    {
        return array_values(array_filter(
            $this->items,
            static fn (AutomationEntity $a): bool => $a->listId === $listId,
        ));
    }

    public function activeForListAndTrigger(int $listId, string $triggerType): array
    {
        return array_values(array_filter(
            $this->items,
            static fn (AutomationEntity $a): bool =>
                $a->listId === $listId
                && $a->triggerType === $triggerType
                && $a->isActive
                && $a->deletedAt === null,
        ));
    }
}

/**
 * Equivalente en memoria de `AutomationRunRepository`. Cada `create()`
 * añade un registro a `$records`; `update()` mergea el patch sobre el
 * registro existente. Suficiente para inspeccionar status y actions_log
 * en las aserciones.
 */
final class InMemoryAutomationRunRepository extends AutomationRunRepository
{
    /** @var array<int, array<string, mixed>> */
    public array $records = [];

    private int $nextId = 1;

    public function __construct()
    {
        // No invocamos al ctor padre: no necesitamos Database.
    }

    public function create(array $data): int
    {
        $id = $this->nextId++;
        $this->records[] = array_merge(
            ['id' => $id, 'actions_log' => []],
            $data,
        );
        return $id;
    }

    public function update(int $id, array $patch): bool
    {
        foreach ($this->records as &$row) {
            if (($row['id'] ?? 0) === $id) {
                $row = array_merge($row, $patch);
                return true;
            }
        }
        return false;
    }

    public function recentForAutomation(int $automationId, int $limit = 50): array
    {
        return array_slice(
            array_values(array_filter(
                $this->records,
                static fn (array $r): bool => ($r['automation_id'] ?? 0) === $automationId,
            )),
            0,
            $limit,
        );
    }
}

/**
 * Acción de prueba con resultado prefabricado.
 */
final class StubAction implements ActionInterface
{
    public function __construct(
        private readonly string $slug,
        private readonly ActionResult $result,
    ) {}

    public function getSlug(): string { return $this->slug; }
    public function getLabel(): string { return $this->slug; }

    public function execute(TriggerContext $context, array $config): ActionResult
    {
        return $this->result;
    }

    public function getConfigSchema(): array { return []; }
}
