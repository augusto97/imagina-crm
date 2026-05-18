<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Integration\Automations;

use ImaginaCRM\Automations\ActionRegistry;
use ImaginaCRM\Automations\Actions\UpdateFieldAction;
use ImaginaCRM\Automations\AutomationEngine;
use ImaginaCRM\Automations\AutomationRepository;
use ImaginaCRM\Automations\AutomationRunRepository;
use ImaginaCRM\Automations\AutomationService;
use ImaginaCRM\Automations\TriggerContext;
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
 * E2E con MySQL real:
 *
 * 1. Crea lista con campos `name` y `status`.
 * 2. Persiste una automatización: trigger `record_created` (filtro
 *    `status=lead`) + acción `update_field` que setea
 *    `name = "[lead] {{name}}"`.
 * 3. Crea un record con status=lead → dispara engine → la acción
 *    actualiza el record y se persiste un run con status=success.
 * 4. Verifica el log del run y el contador en wp_imcrm_automation_runs.
 *
 * Como `do_action` es no-op en el bootstrap de integración, despachamos
 * manualmente al engine — el listener real de Plugin.php ya está
 * cubierto por los tests unitarios del engine.
 */
final class AutomationEngineIntegrationTest extends IntegrationTestCase
{
    private FieldService $fields;
    private RecordService $records;
    private ListService $lists;
    private AutomationService $automations;
    private AutomationEngine $engine;
    private AutomationRepository $automationsRepo;
    private AutomationRunRepository $runsRepo;

    protected function setUp(): void
    {
        parent::setUp();
        AutomationEngine::resetDepth();

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
        $this->records = new RecordService(
            $fieldRepo,
            $recordRepo,
            $relationsRepo,
            $validator,
            $queryBuilder,
        );

        $this->automationsRepo = new AutomationRepository($this->db());
        $this->runsRepo        = new AutomationRunRepository($this->db());

        $triggers = new TriggerRegistry();
        $actions  = new ActionRegistry();
        $actions->register(new UpdateFieldAction($this->records));

        $this->automations = new AutomationService(
            $this->automationsRepo,
            $listRepo,
            $triggers,
            $actions,
        );
        $this->engine = new AutomationEngine(
            $this->automationsRepo,
            $this->runsRepo,
            $triggers,
            $actions,
        );
    }

    public function test_record_created_triggers_update_field_action(): void
    {
        $list = $this->createListWithFields();

        $automation = $this->automations->create($list->id, [
            'name'         => 'Marcar leads',
            'trigger_type' => 'record_created',
            'trigger_config' => ['field_filters' => ['status' => 'lead']],
            'actions' => [
                [
                    'type'   => 'update_field',
                    'config' => ['values' => ['name' => '[lead] {{name}}']],
                ],
            ],
            'is_active' => true,
        ]);
        $this->assertNotInstanceOf(ValidationResult::class, $automation);

        $created = $this->records->create($list, ['name' => 'Acme', 'status' => 'lead']);
        $this->assertIsArray($created);
        $recordId = (int) $created['id'];

        // Dispatch manual del engine (en runtime real lo dispara el listener
        // de Plugin.php sobre el hook `imagina_crm/record_created`).
        $this->engine->dispatch(new TriggerContext(
            event: 'imagina_crm/record_created',
            list: $list,
            record: $created,
        ));

        // El registro debió actualizarse vía UpdateFieldAction.
        $reloaded = $this->records->find($list, $recordId);
        $this->assertNotNull($reloaded);
        $this->assertSame('[lead] Acme', $reloaded['fields']['name']);

        // Y debe haber un run persistido con status=success.
        $runs = $this->runsRepo->recentForAutomation($automation->id);
        $this->assertCount(1, $runs);
        $this->assertSame(AutomationRunRepository::STATUS_SUCCESS, $runs[0]['status']);

        $log = json_decode((string) $runs[0]['actions_log'], true);
        $this->assertIsArray($log);
        $this->assertCount(1, $log);
        $this->assertSame('success', $log[0]['status']);
        $this->assertSame('update_field', $log[0]['action']);
    }

