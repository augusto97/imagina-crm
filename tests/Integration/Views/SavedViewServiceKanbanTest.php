<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Integration\Views;

use ImaginaCRM\Fields\FieldRepository;
use ImaginaCRM\Fields\FieldService;
use ImaginaCRM\Fields\FieldTypeRegistry;
use ImaginaCRM\Lists\ListEntity;
use ImaginaCRM\Lists\ListRepository;
use ImaginaCRM\Lists\ListService;
use ImaginaCRM\Lists\SlugManager;
use ImaginaCRM\Support\ValidationResult;
use ImaginaCRM\Tests\Integration\IntegrationTestCase;
use ImaginaCRM\Views\SavedViewRepository;
use ImaginaCRM\Views\SavedViewService;

/**
 * Validaciones del servicio para vistas kanban (nuevas en Fase 4):
 *
 * - Crear kanban sin `group_by_field_id` → falla.
 * - Crear kanban con field_id de otra lista → falla.
 * - Crear kanban con field tipo distinto a `select` → falla.
 * - Crear kanban con field `select` válido → OK.
 * - Update que mueve a kanban sin proveer config válida → falla.
 */
final class SavedViewServiceKanbanTest extends IntegrationTestCase
{
    private SavedViewService $views;
    private FieldService $fields;
    private ListService $lists;
    private FieldRepository $fieldRepo;

    protected function setUp(): void
    {
        parent::setUp();
        $registry  = new FieldTypeRegistry();
        $slugs     = new SlugManager($this->db());
        $listRepo  = new ListRepository($this->db());
        $fieldRepo = new FieldRepository($this->db());
        $viewsRepo = new SavedViewRepository($this->db());

        $this->lists  = new ListService($listRepo, $slugs, $this->schema);
        $this->fields = new FieldService($fieldRepo, $listRepo, $slugs, $this->schema, $registry, new \ImaginaCRM\Records\RecordRepository($this->db()));
        $this->views  = new SavedViewService($viewsRepo, $listRepo, $fieldRepo);
        $this->fieldRepo = $fieldRepo;
    }

    public function test_create_kanban_without_group_by_field_fails(): void
    {
        $list = $this->createList();

        $result = $this->views->create($list->id, [
            'name'   => 'Kanban',
            'type'   => 'kanban',
            'config' => [],
        ]);

        $this->assertInstanceOf(ValidationResult::class, $result);
        /** @var ValidationResult $result */
        $this->assertArrayHasKey('config.group_by_field_id', $result->errors());
    }

    public function test_create_kanban_with_field_from_other_list_fails(): void
    {
        $list  = $this->createList();
        $other = $this->createList('Otra lista');

        $otherField = $this->fields->create($other->id, [
            'label'  => 'Estado',
            'slug'   => 'estado',
            'type'   => 'select',
            'config' => ['options' => [
                ['value' => 'a', 'label' => 'A'],
            ]],
        ]);
        $this->assertNotInstanceOf(ValidationResult::class, $otherField);

        $result = $this->views->create($list->id, [
            'name'   => 'Kanban',
            'type'   => 'kanban',
            'config' => ['group_by_field_id' => $otherField->id],
        ]);

        $this->assertInstanceOf(ValidationResult::class, $result);
        $this->assertArrayHasKey('config.group_by_field_id', $result->errors());
    }

    public function test_create_kanban_with_non_select_field_fails(): void
    {
        $list = $this->createList();
        $textField = $this->fields->create($list->id, [
            'label' => 'Notas',
            'slug'  => 'notas',
            'type'  => 'text',
        ]);
        $this->assertNotInstanceOf(ValidationResult::class, $textField);

        $result = $this->views->create($list->id, [
            'name'   => 'Kanban',
            'type'   => 'kanban',
            'config' => ['group_by_field_id' => $textField->id],
        ]);

        $this->assertInstanceOf(ValidationResult::class, $result);
        $this->assertArrayHasKey('config.group_by_field_id', $result->errors());
    }

    public function test_create_kanban_with_valid_select_field_succeeds(): void
    {
        $list = $this->createList();
        $statusField = $this->fields->create($list->id, [
            'label'  => 'Estado',
            'slug'   => 'estado',
            'type'   => 'select',
            'config' => ['options' => [
                ['value' => 'todo',  'label' => 'Por hacer'],
                ['value' => 'doing', 'label' => 'En curso'],
                ['value' => 'done',  'label' => 'Hecho'],
            ]],
        ]);
        $this->assertNotInstanceOf(ValidationResult::class, $statusField);

        $result = $this->views->create($list->id, [
            'name'   => 'Tablero',
            'type'   => 'kanban',
            'config' => ['group_by_field_id' => $statusField->id],
        ]);

        $this->assertNotInstanceOf(ValidationResult::class, $result);
        $this->assertSame('kanban', $result->type);
        $this->assertSame($statusField->id, $result->config['group_by_field_id'] ?? null);
    }

    public function test_update_to_kanban_validates_config(): void
    {
        $list = $this->createList();
        $tableView = $this->views->create($list->id, [
            'name' => 'Tabla',
            'type' => 'table',
        ]);
        $this->assertNotInstanceOf(ValidationResult::class, $tableView);

        // Cambiar a kanban sin config válida → falla.
        $result = $this->views->update($list->id, $tableView->id, [
            'type' => 'kanban',
        ]);
        $this->assertInstanceOf(ValidationResult::class, $result);
    }

    public function test_create_calendar_with_valid_date_field_succeeds(): void
    {
        $list = $this->createList();
        $dateField = $this->fields->create($list->id, [
            'label' => 'Vencimiento',
            'slug'  => 'due_at',
            'type'  => 'datetime',
        ]);
        $this->assertNotInstanceOf(ValidationResult::class, $dateField);

        $result = $this->views->create($list->id, [
            'name'   => 'Calendario',
            'type'   => 'calendar',
            'config' => ['date_field_id' => $dateField->id],
        ]);

        $this->assertNotInstanceOf(ValidationResult::class, $result);
        $this->assertSame('calendar', $result->type);
        $this->assertSame($dateField->id, $result->config['date_field_id'] ?? null);
    }

    public function test_create_calendar_with_non_date_field_fails(): void
    {
        $list = $this->createList();
        $textField = $this->fields->create($list->id, [
            'label' => 'Notas',
            'slug'  => 'notas',
            'type'  => 'text',
        ]);
        $this->assertNotInstanceOf(ValidationResult::class, $textField);

        $result = $this->views->create($list->id, [
            'name'   => 'Calendario',
            'type'   => 'calendar',
            'config' => ['date_field_id' => $textField->id],
        ]);

        $this->assertInstanceOf(ValidationResult::class, $result);
        /** @var ValidationResult $result */
        $this->assertArrayHasKey('config.date_field_id', $result->errors());
    }

    public function test_create_calendar_without_date_field_fails(): void
    {
        $list = $this->createList();
        $result = $this->views->create($list->id, [
            'name'   => 'Calendario',
            'type'   => 'calendar',
            'config' => [],
        ]);

        $this->assertInstanceOf(ValidationResult::class, $result);
        /** @var ValidationResult $result */
        $this->assertArrayHasKey('config.date_field_id', $result->errors());
    }

    private function createList(string $name = 'Tareas'): ListEntity
    {
        $list = $this->lists->create(['name' => $name]);
        $this->assertIsObject($list);
        /** @var ListEntity $list */
        return $list;
    }
}
