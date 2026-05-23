<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\Permissions;

use ImaginaCRM\Permissions\CapabilityRegistry;
use ImaginaCRM\Permissions\ListPermissions;
use PHPUnit\Framework\TestCase;

/**
 * Cobertura del value object que representa el ACL serializado en
 * `wp_imcrm_lists.settings.permissions`.
 */
final class ListPermissionsTest extends TestCase
{
    public function test_fromListSettings_handles_empty_settings(): void
    {
        $acl = ListPermissions::fromListSettings([]);
        $this->assertSame([], $acl->toArray());
        $this->assertNull($acl->assignmentFieldId);
    }

    public function test_fromListSettings_parses_assignment_field_id(): void
    {
        $acl = ListPermissions::fromListSettings(['assignment_field_id' => 42]);
        $this->assertSame(42, $acl->assignmentFieldId);
    }

    public function test_fromListSettings_ignores_invalid_assignment_field_id(): void
    {
        $acl = ListPermissions::fromListSettings(['assignment_field_id' => 'not-numeric']);
        $this->assertNull($acl->assignmentFieldId);
    }

    public function test_fromListSettings_normalizes_partial_role_config(): void
    {
        $acl = ListPermissions::fromListSettings([
            'permissions' => [
                CapabilityRegistry::ROLE_AGENT => [
                    'view'   => 'own',
                    'create' => 1,
                    // edit/delete/fields_hidden faltan → defaults
                ],
            ],
        ]);

        $entry = $acl->forRole(CapabilityRegistry::ROLE_AGENT);
        $this->assertSame(ListPermissions::SCOPE_OWN, $entry['view']);
        $this->assertTrue($entry['create']);
        $this->assertSame(ListPermissions::SCOPE_NONE, $entry['edit']);
        $this->assertSame(ListPermissions::SCOPE_NONE, $entry['delete']);
        $this->assertSame([], $entry['fields_hidden']);
    }

    public function test_fromListSettings_skips_non_array_role_entries(): void
    {
        $acl = ListPermissions::fromListSettings([
            'permissions' => [
                CapabilityRegistry::ROLE_AGENT => 'not-an-array',
                CapabilityRegistry::ROLE_VIEWER => ['view' => 'all'],
            ],
        ]);

        $this->assertArrayNotHasKey(CapabilityRegistry::ROLE_AGENT, $acl->toArray());
        $this->assertSame(ListPermissions::SCOPE_ALL, $acl->forRole(CapabilityRegistry::ROLE_VIEWER)['view']);
    }

    public function test_forRole_admin_always_returns_full_bypass(): void
    {
        // Aunque NO esté declarado en settings.
        $acl = ListPermissions::fromListSettings([]);
        $entry = $acl->forRole(CapabilityRegistry::ROLE_ADMIN);
        $this->assertSame(ListPermissions::SCOPE_ALL, $entry['view']);
        $this->assertTrue($entry['create']);
        $this->assertSame(ListPermissions::SCOPE_ALL, $entry['edit']);
        $this->assertSame(ListPermissions::SCOPE_ALL, $entry['delete']);
    }

    public function test_forRole_administrator_native_wp_role_also_bypassed(): void
    {
        $acl = ListPermissions::fromListSettings([]);
        $entry = $acl->forRole('administrator');
        $this->assertSame(ListPermissions::SCOPE_ALL, $entry['view']);
        $this->assertTrue($entry['create']);
    }

    public function test_forRole_unknown_role_returns_none(): void
    {
        $acl = ListPermissions::fromListSettings([
            'permissions' => [
                CapabilityRegistry::ROLE_AGENT => ['view' => 'all'],
            ],
        ]);
        $entry = $acl->forRole('some_other_role_not_in_acl');
        $this->assertSame(ListPermissions::SCOPE_NONE, $entry['view']);
        $this->assertFalse($entry['create']);
    }

