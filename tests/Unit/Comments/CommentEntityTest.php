<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\Comments;

use ImaginaCRM\Comments\CommentEntity;
use PHPUnit\Framework\TestCase;

/**
 * Verificación rápida del shape: `fromRow()` parsea filas crudas como
 * vendrían de wpdb (parent_id puede ser null, deleted_at puede faltar).
 */
final class CommentEntityTest extends TestCase
{
    public function test_from_row_parses_full_payload(): void
    {
        $entity = CommentEntity::fromRow([
            'id'         => '7',
            'list_id'    => '3',
            'record_id'  => '42',
            'user_id'    => '12',
            'parent_id'  => '6',
            'content'    => 'Hola @maria',
            'created_at' => '2026-04-25 10:00:00',
            'updated_at' => '2026-04-25 11:00:00',
            'deleted_at' => null,
        ]);

        $this->assertSame(7, $entity->id);
        $this->assertSame(3, $entity->listId);
        $this->assertSame(42, $entity->recordId);
        $this->assertSame(12, $entity->userId);
        $this->assertSame(6, $entity->parentId);
        $this->assertSame('Hola @maria', $entity->content);
        $this->assertNull($entity->deletedAt);
    }

    public function test_from_row_handles_null_parent(): void
    {
        $entity = CommentEntity::fromRow([
            'id'         => 1,
            'list_id'    => 1,
            'record_id'  => 1,
            'user_id'    => 1,
            'parent_id'  => null,
            'content'    => 'top-level',
            'created_at' => '2026-04-25 10:00:00',
            'updated_at' => '2026-04-25 10:00:00',
        ]);

        $this->assertNull($entity->parentId);
        $this->assertNull($entity->deletedAt);
    }

    public function test_to_array_omits_deleted_at(): void
    {
        $entity = new CommentEntity(
            id: 1,
            listId: 1,
            recordId: 1,
            userId: 1,
            parentId: null,
            content: 'X',
            createdAt: '2026-04-25 10:00:00',
            updatedAt: '2026-04-25 10:00:00',
            deletedAt: null,
        );

        $arr = $entity->toArray();
        $this->assertArrayNotHasKey('deleted_at', $arr, 'No exponemos deleted_at en la API.');
        $this->assertSame(1, $arr['id']);
    }
}
