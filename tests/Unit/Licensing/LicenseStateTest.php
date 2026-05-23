<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\Licensing;

use ImaginaCRM\Licensing\LicenseState;
use PHPUnit\Framework\TestCase;

final class LicenseStateTest extends TestCase
{
    public function test_inactive_factory_returns_empty_state(): void
    {
        $s = LicenseState::inactive();
        $this->assertSame(LicenseState::STATUS_INACTIVE, $s->status);
        $this->assertSame('', $s->key);
        $this->assertFalse($s->isActive());
        $this->assertFalse($s->isValid());
    }

    public function test_isValid_true_only_when_status_valid_or_in_grace(): void
    {
        $valid = new LicenseState('K', LicenseState::STATUS_VALID, null, null, null, null, null, null, null);
        $this->assertTrue($valid->isValid());

        $invalid = new LicenseState('K', LicenseState::STATUS_INVALID, null, null, null, null, null, null, null);
        $this->assertFalse($invalid->isValid());

        $expired = new LicenseState('K', LicenseState::STATUS_EXPIRED, null, null, null, null, null, null, null);
        $this->assertFalse($expired->isValid());

        $inGrace = new LicenseState(
            key: 'K',
            status: LicenseState::STATUS_VALID,
            activatedAt: null,
            expiresAt: null,
            lastCheckAt: null,
            graceUntil: gmdate('Y-m-d H:i:s', time() + 3600),
            siteLimit: null,
            activationsCount: null,
            message: null,
        );
        $this->assertTrue($inGrace->isValid());
        $this->assertTrue($inGrace->isInGrace());

        $expiredGrace = new LicenseState(
            key: 'K',
            status: LicenseState::STATUS_INVALID,
            activatedAt: null,
            expiresAt: null,
            lastCheckAt: null,
            graceUntil: gmdate('Y-m-d H:i:s', time() - 3600),
            siteLimit: null,
            activationsCount: null,
            message: null,
        );
        $this->assertFalse($expiredGrace->isValid(), 'Grace period in the past should not extend validity.');
        $this->assertFalse($expiredGrace->isInGrace());
    }

    public function test_fromArray_normalizes_unknown_status_to_inactive(): void
    {
        $s = LicenseState::fromArray(['status' => 'made_up']);
        $this->assertSame(LicenseState::STATUS_INACTIVE, $s->status);
    }

    public function test_fromArray_round_trip_with_toArray(): void
    {
        $original = new LicenseState(
            key: 'AAAA-BBBB-CCCC',
            status: LicenseState::STATUS_VALID,
            activatedAt: '2026-01-01 00:00:00',
            expiresAt: '2027-01-01 00:00:00',
            lastCheckAt: '2026-04-25 12:00:00',
            graceUntil: null,
            siteLimit: 5,
            activationsCount: 2,
            message: null,
        );
        $copy = LicenseState::fromArray($original->toArray());
        $this->assertEquals($original, $copy);
    }

    public function test_maskedKey_hides_middle(): void
    {
        $s = new LicenseState('AAAA-BBBB-CCCC-DDDD', LicenseState::STATUS_VALID, null, null, null, null, null, null, null);
        $masked = $s->maskedKey();
        $this->assertStringStartsWith('AAAA', $masked);
        $this->assertStringEndsWith('DDDD', $masked);
        // `•` es UTF-8 multibyte; comparamos por caracteres, no por bytes.
        $this->assertSame(mb_strlen('AAAA-BBBB-CCCC-DDDD'), mb_strlen($masked));
        $this->assertStringNotContainsString('BBBB', $masked);
        $this->assertStringNotContainsString('CCCC', $masked);
    }

    public function test_maskedKey_short_keys_fully_masked(): void
    {
        $s = new LicenseState('abc12', LicenseState::STATUS_VALID, null, null, null, null, null, null, null);
        $this->assertSame(str_repeat('•', 5), $s->maskedKey());
    }

    public function test_toPublicArray_masks_key_and_includes_flags(): void
    {
        $s = new LicenseState(
            key: 'XXXX-YYYY-ZZZZ-WWWW',
            status: LicenseState::STATUS_VALID,
            activatedAt: null,
            expiresAt: null,
            lastCheckAt: null,
            graceUntil: gmdate('Y-m-d H:i:s', time() + 3600),
            siteLimit: null,
            activationsCount: null,
            message: null,
        );
        $public = $s->toPublicArray();

        $this->assertArrayHasKey('is_valid', $public);
        $this->assertArrayHasKey('in_grace', $public);
        $this->assertTrue($public['is_valid']);
        $this->assertTrue($public['in_grace']);
        $this->assertNotSame('XXXX-YYYY-ZZZZ-WWWW', $public['key']);
        $this->assertStringStartsWith('XXXX', (string) $public['key']);
    }
}
