<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\Fields;

use ImaginaCRM\Fields\ComputedFieldEvaluator;
use ImaginaCRM\Fields\FieldEntity;
use ImaginaCRM\Fields\Types\ComputedField;
use PHPUnit\Framework\TestCase;

/**
 * Pure tests — el evaluator no toca BD ni hooks. Cubre los 8
 * operadores + edge cases (cross-year, divide-by-zero, missing
 * input, cadenas de computed → computed, ciclos).
 */
final class ComputedFieldEvaluatorTest extends TestCase
{
    public function test_date_diff_months_simple_same_year(): void
    {
        $fields = [
            $this->date(1, 'a'),
            $this->date(2, 'b'),
            $this->computed(3, 'diff', 'date_diff_months', [1, 2]),
        ];
        $hydrated = ['a' => '2026-01-15', 'b' => '2026-04-15'];
        $this->assertSame(3, ComputedFieldEvaluator::evaluate($fields[2], $fields, $hydrated));
    }

    public function test_date_diff_months_crosses_year(): void
    {
        $fields = [
            $this->date(1, 'a'),
            $this->date(2, 'b'),
            $this->computed(3, 'diff', 'date_diff_months', [1, 2]),
        ];
        // Dec 2025 → Jan 2026 = 1 mes (no -11).
        $this->assertSame(
            1,
            ComputedFieldEvaluator::evaluate(
                $fields[2],
                $fields,
                ['a' => '2025-12-15', 'b' => '2026-01-10'],
            ),
        );
        // Jul 2024 → Mar 2026 = 20 meses.
        $this->assertSame(
            20,
            ComputedFieldEvaluator::evaluate(
                $fields[2],
                $fields,
                ['a' => '2024-07-15', 'b' => '2026-03-15'],
            ),
        );
    }

    public function test_date_diff_months_negative_when_a_is_after_b(): void
    {
        $fields = [
            $this->date(1, 'a'),
            $this->date(2, 'b'),
            $this->computed(3, 'diff', 'date_diff_months', [1, 2]),
        ];
        $this->assertSame(
            -2,
            ComputedFieldEvaluator::evaluate(
                $fields[2],
                $fields,
                ['a' => '2026-04-15', 'b' => '2026-02-15'],
            ),
        );
    }

    public function test_date_diff_days(): void
    {
        $fields = [
            $this->date(1, 'a'),
            $this->date(2, 'b'),
            $this->computed(3, 'diff', 'date_diff_days', [1, 2]),
        ];
        $this->assertSame(
            10,
            ComputedFieldEvaluator::evaluate(
                $fields[2],
                $fields,
                ['a' => '2026-04-15', 'b' => '2026-04-25'],
            ),
        );
    }

    public function test_sum(): void
    {
        $fields = [
            $this->number(1, 'a'),
            $this->number(2, 'b'),
            $this->number(3, 'c'),
            $this->computed(4, 's', 'sum', [1, 2, 3]),
        ];
        $this->assertSame(
            60.0,
            ComputedFieldEvaluator::evaluate(
                $fields[3],
                $fields,
                ['a' => 10, 'b' => 20, 'c' => 30],
            ),
        );
    }

    public function test_product(): void
    {
        $fields = [
            $this->number(1, 'a'),
            $this->number(2, 'b'),
            $this->computed(3, 'p', 'product', [1, 2]),
        ];
        $this->assertSame(
            300.0,
            ComputedFieldEvaluator::evaluate(
                $fields[2],
                $fields,
                ['a' => 15, 'b' => 20],
            ),
        );
    }

    public function test_subtract(): void
    {
        $fields = [
            $this->number(1, 'a'),
            $this->number(2, 'b'),
            $this->computed(3, 'r', 'subtract', [1, 2]),
        ];
        $this->assertSame(
            5.0,
            ComputedFieldEvaluator::evaluate(
                $fields[2],
                $fields,
                ['a' => 10, 'b' => 5],
            ),
        );
    }

    public function test_divide_normal(): void
    {
        $fields = [
            $this->number(1, 'a'),
            $this->number(2, 'b'),
            $this->computed(3, 'd', 'divide', [1, 2]),
        ];
        $this->assertSame(
            5.0,
            ComputedFieldEvaluator::evaluate(
                $fields[2],
                $fields,
                ['a' => 100, 'b' => 20],
            ),
        );
    }

    public function test_divide_by_zero_returns_null(): void
    {
        $fields = [
            $this->number(1, 'a'),
            $this->number(2, 'b'),
            $this->computed(3, 'd', 'divide', [1, 2]),
        ];
        $this->assertNull(
            ComputedFieldEvaluator::evaluate(
                $fields[2],
                $fields,
                ['a' => 100, 'b' => 0],
            ),
        );
    }

