<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\Automations;

use ImaginaCRM\Automations\TriggerContext;
use ImaginaCRM\Automations\Triggers\RecordCreatedTrigger;
use ImaginaCRM\Automations\Triggers\RecordUpdatedTrigger;
use ImaginaCRM\Lists\ListEntity;
use PHPUnit\Framework\TestCase;

/**
 * Reglas críticas de los dos triggers iniciales:
 * - `RecordCreatedTrigger` solo dispara para el evento creado y respeta
 *   `field_filters` (todos deben coincidir).
 * - `RecordUpdatedTrigger` evalúa `changed_fields` contra el snapshot
 *   previo; si el contexto no trae snapshot previo y el config exige
 *   diff, falla cerrado (no dispara).
 */
final class RecordTriggersTest extends TestCase
{
    public function test_record_created_matches_when_event_and_filters_pass(): void
    {
        $trigger = new RecordCreatedTrigger();
        $ctx = $this->createContext(
            event: 'imagina_crm/record_created',
            record: ['id' => 1, 'fields' => ['status' => 'active', 'tier' => 'gold']],
        );

        $this->assertTrue($trigger->matches($ctx, []));
        $this->assertTrue($trigger->matches($ctx, ['field_filters' => ['status' => 'active']]));
        $this->assertFalse($trigger->matches($ctx, ['field_filters' => ['status' => 'archived']]));
    }

    public function test_record_created_rejects_wrong_event(): void
    {
        $trigger = new RecordCreatedTrigger();
        $ctx = $this->createContext(
            event: 'imagina_crm/record_updated',
            record: ['fields' => ['status' => 'active']],
        );
        $this->assertFalse($trigger->matches($ctx, []));
    }

    public function test_record_updated_with_changed_fields_diffs_correctly(): void
    {
        $trigger = new RecordUpdatedTrigger();
        $ctx = $this->createContext(
            event: 'imagina_crm/record_updated',
            record: ['fields' => ['status' => 'won', 'amount' => 100]],
            previous: ['fields' => ['status' => 'lead', 'amount' => 100]],
        );

        $this->assertTrue($trigger->matches($ctx, ['changed_fields' => ['status']]));
        // amount no cambió → no dispara aunque la lista de campos era amount.
        $this->assertFalse($trigger->matches($ctx, ['changed_fields' => ['amount']]));
        // sin changed_fields, dispara siempre.
        $this->assertTrue($trigger->matches($ctx, []));
    }

    public function test_record_updated_fails_closed_without_previous_snapshot(): void
    {
        $trigger = new RecordUpdatedTrigger();
        $ctx = $this->createContext(
            event: 'imagina_crm/record_updated',
            record: ['fields' => ['status' => 'won']],
            previous: null,
        );
        // changed_fields exige diff; sin previous no podemos verificarlo →
        // el trigger debe fallar cerrado para no disparar de más.
        $this->assertFalse($trigger->matches($ctx, ['changed_fields' => ['status']]));
    }

    public function test_record_updated_combines_filters_and_changed_fields(): void
    {
        $trigger = new RecordUpdatedTrigger();
        $ctx = $this->createContext(
            event: 'imagina_crm/record_updated',
            record: ['fields' => ['status' => 'lost']],
            previous: ['fields' => ['status' => 'won']],
        );

        // status pasó a 'lost' → dispara.
        $this->assertTrue($trigger->matches($ctx, [
            'field_filters'  => ['status' => 'lost'],
            'changed_fields' => ['status'],
        ]));

        // Filtro pide status=won pero ahora es lost → no dispara, pese al diff.
        $this->assertFalse($trigger->matches($ctx, [
            'field_filters'  => ['status' => 'won'],
            'changed_fields' => ['status'],
        ]));
    }

    /**
     * @param array<string, mixed>|null $record
     * @param array<string, mixed>|null $previous
     */
    private function createContext(string $event, ?array $record, ?array $previous = null): TriggerContext
    {
        $list = new ListEntity(
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

        return new TriggerContext(
            event: $event,
            list: $list,
            record: $record,
            previousRecord: $previous,
        );
    }
}
