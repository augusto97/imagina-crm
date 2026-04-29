<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\Fields;

use ImaginaCRM\Contracts\FieldTypeInterface;
use ImaginaCRM\Fields\FieldTypeRegistry;
use PHPUnit\Framework\TestCase;

final class FieldTypeRegistryTest extends TestCase
{
    public function test_default_registry_has_all_mvp_types(): void
    {
        $registry = new FieldTypeRegistry();
        $expected = [
            'text', 'long_text', 'number', 'currency',
            'select', 'multi_select', 'date', 'datetime',
            'checkbox', 'url', 'email', 'user', 'relation', 'file',
            'computed', // 0.23.0
        ];

        foreach ($expected as $slug) {
            $this->assertTrue($registry->has($slug), "Registry should know type '{$slug}'.");
            $this->assertInstanceOf(FieldTypeInterface::class, $registry->get($slug));
        }

        $this->assertCount(15, $registry->all());
    }

    public function test_relation_type_does_not_materialize_column(): void
    {
        $registry = new FieldTypeRegistry();
        $relation = $registry->get('relation');

        $this->assertNotNull($relation);
        $this->assertFalse($relation->hasColumn(), 'relation type must NOT have a column.');
        $this->assertSame('', $relation->getSqlDefinition([]));
    }

    public function test_only_text_and_email_support_unique_in_mvp(): void
    {
        $registry = new FieldTypeRegistry();

        $this->assertTrue($registry->get('text')?->supportsUnique());
        $this->assertTrue($registry->get('email')?->supportsUnique());

        // Tipos típicos que no soportan UNIQUE (multi_select por JSON, etc.).
        $this->assertFalse($registry->get('multi_select')?->supportsUnique());
        $this->assertFalse($registry->get('long_text')?->supportsUnique());
        $this->assertFalse($registry->get('checkbox')?->supportsUnique());
    }

    public function test_toArray_serializes_each_type(): void
    {
        $registry = new FieldTypeRegistry();
        $serialized = $registry->toArray();

        $this->assertCount(15, $serialized);

        foreach ($serialized as $row) {
            $this->assertArrayHasKey('slug', $row);
            $this->assertArrayHasKey('label', $row);
            $this->assertArrayHasKey('has_column', $row);
            $this->assertArrayHasKey('supports_unique', $row);
            $this->assertArrayHasKey('config_schema', $row);
        }
    }

    public function test_unknown_type_returns_null(): void
    {
        $registry = new FieldTypeRegistry();
        $this->assertNull($registry->get('does_not_exist'));
        $this->assertFalse($registry->has('does_not_exist'));
    }
}
