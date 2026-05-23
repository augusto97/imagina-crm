<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\Portal;

use ImaginaCRM\Fields\FieldEntity;
use ImaginaCRM\Lists\ListEntity;
use ImaginaCRM\Portal\ClientResolverInterface;
use ImaginaCRM\Portal\PortalScopeService;
use PHPUnit\Framework\TestCase;
use WP_User;

/**
 * Tests de aislamiento del portal (Fase 9 — 3.A).
 *
 * Cobertura OBLIGATORIA (ver `docs/multi-stakeholder-design.md` §3.6):
 * cualquier mis-config, ausencia de datos o intento de acceso fuera de
 * scope DEBE producir `AND 1=0` — el cliente NO puede ver nada en esas
 * condiciones. Cualquier failure de un test acá es un data leak en
 * producción.
 */
final class PortalScopeServiceTest extends TestCase
{
    private const RELATIONS_TABLE = 'wp_imcrm_relations';

    public function test_user_with_no_id_blocks_everything(): void
    {
        $service = $this->makeService(
            portalList: $this->makePortalList(1, ownerFieldId: 10),
            clientRecord: null, // resolver devuelve null para user inválido
            fieldsForList: fn () => [],
        );

        $list = $this->makePortalList(1, ownerFieldId: 10);
        $result = $service->recordsScopeWhere(new WP_User(0), $list);

        $this->assertSame('AND 1=0', $result['sql']);
        $this->assertSame([], $result['args']);
    }

    public function test_no_portal_list_configured_blocks_everything(): void
    {
        $service = $this->makeService(
            portalList: null,
            clientRecord: null,
            fieldsForList: fn () => [],
        );

        $someList = $this->makeList(99, 'random');
        $result = $service->recordsScopeWhere(new WP_User(42), $someList);

        $this->assertSame('AND 1=0', $result['sql']);
    }

    public function test_user_without_associated_record_blocks_everything(): void
    {
        $service = $this->makeService(
            portalList: $this->makePortalList(1, ownerFieldId: 10),
            clientRecord: null, // user logged-in pero sin record en lista portal
            fieldsForList: fn () => [],
        );

        $list = $this->makePortalList(1, ownerFieldId: 10);
        $result = $service->recordsScopeWhere(new WP_User(42), $list);

        $this->assertSame('AND 1=0', $result['sql']);
    }

    public function test_portal_list_scopes_to_own_record_id(): void
    {
        $portalList = $this->makePortalList(1, ownerFieldId: 10);
        $service = $this->makeService(
            portalList: $portalList,
            clientRecord: ['id' => 7],
            fieldsForList: fn () => [],
        );

        $result = $service->recordsScopeWhere(new WP_User(42), $portalList);

        $this->assertSame('AND `id` = %d', $result['sql']);
        $this->assertSame([7], $result['args']);
    }

    public function test_portal_list_scopes_use_own_id_not_user_id(): void
    {
        // Crítico: la columna que filtramos es `id` del record, NO
        // el `user_id`. Si en algún momento se confunde y filtramos
        // por user_id (que coincide con el index de wp_users), un
        // cliente con user_id=N podría ver el record con id=N de
        // OTRO cliente. Este test garantiza que no.
        $portalList = $this->makePortalList(1, ownerFieldId: 10);
        $service = $this->makeService(
            portalList: $portalList,
            clientRecord: ['id' => 999],
            fieldsForList: fn () => [],
        );

        $result = $service->recordsScopeWhere(new WP_User(42), $portalList);

        $this->assertSame([999], $result['args']);
        $this->assertNotSame([42], $result['args'], 'Scope debe usar record_id, NO user_id');
    }

    public function test_non_portal_list_with_user_field_scopes_to_user(): void
    {
        $portalList = $this->makePortalList(1, ownerFieldId: 10);
        $invoicesList = $this->makeList(5, 'facturas');

        $ownerField = $this->makeField(20, listId: 5, slug: 'creado_por', col: 'col_creado_por', type: 'user');

        $service = $this->makeService(
            portalList: $portalList,
            clientRecord: ['id' => 7],
            fieldsForList: fn (int $listId) => $listId === 5 ? [$ownerField] : [],
        );

        $result = $service->recordsScopeWhere(new WP_User(42), $invoicesList);

        $this->assertSame('AND `col_creado_por` = %d', $result['sql']);
        $this->assertSame([42], $result['args']);
    }

