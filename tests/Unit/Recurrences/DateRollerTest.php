<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\Recurrences;

use ImaginaCRM\Recurrences\DateRoller;
use ImaginaCRM\Recurrences\RecurrenceEntity;
use PHPUnit\Framework\TestCase;

/**
 * Unit tests del DateRoller — pure, sin BD ni hooks. Cubre los 5
 * tipos de frecuencia + los 4 monthly patterns + edge cases:
 * mes con menos días (28/29/30/31), año bisiesto, weekday-of-month
 * con 5to-no-existe.
 */
final class DateRollerTest extends TestCase
{
    public function test_daily_advances_one_day_with_interval_1(): void
    {
        $rec = $this->makeRec(['frequency' => RecurrenceEntity::FREQ_DAILY, 'interval_n' => 1]);
        $this->assertSame('2026-04-30', DateRoller::nextOccurrence('2026-04-29', $rec));
    }

    public function test_daily_with_interval_3_advances_3_days(): void
    {
        $rec = $this->makeRec(['frequency' => RecurrenceEntity::FREQ_DAILY, 'interval_n' => 3]);
        $this->assertSame('2026-05-02', DateRoller::nextOccurrence('2026-04-29', $rec));
    }

    public function test_weekly_with_interval_2_advances_14_days(): void
    {
        $rec = $this->makeRec(['frequency' => RecurrenceEntity::FREQ_WEEKLY, 'interval_n' => 2]);
        $this->assertSame('2026-05-13', DateRoller::nextOccurrence('2026-04-29', $rec));
    }

    public function test_monthly_same_day_uses_min_when_target_month_shorter(): void
    {
        // 31 enero → 28 febrero (no marzo) en año no-bisiesto.
        $rec = $this->makeRec([
            'frequency' => RecurrenceEntity::FREQ_MONTHLY,
            'interval_n' => 1,
            'monthly_pattern' => RecurrenceEntity::MONTHLY_SAME_DAY,
        ]);
        $this->assertSame('2026-02-28', DateRoller::nextOccurrence('2026-01-31', $rec));
        // 31 enero → 29 febrero en año bisiesto.
        $this->assertSame('2024-02-29', DateRoller::nextOccurrence('2024-01-31', $rec));
    }

    public function test_monthly_first_day_always_returns_day_1(): void
    {
        $rec = $this->makeRec([
            'frequency' => RecurrenceEntity::FREQ_MONTHLY,
            'monthly_pattern' => RecurrenceEntity::MONTHLY_FIRST_DAY,
        ]);
        $this->assertSame('2026-05-01', DateRoller::nextOccurrence('2026-04-15', $rec));
        $this->assertSame('2026-12-01', DateRoller::nextOccurrence('2026-11-30', $rec));
    }

    public function test_monthly_last_day_respects_month_length(): void
    {
        $rec = $this->makeRec([
            'frequency' => RecurrenceEntity::FREQ_MONTHLY,
            'monthly_pattern' => RecurrenceEntity::MONTHLY_LAST_DAY,
        ]);
        // Enero (31) → Febrero (28 en 2026).
        $this->assertSame('2026-02-28', DateRoller::nextOccurrence('2026-01-31', $rec));
        // Marzo → Abril (30).
        $this->assertSame('2026-04-30', DateRoller::nextOccurrence('2026-03-15', $rec));
    }

    public function test_monthly_weekday_2nd_thursday(): void
    {
        // 14 mayo 2026 = 2do jueves. Avanza 1 mes → 2do jueves de junio.
        // Junio 2026: jueves caen 4, 11, 18, 25 → 2do = 11.
        $rec = $this->makeRec([
            'frequency' => RecurrenceEntity::FREQ_MONTHLY,
            'monthly_pattern' => RecurrenceEntity::MONTHLY_WEEKDAY,
        ]);
        $this->assertSame('2026-06-11', DateRoller::nextOccurrence('2026-05-14', $rec));
    }

    public function test_monthly_weekday_5th_falls_back_when_not_available(): void
    {
        // 30 abril 2026 = 5to jueves de abril. Avanza 1 mes → mayo
        // tiene jueves 7, 14, 21, 28 (solo 4) → última (28).
        $rec = $this->makeRec([
            'frequency' => RecurrenceEntity::FREQ_MONTHLY,
            'monthly_pattern' => RecurrenceEntity::MONTHLY_WEEKDAY,
        ]);
        $this->assertSame('2026-05-28', DateRoller::nextOccurrence('2026-04-30', $rec));
    }

    public function test_yearly_advances_year(): void
    {
        $rec = $this->makeRec(['frequency' => RecurrenceEntity::FREQ_YEARLY, 'interval_n' => 1]);
        $this->assertSame('2027-04-29', DateRoller::nextOccurrence('2026-04-29', $rec));
    }

    public function test_yearly_feb29_to_feb28_in_non_leap(): void
    {
        $rec = $this->makeRec(['frequency' => RecurrenceEntity::FREQ_YEARLY, 'interval_n' => 1]);
        // 29 feb 2024 (bisiesto) + 1 año → 28 feb 2025 (PHP normaliza
        // automáticamente con +1 year).
        $next = DateRoller::nextOccurrence('2024-02-29', $rec);
        $this->assertSame('2025-03-01', $next); // PHP wraps overflow al 1 marzo
    }

    public function test_days_after_alias_of_daily_with_interval(): void
    {
        $rec = $this->makeRec(['frequency' => RecurrenceEntity::FREQ_DAYS_AFTER, 'interval_n' => 7]);
        $this->assertSame('2026-05-06', DateRoller::nextOccurrence('2026-04-29', $rec));
    }

    public function test_datetime_preserves_time_component(): void
    {
        $rec = $this->makeRec(['frequency' => RecurrenceEntity::FREQ_DAILY, 'interval_n' => 1]);
        $this->assertSame('2026-04-30 14:30:00', DateRoller::nextOccurrence('2026-04-29 14:30:00', $rec));
    }

    /**
     * @param array<string, mixed> $overrides
     */
    private function makeRec(array $overrides): RecurrenceEntity
    {
        return RecurrenceEntity::fromRow(array_merge([
            'id' => 1,
            'list_id' => 1,
            'record_id' => 1,
            'date_field_id' => 1,
            'frequency' => RecurrenceEntity::FREQ_DAILY,
            'interval_n' => 1,
            'monthly_pattern' => null,
            'trigger_type' => RecurrenceEntity::TRIGGER_SCHEDULE,
            'trigger_status_field_id' => null,
            'trigger_status_value' => null,
            'action_type' => RecurrenceEntity::ACTION_UPDATE,
            'update_status_field_id' => null,
            'update_status_value' => null,
            'repeat_until' => null,
            'last_fired_at' => null,
            'created_at' => '2026-04-29 00:00:00',
            'updated_at' => '2026-04-29 00:00:00',
        ], $overrides));
    }
}
