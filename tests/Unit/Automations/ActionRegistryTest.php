<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\Automations;

use ImaginaCRM\Automations\ActionRegistry;
use ImaginaCRM\Automations\ActionResult;
use ImaginaCRM\Automations\TriggerContext;
use ImaginaCRM\Contracts\ActionInterface;
use PHPUnit\Framework\TestCase;

/**
 * Confirma que `ActionRegistry` arranca vacío (a diferencia del trigger
 * registry) y que el caller registra acciones; éstas aparecen luego en
 * `has`/`get`/`all`/`toArray`.
 */
final class ActionRegistryTest extends TestCase
{
    public function test_registry_starts_empty(): void
    {
        $registry = new ActionRegistry();
        $this->assertSame([], $registry->all());
        $this->assertFalse($registry->has('update_field'));
    }

    public function test_register_and_retrieve(): void
    {
        $action = $this->makeStubAction('noop', 'No-op');

        $registry = new ActionRegistry();
        $registry->register($action);

        $this->assertTrue($registry->has('noop'));
        $this->assertSame($action, $registry->get('noop'));
    }

    public function test_to_array_serializes_each_action(): void
    {
        $registry = new ActionRegistry();
        $registry->register($this->makeStubAction('a', 'Alfa'));
        $registry->register($this->makeStubAction('b', 'Beta'));

        $shape = $registry->toArray();
        $this->assertCount(2, $shape);
        $this->assertSame('a', $shape[0]['slug']);
        $this->assertSame('Alfa', $shape[0]['label']);
        $this->assertArrayHasKey('config_schema', $shape[0]);
    }

    private function makeStubAction(string $slug, string $label): ActionInterface
    {
        return new class($slug, $label) implements ActionInterface {
            public function __construct(private string $slug, private string $label) {}
            public function getSlug(): string { return $this->slug; }
            public function getLabel(): string { return $this->label; }
            public function execute(TriggerContext $context, array $config): ActionResult {
                return ActionResult::success($this->slug);
            }
            public function getConfigSchema(): array { return []; }
        };
    }
}
