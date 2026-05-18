<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\Permissions;

use ImaginaCRM\Fields\FieldEntity;
use ImaginaCRM\Lists\ListEntity;
use ImaginaCRM\Permissions\CapabilityRegistry;
use ImaginaCRM\Permissions\ListPermissions;
use ImaginaCRM\Permissions\PermissionService;
use ImaginaCRM\Permissions\RoleInstaller;
use PHPUnit\Framework\TestCase;
use WP_User;

/**
 * Cobertura del servicio que combina caps globales + ACL por lista.
 *
 * Setup compartido: instala los 5 roles del plugin via `RoleInstaller`
 * (idempotente) y prepara closures resolvedoras de fields para los
 * tests que necesiten scope=assigned.
 */
final class PermissionServiceTest extends TestCase
{
    private PermissionService $service;

    /** @var array<int, FieldEntity> */
    private array $fieldFixtures = [];

    protected function setUp(): void
    {
        imcrm_test_reset_roles();
        (new RoleInstaller())->sync();

        $this->fieldFixtures = [];
        $this->service = new PermissionService(
            fn (int $id): ?FieldEntity => $this->fieldFixtures[$id] ?? null,
        );
    }

    // ───────────────────────────────────────────────────────────────────
    //  Acceso al admin SPA
    // ───────────────────────────────────────────────────────────────────

    public function test_administrator_can_access_admin(): void
    {
        $user = new WP_User(1, ['administrator']);
        $this->assertTrue($this->service->userCanAccessAdmin($user));
        $this->assertTrue($this->service->userIsPluginAdmin($user));
    }

    public function test_crm_admin_can_access_admin(): void
    {
        $user = new WP_User(2, [CapabilityRegistry::ROLE_ADMIN]);
        $this->assertTrue($this->service->userCanAccessAdmin($user));
        $this->assertTrue($this->service->userIsPluginAdmin($user));
    }

    public function test_crm_agent_can_access_admin_but_is_not_plugin_admin(): void
    {
        $user = new WP_User(3, [CapabilityRegistry::ROLE_AGENT]);
        $this->assertTrue($this->service->userCanAccessAdmin($user));
        $this->assertFalse($this->service->userIsPluginAdmin($user));
    }

    public function test_crm_client_cannot_access_admin(): void
    {
        $user = new WP_User(4, [CapabilityRegistry::ROLE_CLIENT]);
        $this->assertFalse($this->service->userCanAccessAdmin($user));
        $this->assertFalse($this->service->userIsPluginAdmin($user));
    }

    // ───────────────────────────────────────────────────────────────────
    //  Schema
    // ───────────────────────────────────────────────────────────────────

    public function test_only_admins_and_managers_with_cap_manage_schema(): void
    {
        $admin   = new WP_User(1, [CapabilityRegistry::ROLE_ADMIN]);
        $manager = new WP_User(2, [CapabilityRegistry::ROLE_MANAGER]);
        $agent   = new WP_User(3, [CapabilityRegistry::ROLE_AGENT]);
        $viewer  = new WP_User(4, [CapabilityRegistry::ROLE_VIEWER]);

        $this->assertTrue($this->service->userCanManageLists($admin));
        $this->assertFalse($this->service->userCanManageLists($manager), 'manager should not have manage_lists by default');
        $this->assertFalse($this->service->userCanManageLists($agent));
        $this->assertFalse($this->service->userCanManageLists($viewer));
    }

    // ───────────────────────────────────────────────────────────────────
    //  Visibilidad de lista
    // ───────────────────────────────────────────────────────────────────

    public function test_admin_sees_every_list_even_without_acl(): void
    {
        $user = new WP_User(1, [CapabilityRegistry::ROLE_ADMIN]);
        $list = $this->makeList(1, []); // sin settings.permissions
        $this->assertTrue($this->service->userCanSeeList($user, $list));
    }

    public function test_agent_does_not_see_list_without_acl(): void
    {
        // Back-compat seguro: una lista legacy (sin clave permissions) no
        // expone datos a roles no-admin hasta que el admin la configure.
        $user = new WP_User(3, [CapabilityRegistry::ROLE_AGENT]);
        $list = $this->makeList(1, []);
        $this->assertFalse($this->service->userCanSeeList($user, $list));
    }