    public function test_non_portal_list_with_relation_to_portal_uses_subquery(): void
    {
        $portalList = $this->makePortalList(1, ownerFieldId: 10);
        $invoicesList = $this->makeList(5, 'facturas');

        // Field relation que apunta a la lista de portal (config.target_list_id = 1).
        $relationField = $this->makeField(
            id: 30,
            listId: 5,
            slug: 'cliente',
            col: 'col_cliente',
            type: 'relation',
            config: ['target_list_id' => 1],
        );

        $service = $this->makeService(
            portalList: $portalList,
            clientRecord: ['id' => 7],
            fieldsForList: fn (int $listId) => $listId === 5 ? [$relationField] : [],
        );

        $result = $service->recordsScopeWhere(new WP_User(42), $invoicesList);

        $expectedSql = 'AND `id` IN (SELECT source_record_id FROM `' . self::RELATIONS_TABLE . '`'
            . ' WHERE field_id = %d AND target_record_id = %d)';
        $this->assertSame($expectedSql, $result['sql']);
        $this->assertSame([30, 7], $result['args'], 'Args: [field_id, client_record_id]');
    }

    public function test_non_portal_list_without_link_blocks_everything(): void
    {
        $portalList = $this->makePortalList(1, ownerFieldId: 10);
        $orphanList = $this->makeList(8, 'huerfana');

        // Esta lista tiene solo fields text/number, ningún vínculo
        // con el cliente. El portal NO debe exponerla.
        $textField = $this->makeField(40, listId: 8, slug: 'nombre', col: 'col_nombre', type: 'text');

        $service = $this->makeService(
            portalList: $portalList,
            clientRecord: ['id' => 7],
            fieldsForList: fn (int $listId) => $listId === 8 ? [$textField] : [],
        );

        $result = $service->recordsScopeWhere(new WP_User(42), $orphanList);

        $this->assertSame('AND 1=0', $result['sql']);
    }

    public function test_relation_field_with_wrong_target_does_not_match(): void
    {
        // Defensa: si una lista tiene un field relation a OTRA lista
        // (no la de portal), no debe contar como vínculo al cliente.
        // Fail-closed.
        $portalList = $this->makePortalList(1, ownerFieldId: 10);
        $invoicesList = $this->makeList(5, 'facturas');

        $relationToOtherList = $this->makeField(
            id: 30,
            listId: 5,
            slug: 'producto',
            col: 'col_producto',
            type: 'relation',
            config: ['target_list_id' => 99], // NO es la lista de portal (1)
        );

        $service = $this->makeService(
            portalList: $portalList,
            clientRecord: ['id' => 7],
            fieldsForList: fn (int $listId) => $listId === 5 ? [$relationToOtherList] : [],
        );

        $result = $service->recordsScopeWhere(new WP_User(42), $invoicesList);

        $this->assertSame('AND 1=0', $result['sql']);
    }

    public function test_user_field_preferred_over_relation_when_both_present(): void
    {
        // Si una lista tiene AMBOS un field user Y un field relation a
        // la lista de portal, ¿cuál gana? El service elige `user`
        // primero (es más directo, más rápido para el QueryBuilder).
        // Test del comportamiento documentado — si cambia el orden,
        // este test alerta.
        $portalList = $this->makePortalList(1, ownerFieldId: 10);
        $list = $this->makeList(5, 'mixta');

        $userField = $this->makeField(20, listId: 5, slug: 'asignado_a', col: 'col_asignado_a', type: 'user');
        $relationField = $this->makeField(
            id: 30,
            listId: 5,
            slug: 'cliente',
            col: 'col_cliente',
            type: 'relation',
            config: ['target_list_id' => 1],
        );

        $service = $this->makeService(
            portalList: $portalList,
            clientRecord: ['id' => 7],
            fieldsForList: fn () => [$userField, $relationField],
        );

        $result = $service->recordsScopeWhere(new WP_User(42), $list);

        // user_field gana → scope por user_id (42), no por relation.
        $this->assertStringContainsString('`col_asignado_a` = %d', $result['sql']);
        $this->assertSame([42], $result['args']);
    }

    public function test_soft_deleted_fields_are_ignored(): void
    {
        // Defensa: un field user soft-deleted no debe contar como
        // vínculo válido — el admin lo eliminó por algo.
        $portalList = $this->makePortalList(1, ownerFieldId: 10);
        $list = $this->makeList(5, 'lista');

        $deletedUserField = $this->makeField(
            id: 20,
            listId: 5,
            slug: 'old_user',
            col: 'col_old',
            type: 'user',
            deletedAt: '2026-04-01 00:00:00',
        );

        $service = $this->makeService(
            portalList: $portalList,
            clientRecord: ['id' => 7],
            fieldsForList: fn () => [$deletedUserField],
        );

        $result = $service->recordsScopeWhere(new WP_User(42), $list);

        $this->assertSame('AND 1=0', $result['sql']);
    }

