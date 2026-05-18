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

    public function test_action_with_unmet_condition_is_skipped(): void
    {
        $list       = $this->stubList();
        $automation = $this->makeAutomation(10, $list->id, 'record_created', actions: [
            // Action 1: condition status=won → matchea, ejecuta.
            ['type' => 'noop_ok', 'config' => [], 'condition' => ['status' => 'won']],
            // Action 2: condition status=lost → no matchea, skipped.
            ['type' => 'noop_ok', 'config' => [], 'condition' => ['status' => 'lost']],
            // Action 3: sin condition → ejecuta siempre.
            ['type' => 'noop_ok', 'config' => []],
        ]);

        $automationsRepo = new InMemoryAutomationRepository([$automation]);
        $runsRepo        = new InMemoryAutomationRunRepository();
        $actions         = new ActionRegistry();
        $actions->register(new StubAction('noop_ok', ActionResult::success('noop_ok')));

        $engine = new AutomationEngine($automationsRepo, $runsRepo, new TriggerRegistry(), $actions);

        $engine->dispatch(new TriggerContext(
            event: 'imagina_crm/record_created',
            list: $list,
            record: ['id' => 99, 'fields' => ['status' => 'won']],
        ));

        $this->assertCount(1, $runsRepo->records);
        $log = $runsRepo->records[0]['actions_log'];
        $this->assertCount(3, $log);
        $this->assertSame('success', $log[0]['status'], 'condición matchea → ejecuta');
        $this->assertSame('skipped', $log[1]['status'], 'condición no matchea → skipped');
        $this->assertSame('Condición de ejecución no cumplida.', $log[1]['message']);
        $this->assertSame('success', $log[2]['status'], 'sin condición → siempre corre');
        // Run final = success: skipped no cuenta como failure.
        $this->assertSame('success', $runsRepo->records[0]['status']);
    }

    public function test_if_else_executes_then_branch_when_condition_matches(): void
    {
        $list       = $this->stubList();
        $automation = $this->makeAutomation(20, $list->id, 'record_created', actions: [
            ['type' => 'if_else', 'config' => [
                'condition'    => ['status' => 'won'],
                'then_actions' => [
                    ['type' => 'noop_ok', 'config' => []],
                ],
                'else_actions' => [
                    ['type' => 'noop_fail', 'config' => []],
                ],
            ]],
        ]);

        $automationsRepo = new InMemoryAutomationRepository([$automation]);
        $runsRepo        = new InMemoryAutomationRunRepository();
        $actions         = new ActionRegistry();
        $actions->register(new StubAction('noop_ok',   ActionResult::success('noop_ok')));
        $actions->register(new StubAction('noop_fail', ActionResult::failed('noop_fail', 'shouldnt run')));
        $actions->register(new \ImaginaCRM\Automations\Actions\IfElseAction());

        $engine = new AutomationEngine($automationsRepo, $runsRepo, new TriggerRegistry(), $actions);
        $engine->dispatch(new TriggerContext(
            event: 'imagina_crm/record_created',
            list: $list,
            record: ['id' => 99, 'fields' => ['status' => 'won']],
        ));

        $log = $runsRepo->records[0]['actions_log'];
        // 1 entry para el if_else summary + 1 para noop_ok del branch then.
        $this->assertCount(2, $log);
        $this->assertSame('if_else', $log[0]['action']);
        $this->assertSame('then',    $log[0]['details']['branch']);
        $this->assertSame('noop_ok', $log[1]['action']);
        $this->assertSame('success', $log[1]['status']);
        // El else NO corrió, así que el run termina success.
        $this->assertSame('success', $runsRepo->records[0]['status']);
    }

    public function test_if_else_executes_else_branch_when_condition_fails(): void
    {
        $list       = $this->stubList();
        $automation = $this->makeAutomation(21, $list->id, 'record_created', actions: [
            ['type' => 'if_else', 'config' => [
                'condition'    => ['status' => 'won'],
                'then_actions' => [
                    ['type' => 'noop_ok', 'config' => []],
                ],
                'else_actions' => [
                    ['type' => 'noop_other', 'config' => []],
                ],
            ]],
        ]);

        $automationsRepo = new InMemoryAutomationRepository([$automation]);
        $runsRepo        = new InMemoryAutomationRunRepository();
        $actions         = new ActionRegistry();
        $actions->register(new StubAction('noop_ok',    ActionResult::success('noop_ok',    'shouldnt run')));
        $actions->register(new StubAction('noop_other', ActionResult::success('noop_other', 'else branch')));
        $actions->register(new \ImaginaCRM\Automations\Actions\IfElseAction());

        $engine = new AutomationEngine($automationsRepo, $runsRepo, new TriggerRegistry(), $actions);
        $engine->dispatch(new TriggerContext(
            event: 'imagina_crm/record_created',
            list: $list,
            record: ['id' => 99, 'fields' => ['status' => 'lost']],
        ));

        $log = $runsRepo->records[0]['actions_log'];
        $this->assertCount(2, $log);
        $this->assertSame('else',       $log[0]['details']['branch']);
        $this->assertSame('noop_other', $log[1]['action']);
        $this->assertSame('else branch', $log[1]['message']);
    }

    public function test_if_else_handles_nested_if_else(): void
    {
        $list       = $this->stubList();
        $automation = $this->makeAutomation(22, $list->id, 'record_created', actions: [
            ['type' => 'if_else', 'config' => [
                'condition'    => ['tier' => 'gold'],
                'then_actions' => [
                    // Nested if_else dentro del then.
                    ['type' => 'if_else', 'config' => [
                        'condition'    => ['region' => 'eu'],
                        'then_actions' => [['type' => 'noop_eu', 'config' => []]],
                        'else_actions' => [['type' => 'noop_other_region', 'config' => []]],
                    ]],
                ],
                'else_actions' => [
                    ['type' => 'noop_silver', 'config' => []],
                ],
            ]],
        ]);

        $automationsRepo = new InMemoryAutomationRepository([$automation]);
        $runsRepo        = new InMemoryAutomationRunRepository();
        $actions         = new ActionRegistry();
        $actions->register(new StubAction('noop_eu',           ActionResult::success('noop_eu')));
        $actions->register(new StubAction('noop_other_region', ActionResult::success('noop_other_region')));
        $actions->register(new StubAction('noop_silver',       ActionResult::success('noop_silver')));
        $actions->register(new \ImaginaCRM\Automations\Actions\IfElseAction());

        $engine = new AutomationEngine($automationsRepo, $runsRepo, new TriggerRegistry(), $actions);
        $engine->dispatch(new TriggerContext(
            event: 'imagina_crm/record_created',
            list: $list,
            record: ['id' => 1, 'fields' => ['tier' => 'gold', 'region' => 'eu']],
        ));

        $log = $runsRepo->records[0]['actions_log'];
        // Outer if_else summary + inner if_else summary + noop_eu.
        $this->assertCount(3, $log);
        $this->assertSame('if_else', $log[0]['action']);
        $this->assertSame('then',    $log[0]['details']['branch']);
        $this->assertSame('if_else', $log[1]['action']);
        $this->assertSame('then',    $log[1]['details']['branch']);
        $this->assertSame('noop_eu', $log[2]['action']);
    }

    public function test_if_else_action_level_condition_skips_entire_block(): void
    {
        $list       = $this->stubList();
        $automation = $this->makeAutomation(23, $list->id, 'record_created', actions: [
            // Condition de NIVEL acción (sibling de type/config) en if_else.
            // Si no matchea, ni el summary ni los nested corren.
            [
                'type'      => 'if_else',
                'condition' => ['active' => '1'],
                'config'    => [
                    'condition'    => ['status' => 'won'],
                    'then_actions' => [['type' => 'noop_ok', 'config' => []]],
                    'else_actions' => [],
                ],
            ],
        ]);

        $automationsRepo = new InMemoryAutomationRepository([$automation]);
        $runsRepo        = new InMemoryAutomationRunRepository();
        $actions         = new ActionRegistry();
        $actions->register(new StubAction('noop_ok', ActionResult::success('noop_ok')));
        $actions->register(new \ImaginaCRM\Automations\Actions\IfElseAction());

        $engine = new AutomationEngine($automationsRepo, $runsRepo, new TriggerRegistry(), $actions);
        $engine->dispatch(new TriggerContext(
            event: 'imagina_crm/record_created',
            list: $list,
            record: ['id' => 1, 'fields' => ['active' => '0', 'status' => 'won']],
        ));

        $log = $runsRepo->records[0]['actions_log'];
        $this->assertCount(1, $log);
        $this->assertSame('skipped', $log[0]['status']);
        $this->assertSame('if_else', $log[0]['action']);
    }

    public function test_empty_condition_does_not_skip(): void
    {
        $list       = $this->stubList();
        $automation = $this->makeAutomation(11, $list->id, 'record_created', actions: [
            ['type' => 'noop_ok', 'config' => [], 'condition' => []],
        ]);

        $automationsRepo = new InMemoryAutomationRepository([$automation]);
        $runsRepo        = new InMemoryAutomationRunRepository();
        $actions         = new ActionRegistry();
        $actions->register(new StubAction('noop_ok', ActionResult::success('noop_ok')));

        $engine = new AutomationEngine($automationsRepo, $runsRepo, new TriggerRegistry(), $actions);
        $engine->dispatch(new TriggerContext(
            event: 'imagina_crm/record_created',
            list: $list,
            record: ['id' => 1, 'fields' => []],
        ));

        $this->assertSame('success', $runsRepo->records[0]['actions_log'][0]['status']);
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
     * @param array<int, array{type: string, config: array<string, mixed>, condition?: array<string, mixed>}> $actions
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

    /**
     * Devuelve la fila tal cual el motor la ve al rehidratar: con
     * `trigger_context` como JSON string (mimick del JSON column real).
     *
     * @return array<string, mixed>|null
     */
    public function find(int $id): ?array
    {
        foreach ($this->records as $row) {
            if (($row['id'] ?? 0) === $id) {
                $copy = $row;
                if (isset($copy['trigger_context']) && is_array($copy['trigger_context'])) {
                    $copy['trigger_context'] = (string) wp_json_encode($copy['trigger_context']);
                }
                return $copy;
            }
        }
        return null;
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
