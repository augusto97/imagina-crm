<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\Automations;

use ImaginaCRM\Automations\ActionRegistry;
use ImaginaCRM\Automations\ActionResult;
use ImaginaCRM\Automations\AutomationEngine;
use ImaginaCRM\Automations\AutomationEntity;
use ImaginaCRM\Automations\TriggerContext;
use ImaginaCRM\Automations\TriggerRegistry;
use ImaginaCRM\Lists\ListEntity;
use PHPUnit\Framework\TestCase;

/**
 * Regresión: el bug original era que `resolveTriggerSlugForEvent`
 * retornaba sólo el primer trigger que coincidía con el evento, así que
 * `field_changed` (mismo evento que `record_updated`) y
 * `due_date_reached` (mismo evento que `scheduled`) nunca se evaluaban.
 *
 * Estos tests garantizan que cuando varios triggers comparten evento,
 * AMBOS se consultan contra sus respectivas automatizaciones.
 */
final class MultiTriggerEventTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        AutomationEngine::resetDepth();
        $GLOBALS['imcrm_test_as_calls'] = [];
    }

    public function test_record_updated_event_evaluates_both_record_updated_and_field_changed(): void
    {
        $list = $this->stubList();

        $autoUpdated = $this->makeAutomation(1, $list->id, 'record_updated', [], [
            ['type' => 'noop_ok', 'config' => []],
        ]);
        $autoFieldChanged = $this->makeAutomation(2, $list->id, 'field_changed', [
            'field'    => 'status',
            'to_value' => 'won',
        ], [
            ['type' => 'noop_ok', 'config' => []],
        ]);

        $automationsRepo = new InMemoryAutomationRepository([$autoUpdated, $autoFieldChanged]);
        $runsRepo        = new InMemoryAutomationRunRepository();

        $actions = new ActionRegistry();
        $actions->register(new StubAction('noop_ok', ActionResult::success('noop_ok')));

        $engine = new AutomationEngine(
            $automationsRepo,
            $runsRepo,
            new TriggerRegistry(),
            $actions,
        );

        $engine->dispatch(new TriggerContext(
            event: 'imagina_crm/record_updated',
            list: $list,
            record: ['fields' => ['status' => 'won']],
            previousRecord: ['fields' => ['status' => 'lead']],
        ));

        // Ambas deben haber persistido un run — antes del fix sólo
        // disparaba la primera del registry.
        $automationIds = array_map(static fn (array $r): int => (int) ($r['automation_id'] ?? 0), $runsRepo->records);
        $this->assertContains(1, $automationIds, 'record_updated debe disparar.');
        $this->assertContains(2, $automationIds, 'field_changed debe disparar.');
    }

    public function test_scheduled_tick_event_evaluates_scheduled_and_due_date_reached(): void
    {
        $list = $this->stubList();

        $autoScheduled = $this->makeAutomation(1, $list->id, 'scheduled', [], [
            ['type' => 'noop_ok', 'config' => []],
        ]);
        $autoDueDate = $this->makeAutomation(2, $list->id, 'due_date_reached', [
            'due_field'      => 'due_at',
            'offset_minutes' => 0,
        ], [
            ['type' => 'noop_ok', 'config' => []],
        ]);

        $automationsRepo = new InMemoryAutomationRepository([$autoScheduled, $autoDueDate]);
        $runsRepo        = new InMemoryAutomationRunRepository();

        $actions = new ActionRegistry();
        $actions->register(new StubAction('noop_ok', ActionResult::success('noop_ok')));

        $engine = new AutomationEngine($automationsRepo, $runsRepo, new TriggerRegistry(), $actions);

        // due_at "ahora" para que due_date_reached matchee.
        $now = time();
        $engine->dispatch(new TriggerContext(
            event: 'imagina_crm/scheduled_tick',
            list: $list,
            record: ['fields' => ['due_at' => gmdate('Y-m-d H:i:s', $now)]],
            extra: ['now' => $now],
        ));

        $automationIds = array_map(static fn (array $r): int => (int) ($r['automation_id'] ?? 0), $runsRepo->records);
        $this->assertContains(1, $automationIds, 'scheduled debe disparar.');
        $this->assertContains(2, $automationIds, 'due_date_reached debe disparar.');
    }

    /**
     * @param array<string, mixed> $triggerConfig
     * @param array<int, array{type: string, config: array<string, mixed>}> $actions
     */
    private function makeAutomation(int $id, int $listId, string $triggerType, array $triggerConfig, array $actions): AutomationEntity
    {
        return new AutomationEntity(
            id: $id,
            listId: $listId,
            name: 'auto-' . $id,
            description: null,
            triggerType: $triggerType,
            triggerConfig: $triggerConfig,
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