    public function test_forRole_legacy_defaults_used_when_no_permissions_in_settings(): void
    {
        // Una lista sin `permissions` debe leerse como "todo cerrado" para
        // crm_manager/agent/viewer — back-compat seguro post-migración.
        $acl = ListPermissions::fromListSettings([]);
        foreach ([CapabilityRegistry::ROLE_MANAGER, CapabilityRegistry::ROLE_AGENT, CapabilityRegistry::ROLE_VIEWER] as $role) {
            $entry = $acl->forRole($role);
            $this->assertSame(ListPermissions::SCOPE_NONE, $entry['view'], "{$role} should default to view=none");
            $this->assertFalse($entry['create'], "{$role} should default to create=false");
        }
    }

    /**
     * @dataProvider scopeMergeProvider
     */
    public function test_mergeScopes_takes_most_permissive(string $a, string $b, string $expected): void
    {
        $this->assertSame($expected, ListPermissions::mergeScopes($a, $b));
        $this->assertSame($expected, ListPermissions::mergeScopes($b, $a), 'merge must be commutative');
    }

    /**
     * @return array<string, array{0: string, 1: string, 2: string}>
     */
    public static function scopeMergeProvider(): array
    {
        return [
            'all beats own'        => [ListPermissions::SCOPE_ALL, ListPermissions::SCOPE_OWN, ListPermissions::SCOPE_ALL],
            'all beats none'       => [ListPermissions::SCOPE_ALL, ListPermissions::SCOPE_NONE, ListPermissions::SCOPE_ALL],
            'assigned beats own'   => [ListPermissions::SCOPE_ASSIGNED, ListPermissions::SCOPE_OWN, ListPermissions::SCOPE_ASSIGNED],
            'assigned beats none'  => [ListPermissions::SCOPE_ASSIGNED, ListPermissions::SCOPE_NONE, ListPermissions::SCOPE_ASSIGNED],
            'own beats none'       => [ListPermissions::SCOPE_OWN, ListPermissions::SCOPE_NONE, ListPermissions::SCOPE_OWN],
            'same scope'           => [ListPermissions::SCOPE_OWN, ListPermissions::SCOPE_OWN, ListPermissions::SCOPE_OWN],
            'all beats assigned'   => [ListPermissions::SCOPE_ALL, ListPermissions::SCOPE_ASSIGNED, ListPermissions::SCOPE_ALL],
        ];
    }

    public function test_normalizeScope_invalid_values_become_none(): void
    {
        $this->assertSame(ListPermissions::SCOPE_NONE, ListPermissions::normalizeScope('invalid'));
        $this->assertSame(ListPermissions::SCOPE_NONE, ListPermissions::normalizeScope(null));
        $this->assertSame(ListPermissions::SCOPE_NONE, ListPermissions::normalizeScope(42));
        $this->assertSame(ListPermissions::SCOPE_NONE, ListPermissions::normalizeScope(''));
    }

    public function test_normalizeScope_case_insensitive(): void
    {
        $this->assertSame(ListPermissions::SCOPE_ALL, ListPermissions::normalizeScope('ALL'));
        $this->assertSame(ListPermissions::SCOPE_OWN, ListPermissions::normalizeScope('Own'));
        $this->assertSame(ListPermissions::SCOPE_ASSIGNED, ListPermissions::normalizeScope('  assigned  '));
    }

    public function test_fields_hidden_normalized_to_unique_string_list(): void
    {
        $acl = ListPermissions::fromListSettings([
            'permissions' => [
                CapabilityRegistry::ROLE_VIEWER => [
                    'fields_hidden' => ['precio_costo', 'precio_costo', 'notas', 42, '', null],
                ],
            ],
        ]);
        $hidden = $acl->forRole(CapabilityRegistry::ROLE_VIEWER)['fields_hidden'];
        $this->assertSame(['precio_costo', 'notas'], $hidden);
    }
}