    public function test_agent_sees_list_when_acl_grants_own_view(): void
    {
        $user = new WP_User(3, [CapabilityRegistry::ROLE_AGENT]);
        $list = $this->listWithAcl([
            CapabilityRegistry::ROLE_AGENT => ['view' => 'own'],
        ]);
        $this->assertTrue($this->service->userCanSeeList($user, $list));
    }

    public function test_multiple_roles_get_most_permissive_view(): void
    {
        // User es agent + viewer. Agent ve `own`, viewer ve `all`.
        // Esperado: ve `all` (más permisivo).
        $user = new WP_User(5, [CapabilityRegistry::ROLE_AGENT, CapabilityRegistry::ROLE_VIEWER]);
        $list = $this->listWithAcl([
            CapabilityRegistry::ROLE_AGENT  => ['view' => 'own'],
            CapabilityRegistry::ROLE_VIEWER => ['view' => 'all'],
        ]);

        $record = ['id' => 99, 'created_by' => 999]; // creado por otro user
        $this->assertTrue($this->service->userCanViewRecord($user, $list, $record));
    }

    // ───────────────────────────────────────────────────────────────────
    //  Records: scope=own
    // ───────────────────────────────────────────────────────────────────

    public function test_agent_with_scope_own_can_view_own_record(): void
    {
        $user = new WP_User(7, [CapabilityRegistry::ROLE_AGENT]);
        $list = $this->listWithAcl([
            CapabilityRegistry::ROLE_AGENT => ['view' => 'own'],
        ]);
        $own = ['id' => 1, 'created_by' => 7];
        $this->assertTrue($this->service->userCanViewRecord($user, $list, $own));
    }

    public function test_agent_with_scope_own_cannot_view_other_record(): void
    {
        $user = new WP_User(7, [CapabilityRegistry::ROLE_AGENT]);
        $list = $this->listWithAcl([
            CapabilityRegistry::ROLE_AGENT => ['view' => 'own'],
        ]);
        $other = ['id' => 1, 'created_by' => 99];
        $this->assertFalse($this->service->userCanViewRecord($user, $list, $other));
    }

    public function test_agent_with_scope_own_cannot_edit_record_he_did_not_create(): void
    {
        $user = new WP_User(7, [CapabilityRegistry::ROLE_AGENT]);
        $list = $this->listWithAcl([
            CapabilityRegistry::ROLE_AGENT => ['edit' => 'own'],
        ]);
        $other = ['id' => 1, 'created_by' => 99];
        $this->assertFalse($this->service->userCanEditRecord($user, $list, $other));
    }

    // ───────────────────────────────────────────────────────────────────
    //  Records: scope=assigned
    // ───────────────────────────────────────────────────────────────────

    public function test_assigned_scope_uses_assignment_field_column(): void
    {
        $this->fieldFixtures[42] = $this->makeField(42, 1, 'asignado_a');

        $user = new WP_User(7, [CapabilityRegistry::ROLE_AGENT]);
        $list = $this->makeList(1, [
            'permissions' => [
                CapabilityRegistry::ROLE_AGENT => ['view' => 'assigned'],
            ],
            'assignment_field_id' => 42,
        ]);

        $assigned    = ['id' => 1, 'created_by' => 99, 'asignado_a' => 7];
        $notAssigned = ['id' => 2, 'created_by' => 99, 'asignado_a' => 11];

        $this->assertTrue($this->service->userCanViewRecord($user, $list, $assigned));
        $this->assertFalse($this->service->userCanViewRecord($user, $list, $notAssigned));
    }

    public function test_assigned_scope_without_assignment_field_falls_closed(): void
    {
        // Si el admin elige scope=assigned pero no configuró
        // assignment_field_id, el user NO ve nada (fail-closed).
        $user = new WP_User(7, [CapabilityRegistry::ROLE_AGENT]);
        $list = $this->listWithAcl([
            CapabilityRegistry::ROLE_AGENT => ['view' => 'assigned'],
        ]);
        $rec = ['id' => 1, 'created_by' => 7];
        $this->assertFalse($this->service->userCanViewRecord($user, $list, $rec));
    }

