<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\Permissions;

use ImaginaCRM\Permissions\CapabilityRegistry;
use ImaginaCRM\Permissions\CustomRoleService;
use ImaginaCRM\Support\ValidationResult;
use PHPUnit\Framework\TestCase;

/**
 * Cobertura del CustomRoleService (Fase 10 — roles personalizados).
 */
final class CustomRoleServiceTest extends TestCase
{
    private CustomRoleService $service;

    protected function setUp(): void
    {
        imcrm_test_reset_options();
        $this->service = new CustomRoleService();
    }

    public function test_all_returns_empty_array_when_no_roles_persisted(): void
    {
        $this->assertSame([], $this->service->all());
    }

    public function test_save_creates_new_role(): void
    {
        $result = $this->service->save('senior_seller', 'Vendedor Senior', [
            CapabilityRegistry::CAP_ACCESS_ADMIN,
            CapabilityRegistry::CAP_VIEW_RECORDS,
            CapabilityRegistry::CAP_BULK_ACTIONS,
        ]);
        $this->assertTrue($result);

        $all = $this->service->all();
        $this->assertCount(1, $all);
        $this->assertSame('senior_seller', $all[0]['slug']);
        $this->assertSame('Vendedor Senior', $all[0]['label']);
        $this->assertCount(3, $all[0]['capabilities']);
    }

    public function test_save_updates_existing_role(): void
    {
        $this->service->save('test_role', 'Test Original', [CapabilityRegistry::CAP_ACCESS_ADMIN]);
        $result = $this->service->save('test_role', 'Test Actualizado', [
            CapabilityRegistry::CAP_ACCESS_ADMIN,
            CapabilityRegistry::CAP_VIEW_RECORDS,
        ]);
        $this->assertTrue($result);

        $all = $this->service->all();
        $this->assertCount(1, $all, 'Update no debería duplicar entradas');
        $this->assertSame('Test Actualizado', $all[0]['label']);
        $this->assertCount(2, $all[0]['capabilities']);
    }

    public function test_save_sanitizes_invalid_chars_in_slug(): void
    {
        // El saneo limpia chars no permitidos. `Bad-Slug!` → `badslug`
        // (lowercase + strip de chars no a-z0-9_). El admin probablemente
        // quería un slug válido — sanear es más amigable que rechazar.
        $result = $this->service->save('Bad-Slug!', 'Test', []);
        $this->assertTrue($result);
        $this->assertSame('badslug', $this->service->all()[0]['slug']);
    }

    public function test_save_rejects_slug_that_becomes_empty_after_sanitize(): void
    {
        // Si todos los chars son inválidos, el resultado post-saneo es
        // vacío → length < 3 → rechazo.
        $result = $this->service->save('!!!@@@###', 'Test', []);
        $this->assertInstanceOf(ValidationResult::class, $result);
        $this->assertArrayHasKey('slug', $result->errors());
    }

    public function test_save_rejects_slug_too_short(): void
    {
        $result = $this->service->save('xy', 'Test', []);
        $this->assertInstanceOf(ValidationResult::class, $result);
    }

    public function test_save_rejects_slug_too_long(): void
    {
        $result = $this->service->save(str_repeat('a', 51), 'Test', []);
        $this->assertInstanceOf(ValidationResult::class, $result);
    }

    public function test_save_rejects_empty_label(): void
    {
        $result = $this->service->save('valid_slug', '   ', []);
        $this->assertInstanceOf(ValidationResult::class, $result);
        $this->assertArrayHasKey('label', $result->errors());
    }

    public function test_save_strips_non_plugin_capabilities(): void
    {
        // Defensa: admin no puede asignar caps WP core (manage_options,
        // edit_posts, etc.) ni caps inventadas a los roles custom.
        $result = $this->service->save('mixed_role', 'Mixed', [
            CapabilityRegistry::CAP_ACCESS_ADMIN, // OK
            'manage_options',                     // NO — WP core
            'edit_posts',                         // NO — WP core
            'fake_cap_invented',                  // NO — no existe
            CapabilityRegistry::CAP_VIEW_RECORDS, // OK
        ]);
        $this->assertTrue($result);

        $caps = $this->service->all()[0]['capabilities'];
        $this->assertContains(CapabilityRegistry::CAP_ACCESS_ADMIN, $caps);
        $this->assertContains(CapabilityRegistry::CAP_VIEW_RECORDS, $caps);
        $this->assertNotContains('manage_options', $caps);
        $this->assertNotContains('edit_posts', $caps);
        $this->assertNotContains('fake_cap_invented', $caps);
    }

    public function test_save_deduplicates_capabilities(): void
    {
        $result = $this->service->save('dedup_role', 'Dedup', [
            CapabilityRegistry::CAP_VIEW_RECORDS,
            CapabilityRegistry::CAP_VIEW_RECORDS,
            CapabilityRegistry::CAP_VIEW_RECORDS,
        ]);
        $this->assertTrue($result);
        $this->assertCount(1, $this->service->all()[0]['capabilities']);
    }

    public function test_save_sanitizes_slug_to_lowercase(): void
    {
        $result = $this->service->save('Mixed_CASE_slug', 'Test', []);
        $this->assertTrue($result);
        $this->assertSame('mixed_case_slug', $this->service->all()[0]['slug']);
    }

    public function test_delete_removes_role(): void
    {
        $this->service->save('to_delete', 'To Delete', []);
        $this->assertCount(1, $this->service->all());

        $result = $this->service->delete('to_delete');
        $this->assertTrue($result);
        $this->assertCount(0, $this->service->all());
    }

    public function test_delete_rejects_unknown_slug(): void
    {
        $result = $this->service->delete('does_not_exist');
        $this->assertInstanceOf(ValidationResult::class, $result);
    }

    public function test_wp_role_slug_prefixes_with_namespace(): void
    {
        $this->assertSame(
            'crm_custom_my_role',
            $this->service->wpRoleSlug('my_role'),
        );
    }

    public function test_all_filters_corrupt_entries(): void
    {
        // Si el option fue tampered manualmente, all() ignora entries
        // que no tienen el shape esperado (no rompe).
        update_option(CustomRoleService::OPTION_KEY, [
            ['slug' => 'good', 'label' => 'Good', 'capabilities' => []],
            'not-an-array',
            ['slug' => '', 'label' => 'no slug', 'capabilities' => []],
            ['slug' => 'no_label', 'label' => '', 'capabilities' => []],
            null,
        ]);

        $all = $this->service->all();
        $this->assertCount(1, $all);
        $this->assertSame('good', $all[0]['slug']);
    }
}
