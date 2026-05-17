<?php
declare(strict_types=1);

namespace ImaginaCRM\REST;

use ImaginaCRM\Lists\ListService;
use ImaginaCRM\Permissions\CapabilityRegistry;
use ImaginaCRM\Permissions\PermissionService;
use ImaginaCRM\Records\RecordAggregator;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

/**
 * REST controller para `/imagina-crm/v1/lists/{list}/records/aggregates`.
 *
 * Devuelve `{totals: {slug: agg}, groups: [{value, aggregates}]}`
 * envuelto en `{data: ...}` (mismo envelope que el resto del API).
 *
 * Query params:
 *   - `fields`        — CSV de field IDs a agregar.
 *   - `filter_tree`   — JSON con el filtro activo (mismo shape que en /records).
 *   - `group_by`      — field ID del campo de agrupación (opcional, para
 *                       footer por bucket en GroupedTableView).
 */
final class AggregatesController extends AbstractController
{
    public function __construct(
        private readonly RecordAggregator $aggregator,
        private readonly ListService $lists,
        private readonly PermissionService $permissions,
    ) {
        parent::__construct();
    }

    public function register_routes(): void
    {
        register_rest_route(
            $this->namespace,
            '/lists/(?P<list>[a-zA-Z0-9_-]+)/records/aggregates',
            [
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => [$this, 'aggregate'],
                'permission_callback' => $this->requireAnyCapability(
                    CapabilityRegistry::CAP_VIEW_RECORDS,
                    CapabilityRegistry::CAP_VIEW_OWN_RECORDS,
                ),
            ],
        );
    }

    public function aggregate(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $list = $this->lists->findByIdOrSlug((string) $request->get_param('list'));
        if ($list === null) {
            return $this->notFound(__('Lista no encontrada.', 'imagina-crm'));
        }
        $user = wp_get_current_user();
        if (! $this->permissions->userCanSeeList($user, $list)) {
            return $this->notFound(__('Lista no encontrada.', 'imagina-crm'));
        }
        // RecordAggregator todavía no soporta inyección de scope SQL.
        // Para no exponer agregados sobre records ajenos, bloqueamos el
        // endpoint a usuarios con scope acotado. Refactor pendiente
        // (ver docs/multi-stakeholder-design.md §1.D — extender
        // RecordAggregator con additionalWhere y devolver agregados
        // limitados al scope del user).
        if (
            ! $this->permissions->userIsPluginAdmin($user)
            && $this->permissions->recordsScopeWhere($user, $list)['sql'] !== ''
        ) {
            return $this->forbidden(__(
                'Agregados sobre records limitados por scope aún no están soportados para tu rol.',
                'imagina-crm'
            ));
        }

        $rawFields = (string) ($request->get_param('fields') ?? '');
        $fieldIds  = array_values(array_filter(
            array_map('intval', explode(',', $rawFields)),
            static fn (int $id): bool => $id > 0,
        ));
        if ($fieldIds === []) {
            return new WP_REST_Response(['data' => ['totals' => [], 'groups' => []]]);
        }

        $rawTree    = $request->get_param('filter_tree');
        $filterTree = null;
        if (is_string($rawTree) && $rawTree !== '') {
            $decoded = json_decode($rawTree, true);
            if (is_array($decoded) && ($decoded['type'] ?? '') === 'group') {
                $filterTree = $decoded;
            }
        } elseif (is_array($rawTree) && ($rawTree['type'] ?? '') === 'group') {
            $filterTree = $rawTree;
        }

        $groupBy = $request->get_param('group_by');
        $groupBy = is_numeric($groupBy) ? (int) $groupBy : null;
        if ($groupBy !== null && $groupBy <= 0) {
            $groupBy = null;
        }

        $result = $this->aggregator->aggregate($list, $fieldIds, $filterTree, $groupBy);

        return new WP_REST_Response(['data' => $result]);
    }
}
