<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\Automations;

use ImaginaCRM\Automations\TriggerContext;
use ImaginaCRM\Lists\ListEntity;
use PHPUnit\Framework\TestCase;

/**
 * `TriggerContext` debe leer correctamente tanto records hidratados (con
 * envelope `fields`) como records planos. La diferencia es importante
 * porque el dispatcher de `Plugin.php` pasa records hidratados, mientras
 * que algunos triggers/tests usan la forma plana.
 */
final class TriggerContextTest extends TestCase
{
    public function test_field_value_reads_from_hydrated_envelope(): void
    {
        $list = $this->stubList();
        $ctx = new TriggerContext(
            event: 'imagina_crm/record_created',
            list: $list,
            record: ['id' => 7, 'fields' => ['name' => 'Acme', 'amount' => 100]],
        );

        $this->assertSame(7, $ctx->recordId());
        $this->assertSame('Acme', $ctx->fieldValue('name'));
        $this->assertSame(100, $ctx->fieldValue('amount'));
        $this->assertNull($ctx->fieldValue('missing'));
    }

    public function test_field_value_falls_back_to_flat_shape(): void
    {
        $list = $this->stubList();
        $ctx = new TriggerContext(
            event: 'imagina_crm/record_created',
            list: $list,
            record: ['id' => 1, 'name' => 'Plano', 'status' => 'active'],
        );

        $this->assertSame('Plano', $ctx->fieldValue('name'));
        $this->assertSame('active', $ctx->fieldValue('status'));
    }

    public function test_previous_field_value_only_set_for_updates(): void
    {
        $list = $this->stubList();
        $ctx = new TriggerContext(
            event: 'imagina_crm/record_updated',
            list: $list,
            record: ['fields' => ['status' => 'won']],
            previousRecord: ['fields' => ['status' => 'lead']],
        );

        $this->assertSame('won', $ctx->fieldValue('status'));
        $this->assertSame('lead', $ctx->previousFieldValue('status'));
    }

    public function test_to_array_is_serializable(): void
    {
        $list = $this->stubList();
        $ctx  = new TriggerContext(
            event: 'imagina_crm/record_created',
            list: $list,
            record: ['id' => 1, 'fields' => ['name' => 'A']],
            extra: ['source' => 'rest'],
        );

        $payload = $ctx->toArray();
        $this->assertSame('imagina_crm/record_created', $payload['event']);
        $this->assertSame($list->id, $payload['list_id']);
        $this->assertSame(['source' => 'rest'], $payload['extra']);
        $this->assertNotFalse(json_encode($payload));
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
