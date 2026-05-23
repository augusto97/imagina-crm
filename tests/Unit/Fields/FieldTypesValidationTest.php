<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\Fields;

use ImaginaCRM\Fields\Types\CheckboxField;
use ImaginaCRM\Fields\Types\DateField;
use ImaginaCRM\Fields\Types\DateTimeField;
use ImaginaCRM\Fields\Types\MultiSelectField;
use ImaginaCRM\Fields\Types\NumberField;
use ImaginaCRM\Fields\Types\SelectField;
use ImaginaCRM\Fields\Types\TextField;
use PHPUnit\Framework\TestCase;

/**
 * Validación unitaria de los tipos de campo PUROS (no consultan WP/BD).
 *
 * `email`, `user`, `file` requieren funciones WordPress
 * (`is_email`, `get_userdata`, `get_post`) que no estubamos en el bootstrap
 * unitario; se verifican en el suite de integración.
 */
final class FieldTypesValidationTest extends TestCase
{
    public function test_text_required_rejects_empty(): void
    {
        $type   = new TextField();
        $result = $type->validate('', ['required' => true]);
        $this->assertFalse($result->isValid());
    }

    public function test_text_respects_max_length(): void
    {
        $type   = new TextField();
        $result = $type->validate(str_repeat('x', 100), ['max_length' => 50]);
        $this->assertFalse($result->isValid());

        $ok = $type->validate('hola', ['max_length' => 50]);
        $this->assertTrue($ok->isValid());
    }

    public function test_text_sql_definition_clamps_max_length(): void
    {
        $type = new TextField();
        $this->assertSame('VARCHAR(255) NULL', $type->getSqlDefinition([]));
        $this->assertSame('VARCHAR(120) NULL', $type->getSqlDefinition(['max_length' => 120]));
        // Out of range fallback al default.
        $this->assertSame('VARCHAR(255) NULL', $type->getSqlDefinition(['max_length' => 9999]));
        $this->assertSame('VARCHAR(255) NULL', $type->getSqlDefinition(['max_length' => 0]));
    }

    public function test_number_validates_range_and_type(): void
    {
        $type = new NumberField();

        $this->assertTrue($type->validate(10, [])->isValid());
        $this->assertTrue($type->validate('15.5', [])->isValid());
        $this->assertFalse($type->validate('abc', [])->isValid());

        $this->assertFalse($type->validate(5, ['min' => 10])->isValid());
        $this->assertFalse($type->validate(20, ['max' => 10])->isValid());
        $this->assertTrue($type->validate(15, ['min' => 10, 'max' => 20])->isValid());
    }

    public function test_number_sql_uses_bigint_when_precision_zero(): void
    {
        $type = new NumberField();
        $this->assertSame('BIGINT NULL', $type->getSqlDefinition(['precision' => 0]));
        $this->assertSame('DECIMAL(18,4) NULL', $type->getSqlDefinition([]));
        $this->assertSame('DECIMAL(18,2) NULL', $type->getSqlDefinition(['precision' => 2]));
        $this->assertSame('DECIMAL(18,8) NULL', $type->getSqlDefinition(['precision' => 99]));
    }

    public function test_select_only_accepts_configured_options(): void
    {
        $type   = new SelectField();
        $config = ['options' => [['value' => 'a', 'label' => 'A'], ['value' => 'b', 'label' => 'B']]];

        $this->assertTrue($type->validate('a', $config)->isValid());
        $this->assertTrue($type->validate('b', $config)->isValid());
        $this->assertFalse($type->validate('c', $config)->isValid());

        // Sin options: cualquier string es válido.
        $this->assertTrue($type->validate('cualquiera', [])->isValid());
    }

    public function test_multi_select_dedupes_on_serialize(): void
    {
        $type   = new MultiSelectField();
        $result = $type->serialize(['a', 'a', 'b', '', 'c'], []);
        $this->assertIsString($result);
        $this->assertSame(['a', 'b', 'c'], json_decode((string) $result, true));
    }

    public function test_multi_select_unserialize_handles_null_and_string(): void
    {
        $type = new MultiSelectField();
        $this->assertSame([], $type->unserialize(null, []));
        $this->assertSame([], $type->unserialize('', []));
        $this->assertSame(['x', 'y'], $type->unserialize('["x","y"]', []));
    }

    public function test_date_rejects_invalid_strings(): void
    {
        $type = new DateField();
        $this->assertTrue($type->validate('2026-04-25', [])->isValid());
        $this->assertFalse($type->validate('2026-13-40', [])->isValid());
        $this->assertFalse($type->validate('hoy', [])->isValid());
        $this->assertTrue($type->validate(null, [])->isValid()); // nullable
    }

    public function test_datetime_serialize_normalizes_to_utc(): void
    {
        $type = new DateTimeField();

        // Input con offset → UTC.
        $serialized = $type->serialize('2026-04-25T10:00:00-05:00', []);
        $this->assertSame('2026-04-25 15:00:00', $serialized);

        // Sin tz se asume server local; solo verificamos que sea string válido.
        $serialized2 = $type->serialize('2026-04-25 09:30:00', []);
        $this->assertIsString($serialized2);
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', (string) $serialized2);
    }

    public function test_checkbox_coerces_truthy_strings(): void
    {
        $type = new CheckboxField();
        $this->assertSame(1, $type->serialize('yes', []));
        $this->assertSame(1, $type->serialize('true', []));
        $this->assertSame(1, $type->serialize('1', []));
        $this->assertSame(1, $type->serialize(true, []));
        $this->assertSame(0, $type->serialize('no', []));
        $this->assertSame(0, $type->serialize('false', []));
        $this->assertSame(0, $type->serialize(false, []));
        $this->assertSame(0, $type->serialize(null, []));
    }

    public function test_checkbox_validation_accepts_common_inputs(): void
    {
        $type = new CheckboxField();
        foreach ([true, false, 0, 1, '0', '1', 'true', 'false', 'yes', 'no', null, ''] as $v) {
            $this->assertTrue(
                $type->validate($v, [])->isValid(),
                'CheckboxField should accept: ' . var_export($v, true)
            );
        }
        $this->assertFalse($type->validate(['array'], [])->isValid());
    }
}
