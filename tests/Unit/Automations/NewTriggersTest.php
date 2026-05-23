<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\Automations;

use ImaginaCRM\Automations\TriggerContext;
use ImaginaCRM\Automations\Triggers\DueDateReachedTrigger;
use ImaginaCRM\Automations\Triggers\FieldChangedTrigger;
use ImaginaCRM\Automations\Triggers\ScheduledTrigger;
use ImaginaCRM\Lists\ListEntity;
use PHPUnit\Framework\TestCase;

/**
 * Cubre los tres triggers programados / específicos de campo añadidos en
 * este commit. Ejes de prueba clave:
 *
 * - field_changed: dispara solo cuando el campo cambia, respeta from/to.
 * - scheduled: matchea evento sintético + filtros de field.
 * - due_date_reached: respeta offset, tolerance y "ahora" inyectado.
 */
final class NewTriggersTest extends TestCase
{
    public function test_field_changed_requires_diff(): void
    {
        $trigger = new FieldChangedTrigger();
        $ctx = $this->updateContext(
            ['fields' => ['status' => 'won']],
            ['fields' => ['status' => 'lead']],
        );

        $this->assertTrue($trigger->matches($ctx, ['field' => 'status']));
        // Mismo valor antes y después → no dispara.
        $sameCtx = $this->updateContext(
            ['fields' => ['status' => 'lead']],
            ['fields' => ['status' => 'lead']],
        );
        $this->assertFalse($trigger->matches($sameCtx, ['field' => 'status']));
    }

    public function test_field_changed_respects_from_and_to_value(): void
    {
        $trigger = new FieldChangedTrigger();
        $ctx = $this->updateContext(
            ['fields' => ['status' => 'won']],
            ['fields' => ['status' => 'lead']],
        );

        $this->assertTrue($trigger->matches($ctx, [
            'field'      => 'status',
            'from_value' => 'lead',
            'to_value'   => 'won',
        ]));

        // Si exigimos from='cold' pero era 'lead', no dispara.
        $this->assertFalse($trigger->matches($ctx, [
            'field'      => 'status',
            'from_value' => 'cold',
        ]));

        // Si exigimos to='lost' pero es 'won', no dispara.
        $this->assertFalse($trigger->matches($ctx, [
            'field'    => 'status',
            'to_value' => 'lost',
        ]));
    }

    public function test_field_changed_fails_closed_without_previous_record(): void
    {
        $trigger = new FieldChangedTrigger();
        $ctx     = $this->updateContext(
            ['fields' => ['status' => 'won']],
            null,
        );
        $this->assertFalse($trigger->matches($ctx, ['field' => 'status']));
    }

    public function test_scheduled_trigger_matches_synthetic_event_with_filters(): void
    {
        $trigger = new ScheduledTrigger();
        $list    = $this->stubList();

        $ctx = new TriggerContext(
            event: ScheduledTrigger::EVENT,
            list: $list,
            record: ['id' => 1, 'fields' => ['status' => 'overdue']],
        );

        $this->assertTrue($trigger->matches($ctx, []));
        $this->assertTrue($trigger->matches($ctx, ['field_filters' => ['status' => 'overdue']]));
        $this->assertFalse($trigger->matches($ctx, ['field_filters' => ['status' => 'paid']]));

        // Evento equivocado.
        $wrongCtx = new TriggerContext(
            event: 'imagina_crm/record_created',
            list: $list,
            record: ['fields' => ['status' => 'overdue']],
        );
        $this->assertFalse($trigger->matches($wrongCtx, []));
    }

    public function test_scheduled_frequency_to_seconds(): void
    {
        $this->assertSame(3600, ScheduledTrigger::frequencyToSeconds('hourly'));
        $this->assertSame(86400, ScheduledTrigger::frequencyToSeconds('daily'));
        $this->assertSame(86400 * 7, ScheduledTrigger::frequencyToSeconds('weekly'));
        $this->assertSame(86400, ScheduledTrigger::frequencyToSeconds('garbage'));
    }

    public function test_due_date_reached_at_target_with_tolerance(): void
    {
        $trigger = new DueDateReachedTrigger();
        $list    = $this->stubList();

        $now = strtotime('2026-04-25 10:00:00');
        $this->assertNotFalse($now);

        // Vencimiento a las 10:30 con offset -30min → target = 10:00.
        // "Ahora" = 10:00 → dispara.
        $ctx = new TriggerContext(
            event: DueDateReachedTrigger::EVENT,
            list: $list,
            record: ['fields' => ['due_at' => '2026-04-25 10:30:00']],
            extra: ['now' => $now],
        );
        $this->assertTrue($trigger->matches($ctx, [
            'due_field'      => 'due_at',
            'offset_minutes' => -30,
        ]));
    }

    public function test_due_date_reached_outside_tolerance_does_not_fire(): void
    {
        $trigger = new DueDateReachedTrigger();
        $list    = $this->stubList();

        $now = strtotime('2026-04-25 10:00:00');
        $this->assertNotFalse($now);

        // Vencimiento mañana → target lejano de "ahora".
        $ctx = new TriggerContext(
            event: DueDateReachedTrigger::EVENT,
            list: $list,
            record: ['fields' => ['due_at' => '2026-04-26 10:30:00']],
            extra: ['now' => $now],
        );
        $this->assertFalse($trigger->matches($ctx, [
            'due_field'         => 'due_at',
            'offset_minutes'    => 0,
            'tolerance_minutes' => 30,
        ]));
    }

    public function test_due_date_reached_invalid_field_does_not_fire(): void
    {
        $trigger = new DueDateReachedTrigger();
        $list    = $this->stubList();

        $ctx = new TriggerContext(
            event: DueDateReachedTrigger::EVENT,
            list: $list,
            record: ['fields' => ['due_at' => 'not-a-date']],
            extra: ['now' => time()],
        );

        $this->assertFalse($trigger->matches($ctx, [
            'due_field'      => 'due_at',
            'offset_minutes' => 0,
        ]));

        // Campo ausente.
        $emptyCtx = new TriggerContext(
            event: DueDateReachedTrigger::EVENT,
            list: $list,
            record: ['fields' => []],
        );
        $this->assertFalse($trigger->matches($emptyCtx, [
            'due_field'      => 'due_at',
            'offset_minutes' => 0,
        ]));
    }

    /**
     * @param array<string, mixed>      $record
     * @param array<string, mixed>|null $previous
     */
    private function updateContext(array $record, ?array $previous): TriggerContext
    {
        return new TriggerContext(
            event: 'imagina_crm/record_updated',
            list: $this->stubList(),
            record: $record,
            previousRecord: $previous,
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
