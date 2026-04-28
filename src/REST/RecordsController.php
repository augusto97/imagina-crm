<?php
declare(strict_types=1);

namespace ImaginaCRM\REST;

use ImaginaCRM\Lists\ListService;
use ImaginaCRM\Records\RecordService;
use ImaginaCRM\Support\ValidationResult;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

/**
 * REST controller para `/imagina-crm/v1/lists/{list}/records`.
 *
 * Acepta los query params definidos en CLAUDE.md §9.3:
 * filter[slug][op]=value, sort=slug:dir, search, fields, page, per_page.
 * El parsing vive aquí; toda la lógica de SQL en `QueryBuilder`.
 */
final class RecordsController extends AbstractController
{
    public function __construct(
        private readonly RecordService $service,
        private readonly ListService $lists,
    ) {
        parent::__construct();
    }

    public function register_routes(): void
    {
        $base = 'lists/(?P<list>[a-zA-Z0-9_-]+)/records';

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

        register_rest_route($this->namespace, '/' . $base . '/bulk', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [$this, 'bulk'],
            'permission_callback' => [$this, 'checkAdminPermissions'],
        ]);

        register_rest_route($this->namespace, '/' . $base . '/(?P<id>\d+)', [
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
                'args'                => ['purge' => ['type' => 'boolean', 'default' => false]],
            ],
        ]);
    }

    public function getCollection(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $list = $this->lists->findByIdOrSlug((string) $request->get_param('list'));
        if ($list === null) {
            return $this->notFound(__('Lista no encontrada.', 'imagina-crm'));
        }

        $page    = max(1, (int) ($request->get_param('page') ?? 1));
        $perPage = max(1, (int) ($request->get_param('per_page') ?? 50));
        $search  = $request->get_param('search');
        $search  = is_string($search) ? $search : null;

        $filters = $request->get_param('filter');
        $filters = is_array($filters) ? $filters : [];

        $sort = $this->parseSort($request->get_param('sort'));
        $proj = $this->parseFields($request->get_param('fields'));

        $result = $this->service->list($list, $filters, $sort, $proj, $search, $page, $perPage);
        if ($result instanceof ValidationResult) {
            return $this->validationError($result);
        }

        return new WP_REST_Response($result);
    }

    public function getItem(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $list = $this->lists->findByIdOrSlug((string) $request->get_param('list'));
        if ($list === null) {
            return $this->notFound(__('Lista no encontrada.', 'imagina-crm'));
        }

        $id     = (int) $request->get_param('id');
        $record = $this->service->find($list, $id);
        if ($record === null) {
            return $this->notFound();
        }
        return new WP_REST_Response(['data' => $record]);
    }

    public function createItem(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $list = $this->lists->findByIdOrSlug((string) $request->get_param('list'));
        if ($list === null) {
            return $this->notFound(__('Lista no encontrada.', 'imagina-crm'));
        }

        $values = $this->extractValues($request);
        $result = $this->service->create($list, $values);
        if ($result instanceof ValidationResult) {
            return $this->validationError($result);
        }
        return new WP_REST_Response(['data' => $result], 201);
    }

    public function updateItem(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $list = $this->lists->findByIdOrSlug((string) $request->get_param('list'));
        if ($list === null) {
            return $this->notFound(__('Lista no encontrada.', 'imagina-crm'));
        }

        $id     = (int) $request->get_param('id');
        $values = $this->extractValues($request);
        $result = $this->service->update($list, $id, $values);
        if ($result instanceof ValidationResult) {
            return $this->validationError($result);
        }
        return new WP_REST_Response(['data' => $result]);
    }

    public function deleteItem(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $list = $this->lists->findByIdOrSlug((string) $request->get_param('list'));
        if ($list === null) {
            return $this->notFound(__('Lista no encontrada.', 'imagina-crm'));
        }

        $id     = (int) $request->get_param('id');
        $purge  = (bool) $request->get_param('purge');
        $result = $this->service->delete($list, $id, $purge);
        if (! $result->isValid()) {
            return $this->validationError($result);
        }
        return new WP_REST_Response(['data' => ['id' => $id, 'purged' => $purge]]);
    }

    public function bulk(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $list = $this->lists->findByIdOrSlug((string) $request->get_param('list'));
        if ($list === null) {
            return $this->notFound(__('Lista no encontrada.', 'imagina-crm'));
        }

        $params = $request->get_json_params();
        if (! is_array($params)) {
            $params = $request->get_params();
        }

        $action = (string) ($params['action'] ?? '');
        $ids    = is_array($params['ids'] ?? null) ? $params['ids'] : [];
        $values = is_array($params['values'] ?? null) ? $params['values'] : [];

        if (! in_array($action, ['delete', 'update'], true)) {
            return new WP_Error('imcrm_bad_action', __('action debe ser delete o update.', 'imagina-crm'), ['status' => 400]);
        }
        if ($ids === []) {
            return new WP_Error('imcrm_no_ids', __('Falta la lista de IDs.', 'imagina-crm'), ['status' => 400]);
        }

        $result = $this->service->bulk($list, $action, array_map('intval', $ids), $values);
        return new WP_REST_Response(['data' => $result]);
    }

    /**
     * @return array<string, mixed>
     */
    private function extractValues(WP_REST_Request $request): array
    {
        $params = $request->get_json_params();
        if (! is_array($params)) {
            $params = $request->get_params();
        }
        // Aceptamos `fields: {slug: value}` o el envelope plano (excluyendo
        // metadatos del sistema).
        if (isset($params['fields']) && is_array($params['fields'])) {
            return $params['fields'];
        }
        $reserved = ['list', 'id', 'page', 'per_page', 'search', 'filter', 'sort'];
        return array_diff_key($params, array_flip($reserved));
    }

    /**
     * Acepta `slug:dir,otro:asc` o simplemente `slug` (asc por defecto).
     *
     * @param mixed $raw
     * @return array<int, array{slug:string, dir:string}>
     */
    private function parseSort(mixed $raw): array
    {
        if (! is_string($raw) || $raw === '') {
            return [];
        }
        $out = [];
        foreach (explode(',', $raw) as $piece) {
            $piece = trim($piece);
            if ($piece === '') {
                continue;
            }
            $parts = explode(':', $piece, 2);
            $slug  = trim($parts[0] ?? '');
            $dir   = strtolower(trim($parts[1] ?? 'asc'));
            if ($slug !== '') {
                $out[] = ['slug' => $slug, 'dir' => $dir === 'desc' ? 'desc' : 'asc'];
            }
        }
        return $out;
    }

    /**
     * @param mixed $raw
     * @return array<int, string>
     */
    private function parseFields(mixed $raw): array
    {
        if (! is_string($raw) || $raw === '') {
            return [];
        }
        $out = [];
        foreach (explode(',', $raw) as $piece) {
            $piece = trim($piece);
            if ($piece !== '') {
                $out[] = $piece;
            }
        }
        return $out;
    }
}
