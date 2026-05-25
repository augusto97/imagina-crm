<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\Imports;

use ImaginaCRM\Imports\ImportService;
use PHPUnit\Framework\TestCase;

/**
 * `ImportService::normalizeDate` debe aceptar todos los formatos
 * comunes de export externos (ClickUp human, Excel ES, ClickUp US,
 * ISO) y devolver una representación que `RecordValidator` acepte.
 */
final class ImportDateNormalizationTest extends TestCase
{
    public function test_iso_date_passes_through(): void
    {
        $this->assertSame('2026-04-15', ImportService::normalizeDate('2026-04-15', 'date'));
    }

    public function test_iso_datetime_with_time_strips_to_date_for_date_field(): void
    {
        // ClickUp emite "2024-07-23T00:00:00.000+00:00" para columnas
        // tipo "Due date" aunque el usuario solo haya elegido día. Si el
        // destino es un campo `date`, el cliente debe llegar a
        // `DateField::validate` con solo `YYYY-MM-DD` — caso contrario
        // rechaza por su validación estricta `Y-m-d`.
        $this->assertSame(
            '2024-07-23',
            ImportService::normalizeDate('2024-07-23T00:00:00.000+00:00', 'date'),
        );
        $this->assertSame(
            '2024-07-30',
            ImportService::normalizeDate('2024-07-30T00:00:00.000+00:00', 'date'),
        );
    }

    public function test_iso_datetime_with_time_passes_through_for_datetime_field(): void
    {
        // Para `datetime`, `DateTimeField::parse` acepta ISO 8601 nativo;
        // no hace falta tocar el string. El serializer normaliza después.
        $this->assertSame(
            '2024-07-23T00:00:00.000+00:00',
            ImportService::normalizeDate('2024-07-23T00:00:00.000+00:00', 'datetime'),
        );
    }

    public function test_clickup_human_date_only(): void
    {
        // El formato "Friday, November 21st 2025" es lo que ClickUp
        // emite en columnas tipo "Pagos recientes" del export CSV.
        $this->assertSame(
            '2025-11-21',
            ImportService::normalizeDate('Friday, November 21st 2025', 'date'),
        );
    }

    public function test_clickup_human_date_with_time_and_timezone(): void
    {
        // "Date Created" / "Date Updated" vienen con hora y timezone:
        //   "Wednesday, January 21st 2026, 5:29:08 pm -05:00"
        // Para `datetime` queremos "YYYY-MM-DD HH:MM:SS".
        $this->assertSame(
            '2026-01-21 17:29:08',
            ImportService::normalizeDate(
                'Wednesday, January 21st 2026, 5:29:08 pm -05:00',
                'datetime',
            ),
        );
    }

    public function test_clickup_human_date_to_date_field_strips_time(): void
    {
        // Si el destino es `date` (no `datetime`), descartamos la hora.
        $this->assertSame(
            '2021-10-25',
            ImportService::normalizeDate(
                'Monday, October 25th 2021, 10:31:36 am -05:00',
                'date',
            ),
        );
    }

    public function test_ordinal_suffixes(): void
    {
        // 1st / 2nd / 3rd / 21st / 22nd / 23rd — todos los sufijos ingleses.
        $this->assertSame('2026-05-01', ImportService::normalizeDate('Friday, May 1st 2026', 'date'));
        $this->assertSame('2026-05-02', ImportService::normalizeDate('Saturday, May 2nd 2026', 'date'));
        $this->assertSame('2026-05-23', ImportService::normalizeDate('Saturday, May 23rd 2026', 'date'));
    }

    public function test_excel_es_dd_mm_yyyy(): void
    {
        // 15 > 12 → forzosamente DD/MM.
        $this->assertSame('2026-01-15', ImportService::normalizeDate('15/01/2026', 'date'));
    }

    public function test_clickup_us_mm_dd_yyyy_when_unambiguous(): void
    {
        // 13 > 12 en segunda posición → MM/DD.
        $this->assertSame('2026-01-13', ImportService::normalizeDate('1/13/2026', 'date'));
    }

    public function test_ambiguous_slashed_defaults_to_dd_mm_es_locale(): void
    {
        // 5/4/2026 podría ser 5 abr (DD/MM ES) o 4 may (MM/DD US).
        // Default ES: DD/MM → 2026-04-05.
        $this->assertSame('2026-04-05', ImportService::normalizeDate('5/4/2026', 'date'));
    }

    public function test_two_digit_year_expands_to_2000s(): void
    {
        $this->assertSame('2025-11-21', ImportService::normalizeDate('21/11/25', 'date'));
    }

    public function test_unparseable_returns_original(): void
    {
        $this->assertSame('not-a-date', ImportService::normalizeDate('not-a-date', 'date'));
        $this->assertSame('xx', ImportService::normalizeDate('xx', 'date'));
    }
}
