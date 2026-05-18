<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\Automations;

use ImaginaCRM\Automations\TriggerContext;
use ImaginaCRM\Automations\TriggerRegistry;
use ImaginaCRM\Automations\Triggers\RecordCreatedTrigger;
use ImaginaCRM\Automations\Triggers\RecordUpdatedTrigger;
use ImaginaCRM\Contracts\TriggerInterface;
use ImaginaCRM\Lists\ListEntity;
use PHPUnit\Framework\TestCase;

/**
 * Verifica que el registry expone los dos triggers default y que custom
 * registrados después aparecen en `all()` / `toArray()`.
 */
final class TriggerRegistryTest extends TestCase
{
    public function test_default_triggers_are_registered(): void
    {
        $registry = new TriggerRegistry();

        $this->assertTrue($registry->has(RecordCreatedTrigger::SLUG));
        $this->assertTrue($registry->has(RecordUpdatedTrigger::SLUG));
        $this->assertTrue($registry->has('field_changed'));
        $this->assertTrue($registry->has('scheduled'));
        $this->assertTrue($registry->has('due_date_reached'));
        $this->assertInstanceOf(RecordCreatedTrigger::class, $registry->get(RecordCreatedTrigger::SLUG));
        $this->assertInstanceOf(RecordUpdatedTrigger::class, $registry->get(RecordUpdatedTrigger::SLUG));
    }

    public function test_unknown_trigger_returns_null(): void
    {
        $registry = new TriggerRegistry();
        $this->assertNull($registry->get('nope'));
        $this->assertFalse($registry->has('nope'));
    }

    public function test_register_adds_custom_trigger(): void
    {
        $registry = new TriggerRegistry();
        $custom   = new class extends \ImaginaCRM\Automations\Triggers\AbstractTrigger {
            public function getSlug(): string { return 'custom'; }
            public function getLabel(): string { return 'Custom'; }
            public function getEvent(): string { return 'imagina_crm/custom'; }
            public function matches(TriggerContext $context, array $config): bool { return true; }
        };

        $registry->register($custom);
        $this->assertTrue($registry->has('custom'));
        $this->assertSame($custom, $registry->get('custom'));
    }

    public function test_to_array_shape_for_frontend(): void
    {
        $registry = new TriggerRegistry();
        $shape    = $registry->toArray();

        $this->assertCount(5, $shape);
        foreach ($shape as $entry) {
            $this->assertArrayHasKey('slug', $entry);
            $this->assertArrayHasKey('label', $entry);
            $this->assertArrayHasKey('event', $entry);
            $this->assertArrayHasKey('config_schema', $entry);
        }
    }
}
