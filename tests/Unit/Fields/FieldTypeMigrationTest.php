<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\Fields;

use ImaginaCRM\Fields\FieldTypeMigration;
use PHPUnit\Framework\TestCase;

/**
 * Cubre el matrix de transiciones permitidas + la conversión de
 * valores por tipo. No toca el schema MySQL (eso vive en
 * `FieldService::changeType` y requiere integration test).
 */
final class FieldTypeMigrationTest extends TestCase
{
    public function test_identity_is_always_allowed(): void
    {
        $this->assertTrue(FieldTypeMigration::isAllowed('text', 'text'));
        $this->assertTrue(FieldTypeMigration::isAllowed('multi_select', 'multi_select'));
    }

    public function test_unknown_transition_blocked(): void
    {
        $this->assertFalse(FieldTypeMigration::isAllowed('text', 'date'));
        $this->assertFalse(FieldTypeMigration::isAllowed('relation', 'text'));
        $this->assertFalse(FieldTypeMigration::isAllowed('checkbox', 'select'));
    }

    public function test_allowed_transitions_for_text(): void
    {
        $allowed = FieldTypeMigration::allowedTransitions('text');
        $types   = array_column($allowed, 'type');
        $this->assertContains('long_text', $types);
        $this->assertContains('email', $types);
        $this->assertContains('url', $types);
    }

    public function test_risk_levels(): void
    {
        $this->assertSame('safe', FieldTypeMigration::riskOf('text', 'long_text'));
        $this->assertSame('lossy', FieldTypeMigration::riskOf('long_text', 'text'));
        $this->assertSame('destructive', FieldTypeMigration::riskOf('multi_select', 'select'));
        $this->assertNull(FieldTypeMigration::riskOf('text', 'date'));
    }

    public function test_text_to_long_text_preserves_value(): void
    {
        $this->assertSame(
            'hola mundo',
            FieldTypeMigration::migrateValue('hola mundo', 'text', 'long_text'),
        );
    }

    public function test_long_text_to_text_truncates_to_255(): void
    {
        $longString = str_repeat('a', 300);
        $result     = FieldTypeMigration::migrateValue($longString, 'long_text', 'text');
        $this->assertIsString($result);
        $this->assertSame(255, mb_strlen($result));
    }

    public function test_datetime_to_date_drops_time(): void
    {
        $this->assertSame(
            '2026-05-25',
            FieldTypeMigration::migrateValue('2026-05-25 14:30:00', 'datetime', 'date'),
        );
    }

    public function test_date_to_datetime_appends_zero_time(): void
    {
        $this->assertSame(
            '2026-05-25 00:00:00',
            FieldTypeMigration::migrateValue('2026-05-25', 'date', 'datetime'),
        );
    }

    public function test_select_to_multi_select_wraps_in_array(): void
    {
        $this->assertSame(
            ['vencido'],
            FieldTypeMigration::migrateValue('vencido', 'select', 'multi_select'),
        );
    }

    public function test_multi_select_to_select_keeps_only_first(): void
    {
        $this->assertSame(
            'urgente',
            FieldTypeMigration::migrateValue(['urgente', 'cliente_nuevo'], 'multi_select', 'select'),
        );
    }

    public function test_multi_select_to_select_empty_array_is_null(): void
    {
        $this->assertNull(FieldTypeMigration::migrateValue([], 'multi_select', 'select'));
    }

    public function test_number_to_currency_passthrough(): void
    {
        // Mismo SQL — el valor sale igual.
        $this->assertSame(1234.56, FieldTypeMigration::migrateValue(1234.56, 'number', 'currency'));
    }

    public function test_email_to_text_keeps_value(): void
    {
        $this->assertSame(
            'foo@bar.com',
            FieldTypeMigration::migrateValue('foo@bar.com', 'email', 'text'),
        );
    }

    public function test_text_to_email_rejects_invalid(): void
    {
        $this->assertNull(FieldTypeMigration::migrateValue('not an email', 'text', 'email'));
        $this->assertSame(
            'foo@bar.com',
            FieldTypeMigration::migrateValue('foo@bar.com', 'text', 'email'),
        );
    }

    public function test_text_to_url_rejects_invalid(): void
    {
        $this->assertNull(FieldTypeMigration::migrateValue('not a url', 'text', 'url'));
        $this->assertSame(
            'https://example.com',
            FieldTypeMigration::migrateValue('https://example.com', 'text', 'url'),
        );
    }

    public function test_null_and_empty_propagate(): void
    {
        $this->assertNull(FieldTypeMigration::migrateValue('', 'text', 'long_text'));
        $this->assertNull(FieldTypeMigration::migrateValue(null, 'datetime', 'date'));
    }
}
