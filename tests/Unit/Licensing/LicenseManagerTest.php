<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\Licensing;

use ImaginaCRM\Licensing\LicenseException;
use ImaginaCRM\Licensing\LicenseHttpClient;
use ImaginaCRM\Licensing\LicenseManager;
use ImaginaCRM\Licensing\LicenseState;
use ImaginaCRM\Support\ValidationResult;
use PHPUnit\Framework\TestCase;

/**
 * Stub del HTTP client que devuelve respuestas pre-programadas o lanza
 * excepciones. Usado por todos los tests del LicenseManager.
 */
final class StubLicenseHttpClient extends LicenseHttpClient
{
    /** @var array<int, array<string, mixed>|LicenseException> */
    public array $queue = [];

    /** @var array<int, array{action:string, key:string, siteUrl:string}> */
    public array $calls = [];

    public function call(string $action, string $key, string $siteUrl): array
    {
        $this->calls[] = ['action' => $action, 'key' => $key, 'siteUrl' => $siteUrl];

        if ($this->queue === []) {
            throw LicenseException::network('No queued response');
        }
        $next = array_shift($this->queue);
        if ($next instanceof LicenseException) {
            throw $next;
        }
        return $next;
    }
}

final class LicenseManagerTest extends TestCase
{
    private StubLicenseHttpClient $http;
    private LicenseManager $manager;

    protected function setUp(): void
    {
        imcrm_test_reset_options();
        $this->http    = new StubLicenseHttpClient();
        $this->manager = new LicenseManager($this->http);
    }

    public function test_initial_state_is_inactive(): void
    {
        $s = $this->manager->getState();
        $this->assertSame(LicenseState::STATUS_INACTIVE, $s->status);
        $this->assertFalse($s->isActive());
        $this->assertFalse($s->isValid());
    }

    public function test_activate_requires_non_empty_key(): void
    {
        $r = $this->manager->activate('   ');
        $this->assertInstanceOf(ValidationResult::class, $r);
        /** @var ValidationResult $r */
        $this->assertArrayHasKey('key', $r->errors());
    }

    public function test_activate_with_successful_response_persists_valid_state(): void
    {
        $this->http->queue[] = [
            'ok'                => true,
            'status'            => 'valid',
            'expires_at'        => '2027-01-01 00:00:00',
            'site_limit'        => 5,
            'activations_count' => 1,
        ];

        $state = $this->manager->activate('AAAA-BBBB-CCCC');
        $this->assertInstanceOf(LicenseState::class, $state);
        /** @var LicenseState $state */

        $this->assertSame(LicenseState::STATUS_VALID, $state->status);
        $this->assertTrue($state->isValid());
        $this->assertSame('2027-01-01 00:00:00', $state->expiresAt);
        $this->assertSame(5, $state->siteLimit);
        $this->assertSame(1, $state->activationsCount);
        $this->assertNotNull($state->activatedAt);
        $this->assertNotNull($state->lastCheckAt);

        // Persistido.
        $reloaded = $this->manager->getState();
        $this->assertSame(LicenseState::STATUS_VALID, $reloaded->status);
        $this->assertSame('AAAA-BBBB-CCCC', $reloaded->key);

        // Verificamos que el HTTP recibió el `action=activate`.
        $this->assertCount(1, $this->http->calls);
        $this->assertSame('activate', $this->http->calls[0]['action']);
    }

    public function test_activate_with_server_invalid_persists_invalid_state(): void
    {
        $this->http->queue[] = LicenseException::server('invalid', 'Clave revocada');

        $state = $this->manager->activate('BAD-KEY');
        $this->assertInstanceOf(LicenseState::class, $state);
        /** @var LicenseState $state */
        $this->assertSame(LicenseState::STATUS_INVALID, $state->status);
        $this->assertSame('Clave revocada', $state->message);
        $this->assertFalse($state->isValid());
    }

    public function test_activate_with_server_expired_persists_expired_state(): void
    {
        $this->http->queue[] = LicenseException::server('expired', 'License expired');

        $state = $this->manager->activate('OLD-KEY');
        $this->assertInstanceOf(LicenseState::class, $state);
        /** @var LicenseState $state */
        $this->assertSame(LicenseState::STATUS_EXPIRED, $state->status);
    }

    public function test_activate_with_server_site_limit_reached(): void
    {
        $this->http->queue[] = LicenseException::server('site_limit_reached', 'Too many sites');

        $state = $this->manager->activate('OVER-USED');
        $this->assertInstanceOf(LicenseState::class, $state);
        /** @var LicenseState $state */
        $this->assertSame(LicenseState::STATUS_SITE_LIMIT_REACHED, $state->status);
    }

