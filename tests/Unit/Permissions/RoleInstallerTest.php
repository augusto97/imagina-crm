<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\Permissions;

use ImaginaCRM\Permissions\CapabilityRegistry;
use ImaginaCRM\Permissions\RoleInstaller;
use PHPUnit\Framework\TestCase;
use WP_Role;

/**
 * Cobertura del instalador de roles. Usa los stubs de `WP_Role` /
 * `get_role` / `add_role` / `remove_role` definidos en `bootstrap.php`.
 */
final class RoleInstallerTest extends TestCase
{
    private RoleInstaller $installer;

    protected function setUp(): void
    {
        imcrm_test_reset_roles();
        $this->installer = new RoleInstaller();
    }

    public function test_sync_creates_all_five_plugin_roles(): void
    {
        $this->installer->sync();

        foreach (array_keys(CapabilityRegistry::roles()) as $slug) {
            $role = get_role($slug);
            $this->assertInstanceOf(
                WP_Role::class,
                $role,
                "Role '{$slug}' must exist after sync()"
            );
        }
    }

    public function test_sync_assigns_default_caps_to_each_role(): void
    {
        $this->installer->sync();

        $defaults = CapabilityRegistry::defaultCapabilitiesByRole();
        foreach ($defaults as $roleSlug => $caps) {
            $role = get_role($roleSlug);
            $this->assertNotNull($role);

            foreach ($caps as $cap) {
                $this->assertTrue(
                    $role->has_cap($cap),
                    "Role '{$roleSlug}' should have cap '{$cap}' after sync()"
                );
            }
        }
    }

    public function test_every_plugin_role_can_login(): void
    {
        // Todos los roles necesitan la cap WP `read` para poder hacer login.
        $this->installer->sync();

        foreach (array_keys(CapabilityRegistry::roles()) as $slug) {
            $role = get_role($slug);
            $this->assertNotNull($role);
            $this->assertTrue(
                $role->has_cap('read'),
                "Role '{$slug}' must have the WP-native 'read' cap"
            );
        }
    }

    public function test_administrator_gets_every_plugin_capability(): void
    {
        $this->installer->sync();

        $admin = get_role('administrator');
        $this->assertNotNull($admin);

        foreach (CapabilityRegistry::allCapabilities() as $cap) {
            $this->assertTrue(
                $admin->has_cap($cap),
                "administrator role should receive cap '{$cap}' for back-compat"
            );
        }
    }

    public function test_sync_is_idempotent(): void
    {
        $this->installer->sync();
        $beforeAdmin = get_role(CapabilityRegistry::ROLE_ADMIN);
        $beforeCount = count($beforeAdmin->capabilities);

        // Re-sync: nada cambia.
        $this->installer->sync();
        $afterAdmin = get_role(CapabilityRegistry::ROLE_ADMIN);

        $this->assertSame(
            $beforeCount,
            count($afterAdmin->capabilities),
            'sync() must be idempotent — caps count should not drift on repeated calls'
        );
    }

    public function test_sync_removes_obsolete_imcrm_caps_from_managed_roles(): void
    {
        // Simula un upgrade donde una cap antigua sigue presente en el rol
        // del plugin. Después de `sync()` la cap obsoleta debe quedar fuera.
        $this->installer->sync();
        $role = get_role(CapabilityRegistry::ROLE_VIEWER);
        $this->assertNotNull($role);
        $role->add_cap('imcrm_obsolete_cap_from_old_version');
        $this->assertTrue($role->has_cap('imcrm_obsolete_cap_from_old_version'));

        $this->installer->sync();

        $role = get_role(CapabilityRegistry::ROLE_VIEWER);
        $this->assertFalse(
            $role->has_cap('imcrm_obsolete_cap_from_old_version'),
            'sync() should drop imcrm_* caps that are no longer in the registry'
        );
    }

    public function test_sync_does_not_touch_non_imcrm_caps_on_plugin_roles(): void
    {
        // Sysadmin agrega una cap custom (otro plugin) al rol del CRM.
        // `sync()` no debe pisarla.
        $this->installer->sync();
        $role = get_role(CapabilityRegistry::ROLE_AGENT);
        $this->assertNotNull($role);
        $role->add_cap('woocommerce_view_orders');

        $this->installer->sync();

        $role = get_role(CapabilityRegistry::ROLE_AGENT);
        $this->assertTrue(
            $role->has_cap('woocommerce_view_orders'),
            'sync() must preserve caps without the imcrm_ prefix'
        );
    }

    public function test_uninstall_removes_all_plugin_roles_and_admin_caps(): void
    {
        $this->installer->sync();

        $this->installer->uninstall();

        foreach (array_keys(CapabilityRegistry::roles()) as $slug) {
            $this->assertNull(
                get_role($slug),
                "Role '{$slug}' must be removed on uninstall"
            );
        }

        $admin = get_role('administrator');
        $this->assertNotNull($admin, 'administrator role should never be removed');

        foreach (CapabilityRegistry::allCapabilities() as $cap) {
            $this->assertFalse(
                $admin->has_cap($cap),
                "administrator should lose plugin cap '{$cap}' on uninstall"
            );
        }
    }
}
