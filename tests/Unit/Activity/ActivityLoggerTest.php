<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\Activity;

use ImaginaCRM\Activity\ActivityLogger;
use ImaginaCRM\Activity\ActivityRepository;
use ImaginaCRM\Comments\CommentEntity;
use ImaginaCRM\Lists\ListEntity;
use PHPUnit\Framework\TestCase;

/**
 * Tests del logger usando un repo en memoria. Cubrimos:
 *
 * - diffRecords() detecta sólo los slugs que cambiaron y soporta tanto
 *   shape hidratado (`{fields: …}`) como plano.
 * - recordUpdated() es no-op cuando no hay diff (no contamina timeline).
 * - commentCreated/Updated/Deleted persisten action + payload con
 *   user_id del autor (no del usuario actual de la request).
 * - Los payloads grandes (comentarios de >280 chars) se truncan con `…`.
 * - Los payloads sólo contienen valores serializables a JSON; objetos
 *   no escalares se descartan.
 */
final class ActivityLoggerTest extends TestCase
{
    private InMemoryActivityRepository $repo;
    private ActivityLogger $logger;

    protected function setUp(): void
    {
        parent::setUp();
        $this->repo   = new InMemoryActivityRepository();
        $this->logger = new ActivityLogger($this->repo);
    }

    public function test_diff_records_returns_only_changed_slugs(): void
    {
        $before = ['fields' => ['name' => 'Acme', 'amount' => 100, 'status' => 'lead']];
        $after  = ['fields' => ['name' => 'Acme', 'amount' => 200, 'status' => 'won']];

        $diff = $this->logger->diffRecords($before, $after);
        $this->assertArrayHasKey('amount', $diff);
        $this->assertArrayHasKey('status', $diff);
        $this->assertArrayNotHasKey('name', $diff);
        $this->assertSame(['before' => 100, 'after' => 200], $diff['amount']);
    }

    public function test_diff_records_supports_flat_shape(): void
    {
        $diff = $this->logger->diffRecords(
            ['name' => 'A', 'status' => 'lead'],
            ['name' => 'A', 'status' => 'won'],
        );
        $this->assertArrayHasKey('status', $diff);
        $this->assertArrayNotHasKey('name', $diff);
    }

    public function test_record_updated_is_noop_when_no_changes(): void
    {
        $list   = $this->stubList();
        $before = ['fields' => ['name' => 'Acme']];
        $after  = ['fields' => ['name' => 'Acme']];

        $id = $this->logger->recordUpdated($list, 7, $after, $before);
        $this->assertSame(0, $id);
        $this->assertCount(0, $this->repo->records);
    }

    public function test_record_created_persists_action_with_payload(): void
    {
        $list = $this->stubList();
        $this->logger->recordCreated($list, 99, ['fields' => ['name' => 'X']]);

        $this->assertCount(1, $this->repo->records);
        $entry = $this->repo->records[0];
        $this->assertSame(ActivityLogger::ACTION_RECORD_CREATED, $entry['action']);
        $this->assertSame(99, $entry['record_id']);
        $this->assertSame($list->id, $entry['list_id']);
        $this->assertArrayHasKey('record', $entry['changes']);
    }

    public function test_record_deleted_records_purge_flag(): void
    {
        $list = $this->stubList();
        $this->logger->recordDeleted($list, 1, true);
        $this->logger->recordDeleted($list, 2, false);

        $this->assertSame(true,  $this->repo->records[0]['changes']['purge']);
        $this->assertSame(false, $this->repo->records[1]['changes']['purge']);
    }

    public function test_comment_events_attribute_to_author_not_current_user(): void
    {
        $comment = $this->stubComment(1, 5, 42, 'Hola @maria');
        $this->logger->commentCreated($comment);

        $this->assertSame(42, $this->repo->records[0]['user_id']);
        $this->assertSame(ActivityLogger::ACTION_COMMENT_CREATED, $this->repo->records[0]['action']);
        $this->assertSame(5,  $this->repo->records[0]['comment_id'] ?? null);
        $this->assertSame('Hola @maria', $this->repo->records[0]['changes']['content']);
    }

    public function test_truncates_long_comment_content(): void
    {
        $long    = str_repeat('a', 500);
        $comment = $this->stubComment(1, 5, 42, $long);
        $this->logger->commentCreated($comment);

        $stored = (string) $this->repo->records[0]['changes']['content'];
        $this->assertLessThanOrEqual(280, mb_strlen($stored));
        $this->assertStringEndsWith('…', $stored);
    }

    public function test_safe_payload_drops_non_scalar_objects(): void
    {
        $list = $this->stubList();
        // Pasamos un objeto sin __toString — debe quedar como null.
        $this->logger->recordCreated($list, 1, ['fields' => ['x' => new \stdClass()]]);

        $payload = $this->repo->records[0]['changes']['record']['fields'] ?? null;
        $this->assertIsArray($payload);
        $this->assertNull($payload['x']);
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

    private function stubComment(int $listId, int $id, int $userId, string $content): CommentEntity
    {
        return new CommentEntity(
            id: $id,
            listId: $listId,
            recordId: 99,
            userId: $userId,
            parentId: null,
            content: $content,
            createdAt: '2026-04-25 10:00:00',
            updatedAt: '2026-04-25 10:00:00',
            deletedAt: null,
        );
    }
}

/**
 * Repo en memoria para ejercitar al logger sin tocar wpdb. Aplana los
 * datos en `records` y conserva `changes` ya decodificado como array
 * (en vez del JSON string que persistiría el repo real) para asserts
 * más legibles.
 */
final class InMemoryActivityRepository extends ActivityRepository
{
    /** @var array<int, array<string, mixed>> */
    public array $records = [];

    private int $nextId = 1;

    public function __construct()
    {
        // No invocamos al ctor padre — no necesitamos Database.
    }

    public function insert(array $data): int
    {
        $id = $this->nextId++;
        $row = [
            'id'         => $id,
            'list_id'    => (int) $data['list_id'],
            'record_id'  => isset($data['record_id']) && $data['record_id'] !== null ? (int) $data['record_id'] : null,
            'user_id'    => isset($data['user_id']) && $data['user_id'] !== null ? (int) $data['user_id'] : null,
            'action'     => (string) $data['action'],
            'changes'    => $data['changes'] ?? [],
            'created_at' => '2026-04-25 10:00:00',
        ];
        // Conveniencia: si el payload trae `comment_id`, súbelo al toplevel.
        if (is_array($row['changes']) && isset($row['changes']['comment_id'])) {
            $row['comment_id'] = $row['changes']['comment_id'];
        }
        $this->records[] = $row;
        return $id;
    }
}
