<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\Stubs;

use ImaginaCRM\Lists\SlugManager;
use ImaginaCRM\Support\SlugContext;

/**
 * SlugManager con `resolveCurrentSlug` controlable por test.
 *
 * Permite simular historial de slugs sin levantar una BD real.
 */
final class StubSlugManager extends SlugManager
{
    /** @var array<string, string> [oldSlug => newSlug] */
    public array $resolutions = [];

    public function __construct()
    {
        parent::__construct(new \ImaginaCRM\Support\Database(new FakeWpdb()));
    }

    public function resolveCurrentSlug(SlugContext $context, string $maybeOldSlug, ?int $listId = null): ?string
    {
        unset($context, $listId);
        return $this->resolutions[$maybeOldSlug] ?? null;
    }
}
