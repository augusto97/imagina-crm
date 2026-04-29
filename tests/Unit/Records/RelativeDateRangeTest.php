<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\Records;

use DateTimeImmutable;
use DateTimeZone;
use ImaginaCRM\Records\RelativeDateRange;
use PHPUnit\Framework\TestCase;

/**
 * Pure tests del helper de presets relativos. El test pasa siempre
 * un `$now` fijo para que no dependa del reloj de CI.
 *
 * `now` para los tests: 2026-04-15 (miércoles), zona UTC.
 */
final class RelativeDateRangeTest extends TestCase
{
    private function now(): DateTimeImmutable
    {
        return new DateTimeImmutable('2026-04-15 14:30:00', new DateTimeZone('UTC'));
    }

    public function test_today_for_date_field(): void
    {
        $r = RelativeDateRange::compute('today', 'date', $this->now());
        $this->assertSame(['from' => '2026-04-15', 'to' => '2026-04-15'], $r);
    }

    public function test_today_for_datetime_field_covers_full_day(): void
    {
        $r = RelativeDateRange::compute('today', 'datetime', $this->now());
        $this->assertSame(
            ['from' => '2026-04-15 00:00:00', 'to' => '2026-04-15 23:59:59'],
            $r,
        );
    }

    public function test_yesterday(): void
    {
        $r = RelativeDateRange::compute('yesterday', 'date', $this->now());
        $this->assertSame(['from' => '2026-04-14', 'to' => '2026-04-14'], $r);
    }

    public function test_this_week_starts_monday(): void
    {
        // 2026-04-15 es miércoles → semana = 13 (lun) … 19 (dom).
        $r = RelativeDateRange::compute('this_week', 'date', $this->now());
        $this->assertSame(['from' => '2026-04-13', 'to' => '2026-04-19'], $r);
    }

    public function test_last_week(): void
    {
        $r = RelativeDateRange::compute('last_week', 'date', $this->now());
        $this->assertSame(['from' => '2026-04-06', 'to' => '2026-04-12'], $r);
    }

    public function test_this_month(): void
    {
        $r = RelativeDateRange::compute('this_month', 'date', $this->now());
        $this->assertSame(['from' => '2026-04-01', 'to' => '2026-04-30'], $r);
    }

    public function test_last_month_handles_year_boundary(): void
    {
        $jan = new DateTimeImmutable('2026-01-15', new DateTimeZone('UTC'));
        $r   = RelativeDateRange::compute('last_month', 'date', $jan);
        $this->assertSame(['from' => '2025-12-01', 'to' => '2025-12-31'], $r);
    }

    public function test_last_7_days_inclusive(): void
    {
        $r = RelativeDateRange::compute('last_7_days', 'date', $this->now());
        // 7 días incluye hoy → 9..15.
        $this->assertSame(['from' => '2026-04-09', 'to' => '2026-04-15'], $r);
    }

    public function test_last_30_days(): void
    {
        $r = RelativeDateRange::compute('last_30_days', 'date', $this->now());
        $this->assertSame(['from' => '2026-03-17', 'to' => '2026-04-15'], $r);
    }

    public function test_this_year(): void
    {
        $r = RelativeDateRange::compute('this_year', 'date', $this->now());
        $this->assertSame(['from' => '2026-01-01', 'to' => '2026-12-31'], $r);
    }

    public function test_last_year(): void
    {
        $r = RelativeDateRange::compute('last_year', 'date', $this->now());
        $this->assertSame(['from' => '2025-01-01', 'to' => '2025-12-31'], $r);
    }

    public function test_unknown_preset_returns_null(): void
    {
        $r = RelativeDateRange::compute('does_not_exist', 'date', $this->now());
        $this->assertNull($r);
    }

    public function test_isPreset_only_accepts_known_slugs(): void
    {
        $this->assertTrue(RelativeDateRange::isPreset('this_month'));
        $this->assertTrue(RelativeDateRange::isPreset('last_year'));
        $this->assertFalse(RelativeDateRange::isPreset(''));
        $this->assertFalse(RelativeDateRange::isPreset('custom'));
        $this->assertFalse(RelativeDateRange::isPreset('next_month'));
    }
}
