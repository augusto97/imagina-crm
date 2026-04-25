<?php
declare(strict_types=1);

namespace ImaginaCRM\REST;

use ImaginaCRM\Dashboards\DashboardEntity;
use ImaginaCRM\Dashboards\DashboardService;
use ImaginaCRM\Plugin;
use ImaginaCRM\Support\ValidationResult;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

/**
 * REST controller para `/imagina-crm/v1/dashboards[/{id}]`.
 *
 * Permisos:
 * - Lectura: el service ya filtra por `user_id` actual + compartidos.
 * - Mutación: el service valida que sea dueño o admin.
 */
final class DashboardsController extends AbstractController
{
    public function __construct(private readonly DashboardService $service)
    {
        parent::__construct();
    }

    public function register_routes(): void
    {
        register_rest_route($this->namespace, '/dashboards', [
            [
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => [$this, 'getCollection'],
                'permission_callback' => [$this, 'checkAdminPermissions'],
            ],
            [
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => [$this, 'createItem'],
                'permission_callback' => [$this, 'checkAdminPermissions'],
            ],
        ]);

        register_rest_route($this->namespace, '/dashboards/(?P<id>\d+)', [
            [
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => [$this, 'getItem'],
                'permission_callback' => [$this, 'checkAdminPermissions'],
            ],
            [
                'methods'             => WP_REST_Server::EDITABLE,
                'callback'            => [$this, 'updateItem'],
                'permission_callback' => [$this, 'checkAdminPermissions'],
            ],
            [
                'methods'             => WP_REST_Server::DELETABLE,
                'callback'            => [$this, 'deleteItem'],
                'permission_callback' => [$this, 'checkAdminPermissions'],
            ],
        ]);
    }

    public function getCollection(WP_REST_Request $request): WP_REST_Response
    {
        unset($request);
        $userId = get_current_user_id();
        $items = array_map(
            static fn (DashboardEntity $d): array => $d->toArray(),
            $this->service->visibleFor($userId),
        );
        return new WP_REST_Response(['data' => $items]);
    }

    public function getItem(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $id = (int) $request->get_param('id');
        $dashboard = $this->service->find($id);
        if ($dashboard === null) {
            return $this->notFound(__('Dashboard no encontrado.', 'imagina-crm'));
        }
        // Filtro de visibilidad: si es privado de otro usuario y el actual
        // no es admin, devolvemos 404 (no exponemos su existencia).
        $userId = get_current_user_id();
        $isAdmin = current_user_can(Plugin::ADMIN_CAPABILITY);
        if ($dashboard->userId !== null && $dashboard->userId !== $userId && ! $isAdmin) {
            return $this->notFound(__('Dashboard no encontrado.', 'imagina-crm'));
        }
        return new WP_REST_Response(['data' => $dashboard->toArray()]);
    }

    public function createItem(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $params = $request->get_json_params();
        if (! is_array($params)) {
            $params = $request->get_params();
        }

        $result = $this->service->create($params, get_current_user_id());
        if ($result instanceof ValidationResult) {
            return $this->validationError($result);
        }
        return new WP_REST_Response(['data' => $result->toArray()], 201);
    }

    public function updateItem(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $id     = (int) $request->get_param('id');
        $params = $request->get_json_params();
        if (! is_array($params)) {
            $params = $request->get_params();
        }

        $result = $this->service->update(
            $id,
            $params,
            get_current_user_id(),
            current_user_can(Plugin::ADMIN_CAPABILITY),
        );
        if ($result instanceof ValidationResult) {
            return $this->serviceError($result);
        }
        return new WP_REST_Response(['data' => $result->toArray()]);
    }

    public function deleteItem(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $id = (int) $request->get_param('id');
        $result = $this->service->delete(
            $id,
            get_current_user_id(),
            current_user_can(Plugin::ADMIN_CAPABILITY),
        );
        if (! $result->isValid()) {
            return $this->serviceError($result);
        }
        return new WP_REST_Response(['data' => ['id' => $id]]);
    }

    /**
     * Mapea los errores especiales del service a status HTTP correctos:
     * - `forbidden` → 403
     * - `id` (not found) → 404
     */
    private function serviceError(ValidationResult $result): WP_Error
    {
        $errors = $result->errors();
        if (array_key_exists('forbidden', $errors)) {
            return new WP_Error('imcrm_forbidden', $result->firstError() ?? '', ['status' => 403]);
        }
        if (array_key_exists('id', $errors)) {
            return $this->notFound($result->firstError() ?? '');
        }
        return $this->validationError($result);
    }
}