    public function test_user_has_portal_returns_true_when_client_record_exists(): void
    {
        $portalList = $this->makePortalList(1, ownerFieldId: 10);
        $service = $this->makeService(
            portalList: $portalList,
            clientRecord: ['id' => 7],
            fieldsForList: fn () => [],
        );

        $this->assertTrue($service->userHasPortal(new WP_User(42)));
    }

    public function test_user_has_portal_returns_false_without_client_record(): void
    {
        $service = $this->makeService(
            portalList: $this->makePortalList(1, ownerFieldId: 10),
            clientRecord: null,
            fieldsForList: fn () => [],
        );

        $this->assertFalse($service->userHasPortal(new WP_User(42)));
    }

    public function test_client_record_with_zero_id_treated_as_invalid(): void
    {
        // Defensa contra mis-config: si el resolver devuelve un row
        // con id=0 (no debería pero defensivo), bloqueamos.
        $portalList = $this->makePortalList(1, ownerFieldId: 10);
        $service = $this->makeService(
            portalList: $portalList,
            clientRecord: ['id' => 0],
            fieldsForList: fn () => [],
        );

        $result = $service->recordsScopeWhere(new WP_User(42), $portalList);

        $this->assertSame('AND 1=0', $result['sql']);
    }

    // ───────────────────────────────────────────────────────────────────
    //  Helpers
    // ───────────────────────────────────────────────────────────────────

    /**
     * @param array<string, mixed>|null $clientRecord
     * @param callable(int): list<FieldEntity> $fieldsForList
     */
    private function makeService(
        ?ListEntity $portalList,
        ?array $clientRecord,
        callable $fieldsForList,
    ): PortalScopeService {
        $resolver = new class ($portalList, $clientRecord) implements ClientResolverInterface {
            /** @param array<string, mixed>|null $clientRecord */
            public function __construct(
                private readonly ?ListEntity $portalList,
                private readonly ?array $clientRecord,
            ) {
            }
            public function portalList(): ?ListEntity
            {
                return $this->portalList;
            }
            public function ownerField(ListEntity $portalList): ?FieldEntity
            {
                unset($portalList);
                return null; // No usado por PortalScopeService directamente.
            }
            public function clientRecordFor(WP_User $user): ?array
            {
                if ($user->ID <= 0) return null;
                return $this->clientRecord;
            }
        };

        return new PortalScopeService(
            $resolver,
            $fieldsForList,
            self::RELATIONS_TABLE,
        );
    }

    private function makeList(int $id, string $slug): ListEntity
    {
        return new ListEntity(
            id:          $id,
            slug:        $slug,
            tableSuffix: 'ts_' . $slug,
            name:        ucfirst($slug),
            description: null,
            icon:        null,
            color:       null,
            settings:    [],
            position:    0,
            createdBy:   1,
            createdAt:   '2026-05-17 00:00:00',
            updatedAt:   '2026-05-17 00:00:00',
            deletedAt:   null,
        );
    }

    private function makePortalList(int $id, int $ownerFieldId): ListEntity
    {
        return new ListEntity(
            id:          $id,
            slug:        'clientes',
            tableSuffix: 'ts_clientes',
            name:        'Clientes',
            description: null,
            icon:        null,
            color:       null,
            settings:    [
                'portal' => [
                    'enabled'        => true,
                    'owner_field_id' => $ownerFieldId,
                ],
            ],
            position:    0,
            createdBy:   1,
            createdAt:   '2026-05-17 00:00:00',
            updatedAt:   '2026-05-17 00:00:00',
            deletedAt:   null,
        );
    }

    /**
     * @param array<string, mixed> $config
     */
    private function makeField(
        int $id,
        int $listId,
        string $slug,
        string $col,
        string $type,
        array $config = [],
        ?string $deletedAt = null,
    ): FieldEntity {
        return new FieldEntity(
            id:          $id,
            listId:      $listId,
            slug:        $slug,
            columnName:  $col,
            label:       ucfirst($slug),
            type:        $type,
            config:      $config,
            isRequired:  false,
            isUnique:    false,
            isPrimary:   false,
            position:    0,
            createdAt:   '2026-05-17 00:00:00',
            updatedAt:   '2026-05-17 00:00:00',
            deletedAt:   $deletedAt,
        );
    }
}