    public function test_assigned_scope_with_field_from_other_list_falls_closed(): void
    {
        // Defensa contra mis-config: el campo de asignación apunta a otra
        // lista → ignoramos y bloqueamos.
        $this->fieldFixtures[42] = $this->makeField(42, 999, 'asignado_a'); // listId distinto

        $user = new WP_User(7, [CapabilityRegistry::ROLE_AGENT]);
        $list = $this->makeList(1, [
            'permissions' => [
                CapabilityRegistry::ROLE_AGENT => ['view' => 'assigned'],
            ],
            'assignment_field_id' => 42,
        ]);

        $this->assertFalse($this->service->userCanViewRecord($user, $list, ['id' => 1, 'asignado_a' => 7]));
    }

    // ───────────────────────────────────────────────────────────────────
    //  Records: scope=all
    // ───────────────────────────────────────────────────────────────────

    public function test_viewer_with_scope_all_sees_every_record_but_cannot_edit(): void
    {
        $user = new WP_User(8, [CapabilityRegistry::ROLE_VIEWER]);
        $list = $this->listWithAcl([
            CapabilityRegistry::ROLE_VIEWER => ['view' => 'all', 'edit' => 'none', 'delete' => 'none'],
        ]);
        $rec = ['id' => 1, 'created_by' => 999];
        $this->assertTrue($this->service->userCanViewRecord($user, $list, $rec));
        $this->assertFalse($this->service->userCanEditRecord($user, $list, $rec));
        $this->assertFalse($this->service->userCanDeleteRecord($user, $list, $rec));
    }

    // ───────────────────────────────────────────────────────────────────
    //  Records: scope=none
    // ───────────────────────────────────────────────────────────────────

    public function test_scope_none_blocks_all_operations(): void
    {
        $user = new WP_User(9, [CapabilityRegistry::ROLE_AGENT]);
        $list = $this->listWithAcl([
            CapabilityRegistry::ROLE_AGENT => [
                'view' => 'none', 'edit' => 'none', 'delete' => 'none',
            ],
        ]);
        $rec = ['id' => 1, 'created_by' => 9];
        $this->assertFalse($this->service->userCanViewRecord($user, $list, $rec));
        $this->assertFalse($this->service->userCanEditRecord($user, $list, $rec));
        $this->assertFalse($this->service->userCanDeleteRecord($user, $list, $rec));
    }

    // ───────────────────────────────────────────────────────────────────
    //  Create
    // ───────────────────────────────────────────────────────────────────

    public function test_create_requires_both_cap_and_acl(): void
    {
        $viewer = new WP_User(10, [CapabilityRegistry::ROLE_VIEWER]);
        $list   = $this->listWithAcl([
            CapabilityRegistry::ROLE_VIEWER => ['create' => true], // viewer no tiene cap create_records
        ]);
        $this->assertFalse(
            $this->service->userCanCreateInList($viewer, $list),
            'crm_viewer no tiene imcrm_create_records — debe fallar incluso si ACL lo permite'
        );

        $agent = new WP_User(11, [CapabilityRegistry::ROLE_AGENT]);
        $this->assertFalse(
            $this->service->userCanCreateInList($agent, $list),
            'crm_agent tiene la cap, pero el ACL no le permite create — debe fallar'
        );

        $list2 = $this->listWithAcl([
            CapabilityRegistry::ROLE_AGENT => ['create' => true],
        ]);
        $this->assertTrue($this->service->userCanCreateInList($agent, $list2));
    }

    // ───────────────────────────────────────────────────────────────────
    //  recordsScopeWhere
    // ───────────────────────────────────────────────────────────────────

    public function test_recordsScopeWhere_admin_returns_no_filter(): void
    {
        $user = new WP_User(1, [CapabilityRegistry::ROLE_ADMIN]);
        $list = $this->listWithAcl([]);
        $out  = $this->service->recordsScopeWhere($user, $list);
        $this->assertSame('', $out['sql']);
        $this->assertSame([], $out['args']);
    }

    public function test_recordsScopeWhere_scope_own_emits_created_by_filter(): void
    {
        $user = new WP_User(42, [CapabilityRegistry::ROLE_AGENT]);
        $list = $this->listWithAcl([
            CapabilityRegistry::ROLE_AGENT => ['view' => 'own'],
        ]);
        $out = $this->service->recordsScopeWhere($user, $list, 'r');
        $this->assertSame('AND `r`.`created_by` = %d', $out['sql']);
        $this->assertSame([42], $out['args']);
    }

