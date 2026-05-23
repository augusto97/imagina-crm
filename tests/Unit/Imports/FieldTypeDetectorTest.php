<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\Imports;

use ImaginaCRM\Imports\FieldTypeDetector;
use PHPUnit\Framework\TestCase;

final class FieldTypeDetectorTest extends TestCase
{
    public function test_empty_sample_falls_back_to_text(): void
    {
        $this->assertSame('text', FieldTypeDetector::detect([]));
        $this->assertSame('text', FieldTypeDetector::detect(['', '   ', '']));
    }

    public function test_detects_email(): void
    {
        $this->assertSame('email', FieldTypeDetector::detect([
            'a@x.com', 'b@y.com', 'c@z.org', 'd@w.net',
        ]));
    }

    public function test_detects_url(): void
    {
        $this->assertSame('url', FieldTypeDetector::detect([
            'https://x.com', 'http://y.com/abc', 'https://z.org',
        ]));
    }

    public function test_detects_number_us(): void
    {
        $this->assertSame('number', FieldTypeDetector::detect([
            '100', '250.50', '1000', '999.99',
        ]));
    }

    public function test_detects_number_es_format(): void
    {
        $this->assertSame('number', FieldTypeDetector::detect([
            '1.234,56', '850,00', '999,50', '12.000',
        ]));
    }

    public function test_detects_iso_date(): void
    {
        $this->assertSame('date', FieldTypeDetector::detect([
            '2026-01-15', '2026-02-28', '2026-03-10',
        ]));
    }

    public function test_detects_datetime_when_majority_have_time(): void
    {
        $this->assertSame('datetime', FieldTypeDetector::detect([
            '2026-01-15 10:30:00', '2026-02-28 14:00:00', '2026-03-10 09:15:00',
        ]));
    }

    public function test_detects_dd_mm_yyyy(): void
    {
        $this->assertSame('date', FieldTypeDetector::detect([
            '15/01/2026', '28/02/2026', '10/03/2026',
        ]));
    }

    public function test_detects_checkbox(): void
    {
        $this->assertSame('checkbox', FieldTypeDetector::detect([
            'sí', 'no', 'sí', 'no', 'sí',
        ]));
        $this->assertSame('checkbox', FieldTypeDetector::detect([
            'true', 'false', 'true', '1', '0',
        ]));
    }

    public function test_detects_select_low_cardinality(): void
    {
        // 3 valores únicos en 10 filas → select.
        $this->assertSame('select', FieldTypeDetector::detect([
            'Activo', 'Inactivo', 'Pendiente', 'Activo', 'Activo',
            'Pendiente', 'Inactivo', 'Activo', 'Pendiente', 'Activo',
        ]));
    }

    public function test_high_cardinality_stays_text(): void
    {
        // Todos únicos = no es un select.
        $this->assertSame('text', FieldTypeDetector::detect([
            'Una nota larga', 'Otra cosa diferente', 'Un tercer comentario',
            'Cuarto valor único', 'Quinto único',
        ]));
    }

    public function test_tolerates_some_noise(): void
    {
        // 4 emails de 5 valores = 80%, pasa el threshold.
        $this->assertSame('email', FieldTypeDetector::detect([
            'a@x.com', 'b@y.com', 'c@z.org', 'd@w.net', 'no-es-email',
        ]));
    }

    public function test_email_priority_over_url(): void
    {
        // Si todos son emails, gana email — no fallback a url o text.
        $this->assertSame('email', FieldTypeDetector::detect([
            'admin@example.com', 'user@test.org',
        ]));
    }
}
