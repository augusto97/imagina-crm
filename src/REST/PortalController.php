<?php
declare(strict_types=1);

namespace ImaginaCRM\REST;

use ImaginaCRM\Lists\ListService;
use ImaginaCRM\Permissions\CapabilityRegistry;
use ImaginaCRM\Portal\ClientResolverInterface;
use ImaginaCRM\Portal\PortalConfig;
use ImaginaCRM\Portal\PortalScopeService;
use ImaginaCRM\Records\RecordService;
use ImaginaCRM\Support\ValidationResult;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

/**
 * REST controllers del portal del cliente (Fase 9 — 3.B).
 *
 * Endpoints (todos requieren cap `imcrm_access_portal` — `crm_client`
 * la tiene por default desde Fase 7):
 *
 *   GET /imagina-crm/v1/portal/me
 *       Devuelve el record del cliente actual + metadata del portal
 *       (template_id por configurar, etc.). 404 si el user no tiene
 *       record asociado en la lista de portal.
 *
 *   GET /imagina-crm/v1/portal/lists/{slug}/records
 *       Records de una lista visibles para el cliente. El scope SQL
 *       de PortalScopeService se inyecta automáticamente — el cliente
 *       NO puede ver records ajenos aunque la lista sea conocida.
 *
 *   GET /imagina-crm/v1/portal/lists/{slug}/records/{id}
 *       Detalle de un record. 404 si no está en el scope del cliente.
 *
 * Esta superficie es la que la SPA del portal (`app/portal.tsx`,
 * llega en Fase 9 — 3.F) consume. NO usa los endpoints del admin
 * (`/v1/lists/.../records`) porque esos exigen capabilities que el
 * cliente no tiene.
 */
final class PortalController extends AbstractController
{
    public function __construct(
        private readonly ClientResolverInterface $resolver,
        private readonly PortalScopeService $scope,
        private readonly ListService $lists,
        private readonly RecordService $records,
    ) {
        parent::__construct();
    }

    public function register_routes(): void
    {
        $canAccess = $this->requireCapability(CapabilityRegistry::CAP_ACCESS_PORTAL);

        register_rest_route($this->namespace, '/portal/me', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [$this, 'getMe'],
            'permission_callback' => $canAccess,
        ]);

        register_rest_route(
            $this->namespace,
            '/portal/lists/(?P<slug>[a-zA-Z0-9_-]+)/records',
            [
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => [$this, 'getRecords'],
                'permission_callback' => $canAccess,
                'args'                => [
                    'slug'     => ['type' => 'string'],
                    'page'     => ['type' => 'integer', 'default' => 1],
                    'per_page' => ['type' => 'integer', 'default' => 20],
                    'sort'     => ['type' => 'string'],
                    'search'   => ['type' => 'string'],
                ],
            ],
        );