    public function test_recordsScopeWhere_scope_none_emits_blocking_clause(): void
    {
        $user = new WP_User(9, [CapabilityRegistry::ROLE_VIEWER]);
        $list = $this->listWithAcl([
            CapabilityRegistry::ROLE_VIEWER => ['view' => 'none'],
        ]);
        $out = $this->service->recordsScopeWhere($user, $list);
        $this->assertSame('AND 1=0', $out['sql']);
        $this->assertSame([], $out['args']);
    }

    public function test_recordsScopeWhere_scope_assigned_uses_assignment_column(): void
    {
        $this->fieldFixtures[42] = $this->makeField(42, 1, 'asignado_a');

        $user = new WP_User(7, [CapabilityRegistry::ROLE_AGENT]);
        $list = $this->makeList(1, [
            'permissions' => [
                CapabilityRegistry::ROLE_AGENT => ['view' => 'assigned'],
            ],
            'assignment_field_id' => 42,
        ]);

        $out = $this->service->recordsScopeWhere($user, $list, 'r');
        $this->assertSame('AND `r`.`asignado_a` = %d', $out['sql']);
        $this->assertSame([7], $out['args']);
    }

    public function test_recordsScopeWhere_assigned_without_field_falls_closed(): void
    {
        $user = new WP_User(7, [CapabilityRegistry::ROLE_AGENT]);
        $list = $this->listWithAcl([
            CapabilityRegistry::ROLE_AGENT => ['view' => 'assigned'],
        ]);
        $out = $this->service->recordsScopeWhere($user, $list);
        $this->assertSame('AND 1=0', $out['sql']);
    }

    // ───────────────────────────────────────────────────────────────────
    //  hiddenFieldSlugs (intersección)
    // ───────────────────────────────────────────────────────────────────

    public function test_hiddenFieldSlugs_takes_intersection_across_roles(): void
    {
        $user = new WP_User(5, [CapabilityRegistry::ROLE_AGENT, CapabilityRegistry::ROLE_VIEWER]);
        $list = $this->listWithAcl([
            CapabilityRegistry::ROLE_AGENT  => ['fields_hidden' => ['precio_costo', 'notas_internas']],
            CapabilityRegistry::ROLE_VIEWER => ['fields_hidden' => ['precio_costo']],
        ]);
        // Solo `precio_costo` está oculto en AMBOS roles. `notas_internas`
        // visible porque viewer no la oculta.
        $this->assertSame(['precio_costo'], $this->service->hiddenFieldSlugs($user, $list));
    }

    public function test_hiddenFieldSlugs_empty_for_admin(): void
    {
        $user = new WP_User(1, [CapabilityRegistry::ROLE_ADMIN]);
        $list = $this->listWithAcl([
            CapabilityRegistry::ROLE_ADMIN => ['fields_hidden' => ['x']],
        ]);
        $this->assertSame([], $this->service->hiddenFieldSlugs($user, $list));
    }

    // ───────────────────────────────────────────────────────────────────
    //  Helpers
    // ───────────────────────────────────────────────────────────────────

    /**
     * @param array<string, mixed> $settings
     */
    private function makeList(int $id, array $settings): ListEntity
    {
        return new ListEntity(
            id:          $id,
            slug:        'test_list_' . $id,
            tableSuffix: 'tl' . $id,
            name:        'Test list',
            description: null,
            icon:        null,
            color:       null,
            settings:    $settings,
            position:    0,
            createdBy:   1,
            createdAt:   '2026-05-17 00:00:00',
            updatedAt:   '2026-05-17 00:00:00',
            deletedAt:   null,
        );
    }

    /**
     * Atajo: crea una lista con el shape `{permissions: {...}}` y nada más.
     *
     * @param array<string, array<string, mixed>> $permsByRole
     */
    private function listWithAcl(array $permsByRole): ListEntity
    {
        return $this->makeList(1, ['permissions' => $permsByRole]);
    }

    private function makeField(int $id, int $listId, string $columnName): FieldEntity
    {
        return new FieldEntity(
            id:          $id,
            listId:      $listId,
            slug:        $columnName,
            columnName:  $columnName,
            label:       ucfirst($columnName),
            type:        'user',
            config:      [],
            isRequired:  false,
            isUnique:    false,
            isPrimary:   false,
            position:    0,
            createdAt:   '2026-05-17 00:00:00',
            updatedAt:   '2026-05-17 00:00:00',
            deletedAt:   null,
        );
    }
}