    public function test_missing_input_returns_null(): void
    {
        $fields = [
            $this->number(1, 'a'),
            $this->number(2, 'b'),
            $this->computed(3, 's', 'subtract', [1, 2]),
        ];
        $this->assertNull(
            ComputedFieldEvaluator::evaluate(
                $fields[2],
                $fields,
                ['a' => 100], // b ausente
            ),
        );
    }

    public function test_concat(): void
    {
        $fields = [
            $this->text(1, 'first'),
            $this->text(2, 'last'),
            $this->computed(3, 'full', 'concat', [1, 2], ['separator' => ' ']),
        ];
        $this->assertSame(
            'Augusto Garzon',
            ComputedFieldEvaluator::evaluate(
                $fields[2],
                $fields,
                ['first' => 'Augusto', 'last' => 'Garzon'],
            ),
        );
    }

    public function test_abs(): void
    {
        $fields = [
            $this->number(1, 'a'),
            $this->computed(2, 'pos', 'abs', [1]),
        ];
        $this->assertSame(7.0, ComputedFieldEvaluator::evaluate($fields[1], $fields, ['a' => -7]));
        $this->assertSame(7.0, ComputedFieldEvaluator::evaluate($fields[1], $fields, ['a' => 7]));
    }

    public function test_chained_computed_resolves_recursively(): void
    {
        // C = A - B; D = C * E
        $fields = [
            $this->date(1, 'a'),
            $this->date(2, 'b'),
            $this->computed(3, 'c', 'date_diff_months', [2, 1]), // a - b in months
            $this->number(4, 'monthly'),
            $this->computed(5, 'total', 'product', [3, 4]),
        ];
        // a = mar 2026, b = ene 2026 → c = months(a) - months(b) = 2
        // monthly = 50 → total = 100
        $hydrated = ['a' => '2026-03-15', 'b' => '2026-01-15', 'monthly' => 50];
        $this->assertSame(2, ComputedFieldEvaluator::evaluate($fields[2], $fields, $hydrated));
        $this->assertSame(100.0, ComputedFieldEvaluator::evaluate($fields[4], $fields, $hydrated));
    }

    public function test_cycle_detection_returns_null(): void
    {
        // C depende de D, D depende de C → ciclo.
        $fields = [
            $this->computed(1, 'c', 'sum', [2]),
            $this->computed(2, 'd', 'sum', [1]),
        ];
        $this->assertNull(ComputedFieldEvaluator::evaluate($fields[0], $fields, []));
    }

    public function test_self_reference_returns_null(): void
    {
        $fields = [
            $this->computed(1, 'c', 'abs', [1]), // referencia a sí mismo
        ];
        $this->assertNull(ComputedFieldEvaluator::evaluate($fields[0], $fields, []));
    }

    public function test_unknown_input_id_treated_as_null(): void
    {
        $fields = [
            $this->number(1, 'a'),
            $this->computed(2, 's', 'subtract', [1, 999]), // 999 no existe
        ];
        $this->assertNull(
            ComputedFieldEvaluator::evaluate($fields[1], $fields, ['a' => 100]),
        );
    }

    private function date(int $id, string $slug): FieldEntity
    {
        return new FieldEntity(
            id: $id, listId: 1, slug: $slug, columnName: 'col_' . $slug,
            label: ucfirst($slug), type: 'date', config: [],
            isRequired: false, isUnique: false, isPrimary: false,
            position: 0, createdAt: '', updatedAt: '', deletedAt: null,
        );
    }

    private function number(int $id, string $slug): FieldEntity
    {
        return new FieldEntity(
            id: $id, listId: 1, slug: $slug, columnName: 'col_' . $slug,
            label: ucfirst($slug), type: 'number', config: [],
            isRequired: false, isUnique: false, isPrimary: false,
            position: 0, createdAt: '', updatedAt: '', deletedAt: null,
        );
    }

    private function text(int $id, string $slug): FieldEntity
    {
        return new FieldEntity(
            id: $id, listId: 1, slug: $slug, columnName: 'col_' . $slug,
            label: ucfirst($slug), type: 'text', config: [],
            isRequired: false, isUnique: false, isPrimary: false,
            position: 0, createdAt: '', updatedAt: '', deletedAt: null,
        );
    }

    /**
     * @param array<int, int>      $inputs
     * @param array<string, mixed> $extras
     */
    private function computed(
        int $id,
        string $slug,
        string $operation,
        array $inputs,
        array $extras = [],
    ): FieldEntity {
        return new FieldEntity(
            id: $id, listId: 1, slug: $slug, columnName: '',
            label: ucfirst($slug),
            type: ComputedField::SLUG,
            config: array_merge(['operation' => $operation, 'inputs' => $inputs], $extras),
            isRequired: false, isUnique: false, isPrimary: false,
            position: 0, createdAt: '', updatedAt: '', deletedAt: null,
        );
    }
}