        register_rest_route(
            $this->namespace,
            '/portal/lists/(?P<slug>[a-zA-Z0-9_-]+)/records/(?P<id>\d+)',
            [
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => [$this, 'getRecord'],
                'permission_callback' => $canAccess,
            ],
        );
    }

    public function getMe(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        unset($request);
        $user = wp_get_current_user();

        $portalList = $this->resolver->portalList();
        if ($portalList === null) {
            return $this->notFound(__('El portal del cliente no está configurado.', 'imagina-crm'));
        }

        $clientRecord = $this->resolver->clientRecordFor($user);
        if ($clientRecord === null) {
            return $this->notFound(__('Tu cuenta aún no está asociada a un cliente.', 'imagina-crm'));
        }

        // Refetch hidratado vía RecordService para que el cliente
        // reciba fields + relations en el shape estándar.
        $clientId = isset($clientRecord['id']) ? (int) $clientRecord['id'] : 0;
        $hydrated = $clientId > 0 ? $this->records->find($portalList, $clientId) : null;
        if ($hydrated === null) {
            return $this->notFound();
        }

        $portalConfig = PortalConfig::fromListSettings($portalList->settings);

        return new WP_REST_Response([
            'data' => [
                'list'   => [
                    'id'   => $portalList->id,
                    'slug' => $portalList->slug,
                    'name' => $portalList->name,
                ],
                'record' => $hydrated,
                'user'   => [
                    'id'           => $user->ID,
                    'display_name' => $user->display_name,
                    'email'        => $user->user_email,
                ],
                'template_id' => $portalConfig->defaultTemplateId,
            ],
        ]);
    }

    public function getRecords(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $list = $this->lists->findByIdOrSlug((string) $request->get_param('slug'));
        if ($list === null) {
            return $this->notFound();
        }

        $user = wp_get_current_user();
        $scope = $this->scope->recordsScopeWhere($user, $list);

        // Si el scope ya bloquea todo (1=0), igual seguimos la query —
        // el cliente recibe `data: []` y el meta apropiado. Más
        // predecible para el frontend que un 404.

        $page    = max(1, (int) ($request->get_param('page') ?? 1));
        $perPage = max(1, min(100, (int) ($request->get_param('per_page') ?? 20)));
        $sort    = $this->parseSort($request->get_param('sort'));
        $search  = $request->get_param('search');
        $search  = is_string($search) ? $search : null;

        $result = $this->records->list(
            list:            $list,
            filters:         [],
            sort:            $sort,
            fields:          [],
            search:          $search,
            page:            $page,
            perPage:         $perPage,
            filterTree:      null,
            cursor:          null,
            additionalWhere: $scope,
        );
        if ($result instanceof ValidationResult) {
            return $this->validationError($result);
        }

        return new WP_REST_Response($result);
    }

    public function getRecord(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $list = $this->lists->findByIdOrSlug((string) $request->get_param('slug'));
        if ($list === null) {
            return $this->notFound();
        }

        $recordId = (int) $request->get_param('id');
        if ($recordId <= 0) {
            return $this->notFound();
        }

        $user = wp_get_current_user();
        $scope = $this->scope->recordsScopeWhere($user, $list);

        // Estrategia para visibility per-record: cargamos el record
        // por id directamente y verificamos contra el scope. Más eficiente
        // que ejecutar list() con un filtro de id (que pasaría por todo
        // el pipeline). El scope se evalúa mentalmente:
        //  - Lista de portal: scope['args'][0] DEBE ser el id pedido.
        //  - Lista con user field: el record DEBE tener user_id == col.
        //  - Lista con relation: tenemos que mirar la tabla relations.
        //  - Lista sin vínculo: 1=0 → siempre 404.
        //
        // Para 3.B simplificamos: usamos `list()` con additionalWhere
        // del scope + un filtro extra `id=%d`. Es UN solo round-trip
        // y reusa toda la lógica del QueryBuilder.
        $additional = $this->mergeScopeWithIdFilter($scope, $recordId);
        $result = $this->records->list(
            list:            $list,
            filters:         [],
            sort:            [],
            fields:          [],
            search:          null,
            page:            1,
            perPage:         1,
            filterTree:      null,
            cursor:          null,
            additionalWhere: $additional,
        );
        if ($result instanceof ValidationResult || ! isset($result['data'][0])) {
            return $this->notFound();
        }

        return new WP_REST_Response(['data' => $result['data'][0]]);
    }

    /**
     * Concatena la cláusula del scope con un filtro de id específico.
     * Resultado: `AND id = %d <scope.sql>` con args `[id, ...scope.args]`.
     *
     * @param array{sql: string, args: list<mixed>} $scope
     * @return array{sql: string, args: list<mixed>}
     */
    private function mergeScopeWithIdFilter(array $scope, int $recordId): array
    {
        $sql = 'AND `id` = %d';
        $args = [$recordId];
        if ($scope['sql'] !== '') {
            $sql .= ' ' . $scope['sql'];
            foreach ($scope['args'] as $a) {
                $args[] = $a;
            }
        }
        return ['sql' => $sql, 'args' => $args];
    }

    /**
     * @param mixed $raw
     * @return list<array{slug:string, dir:string}>
     */
    private function parseSort(mixed $raw): array
    {
        if (! is_string($raw) || $raw === '') {
            return [];
        }
        $out = [];
        foreach (explode(',', $raw) as $piece) {
            $parts = explode(':', trim($piece), 2);
            $slug = trim($parts[0] ?? '');
            $dir = strtolower(trim($parts[1] ?? 'asc'));
            if ($slug !== '') {
                $out[] = ['slug' => $slug, 'dir' => $dir === 'desc' ? 'desc' : 'asc'];
            }
        }
        return $out;
    }
}
