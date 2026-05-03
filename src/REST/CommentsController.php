<?php
declare(strict_types=1);

namespace ImaginaCRM\REST;

use ImaginaCRM\Comments\CommentEntity;
use ImaginaCRM\Comments\CommentService;
use ImaginaCRM\Lists\ListService;
use ImaginaCRM\Plugin;
use ImaginaCRM\Support\ValidationResult;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

/**
 * REST para `/imagina-crm/v1/lists/{list}/records/{record}/comments`.
 *
 * Permisos:
 * - Lectura/creación: `manage_options` (mismo umbral del resto del plugin
 *   en Fase 1; granularidad de roles llega en Fase futura).
 * - Edición/eliminación: el `CommentService` valida que sea autor o admin.
 *   Aquí en el controller `manage_options` ya implica "admin" para el
 *   service.
 */
final class CommentsController extends AbstractController
{
    public function __construct(
        private readonly CommentService $service,
        private readonly ListService $lists,
    ) {
        parent::__construct();
    }

    public function register_routes(): void
    {
        $base = 'lists/(?P<list>[a-zA-Z0-9_-]+)/records/(?P<record>\d+)/comments';

        register_rest_route($this->namespace, '/' . $base, [
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

        register_rest_route($this->namespace, '/' . $base . '/(?P<id>\d+)', [
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

    public function getCollection(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $list = $this->lists->findByIdOrSlug((string) $request->get_param('list'));
        if ($list === null) {
            return $this->notFound(__('Lista no encontrada.', 'imagina-crm'));
        }
        $recordId = (int) $request->get_param('record');

        $items = array_map(
            static fn (CommentEntity $c): array => $c->toArray(),
            $this->service->allForRecord($list->id, $recordId),
        );
        return new WP_REST_Response(['data' => $items]);
    }

    public function createItem(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $list = $this->lists->findByIdOrSlug((string) $request->get_param('list'));
        if ($list === null) {
            return $this->notFound(__('Lista no encontrada.', 'imagina-crm'));
        }
        $recordId = (int) $request->get_param('record');

        $params = $request->get_json_params();
        if (! is_array($params)) {
            $params = $request->get_params();
        }

        $result = $this->service->create($list->id, $recordId, get_current_user_id(), $params);
        if ($result instanceof ValidationResult) {
            return $this->validationError($result);
        }
        return new WP_REST_Response(['data' => $result->toArray()], 201);
    }

    public function updateItem(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $id      = (int) $request->get_param('id');
        $params  = $request->get_json_params();
        if (! is_array($params)) {
            $params = $request->get_params();
        }
        $content  = isset($params['content']) ? (string) $params['content'] : '';
        $metadata = $params['metadata'] ?? null;

        $result = $this->service->update(
            $id,
            get_current_user_id(),
            current_user_can(Plugin::ADMIN_CAPABILITY),
            $content,
            $metadata,
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
     * `forbidden` y `id` (not found) son shapes especiales: 403 / 404 en
     * lugar del 422 del validation error genérico.
     */
    private function serviceError(ValidationResult $result): WP_Error
    {
        if (array_key_exists('forbidden', $result->errors())) {
            return new WP_Error('imcrm_forbidden', $result->firstError() ?? '', ['status' => 403]);
        }
        if (array_key_exists('id', $result->errors())) {
            return $this->notFound($result->firstError() ?? '');
        }
        return $this->validationError($result);
    }
}
