<?php
declare(strict_types=1);

namespace ImaginaCRM\REST;

use ImaginaCRM\Fields\FieldEntity;
use ImaginaCRM\Fields\FieldService;
use ImaginaCRM\Lists\ListService;
use ImaginaCRM\Support\ValidationResult;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

/**
 * REST controller para `/imagina-crm/v1/lists/{list}/fields`.
 *
 * `{list}` acepta ID o slug y se resuelve vía `ListService` (incluido el
 * historial de slugs). Los `{id_or_slug}` de campo siguen el mismo patrón.
 */
final class FieldsController extends AbstractController
{
    public function __construct(
        private readonly FieldService $service,
        private readonly ListService $lists,
    ) {
        parent::__construct();
    }

    public function register_routes(): void
    {
        $base = 'lists/(?P<list>[a-zA-Z0-9_-]+)/fields';

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

        register_rest_route($this->namespace, '/' . $base . '/reorder', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [$this, 'reorder'],
            'permission_callback' => [$this, 'checkAdminPermissions'],
        ]);

        register_rest_route($this->namespace, '/' . $base . '/(?P<id_or_slug>[a-zA-Z0-9_-]+)', [
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
                'args'                => [
                    'purge' => ['type' => 'boolean', 'default' => false],
                ],
            ],
        ]);
    }

    public function getCollection(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $list = $this->lists->findByIdOrSlug((string) $request->get_param('list'));
        if ($list === null) {
            return $this->notFound(__('Lista no encontrada.', 'imagina-crm'));
        }

        $items = array_map(
            static fn (FieldEntity $f): array => $f->toArray(includePhysical: true),
            $this->service->allForList($list->id)
        );

        return new WP_REST_Response(['data' => $items]);
    }

    public function getItem(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $list = $this->lists->findByIdOrSlug((string) $request->get_param('list'));
        if ($list === null) {
            return $this->notFound(__('Lista no encontrada.', 'imagina-crm'));
        }

        $idOrSlug = (string) $request->get_param('id_or_slug');
        $field    = $this->service->findByIdOrSlug($list->id, $idOrSlug);

        if ($field === null) {
            return $this->notFound();
        }

        $response = new WP_REST_Response(['data' => $field->toArray(includePhysical: true)]);

        if (! ctype_digit($idOrSlug) && strtolower($idOrSlug) !== $field->slug) {
            $response->header(
                'X-Imagina-CRM-Slug-Renamed',
                'old=' . strtolower($idOrSlug) . ',new=' . $field->slug
            );
        }
        return $response;
    }

    public function createItem(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $list = $this->lists->findByIdOrSlug((string) $request->get_param('list'));
        if ($list === null) {
            return $this->notFound(__('Lista no encontrada.', 'imagina-crm'));
        }

        $params = $request->get_json_params();
        if (! is_array($params)) {
            $params = $request->get_params();
        }

        $payload = [
            'label'       => (string) ($params['label'] ?? ''),
            'type'        => (string) ($params['type'] ?? ''),
            'slug'        => isset($params['slug']) ? (string) $params['slug'] : '',
            'config'      => is_array($params['config'] ?? null) ? $params['config'] : [],
            'is_required' => ! empty($params['is_required']),
            'is_unique'   => ! empty($params['is_unique']),
            'is_primary'  => ! empty($params['is_primary']),
        ];

        if (isset($params['position']) && is_numeric($params['position'])) {
            $payload['position'] = (int) $params['position'];
        }

        $result = $this->service->create($list->id, $payload);
        if ($result instanceof ValidationResult) {
            return $this->validationError($result);
        }

        return new WP_REST_Response(['data' => $result->toArray(includePhysical: true)], 201);
    }

    public function updateItem(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $list = $this->lists->findByIdOrSlug((string) $request->get_param('list'));
        if ($list === null) {
            return $this->notFound(__('Lista no encontrada.', 'imagina-crm'));
        }

        $idOrSlug = (string) $request->get_param('id_or_slug');
        $existing = $this->service->findByIdOrSlug($list->id, $idOrSlug);
        if ($existing === null) {
            return $this->notFound();
        }

        $params = $request->get_json_params();
        if (! is_array($params)) {
            $params = $request->get_params();
        }

        $renamed = null;
        if (isset($params['slug']) && is_string($params['slug'])) {
            $renameResult = $this->service->renameSlug($list->id, $existing->id, $params['slug']);
            if (! $renameResult->success) {
                return $this->validationError($renameResult->validation);
            }
            if ($renameResult->oldSlug !== $renameResult->newSlug) {
                $renamed = $renameResult;
            }
        }

        $patch = array_intersect_key(
            $params,
            array_flip(['label', 'config', 'is_required', 'is_unique', 'is_primary', 'position'])
        );

        if ($patch !== []) {
            $result = $this->service->update($list->id, $existing->id, $patch);
            if ($result instanceof ValidationResult) {
                return $this->validationError($result);
            }
            $entity = $result;
        } else {
            $entity = $this->service->findByIdOrSlug($list->id, (string) $existing->id);
            if ($entity === null) {
                return $this->notFound();
            }
        }

        $response = new WP_REST_Response(['data' => $entity->toArray(includePhysical: true)]);
        if ($renamed !== null) {
            $response->header(
                'X-Imagina-CRM-Slug-Renamed',
                'old=' . $renamed->oldSlug . ',new=' . $renamed->newSlug
            );
        }
        return $response;
    }

    public function deleteItem(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $list = $this->lists->findByIdOrSlug((string) $request->get_param('list'));
        if ($list === null) {
            return $this->notFound(__('Lista no encontrada.', 'imagina-crm'));
        }

        $field = $this->service->findByIdOrSlug($list->id, (string) $request->get_param('id_or_slug'));
        if ($field === null) {
            return $this->notFound();
        }

        $purge  = (bool) $request->get_param('purge');
        $result = $this->service->delete($list->id, $field->id, $purge);

        if (! $result->isValid()) {
            return $this->validationError($result, 500);
        }

        return new WP_REST_Response(['data' => ['id' => $field->id, 'purged' => $purge]], 200);
    }

    public function reorder(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $list = $this->lists->findByIdOrSlug((string) $request->get_param('list'));
        if ($list === null) {
            return $this->notFound(__('Lista no encontrada.', 'imagina-crm'));
        }

        $params = $request->get_json_params();
        if (! is_array($params) || ! isset($params['order']) || ! is_array($params['order'])) {
            return new WP_Error('imcrm_bad_payload', __('Falta el array order.', 'imagina-crm'), ['status' => 400]);
        }

        /** @var array<int, int> $order */
        $order  = [];
        foreach ($params['order'] as $entry) {
            if (! is_array($entry)) {
                continue;
            }
            $id  = isset($entry['id']) ? (int) $entry['id'] : 0;
            $pos = isset($entry['position']) ? (int) $entry['position'] : 0;
            if ($id > 0) {
                $order[$id] = $pos;
            }
        }

        $result = $this->service->reorder($list->id, $order);
        if (! $result->isValid()) {
            return $this->validationError($result);
        }

        return new WP_REST_Response(['data' => ['ok' => true, 'count' => count($order)]]);
    }
}
