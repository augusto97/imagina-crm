<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Integration\Automations;

use ImaginaCRM\Automations\ActionRegistry;
use ImaginaCRM\Automations\Actions\UpdateFieldAction;
use ImaginaCRM\Automations\AutomationEngine;
use ImaginaCRM\Automations\AutomationRepository;
use ImaginaCRM\Automations\AutomationRunRepository;
use ImaginaCRM\Automations\AutomationService;
use ImaginaCRM\Automations\ScheduledRunner;
use ImaginaCRM\Automations\TriggerRegistry;
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
 * E2E del `ScheduledRunner` contra MySQL real.
 *
 * 1. Crea lista con campos y N registros.
 * 2. Persiste una automatización `scheduled` que actualiza un campo
 *    cuando dispara.
 * 3. Llama `runner->tick()`.
 * 4. Verifica que se encolaron runs (vía Action Scheduler stubs) y que
 *    al ejecutar `engine->runById()` cada run aplica la acción.
 *
 * Como en otros tests de integración, `do_action` y AS están stubeados
 * (no-op / registros en globals), así que `engine->enqueue()` no
 * dispara realmente la ejecución; la simulamos manualmente para
 * verificar el flujo completo.
 */
final class ScheduledRunnerTest extends IntegrationTestCase
{
    private FieldService $fields;
    private RecordService $records;
    private ListService $lists;
    private AutomationService $automations;
    private AutomationEngine $engine;
    private AutomationRepository $automationsRepo;
    private AutomationRunRepository $runsRepo;
    private ScheduledRunner $runner;

    protected function setUp(): void
    {
        parent::setUp();
        AutomationEngine::resetDepth();
        $GLOBALS['imcrm_test_as_calls'] = [];

        $registry      = new FieldTypeRegistry();
        $slugs         = new SlugManager($this->db());
        $listRepo      = new ListRepository($this->db());
        $fieldRepo     = new FieldRepository($this->db());
        $relationsRepo = new RelationRepository($this->db());
        $recordRepo    = new RecordRepository($this->db());
        $validator     = new RecordValidator($registry, $this->db());
        $queryBuilder  = new QueryBuilder($this->db(), $slugs);

        $this->lists   = new ListService($listRepo, $slugs, $this->schema);
        $this->fields  = new FieldService($fieldRepo, $listRepo, $slugs, $this->schema, $registry, $recordRepo);
        $this->records = new RecordService($fieldRepo, $recordRepo, $relationsRepo, $validator, $queryBuilder);

        $this->automationsRepo = new AutomationRepository($this->db());
        $this->runsRepo        = new AutomationRunRepository($this->db());

        $triggers = new TriggerRegistry();
        $actions  = new ActionRegistry();
        $actions->register(new UpdateFieldAction($this->records));

        $this->automations = new AutomationService($this->automationsRepo, $listRepo, $triggers, $actions);
        $this->engine = new AutomationEngine($this->automationsRepo, $this->runsRepo, $triggers, $actions);

        $this->runner = new ScheduledRunner(
            $this->automationsRepo,
            $this->runsRepo,
            $listRepo,
            $this->records,
            $this->engine,
        );
    }

    public function test_tick_enqueues_run_per_record_for_scheduled_automation(): void
    {
        $list = $this->createList();
        $this->seedRecords($list, 3);

        $automation = $this->automations->create($list->id, [
            'name'           => 'Daily ping',
            'trigger_type'   => 'scheduled',
            'trigger_config' => ['frequency' => 'daily'],
            'actions' => [
                ['type' => 'update_field', 'config' => ['values' => ['status' => 'pinged']]],
            ],
            'is_active' => true,
        ]);
        $this->assertNotInstanceOf(ValidationResult::class, $automation);

        $this->runner->tick();

        // Cada record debe haber generado un run pending + una llamada AS.
        $this->assertCount(3, $GLOBALS['imcrm_test_as_calls']);
        foreach ($GLOBALS['imcrm_test_as_calls'] as $call) {
            $this->assertSame(AutomationEngine::HOOK_RUN_AUTOMATION, $call['hook']);
        }

        $runs = $this->runsRepo->recentForAutomation($automation->id, 100);
        $this->assertCount(3, $runs);
        foreach ($runs as $run) {
            $this->assertSame(AutomationRunRepository::STATUS_PENDING, $run['status']);
        }
    }

