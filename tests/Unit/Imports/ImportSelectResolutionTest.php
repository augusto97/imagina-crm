<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\Imports;

use ImaginaCRM\Fields\FieldEntity;
use ImaginaCRM\Imports\ImportService;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

/**
 * `ImportService::resolveSelectValue` debe mapear la etiqueta humana
 * del CSV (lo que ClickUp/Airtable persisten como valor) al `value`
 * (slug) de la opción correspondiente. Sin esto, valores como "sin
 * factura" o "Vencido" rebotaban contra `RecordValidator` con
 * "Opción no válida para este campo.".
 */
final class ImportSelectResolutionTest extends TestCase
{
    private function selectField(array $options): FieldEntity
    {
        return new FieldEntity(
            id: 1, listId: 1, slug: 'estado', columnName: 'col_estado',
            label: 'Estado', type: 'select',
            config: ['options' => $options],
            isRequired: false, isUnique: false, isPrimary: false,
            position: 0, createdAt: '', updatedAt: '', deletedAt: null,
        );
    }

    private function callResolve(string $raw, FieldEntity $field): string
    {
        $r = new ReflectionClass(ImportService::class);
        $m = $r->getMethod('resolveSelectValue');
        $m->setAccessible(true);
        return (string) $m->invoke(null, $raw, $field);
    }

    public function test_label_match_returns_value(): void
    {
        $field = $this->selectField([
            ['value' => 'al_dia', 'label' => 'Al día'],
            ['value' => 'vencido', 'label' => 'Vencido'],
        ]);
        $this->assertSame('al_dia', $this->callResolve('Al día', $field));
        $this->assertSame('vencido', $this->callResolve('Vencido', $field));
    }

    public function test_label_match_is_case_insensitive(): void
    {
        $field = $this->selectField([
            ['value' => 'al_dia', 'label' => 'Al día'],
        ]);
        $this->assertSame('al_dia', $this->callResolve('al día', $field));
        $this->assertSame('al_dia', $this->callResolve('AL DÍA', $field));
    }

    public function test_value_match_works_too(): void
    {
        // Si el CSV trae directamente el slug.
        $field = $this->selectField([
            ['value' => 'vencido', 'label' => 'Vencido'],
        ]);
        $this->assertSame('vencido', $this->callResolve('vencido', $field));
    }

    public function test_unmatched_returns_raw(): void
    {
        // Si no matchea y `expandSelectOptions` no corrió antes, el
        // validator rechaza con "Opción no válida".
        $field = $this->selectField([
            ['value' => 'al_dia', 'label' => 'Al día'],
        ]);
        $this->assertSame('algo_random', $this->callResolve('algo_random', $field));
    }

    public function test_empty_returns_empty(): void
    {
        $field = $this->selectField([['value' => 'a', 'label' => 'A']]);
        $this->assertSame('', $this->callResolve('', $field));
    }

    public function test_string_options_legacy_format(): void
    {
        // Backward-compat: opciones definidas como strings sueltos
        // ['Al día', 'Vencido'] (sin shape value/label).
        $field = $this->selectField(['Al día', 'Vencido']);
        $this->assertSame('Al día', $this->callResolve('al día', $field));
    }
}
