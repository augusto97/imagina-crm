<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\Comments;

use ImaginaCRM\Activity\ActivityLogger;
use ImaginaCRM\Activity\ActivityRepository;
use ImaginaCRM\Comments\CommentEntity;
use ImaginaCRM\Comments\MentionNotifier;
use ImaginaCRM\Comments\MentionParser;
use ImaginaCRM\Lists\ListEntity;
use ImaginaCRM\Lists\ListRepository;
use ImaginaCRM\Tests\Unit\Activity\InMemoryActivityRepository;
use PHPUnit\Framework\TestCase;

/**
 * Tests del notificador end-to-end (con doubles): un comentario con
 * menciones dispara wp_mail por cada mencionado existente y queda un
 * activity entry `mention.received` por cada uno. Auto-menciones del
 * autor se ignoran.
 */
final class MentionNotifierTest extends TestCase
{
    private InMemoryActivityRepository $activityRepo;
    private ActivityLogger $logger;
    private MentionNotifier $notifier;

    protected function setUp(): void
    {
        parent::setUp();
        $GLOBALS['imcrm_test_mail_calls']          = [];
        $GLOBALS['imcrm_test_mail_should_succeed'] = true;
        $GLOBALS['imcrm_test_users']               = [];

        $this->activityRepo = new InMemoryActivityRepository();
        $this->logger       = new ActivityLogger($this->activityRepo);

        // Resolver de menciones inyectado: maria=12, juan=18, autor=42.
        $parser = new MentionParser(static function (string $login): ?int {
            return match ($login) {
                'maria' => 12,
                'juan'  => 18,
                'autor' => 42,
                default => null,
            };
        });

        $lists = new class extends ListRepository {
            public function __construct() {}
            public function find(int $id): ?ListEntity
            {
                if ($id !== 1) return null;
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
        };

        $this->notifier = new MentionNotifier($parser, $this->logger, $lists);

        // Stubs de WP users.
        $GLOBALS['imcrm_test_users']['id:12'] = (object) [
            'ID' => 12, 'user_email' => 'maria@example.test', 'display_name' => 'María',
        ];
        $GLOBALS['imcrm_test_users']['id:18'] = (object) [
            'ID' => 18, 'user_email' => 'juan@example.test', 'display_name' => 'Juan',
        ];
        $GLOBALS['imcrm_test_users']['id:42'] = (object) [
            'ID' => 42, 'user_email' => 'autor@example.test', 'display_name' => 'Autor',
        ];
    }

    public function test_creates_activity_and_email_per_mention(): void
    {
        $comment = $this->makeComment(7, 42, 'Hola @maria y @juan, revisen esto');
        $this->notifier->handleCommentCreated($comment);

        // Activity log: dos entradas mention.received con user_id =
        // mencionado.
        $mentions = array_filter(
            $this->activityRepo->records,
            static fn (array $r): bool => $r['action'] === ActivityLogger::ACTION_MENTION_RECEIVED,
        );
        $mentions = array_values($mentions);
        $this->assertCount(2, $mentions);
        $this->assertSame(12, $mentions[0]['user_id']);
        $this->assertSame(18, $mentions[1]['user_id']);
        $this->assertSame(42, $mentions[0]['changes']['actor_user_id']);

        // Email a cada uno.
        $this->assertCount(2, $GLOBALS['imcrm_test_mail_calls']);
        $this->assertSame(['maria@example.test'], (array) $GLOBALS['imcrm_test_mail_calls'][0]['to']);
        $this->assertStringContainsString('Imagina CRM', $GLOBALS['imcrm_test_mail_calls'][0]['subject']);
    }

    public function test_self_mention_does_not_notify(): void
    {
        $comment = $this->makeComment(7, 42, 'Nota para mí: @autor revisar después');
        $this->notifier->handleCommentCreated($comment);

        $this->assertSame([], $this->activityRepo->records);
        $this->assertSame([], $GLOBALS['imcrm_test_mail_calls']);
    }

    public function test_unknown_login_is_silently_ignored(): void
    {
        $comment = $this->makeComment(7, 42, 'Hola @ghost @maria');
        $this->notifier->handleCommentCreated($comment);

        $mentions = array_filter(
            $this->activityRepo->records,
            static fn (array $r): bool => $r['action'] === ActivityLogger::ACTION_MENTION_RECEIVED,
        );
        $this->assertCount(1, $mentions, 'Sólo @maria existe; @ghost se descarta.');
        $this->assertCount(1, $GLOBALS['imcrm_test_mail_calls']);
    }

    public function test_no_mentions_means_no_side_effects(): void
    {
        $comment = $this->makeComment(7, 42, 'Sin menciones aquí');
        $this->notifier->handleCommentCreated($comment);

        $this->assertSame([], $this->activityRepo->records);
        $this->assertSame([], $GLOBALS['imcrm_test_mail_calls']);
    }

    private function makeComment(int $recordId, int $userId, string $content): CommentEntity
    {
        return new CommentEntity(
            id: 1,
            listId: 1,
            recordId: $recordId,
            userId: $userId,
            parentId: null,
            content: $content,
            createdAt: '2026-04-25 10:00:00',
            updatedAt: '2026-04-25 10:00:00',
            deletedAt: null,
        );
    }
}