    public function test_filter_mismatch_does_not_trigger_run(): void
    {
        $list = $this->createListWithFields();

        $automation = $this->automations->create($list->id, [
            'name'           => 'Solo customers',
            'trigger_type'   => 'record_created',
            'trigger_config' => ['field_filters' => ['status' => 'customer']],
            'actions'        => [
                ['type' => 'update_field', 'config' => ['values' => ['name' => 'X']]],
            ],
            'is_active' => true,
        ]);
        $this->assertNotInstanceOf(ValidationResult::class, $automation);

        $created = $this->records->create($list, ['name' => 'Acme', 'status' => 'lead']);
        $this->assertIsArray($created);

        $this->engine->dispatch(new TriggerContext(
            event: 'imagina_crm/record_created',
            list: $list,
            record: $created,
        ));

        // Filtro no matcheó → no se persiste run.
        $runs = $this->runsRepo->recentForAutomation($automation->id);
        $this->assertSame([], $runs);
    }

    public function test_inactive_automation_is_skipped(): void
    {
        $list = $this->createListWithFields();

        $automation = $this->automations->create($list->id, [
            'name'         => 'Pausada',
            'trigger_type' => 'record_created',
            'trigger_config' => [],
            'actions'      => [
                ['type' => 'update_field', 'config' => ['values' => ['name' => 'X']]],
            ],
            'is_active' => false,
        ]);
        $this->assertNotInstanceOf(ValidationResult::class, $automation);

        $created = $this->records->create($list, ['name' => 'Acme', 'status' => 'lead']);
        $this->assertIsArray($created);

        $this->engine->dispatch(new TriggerContext(
            event: 'imagina_crm/record_created',
            list: $list,
            record: $created,
        ));

        $runs = $this->runsRepo->recentForAutomation($automation->id);
        $this->assertSame([], $runs);
    }

    public function test_creating_automation_with_invalid_trigger_returns_validation_error(): void
    {
        $list = $this->createListWithFields();

        $result = $this->automations->create($list->id, [
            'name'         => 'Bad',
            'trigger_type' => 'nope_does_not_exist',
            'actions'      => [
                ['type' => 'update_field', 'config' => ['values' => ['name' => 'X']]],
            ],
        ]);

        $this->assertInstanceOf(ValidationResult::class, $result);
        /** @var ValidationResult $result */
        $this->assertArrayHasKey('trigger_type', $result->errors());
    }

    public function test_creating_automation_with_invalid_action_returns_validation_error(): void
    {
        $list = $this->createListWithFields();

        $result = $this->automations->create($list->id, [
            'name'         => 'Bad',
            'trigger_type' => 'record_created',
            'actions'      => [
                ['type' => 'nope_does_not_exist', 'config' => []],
            ],
        ]);

        $this->assertInstanceOf(ValidationResult::class, $result);
    }

    private function createListWithFields(): ListEntity
    {
        $list = $this->lists->create(['name' => 'Leads']);
        $this->assertIsObject($list);
        /** @var ListEntity $list */

        $r = $this->fields->create($list->id, [
            'label' => 'Nombre',
            'slug'  => 'name',
            'type'  => 'text',
        ]);
        $this->assertNotInstanceOf(ValidationResult::class, $r);

        $r = $this->fields->create($list->id, [
            'label' => 'Status',
            'slug'  => 'status',
            'type'  => 'select',
            'config' => [
                'options' => [
                    ['value' => 'lead', 'label' => 'Lead'],
                    ['value' => 'customer', 'label' => 'Customer'],
                ],
            ],
        ]);
        $this->assertNotInstanceOf(ValidationResult::class, $r);

        return $list;
    }
}
