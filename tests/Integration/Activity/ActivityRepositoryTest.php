<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Integration\Activity;

use ImaginaCRM\Activity\ActivityLogger;
use ImaginaCRM\Activity\ActivityRepository;
use ImaginaCRM\Lists\ListEntity;
use ImaginaCRM\Tests\Integration\IntegrationTestCase;

/**
 * E2E del repositorio de actividad contra MySQL real:
 * - Inserts persisten + recentForRecord/recentForList los devuelven en
 *   orden descendente por created_at.
 * - El JSON de `changes` se serializa y deserializa preservando shape.
 * - Paginación (limit/offset) funciona.
 */
final class ActivityRepositoryTest extends IntegrationTestCase
{
    private ActivityRepository $repo;
    private ActivityLogger $logger;

    protected function setUp(): void
    {
        parent::setUp();
        $this->repo   = new ActivityRepository($this->db());
        $this->logger = new ActivityLogger($this->repo);
    }

    public function test_insert_then_recent_round_trip(): void
    {
        $list = $this->stubList(7);

        $this->logger->recordCreated($list, 100, ['fields' => ['name' => 'Acme']]);
        $this->logger->recordUpdated(
            $list,
            100,
            ['fields' => ['name' => 'Acme', 'amount' => 200]],
            ['fields' => ['name' => 'Acme', 'amount' => 100]],
        );

        $rows = $this->repo->recentForRecord(7, 100);
        $this->assertCount(2, $rows);
        // Orden DESC: el update (más reciente) primero.
        $this->assertSame(ActivityLogger::ACTION_RECORD_UPDATED, $rows[0]->action);
        $this->assertSame(ActivityLogger::ACTION_RECORD_CREATED, $rows[1]->action);

        // El payload del update conserva el diff con `before`/`after`.
        $diff = $rows[0]->changes['fields']['amount'] ?? null;
        $this->assertIsArray($diff);
        $this->assertSame(100, $diff['before']);
        $this->assertSame(200, $diff['after']);
    }

    public function test_recent_for_list_returns_all_records(): void
    {
        $list = $this->stubList(7);

        $this->logger->recordCreated($list, 1, ['fields' => ['x' => 1]]);
        $this->logger->recordCreated($list, 2, ['fields' => ['x' => 2]]);

        // Otra lista para asegurar el filtro.
        $other = $this->stubList(8);
        $this->logger->recordCreated($other, 99, ['fields' => ['x' => 3]]);

        $list7 = $this->repo->recentForList(7);
        $this->assertCount(2, $list7);
        foreach ($list7 as $entry) {
            $this->assertSame(7, $entry->listId);
        }
    }

    public function test_pagination_with_limit_and_offset(): void
    {
        $list = $this->stubList(7);
        for ($i = 1; $i <= 5; $i++) {
            $this->logger->recordCreated($list, $i, ['fields' => ['x' => $i]]);
        }

        $page1 = $this->repo->recentForList(7, 2, 0);
        $page2 = $this->repo->recentForList(7, 2, 2);
        $page3 = $this->repo->recentForList(7, 2, 4);

        $this->assertCount(2, $page1);
        $this->assertCount(2, $page2);
        $this->assertCount(1, $page3);

        // Sin solapamiento.
        $allIds = array_merge(
            array_map(static fn ($e) => $e->id, $page1),
            array_map(static fn ($e) => $e->id, $page2),
            array_map(static fn ($e) => $e->id, $page3),
        );
        $this->assertSame($allIds, array_unique($allIds));
    }

    private function stubList(int $id): ListEntity
    {
        return new ListEntity(
            id: $id,
            slug: 'l' . $id,
            tableSuffix: 'l' . $id,
            name: 'L' . $id,
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
