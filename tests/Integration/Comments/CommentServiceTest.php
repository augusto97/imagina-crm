<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Integration\Comments;

use ImaginaCRM\Comments\CommentRepository;
use ImaginaCRM\Comments\CommentService;
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
 * E2E del CommentService contra MySQL real:
 * - Creación / lectura ordenada / actualización / eliminación.
 * - Validaciones: vacío, largo máximo, padre inválido, lista/record
 *   inexistente.
 * - Permiso por autor: usuario distinto que no es admin no puede editar
 *   ni borrar.
 */
final class CommentServiceTest extends IntegrationTestCase
{
    private CommentService $comments;
    private RecordService $records;
    private ListService $lists;
    private FieldService $fields;

    protected function setUp(): void
    {
        parent::setUp();
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
        $this->records = new RecordService($fieldRepo, $recordRepo, $relationsRepo, $validator, $queryBuilder);

        $this->comments = new CommentService(
            new CommentRepository($this->db()),
            $listRepo,
            $recordRepo,
        );
    }

    public function test_create_read_update_delete_cycle(): void
    {
        [$list, $recordId] = $this->seed();

        // Create.
        $first = $this->comments->create($list->id, $recordId, 7, ['content' => 'Hola']);
        $this->assertNotInstanceOf(ValidationResult::class, $first);
        $this->assertSame('Hola', $first->content);
        $this->assertSame(7, $first->userId);

        // Reply.
        $reply = $this->comments->create($list->id, $recordId, 8, [
            'content'   => 'Respuesta',
            'parent_id' => $first->id,
        ]);
        $this->assertNotInstanceOf(ValidationResult::class, $reply);
        $this->assertSame($first->id, $reply->parentId);

        // Read all (ordenado por created_at asc).
        $all = $this->comments->allForRecord($list->id, $recordId);
        $this->assertCount(2, $all);
        $this->assertSame($first->id, $all[0]->id);

        // Update por el autor.
        $updated = $this->comments->update($first->id, 7, false, 'Hola editado');
        $this->assertNotInstanceOf(ValidationResult::class, $updated);
        $this->assertSame('Hola editado', $updated->content);

        // Delete por el autor.
        $del = $this->comments->delete($first->id, 7, false);
        $this->assertTrue($del->isValid());
        $this->assertNull($this->comments->find($first->id), 'soft-deleted: find devuelve null.');
    }

    public function test_empty_or_too_long_content_is_rejected(): void
    {
        [$list, $recordId] = $this->seed();

        $r = $this->comments->create($list->id, $recordId, 1, ['content' => '   ']);
        $this->assertInstanceOf(ValidationResult::class, $r);
        $this->assertArrayHasKey('content', $r->errors());

        $r = $this->comments->create($list->id, $recordId, 1, [
            'content' => str_repeat('a', CommentService::MAX_CONTENT_LENGTH + 1),
        ]);
        $this->assertInstanceOf(ValidationResult::class, $r);
        $this->assertArrayHasKey('content', $r->errors());
    }

    public function test_invalid_list_or_record_returns_validation_error(): void
    {
        $r = $this->comments->create(99999, 1, 1, ['content' => 'x']);
        $this->assertInstanceOf(ValidationResult::class, $r);
        $this->assertArrayHasKey('list_id', $r->errors());

        [$list] = $this->seed();
        $r = $this->comments->create($list->id, 99999, 1, ['content' => 'x']);
        $this->assertInstanceOf(ValidationResult::class, $r);
        $this->assertArrayHasKey('record_id', $r->errors());
    }

    public function test_parent_must_belong_to_same_record(): void
    {
        [$list, $recordId] = $this->seed();
        // Otro record de la misma lista.
        $other = $this->records->create($list, ['name' => 'Otro']);
        $this->assertIsArray($other);
        $otherId = (int) $other['id'];

        $a = $this->comments->create($list->id, $recordId, 1, ['content' => 'A']);
        $this->assertNotInstanceOf(ValidationResult::class, $a);

        $bad = $this->comments->create($list->id, $otherId, 1, [
            'content'   => 'B',
            'parent_id' => $a->id,
        ]);
        $this->assertInstanceOf(ValidationResult::class, $bad);
        $this->assertArrayHasKey('parent_id', $bad->errors());
    }

    public function test_only_author_or_admin_can_edit_and_delete(): void
    {
        [$list, $recordId] = $this->seed();

        $c = $this->comments->create($list->id, $recordId, 7, ['content' => 'mío']);
        $this->assertNotInstanceOf(ValidationResult::class, $c);

        // Otro usuario, no admin → forbidden.
        $r = $this->comments->update($c->id, 99, false, 'pwned');
        $this->assertInstanceOf(ValidationResult::class, $r);
        $this->assertArrayHasKey('forbidden', $r->errors());

        $r = $this->comments->delete($c->id, 99, false);
        $this->assertFalse($r->isValid());

        // Admin sí puede editar/borrar comentario ajeno.
        $r = $this->comments->update($c->id, 99, true, 'moderado');
        $this->assertNotInstanceOf(ValidationResult::class, $r);
        $this->assertSame('moderado', $r->content);

        $r = $this->comments->delete($c->id, 99, true);
        $this->assertTrue($r->isValid());
    }

    /**
     * @return array{0: ListEntity, 1: int}
     */
    private function seed(): array
    {
        $list = $this->lists->create(['name' => 'Empresas']);
        $this->assertIsObject($list);
        /** @var ListEntity $list */

        $r = $this->fields->create($list->id, [
            'label' => 'Nombre',
            'slug'  => 'name',
            'type'  => 'text',
            'is_required' => true,
        ]);
        $this->assertNotInstanceOf(ValidationResult::class, $r);

        $rec = $this->records->create($list, ['name' => 'Acme']);
        $this->assertIsArray($rec);

        return [$list, (int) $rec['id']];
    }
}
