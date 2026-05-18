<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\Automations;

use ImaginaCRM\Automations\ConditionEvaluator;
use ImaginaCRM\Automations\TriggerContext;
use ImaginaCRM\Lists\ListEntity;
use PHPUnit\Framework\TestCase;

/**
 * Cubre los DOS shapes que `ConditionEvaluator::matches` acepta:
 *   - Legacy plano `{slug: value}` (eq-only, compat 0.1.x→0.18.x).
 *   - Nuevo array `[{slug, op, value}, ...]` (operadores, 0.20.0+).
 */
final class ConditionEvaluatorTest extends TestCase
{
    public function test_legacy_flat_shape_is_eq_only(): void
    {
        $ctx = $this->ctx(['name' => 'Acme', 'amount' => 100]);
        $this->assertTrue(ConditionEvaluator::matches($ctx, ['name' => 'Acme']));
        $this->assertFalse(ConditionEvaluator::matches($ctx, ['name' => 'Other']));
    }

    public function test_empty_or_null_condition_always_matches(): void
    {
        $ctx = $this->ctx([]);
        $this->assertTrue(ConditionEvaluator::matches($ctx, null));
        $this->assertTrue(ConditionEvaluator::matches($ctx, []));
    }

    public function test_rich_array_with_eq_neq(): void
    {
        $ctx = $this->ctx(['status' => 'active', 'amount' => 100]);
        $this->assertTrue(ConditionEvaluator::matches($ctx, [
            ['slug' => 'status', 'op' => 'eq', 'value' => 'active'],
        ]));
        $this->assertFalse(ConditionEvaluator::matches($ctx, [
            ['slug' => 'status', 'op' => 'neq', 'value' => 'active'],
        ]));
    }

    public function test_rich_array_with_contains_and_not_contains(): void
    {
        $ctx = $this->ctx(['name' => 'Acme Corp']);
        $this->assertTrue(ConditionEvaluator::matches($ctx, [
            ['slug' => 'name', 'op' => 'contains', 'value' => 'Acme'],
        ]));
        $this->assertFalse(ConditionEvaluator::matches($ctx, [
            ['slug' => 'name', 'op' => 'contains', 'value' => 'Foo'],
        ]));
        $this->assertTrue(ConditionEvaluator::matches($ctx, [
            ['slug' => 'name', 'op' => 'not_contains', 'value' => 'Foo'],
        ]));
    }

    public function test_rich_array_with_numeric_comparisons(): void
    {
        $ctx = $this->ctx(['amount' => 150]);
        $this->assertTrue(ConditionEvaluator::matches($ctx, [
            ['slug' => 'amount', 'op' => 'gt', 'value' => 100],
        ]));
        $this->assertTrue(ConditionEvaluator::matches($ctx, [
            ['slug' => 'amount', 'op' => 'lte', 'value' => 150],
        ]));
        $this->assertFalse(ConditionEvaluator::matches($ctx, [
            ['slug' => 'amount', 'op' => 'gt', 'value' => 200],
        ]));
    }

    public function test_rich_array_with_is_null_is_not_null(): void
    {
        $ctx = $this->ctx(['nickname' => '', 'name' => 'Acme']);
        $this->assertTrue(ConditionEvaluator::matches($ctx, [
            ['slug' => 'nickname', 'op' => 'is_null', 'value' => null],
        ]));
        $this->assertTrue(ConditionEvaluator::matches($ctx, [
            ['slug' => 'name', 'op' => 'is_not_null', 'value' => null],
        ]));
        $this->assertFalse(ConditionEvaluator::matches($ctx, [
            ['slug' => 'name', 'op' => 'is_null', 'value' => null],
        ]));
    }

    public function test_rich_array_with_in_nin(): void
    {
        $ctx = $this->ctx(['status' => 'active']);
        $this->assertTrue(ConditionEvaluator::matches($ctx, [
            ['slug' => 'status', 'op' => 'in', 'value' => ['active', 'pending']],
        ]));
        $this->assertTrue(ConditionEvaluator::matches($ctx, [
            ['slug' => 'status', 'op' => 'nin', 'value' => ['archived', 'deleted']],
        ]));
        $this->assertFalse(ConditionEvaluator::matches($ctx, [
            ['slug' => 'status', 'op' => 'in', 'value' => ['archived', 'deleted']],
        ]));
    }

    public function test_date_range_via_two_gte_lte_conditions(): void
    {
        $ctx = $this->ctx(['due_date' => '2026-04-15']);
        $this->assertTrue(ConditionEvaluator::matches($ctx, [
            ['slug' => 'due_date', 'op' => 'gte', 'value' => '2026-04-01'],
            ['slug' => 'due_date', 'op' => 'lte', 'value' => '2026-04-30'],
        ]));
        $this->assertFalse(ConditionEvaluator::matches($ctx, [
            ['slug' => 'due_date', 'op' => 'gte', 'value' => '2026-05-01'],
            ['slug' => 'due_date', 'op' => 'lte', 'value' => '2026-05-31'],
        ]));
    }

    public function test_rich_array_all_conditions_must_match(): void
    {
        $ctx = $this->ctx(['status' => 'active', 'amount' => 100]);
        $this->assertTrue(ConditionEvaluator::matches($ctx, [
            ['slug' => 'status', 'op' => 'eq', 'value' => 'active'],
            ['slug' => 'amount', 'op' => 'gte', 'value' => 50],
        ]));
        // Una falla → false.
        $this->assertFalse(ConditionEvaluator::matches($ctx, [
            ['slug' => 'status', 'op' => 'eq', 'value' => 'active'],
            ['slug' => 'amount', 'op' => 'gt', 'value' => 200],
        ]));
    }

    public function test_alias_field_key_works_same_as_slug(): void
    {
        $ctx = $this->ctx(['name' => 'Acme']);
        // El UI puede mandar `field` en lugar de `slug` (ambos
        // aceptados por matchOne).
        $this->assertTrue(ConditionEvaluator::matches($ctx, [
            ['field' => 'name', 'op' => 'eq', 'value' => 'Acme'],
        ]));
    }

    public function test_starts_with_and_ends_with(): void
    {
        $ctx = $this->ctx(['email' => 'augusto@imaginawp.com']);
        $this->assertTrue(ConditionEvaluator::matches($ctx, [
            ['slug' => 'email', 'op' => 'starts_with', 'value' => 'augusto'],
        ]));
        $this->assertTrue(ConditionEvaluator::matches($ctx, [
            ['slug' => 'email', 'op' => 'ends_with', 'value' => '@imaginawp.com'],
        ]));
        $this->assertFalse(ConditionEvaluator::matches($ctx, [
            ['slug' => 'email', 'op' => 'starts_with', 'value' => 'foo'],
        ]));
    }

    /**
     * @param array<string, mixed> $fields
     */
    private function ctx(array $fields): TriggerContext
    {
        $list = new ListEntity(
            id: 1,
            slug: 'test',
            tableSuffix: 'test',
            name: 'Test',
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
            record: ['id' => 1, 'fields' => $fields],
        );
    }
}
