<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\Automations;

use ImaginaCRM\Automations\ActionResult;
use ImaginaCRM\Automations\Actions\AbstractAction;
use ImaginaCRM\Automations\TriggerContext;
use ImaginaCRM\Lists\ListEntity;
use PHPUnit\Framework\TestCase;

/**
 * `AbstractAction::applyMergeTags()` es la base para acciones tipo
 * `call_webhook` o (futuro) `send_email`. Garantiza que `{{slug}}`,
 * `{{record.id}}` y `{{record.slug}}` se interpolan, que valores ausentes
 * caen a string vacío, y que tags inválidos pasan tal cual.
 */
final class MergeTagsTest extends TestCase
{
    public function test_replaces_simple_slug_tag(): void
    {
        $action = $this->makeAction();
        $ctx = $this->createContext(['id' => 7, 'fields' => ['name' => 'Acme', 'amount' => 1500]]);

        $this->assertSame('Hola Acme', $action->expand('Hola {{name}}', $ctx));
        $this->assertSame('Total: 1500', $action->expand('Total: {{amount}}', $ctx));
    }

    public function test_replaces_record_id_and_record_slug_aliases(): void
    {
        $action = $this->makeAction();
        $ctx = $this->createContext(['id' => 42, 'fields' => ['name' => 'Globex']]);

        $this->assertSame('id=42', $action->expand('id={{record.id}}', $ctx));
        $this->assertSame('name=Globex', $action->expand('name={{record.name}}', $ctx));
    }

    public function test_missing_value_becomes_empty_string(): void
    {
        $action = $this->makeAction();
        $ctx = $this->createContext(['id' => 1, 'fields' => []]);
        $this->assertSame('Hola ', $action->expand('Hola {{nope}}', $ctx));
    }

    public function test_unrecognized_pattern_passes_through(): void
    {
        $action = $this->makeAction();
        $ctx = $this->createContext(['id' => 1, 'fields' => []]);
        // Sin doble brace, no se toca.
        $this->assertSame('texto literal sin tags', $action->expand('texto literal sin tags', $ctx));
    }

    public function test_record_metadata_tags_resolve(): void
    {
        $action = $this->makeAction();
        $ctx = $this->createContext([
            'id' => 7,
            'fields' => [],
            'created_at' => '2026-04-29 10:30:00',
            'updated_at' => '2026-04-29 11:45:00',
            'created_by' => 42,
        ]);

        $this->assertSame('2026-04-29 10:30:00', $action->expand('{{record.created_at}}', $ctx));
        $this->assertSame('2026-04-29 11:45:00', $action->expand('{{record.updated_at}}', $ctx));
        $this->assertSame('42', $action->expand('{{record.created_by}}', $ctx));
    }

    public function test_date_now_returns_iso_8601_format(): void
    {
        $action = $this->makeAction();
        $ctx = $this->createContext(['id' => 1, 'fields' => []]);
        $result = $action->expand('{{date.now}}', $ctx);
        // ISO 8601 con offset (e.g. 2026-04-29T15:30:00+00:00).
        $this->assertMatchesRegularExpression(
            '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/',
            $result,
        );
    }

    public function test_date_today_returns_ymd(): void
    {
        $action = $this->makeAction();
        $ctx = $this->createContext(['id' => 1, 'fields' => []]);
        $result = $action->expand('{{date.today}}', $ctx);
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}$/', $result);
    }

    public function test_signature_returns_empty_when_no_user_meta(): void
    {
        $action = $this->makeAction();
        // Sin created_by ni current_user, resolveAuthorId devuelve 0
        // y get_user_meta queda en string vacío.
        $ctx = $this->createContext(['id' => 1, 'fields' => []]);
        $this->assertSame('', $action->expand('{{signature}}', $ctx));
    }

    private function makeAction(): object
    {
        return new class extends AbstractAction {
            public function getSlug(): string { return 'test'; }
            public function getLabel(): string { return 'Test'; }
            public function execute(TriggerContext $context, array $config): ActionResult {
                return ActionResult::success('test');
            }
            public function expand(string $template, TriggerContext $context): string
            {
                return $this->applyMergeTags($template, $context);
            }
        };
    }

    /**
     * @param array<string, mixed> $record
     */
    private function createContext(array $record): TriggerContext
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
            event: 'imagina_crm/record_created',
            list: $list,
            record: $record,
        );
    }
}
