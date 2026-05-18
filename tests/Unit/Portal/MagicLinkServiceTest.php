<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\Portal;

use ImaginaCRM\Permissions\CapabilityRegistry;
use ImaginaCRM\Permissions\RoleInstaller;
use ImaginaCRM\Portal\MagicLinkService;
use ImaginaCRM\Support\ValidationResult;
use PHPUnit\Framework\TestCase;
use WP_User;

/**
 * Cobertura del MagicLinkService (Fase 10 — magic links).
 *
 * Verifica:
 *  - Tokens válidos: generate + consume devuelve el user_id correcto.
 *  - One-time: el mismo token no consume dos veces.
 *  - Validaciones de generate: user inexistente, user sin cap,
 *    URL inválida.
 *  - Validaciones de consume: token malformado, expirado, user
 *    borrado entre generate y consume, user perdió cap.
 *  - Hash storage: el token raw NO se guarda en el transient
 *    (defensa contra DB leak).
 */
final class MagicLinkServiceTest extends TestCase
{
    private MagicLinkService $service;

    protected function setUp(): void
    {
        imcrm_test_reset_roles();
        imcrm_test_reset_transients();
        (new RoleInstaller())->sync();
        $this->service = new MagicLinkService();

        // Crear fixture: un user crm_client con cap access_portal.
        $client = new WP_User(42, [CapabilityRegistry::ROLE_CLIENT]);
        $GLOBALS['imcrm_test_users']['id:42'] = $client;
    }

    public function test_generate_returns_url_with_token_for_valid_user(): void
    {
        $result = $this->service->generate(42, 'https://example.test/portal/');

        $this->assertIsArray($result);
        $this->assertArrayHasKey('token', $result);
        $this->assertArrayHasKey('url', $result);
        $this->assertArrayHasKey('expires_at', $result);

        $this->assertSame(64, strlen($result['token']));
        $this->assertStringStartsWith('https://example.test/portal/', $result['url']);
        $this->assertStringContainsString('imcrm_token=' . $result['token'], $result['url']);
        $this->assertGreaterThan(time(), $result['expires_at']);
    }

    public function test_generate_rejects_invalid_user_id(): void
    {
        $result = $this->service->generate(0, 'https://example.test/portal/');
        $this->assertInstanceOf(ValidationResult::class, $result);
    }

    public function test_generate_rejects_missing_user(): void
    {
        $result = $this->service->generate(999, 'https://example.test/portal/');
        $this->assertInstanceOf(ValidationResult::class, $result);
        $this->assertArrayHasKey('user_id', $result->errors());
    }

    public function test_generate_rejects_user_without_portal_cap(): void
    {
        // User existente sin rol crm_client → no tiene access_portal cap.
        $GLOBALS['imcrm_test_users']['id:99'] = new WP_User(99, ['crm_agent']);

        $result = $this->service->generate(99, 'https://example.test/portal/');
        $this->assertInstanceOf(ValidationResult::class, $result);
    }

    public function test_generate_rejects_invalid_url(): void
    {
        $result = $this->service->generate(42, 'not-a-url');
        $this->assertInstanceOf(ValidationResult::class, $result);
    }

    public function test_token_not_stored_raw_in_transient(): void
    {
        // Defensa crítica: si la BD se filtra, el atacante no debe
        // poder usar los tokens directamente.
        $generated = $this->service->generate(42, 'https://example.test/portal/');
        $this->assertIsArray($generated);

        $token = $generated['token'];
        // Buscar el token raw en cualquier transient.
        foreach ($GLOBALS['imcrm_test_transients'] as $key => $value) {
            $this->assertStringNotContainsString(
                $token,
                $key,
                'El token raw NO debe aparecer como key del transient',
            );
            // El valor es array con user_id — verificamos que el token
            // raw tampoco esté serializado.
            $serialized = serialize($value);
            $this->assertStringNotContainsString(
                $token,
                $serialized,
                'El token raw NO debe estar en el valor del transient',
            );
        }
    }

    public function test_consume_returns_user_id_for_valid_token(): void
    {
        $generated = $this->service->generate(42, 'https://example.test/portal/');
        $this->assertIsArray($generated);

        $result = $this->service->consume($generated['token']);
        $this->assertSame(42, $result);
    }

    public function test_consume_invalidates_token_after_use(): void
    {
        // One-time enforcement crítico.
        $generated = $this->service->generate(42, 'https://example.test/portal/');
        $this->assertIsArray($generated);

        $first = $this->service->consume($generated['token']);
        $this->assertSame(42, $first);

        // Segundo consume con el mismo token → null.
        $second = $this->service->consume($generated['token']);
        $this->assertNull($second);
    }

    public function test_consume_sets_auth_cookie_on_success(): void
    {
        $GLOBALS['imcrm_test_auth_cookies'] = [];
        $generated = $this->service->generate(42, 'https://example.test/portal/');
        $this->assertIsArray($generated);

        $this->service->consume($generated['token']);

        $this->assertCount(1, $GLOBALS['imcrm_test_auth_cookies']);
        $this->assertSame(42, $GLOBALS['imcrm_test_auth_cookies'][0]['user_id']);
    }

    public function test_consume_rejects_malformed_token(): void
    {
        $this->assertNull($this->service->consume(''));
        $this->assertNull($this->service->consume('short'));
        // Length 64 pero con char no-hex.
        $this->assertNull($this->service->consume(str_repeat('z', 64)));
        // Length distinta a 64.
        $this->assertNull($this->service->consume(str_repeat('a', 65)));
    }

    public function test_consume_rejects_unknown_token(): void
    {
        // Token aleatorio nunca generado.
        $fake = bin2hex(random_bytes(32));
        $this->assertNull($this->service->consume($fake));
    }

    public function test_consume_rejects_when_user_deleted_after_generate(): void
    {
        $generated = $this->service->generate(42, 'https://example.test/portal/');
        $this->assertIsArray($generated);

        // Admin borró al cliente entre generate y consume.
        unset($GLOBALS['imcrm_test_users']['id:42']);

        $result = $this->service->consume($generated['token']);
        $this->assertNull($result);
    }

    public function test_consume_rejects_when_user_lost_portal_cap(): void
    {
        $generated = $this->service->generate(42, 'https://example.test/portal/');
        $this->assertIsArray($generated);

        // Admin le quitó el rol crm_client al cliente entre generate
        // y consume — perdió la cap access_portal.
        $GLOBALS['imcrm_test_users']['id:42'] = new WP_User(42, []);

        $result = $this->service->consume($generated['token']);
        $this->assertNull($result);
    }

    public function test_consume_rejects_expired_token(): void
    {
        $generated = $this->service->generate(42, 'https://example.test/portal/');
        $this->assertIsArray($generated);

        // Simular expiración: marcar el transient como expired.
        $hash = hash('sha256', $generated['token']);
        $key = MagicLinkService::TRANSIENT_PREFIX . $hash;
        $GLOBALS['imcrm_test_transients_expired'][] = $key;

        $result = $this->service->consume($generated['token']);
        $this->assertNull($result);
    }

    public function test_failed_consume_does_not_set_auth_cookie(): void
    {
        $GLOBALS['imcrm_test_auth_cookies'] = [];

        // Token malformado.
        $this->service->consume('invalid');
        $this->assertCount(0, $GLOBALS['imcrm_test_auth_cookies']);

        // Token desconocido.
        $this->service->consume(bin2hex(random_bytes(32)));
        $this->assertCount(0, $GLOBALS['imcrm_test_auth_cookies']);
    }
}