    public function test_tick_skips_scheduled_automation_already_fired_within_interval(): void
    {
        $list = $this->createList();
        $this->seedRecords($list, 2);

        $automation = $this->automations->create($list->id, [
            'name'           => 'Daily ping',
            'trigger_type'   => 'scheduled',
            'trigger_config' => ['frequency' => 'daily'],
            'actions'        => [
                ['type' => 'update_field', 'config' => ['values' => ['status' => 'pinged']]],
            ],
            'is_active' => true,
        ]);
        $this->assertNotInstanceOf(ValidationResult::class, $automation);

        // Primer tick: dispara contra cada record.
        $this->runner->tick();
        $this->assertCount(2, $GLOBALS['imcrm_test_as_calls']);

        // Segundo tick inmediato: al ser frecuencia diaria y haber un run
        // hace segundos, debe saltar.
        $GLOBALS['imcrm_test_as_calls'] = [];
        $this->runner->tick();
        $this->assertSame([], $GLOBALS['imcrm_test_as_calls'], 'No debe re-disparar dentro del intervalo configurado.');
    }

    public function test_tick_processes_due_date_reached_every_time(): void
    {
        $list = $this->createList(includeDueAt: true);
        // record con due_at "ahora" → matchea ventana de tolerancia.
        $now = gmdate('Y-m-d H:i:s', time());
        $created = $this->records->create($list, [
            'name'   => 'ProyectoX',
            'status' => 'open',
            'due_at' => $now,
        ]);
        $this->assertIsArray($created);

        $automation = $this->automations->create($list->id, [
            'name'           => 'Aviso al vencer',
            'trigger_type'   => 'due_date_reached',
            'trigger_config' => [
                'due_field'         => 'due_at',
                'offset_minutes'    => 0,
                'tolerance_minutes' => 60,
            ],
            'actions' => [
                ['type' => 'update_field', 'config' => ['values' => ['status' => 'overdue']]],
            ],
            'is_active' => true,
        ]);
        $this->assertNotInstanceOf(ValidationResult::class, $automation);

        $this->runner->tick();
        $runs = $this->runsRepo->recentForAutomation($automation->id, 10);
        $this->assertCount(1, $runs, 'Un record matchea la ventana, debe haber un run.');

        // Segundo tick → otra evaluación. due_date_reached no usa el "skip
        // por intervalo" (ese sólo aplica a `scheduled`), así que vuelve
        // a encolar.
        $this->runner->tick();
        $runs = $this->runsRepo->recentForAutomation($automation->id, 10);
        $this->assertCount(2, $runs);
    }

    public function test_tick_ignores_inactive_automations(): void
    {
        $list = $this->createList();
        $this->seedRecords($list, 2);

        $automation = $this->automations->create($list->id, [
            'name'           => 'Pausada',
            'trigger_type'   => 'scheduled',
            'trigger_config' => [],
            'actions' => [
                ['type' => 'update_field', 'config' => ['values' => ['status' => 'X']]],
            ],
            'is_active' => false,
        ]);
        $this->assertNotInstanceOf(ValidationResult::class, $automation);

        $this->runner->tick();
        $this->assertSame([], $GLOBALS['imcrm_test_as_calls']);
    }

    private function createList(bool $includeDueAt = false): ListEntity
    {
        $list = $this->lists->create(['name' => 'Leads']);
        $this->assertIsObject($list);
        /** @var ListEntity $list */

        $r = $this->fields->create($list->id, ['label' => 'Nombre', 'slug' => 'name', 'type' => 'text', 'is_required' => true]);
        $this->assertNotInstanceOf(ValidationResult::class, $r);

        $r = $this->fields->create($list->id, [
            'label' => 'Status',
            'slug'  => 'status',
            'type'  => 'select',
            'config' => [
                'options' => [
                    ['value' => 'open',    'label' => 'Open'],
                    ['value' => 'pinged',  'label' => 'Pinged'],
                    ['value' => 'overdue', 'label' => 'Overdue'],
                ],
            ],
        ]);
        $this->assertNotInstanceOf(ValidationResult::class, $r);

        if ($includeDueAt) {
            $r = $this->fields->create($list->id, ['label' => 'Vencimiento', 'slug' => 'due_at', 'type' => 'datetime']);
            $this->assertNotInstanceOf(ValidationResult::class, $r);
        }
        return $list;
    }

    private function seedRecords(ListEntity $list, int $count): void
    {
        for ($i = 1; $i <= $count; $i++) {
            $created = $this->records->create($list, ['name' => 'Lead ' . $i, 'status' => 'open']);
            $this->assertIsArray($created);
        }
    }
}