    public function test_activate_network_failure_does_not_open_grace_period(): void
    {
        $this->http->queue[] = LicenseException::network('timeout');

        $state = $this->manager->activate('SOME-KEY');
        $this->assertInstanceOf(LicenseState::class, $state);
        /** @var LicenseState $state */
        $this->assertSame(LicenseState::STATUS_INACTIVE, $state->status);
        $this->assertNull($state->graceUntil);
        $this->assertSame('timeout', $state->message);
    }

    public function test_refresh_network_failure_opens_grace_when_currently_valid(): void
    {
        // Bootstrap: licencia activa.
        $this->http->queue[] = ['ok' => true, 'status' => 'valid', 'expires_at' => null];
        $this->manager->activate('VALID-KEY');

        // Refresh con red caída.
        $this->http->queue[] = LicenseException::network('DNS error');
        $state = $this->manager->refresh();

        $this->assertSame(LicenseState::STATUS_VALID, $state->status);
        $this->assertNotNull($state->graceUntil);
        $this->assertTrue($state->isInGrace());
        $this->assertTrue($state->isValid(), 'Within grace period the license must still be considered valid.');
        $this->assertSame('DNS error', $state->message);
    }

    public function test_refresh_server_invalid_overrides_grace(): void
    {
        $this->http->queue[] = ['ok' => true, 'status' => 'valid'];
        $this->manager->activate('K');

        $this->http->queue[] = LicenseException::server('invalid', 'Revoked');
        $state = $this->manager->refresh();

        $this->assertSame(LicenseState::STATUS_INVALID, $state->status);
        $this->assertNull($state->graceUntil);
    }

    public function test_refresh_recovery_clears_grace(): void
    {
        // Activa.
        $this->http->queue[] = ['ok' => true, 'status' => 'valid'];
        $this->manager->activate('K');

        // Caída de red → en gracia.
        $this->http->queue[] = LicenseException::network('timeout');
        $stateGrace = $this->manager->refresh();
        $this->assertNotNull($stateGrace->graceUntil);

        // Server vuelve OK → sale de gracia.
        $this->http->queue[] = ['ok' => true, 'status' => 'valid'];
        $stateRecovered = $this->manager->refresh();
        $this->assertNull($stateRecovered->graceUntil);
        $this->assertSame(LicenseState::STATUS_VALID, $stateRecovered->status);
    }

    public function test_refresh_when_inactive_is_a_noop(): void
    {
        $state = $this->manager->refresh();
        $this->assertSame(LicenseState::STATUS_INACTIVE, $state->status);
        $this->assertCount(0, $this->http->calls, 'No debe llamar al server cuando está inactiva.');
    }

    public function test_deactivate_clears_state_and_calls_server(): void
    {
        $this->http->queue[] = ['ok' => true, 'status' => 'valid'];
        $this->manager->activate('K');

        $this->http->queue[] = ['ok' => true, 'status' => 'valid']; // server respondería con OK al deactivate
        $state = $this->manager->deactivate();

        $this->assertSame(LicenseState::STATUS_INACTIVE, $state->status);
        $this->assertSame('', $state->key);

        // Llamó al server con action=deactivate.
        $deactivateCalls = array_filter($this->http->calls, static fn (array $c): bool => $c['action'] === 'deactivate');
        $this->assertCount(1, $deactivateCalls);
    }

    public function test_deactivate_tolerates_network_failure(): void
    {
        $this->http->queue[] = ['ok' => true, 'status' => 'valid'];
        $this->manager->activate('K');

        $this->http->queue[] = LicenseException::network('timeout');
        // No debería lanzar.
        $state = $this->manager->deactivate();
        $this->assertSame(LicenseState::STATUS_INACTIVE, $state->status);
    }

    public function test_deactivate_when_inactive_does_not_call_server(): void
    {
        $state = $this->manager->deactivate();
        $this->assertSame(LicenseState::STATUS_INACTIVE, $state->status);
        $this->assertCount(0, $this->http->calls);
    }

    public function test_dailyCheck_inactive_does_nothing(): void
    {
        $this->manager->dailyCheck();
        $this->assertCount(0, $this->http->calls);
    }

    public function test_dailyCheck_active_runs_refresh(): void
    {
        $this->http->queue[] = ['ok' => true, 'status' => 'valid'];
        $this->manager->activate('K');

        $this->http->queue[] = ['ok' => true, 'status' => 'valid'];
        $this->manager->dailyCheck();

        $validateCalls = array_filter($this->http->calls, static fn (array $c): bool => $c['action'] === 'validate');
        $this->assertCount(1, $validateCalls);
    }
}
