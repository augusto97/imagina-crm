<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\Records;

use ImaginaCRM\Fields\FieldEntity;
use ImaginaCRM\Fields\FieldTypeRegistry;
use ImaginaCRM\Records\RecordValidator;
use ImaginaCRM\Support\Database;
use ImaginaCRM\Tests\Unit\Stubs\FakeWpdb;
use PHPUnit\Framework\TestCase;

final class RecordValidatorTest extends TestCase
{
    private RecordValidator $validator;

    protected function setUp(): void
    {
        $this->validator = new RecordValidator(
            new FieldTypeRegistry(),
            new Database(new FakeWpdb()),
        );
    }

    public function test_required_field_missing_in_full_create_fails(): void
    {
        $fields = [$this->textField(true)];
        $result = $this->validator->validate($fields, [], partial: false);
        $this->assertFalse($result->isValid());
        $this->assertArrayHasKey('name', $result->errors());
    }

    public function test_required_field_missing_in_partial_update_is_ok(): void
    {
        $fields = [$this->textField(true)];
        $result = $this->validator->validate($fields, [], partial: true);
        $this->assertTrue($result->isValid());
    }

    public function test_invalid_value_per_type_is_reported_under_slug(): void
    {
        $fields = [$this->numberField()];
        $result = $this->validator->validate($fields, ['amount' => 'not a number'], partial: true);
        $this->assertFalse($result->isValid());
        $this->assertArrayHasKey('amount', $result->errors());
    }

    public function test_buildRow_serializes_only_known_fields(): void
    {
        $fields = [$this->textField(false), $this->numberField()];
        $row    = $this->validator->buildRow($fields, [
            'name'    => 'Acme',
            'amount'  => '42.5',
            'unknown' => 'ignored',
        ]);

        $this->assertSame(['col_name' => 'Acme', 'col_amount' => 42.5], $row);
    }

    public function test_buildRow_skips_relation_fields(): void
    {
        $fields = [
            $this->textField(false),
            new FieldEntity(
                id: 5, listId: 1, slug: 'owner', columnName: 'col_owner',
                label: 'Owner', type: 'relation', config: ['target_list_id' => 9],
                isRequired: false, isUnique: false, isPrimary: false,
                position: 5, createdAt: '', updatedAt: '', deletedAt: null,
            ),
        ];
        $row = $this->validator->buildRow($fields, ['name' => 'Acme', 'owner' => [1, 2, 3]]);

        // owner no debe aparecer en el row físico (vive en wp_imcrm_relations).
        $this->assertSame(['col_name' => 'Acme'], $row);
    }

    public function test_hydrateRow_returns_slug_keyed_payload(): void
    {
        $fields = [$this->textField(false), $this->numberField()];
        $hyd    = $this->validator->hydrateRow($fields, [
            'col_name'   => 'Acme',
            'col_amount' => '42.5',
        ]);
        $this->assertSame('Acme', $hyd['name']);
        $this->assertSame(42.5, $hyd['amount']);
    }

    private function textField(bool $required): FieldEntity
    {
        return new FieldEntity(
            id: 1, listId: 1, slug: 'name', columnName: 'col_name',
            label: 'Nombre', type: 'text', config: ['max_length' => 255],
            isRequired: $required, isUnique: false, isPrimary: false,
            position: 0, createdAt: '', updatedAt: '', deletedAt: null,
        );
    }

    private function numberField(): FieldEntity
    {
        return new FieldEntity(
            id: 2, listId: 1, slug: 'amount', columnName: 'col_amount',
            label: 'Monto', type: 'number', config: ['precision' => 2],
            isRequired: false, isUnique: false, isPrimary: false,
            position: 1, createdAt: '', updatedAt: '', deletedAt: null,
        );
    }
}
