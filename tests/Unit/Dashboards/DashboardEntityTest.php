<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\Dashboards;

use ImaginaCRM\Dashboards\DashboardEntity;
use PHPUnit\Framework\TestCase;

/**
 * Verifica el shape de fromRow():
 * - JSON `widgets` se decodifica a array.
 * - Items inválidos (no-array, sin type) se descartan.
 * - user_id y deleted_at NULL se preservan.
 * - is_default se booleaniza.
 */
final class DashboardEntityTest extends TestCase
{
    public function test_from_row_decodes_widgets_json(): void
    {
        $entity = DashboardEntity::fromRow([
            'id'         => '7',
            'user_id'    => '12',
            'name'       => 'Mi dashboard',
            'description' => 'desc',
            'widgets'    => json_encode([
                ['id' => 'w1', 'type' => 'kpi',       'list_id' => 1, 'config' => ['metric' => 'count']],
                ['id' => 'w2', 'type' => 'chart_bar', 'list_id' => 1, 'config' => ['group_by_field_id' => 5]],
            ]),
            'is_default' => '1',
            'position'   => '3',
            'created_by' => '12',
            'created_at' => '2026-04-25 10:00:00',
            'updated_at' => '2026-04-25 11:00:00',
            'deleted_at' => null,
        ]);

        $this->assertSame(7, $entity->id);
        $this->assertSame(12, $entity->userId);
        $this->assertTrue($entity->isDefault);
        $this->assertCount(2, $entity->widgets);
        $this->assertSame('w1', $entity->widgets[0]['id']);
        $this->assertSame('kpi', $entity->widgets[0]['type']);
    }

    public function test_from_row_filters_invalid_widget_items(): void
    {
        $entity = DashboardEntity::fromRow([
            'id'         => 1,
            'name'       => 'Test',
            'widgets'    => json_encode([
                ['id' => 'ok', 'type' => 'kpi', 'list_id' => 1, 'config' => []],
                'no-array',
                ['type' => '', 'list_id' => 1], // tipo vacío
                ['list_id' => 1], // sin tipo
            ]),
            'created_by' => 1,
            'created_at' => '2026-04-25 10:00:00',
            'updated_at' => '2026-04-25 10:00:00',
        ]);

        $this->assertCount(1, $entity->widgets, 'Solo el primer item es válido.');
        $this->assertSame('ok', $entity->widgets[0]['id']);
    }

    public function test_shared_dashboard_has_null_user_id(): void
    {
        $entity = DashboardEntity::fromRow([
            'id'         => 1,
            'user_id'    => null,
            'name'       => 'Compartido',
            'widgets'    => '[]',
            'is_default' => 0,
            'created_by' => 1,
            'created_at' => '2026-04-25 10:00:00',
            'updated_at' => '2026-04-25 10:00:00',
        ]);

        $this->assertNull($entity->userId);
        $this->assertFalse($entity->isDefault);
    }

    public function test_to_array_omits_internal_fields(): void
    {
        $entity = new DashboardEntity(
            id: 1,
            userId: 12,
            name: 'X',
            description: null,
            widgets: [],
            isDefault: false,
            position: 0,
            createdBy: 12,
            createdAt: '2026-04-25 10:00:00',
            updatedAt: '2026-04-25 10:00:00',
            deletedAt: null,
        );

        $arr = $entity->toArray();
        $this->assertArrayNotHasKey('deleted_at', $arr);
        $this->assertArrayHasKey('widgets', $arr);
    }
}
