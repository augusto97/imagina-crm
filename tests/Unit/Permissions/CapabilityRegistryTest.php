<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\Permissions;

use ImaginaCRM\Permissions\CapabilityRegistry;
use PHPUnit\Framework\TestCase;

/**
 * Cobertura del registro estático de capabilities + mapeos a roles default.
 *
 * No toca WP — todo es comprobación de integridad de los arrays.
 */
final class CapabilityRegistryTest extends TestCase
{
    public function test_allCapabilities_returns_non_empty_list_of_strings(): void
    {
        $caps = CapabilityRegistry::allCapabilities();
        $this->assertNotEmpty($caps);
        foreach ($caps as $cap) {
            $this->assertIsString($cap);
            $this->assertStringStartsWith('imcrm_', $cap);
        }
        $this->assertSame(array_values($caps), $caps, 'allCapabilities() must return a list');
    }

    public function test_allCapabilities_has_no_duplicates(): void
    {
        $caps = CapabilityRegistry::allCapabilities();
        $this->assertSame(count($caps), count(array_unique($caps)));
    }

    public function test_roles_returns_five_entries(): void
    {
        $roles = CapabilityRegistry::roles();
        $this->assertCount(5, $roles);
        $this->assertArrayHasKey(CapabilityRegistry::ROLE_ADMIN, $roles);
        $this->assertArrayHasKey(CapabilityRegistry::ROLE_MANAGER, $roles);
        $this->assertArrayHasKey(CapabilityRegistry::ROLE_AGENT, $roles);
        $this->assertArrayHasKey(CapabilityRegistry::ROLE_VIEWER, $roles);
        $this->assertArrayHasKey(CapabilityRegistry::ROLE_CLIENT, $roles);
    }

    public function test_every_role_in_defaults_exists_in_roles(): void
    {
        $defaults = CapabilityRegistry::defaultCapabilitiesByRole();
        $labels   = CapabilityRegistry::roles();
        foreach (array_keys($defaults) as $roleSlug) {
            $this->assertArrayHasKey(
                $roleSlug,
                $labels,
                "Role '{$roleSlug}' in defaults but missing from roles() label map"
            );
        }
    }

    public function test_every_cap_in_defaults_is_a_declared_plugin_cap(): void
    {
        $declared = CapabilityRegistry::allCapabilities();
        foreach (CapabilityRegistry::defaultCapabilitiesByRole() as $roleSlug => $caps) {
            foreach ($caps as $cap) {
                $this->assertContains(
                    $cap,
                    $declared,
                    "Cap '{$cap}' assigned to role '{$roleSlug}' is not in allCapabilities()"
                );
            }
        }
    }

    public function test_crm_admin_has_every_capability(): void
    {
        $defaults = CapabilityRegistry::defaultCapabilitiesByRole();
        $this->assertSame(
            CapabilityRegistry::allCapabilities(),
            $defaults[CapabilityRegistry::ROLE_ADMIN],
            'crm_admin must receive every plugin capability by default'
        );
    }

    public function test_crm_client_only_has_portal_access(): void
    {
        $defaults = CapabilityRegistry::defaultCapabilitiesByRole();
        $this->assertSame(
            [CapabilityRegistry::CAP_ACCESS_PORTAL],
            $defaults[CapabilityRegistry::ROLE_CLIENT],
            'crm_client must not have any admin capability — only portal access'
        );
    }

    public function test_crm_agent_only_has_own_record_scope(): void
    {
        $caps = CapabilityRegistry::defaultCapabilitiesByRole()[CapabilityRegistry::ROLE_AGENT];

        // Tiene scope `own` para view/edit/delete.
        $this->assertContains(CapabilityRegistry::CAP_VIEW_OWN_RECORDS, $caps);
        $this->assertContains(CapabilityRegistry::CAP_EDIT_OWN_RECORDS, $caps);
        $this->assertContains(CapabilityRegistry::CAP_DELETE_OWN_RECORDS, $caps);

        // No tiene scope total — eso lo expondría a records ajenos.
        $this->assertNotContains(CapabilityRegistry::CAP_VIEW_RECORDS, $caps);
        $this->assertNotContains(CapabilityRegistry::CAP_EDIT_RECORDS, $caps);
        $this->assertNotContains(CapabilityRegistry::CAP_DELETE_RECORDS, $caps);

        // No toca schema ni automatizaciones.
        $this->assertNotContains(CapabilityRegistry::CAP_MANAGE_LISTS, $caps);
        $this->assertNotContains(CapabilityRegistry::CAP_MANAGE_AUTOMATIONS, $caps);
    }

    public function test_isPluginCapability(): void
    {
        $this->assertTrue(CapabilityRegistry::isPluginCapability(CapabilityRegistry::CAP_ACCESS_ADMIN));
        $this->assertTrue(CapabilityRegistry::isPluginCapability(CapabilityRegistry::CAP_VIEW_RECORDS));

        $this->assertFalse(CapabilityRegistry::isPluginCapability('manage_options'));
        $this->assertFalse(CapabilityRegistry::isPluginCapability('imcrm_nonexistent_cap'));
        $this->assertFalse(CapabilityRegistry::isPluginCapability(''));
    }
}
